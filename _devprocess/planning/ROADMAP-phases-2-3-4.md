# Roadmap: Phase 2, 3 & 4 -- Handoff-Dokument

> Erstellt: 2026-03-29
> Kontext: Kritisches Feature-Review (60.207 LOC Analyse) mit strategischer Neuausrichtung als Hybrid-Gateway.
> Phase 1 (Verschlanken) wird direkt umgesetzt.
> Phase 2, 3 & 4 durchlaufen den V-Model Workflow: BA -> RE -> Architektur -> Implementierung -> Test

---

## Strategische Vision

**Hybrid-Gateway:** Obsilo soll beides exzellent koennen:
1. **Standalone in Obsidian**: Waehrend der Arbeit in Obsidian kein anderes Tool vermissen
2. **Via Connector (MCP)**: Waehrend der Arbeit in Claude die Obsilo-Features nicht vermissen

Beide Modi teilen denselben Tool-Kern. Unterschied: eigener Agent-Loop (Standalone) vs. exponierte Tools (Connector/MCP-Server).

## Kern-Differenzierung (Was nur Obsilo kann)

| Faehigkeit | Tools | LOC | Warum einzigartig |
|------------|-------|-----|-------------------|
| Vault-Operationen | read_file, write_file, edit_file etc. | ~2.500 | Direkter Obsidian-API-Zugang |
| Plugin-Steuerung | execute_command, call_plugin_api, enable_plugin | ~600 | Kein externer Client kann Obsidian-Plugins aufrufen |
| VaultDNA + Plugin-Skills | VaultDNAScanner, SkillRegistry, CapabilityGapResolver | ~2.700 | Erkennt installierte Plugins, macht sie agentisch nutzbar |
| Semantic Vault Search | semantic_search (Vectra) | 1.079 | Embedding-Index ueber den gesamten Vault |
| Canvas/Excalidraw | generate_canvas, create_excalidraw | ~400 | Obsidian-native Formate |
| Checkpoints | isomorphic-git Shadow-Versioning | ~400 | Undo/Redo auf Vault-Ebene |
| Office-Dokumente | create_docx, create_xlsx, (create_pptx reduziert) | ~900 | Binaere Formate direkt in den Vault schreiben |
| Sandbox (Vault-scoped) | evaluate_expression, custom_* Tools | 1.758 | Sichere Batch-Ops ueber 5+ Dateien mit Security-Garantien |
| Memory (Vault-gebunden) | MemoryService, SessionExtractor, LongTermExtractor | 1.280 | Was der Agent ueber diesen Vault gelernt hat |
| Mastery/Recipes | RecipeStore, RecipeMatchingService, EpisodicExtractor | 1.027 | Selbstlernendes System, 300-1000 Token/Task Ersparnis |

---

## Phase 2: Stabilisieren (Code-Qualitaet)

> V-Model Workflow: BA -> RE -> Architektur (ADRs) -> Implementierung -> Test

### 2a. AgentSidebarView aufteilen (3.808 LOC Monolith)

**Probleme identifiziert (Code-Review 2026-03-29):**
- 27 Imports, 156 Event-Listener ohne Cleanup
- `conversationHistory[]` und `uiMessages[]` wachsen unbegrenzt -- Memory-Leak bei langen Sessions
- Kein `onunload()` Cleanup fuer Event-Listener
- Mehrere Verantwortlichkeiten: DOM-Rendering, State-Management, Event-Handling, Task-Ausfuehrung

**Empfohlene Aufteiling (aus Analyse):**
```
AgentSidebarView.ts (Facade, ~400 LOC)
+-- ChatMessageRenderer.ts (Nachrichten-Rendering)
+-- ChatInputManager.ts (Input + Toolbar-Handling)
+-- ConversationStateManager.ts (History + Context)
+-- SidebarEventBridge.ts (Event-Delegation)
```

**Kritische Fixes:**
- `onunload()` implementieren mit Event-Listener Cleanup
- `conversationHistory[]` und `uiMessages[]` begrenzen (Pruning/Paging)
- DOM-Virtualisierung fuer lange Chats (nur sichtbare Messages rendern)

**Risiko:** Hoch. Zentrale UI-Komponente, alle Chat-Funktionen gehen durch diese Datei.

**Datei:** `src/ui/AgentSidebarView.ts` (3.808 LOC)
**Abhaengig von:** Kein externer Blocker, aber alle UI-Features muessen nach Refactoring funktionieren.

### 2b. main.ts Service-Entkopplung (1.288 LOC, 52 Imports)

**Problem:** Alle 30+ Services werden direkt instantiiert. Bidirektionale Kopplung: Services kennen Plugin, Plugin kennt Services.

**Empfehlung:** ServiceContainer oder Factory Pattern:
```typescript
class ServiceContainer {
  register<T>(name: string, factory: () => T): void
  resolve<T>(name: string): T
}
```

**Datei:** `src/main.ts` (1.288 LOC, 52 Imports)
**Risiko:** Mittel. Betrifft die Initialisierungsreihenfolge aller Services.

### 2c. Office-Tool Duplikation bereinigen

**Duplikation identifiziert:**
- `CreateDocxTool.ts` (481 LOC) und `CreatePptxTool.ts` (367 LOC): Identische Color-Resolution (`resolveHexColor` vs `toHex`), Theme-Parsing, Default-Konstanten
- Search-Tools (`SearchFilesTool`, `SemanticSearchTool`, `SearchByTagTool`): Aehnliche Input-Validierung und File-Iteration

**Empfehlung:** Gemeinsame Utility:
```
src/core/tools/helpers/documentFormatting.ts -- resolveColor(), DEFAULT_COLORS
src/core/tools/helpers/searchBase.ts -- validatePath(), getFilesInPath()
```

**Risiko:** Niedrig.

### 2d. learnedRecipesEnabled Guard verdrahten

**Problem:** Setting existiert (`mastery.learnedRecipesEnabled`, default jetzt `true`), wird aber nirgendwo als Guard geprueft.

**Loesung:**
- `RecipeStore.getAll()`: Learned Recipes filtern wenn disabled (neuer `getLearnedEnabled` Constructor-Param)
- `RecipePromotionService.checkForPromotion()`: Early-Return wenn disabled (verhindert LLM-Calls)
- `main.ts`: Lambda `() => this.settings.mastery.learnedRecipesEnabled` an beide Services
- Episodes werden IMMER aufgezeichnet (unabhaengig vom Toggle)
- Kein Datenverlust: Learned Recipes bleiben auf Disk, werden bei Toggle sofort verfuegbar

**Dateien:**
- `src/core/mastery/RecipeStore.ts` (126 LOC)
- `src/core/mastery/RecipePromotionService.ts` (208 LOC)
- `src/main.ts` (Zeile ~403-431)

**Risiko:** Niedrig.

---

## Phase 3: Connector bauen (EPIC-014)

> V-Model Workflow: BA (existiert) -> RE (Feature-Specs schreiben) -> Architektur (ADRs) -> Implementierung -> Test
> Referenz: `_devprocess/requirements/epics/EPIC-014-mcp-connector.md`
> Referenz: `_devprocess/analysis/BA-MCP-CONNECTOR.md`

### Bereits vorhanden
- EPIC-014 mit 12 Features (FEATURE-1400 bis FEATURE-1411)
- Business-Analyse (BA-MCP-CONNECTOR.md)
- Epic Hypothesis Statement, Business Outcomes, Leading Indicators
- Dependencies & Risks Matrix

### Noch zu erstellen (V-Model Workflow)
- Feature-Specs fuer FEATURE-1400 bis FEATURE-1411 (RE)
- ADRs fuer Architektur-Entscheidungen (MCP-Transport, Tool-Exposition, Auth)
- plan-context.md fuer Implementierung

### Features im Ueberblick

| Feature | Name | Priority | Kern-Erkenntnisse aus Review |
|---------|------|----------|-------------------------------|
| FEATURE-1400 | MCP Server Core (stdio) | P0 | ToolRegistry liefert Tool-Definitionen, ToolExecutionPipeline fuehrt aus |
| FEATURE-1401 | Tool-Tier-Mapping | P0 | TOOL_GROUP_MAP als Basis, 3-Tier: Read/Vault/Edit |
| FEATURE-1402 | MCP Server Settings UI | P0 | Toggle + Tier-Config + Connection-Status |
| FEATURE-1403 | Remote Transport | P1 | Cloudflare Tunnel oder HTTP-Server |
| FEATURE-1404 | Remote Authentication | P1 | OAuth 2.1 |
| FEATURE-1405 | MCP Resources | P1 | Vault-Dateien als MCP Resources |
| FEATURE-1406 | MCP Prompts | P1 | Skills/Recipes als MCP Prompts |
| FEATURE-1407 | Plugin Skill Discovery | P2 | VaultDNA ueber MCP exponieren |
| FEATURE-1408 | Remote Approval Pipeline | P2 | Push-Notification, Whitelist, Auto-Approve |
| FEATURE-1409 | Connectors Directory Submission | P2 | Obsidian Community Listing |
| FEATURE-1410 | Sandbox Exposure via MCP | P1 | evaluate_expression + custom_* Tools via MCP, Security server-seitig |
| FEATURE-1411 | Memory Source-Tracking | P1 | UiMessage.source: 'human'\|'mcp'\|'subtask', Audit-Trail |

### Sandbox via MCP (FEATURE-1410) -- Detail aus Code-Review

**Kontext:** Obsilo Sandbox (Process/iframe) mit Vault-APIs (read, write, list) und CDN-HTTP. Externer Client hat eigene Code-Execution, aber NICHT Vault-scoped mit Security-Garantien.

**Was exponiert wird:**
- `evaluate_expression` als MCP Tool -- externer Client sendet TypeScript/JS
- Security bleibt server-seitig: AstValidator, Rate-Limiting (10 Writes/min, 5 Requests/min), .obsidian-Blockade
- Custom Tools (`custom_*`) aus DynamicToolFactory als MCP Tools
- NPM-Dependency-Bundling via EsbuildWasmManager bleibt server-seitig

**Warum:**
- Batch-Ops ueber 5+ Vault-Dateien mit einzelnen MCP read/write Calls ineffizient
- Sandbox bietet atomare Vault-Batch-Ops mit Security-Garantien
- Externer Client muss Vault-Pfade nicht selbst validieren

**Architektur:** Externer Client sendet Code als String -> Obsilo validiert (AstValidator) -> kompiliert (esbuild) -> fuehrt in Sandbox aus -> Result via MCP Response

### Memory Source-Tracking (FEATURE-1411) -- Detail aus Code-Review

**Problem:** Memory-System unterscheidet NICHT zwischen menschlichem Input und Agent-Input (via MCP). `UiMessage` hat kein `source`-Feld. Alles `role: 'user'`.

**Aenderungen:**
- `UiMessage` erhaelt `source: 'human' | 'mcp' | 'subtask'`
- SessionExtractor speichert Source-Info in Session-Summaries
- Memory-Updates via MCP werden markiert
- Learning bleibt transparent: Obsilo soll gleich lernen egal ob Mensch oder Agent
- Hinter jedem Agent/LLM steht letztlich ein Prompt vom User

---

## Phase 4: Kontext-Radius erweitern

> V-Model Workflow: BA -> RE -> Architektur -> Implementierung -> Test
> Voraussetzung: Phase 3 (Connector) muss abgeschlossen sein

### 4a. DeckPlan -> python-pptx Renderer-Script (Claude Code Skill)

**Kontext:** Phase 1c entfernt das interne PPTX-Rendering (TemplateEngine, AdhocSlideBuilder). Der USP-Kern bleibt (PlanPresentation, slideSemantics, TemplateCatalog). Rendering wird an externe Tools delegiert.

**Flow:**
```
Obsilo: plan_presentation -> DeckPlan JSON im Vault
Claude Code: liest DeckPlan via MCP (read_file)
Claude Code: python render_deckplan.py (python-pptx)
Claude Code: schreibt .pptx via MCP (write_file) -> fertige PPTX im Vault
```

**Renderer-Optionen (Recherche 2026-03-29):**

| Option | Output-Qualitaet | Claude-Integration | Template-Support | PPTX editierbar |
|--------|------------------|--------------------|------------------|----------------|
| python-pptx via Claude Code | Sehr gut | Gut (Script) | Ja | Ja |
| Claude Built-in PPTX Skill | Gut | Nativ | Ja | Ja |
| Office-PowerPoint-MCP (GongRzhe) | Sehr gut | Sehr gut (MCP) | Ja | Ja |
| Plus AI MCP | Exzellent | Sehr gut (MCP) | Ja (Enterprise) | Ja |
| Marp CLI | Mittel | Sehr gut (CLI) | Nein | Nein (Bilder) |

**Empfehlung:**
- **Default:** python-pptx Script via Claude Code (volle DeckPlan-Kontrolle, einmaliger Aufwand)
- **Quick:** Claude Built-in PPTX Skill (Blackbox, "just works")
- **Premium:** Plus AI MCP (professionellster Output, SaaS, kostenpflichtig)

**Kein Python in Obsilo noetig** -- Obsilo = Intelligenz (Storyline, Content-Planung), Claude Code = Execution (Rendering).

### 4b. OneDrive Connector (Microsoft Graph API)

**Ziel:** Erweiterung des "Context-Radius" ueber den Vault hinaus.

**Statt nur Vault-Kontext hat Obsilo dann:**
```
Vault (Obsidian)          <- heute
  + OneDrive (Dokumente)
  + Mail (Kommunikation)
  + Kalender (zeitlich)
```

**Implementierung:**
- Als MCP-Server (eigenes Projekt oder Community)
- Microsoft Graph API als Basis
- Nur private Accounts (EnBW Mails und Ressourcen tabu)
- Obsilo konsumiert als MCP-Client (bestehende Infrastruktur)

### 4c. Memory aus MCP-Sessions lernen

**Problem:** Im Connector-Modus entsteht keine Conversation im Obsilo-Sinne. Memory greift nur im Standalone-Modus.

**Loesung:**
- Leichtgewichtiger Session-Tracker fuer MCP-Interaktionen
- Sammelt Tool-Calls + Results waehrend einer MCP-Session
- Fuettert diese in gleiche Extraction-Pipeline (SessionExtractor -> LongTermExtractor)
- Memory lernt aus Agent-Aktionen genauso wie aus menschlichen

**Designprinzip:** Obsilo soll egal sein ob Mensch oder Agent es bedient. Auch hinter dem Agent/LLM steht letztlich ein Prompt vom User. Memory soll fuer echte (Hyper-)Personalisierung sorgen und nahtloses Anknuepfen ermoeglichen.

---

## Abhaengigkeiten zwischen Phasen

```
Phase 1 (Verschlanken)     -- Keine Abhaengigkeit, wird JETZT umgesetzt
     |
     v
Phase 2 (Stabilisieren)    -- Saubere Basis fuer Connector
     |
     v
Phase 3 (Connector)        -- EPIC-014, setzt Phase 1+2 voraus
     |
     v
Phase 4 (Kontext-Radius)   -- Setzt Connector voraus
  4a: DeckPlan-Renderer     -- Setzt PPTX-Vereinfachung (1c) + Connector (3) voraus
  4b: OneDrive              -- Setzt MCP-Infrastruktur (3) voraus
  4c: Memory aus MCP        -- Setzt Connector (3) + Memory-Tracking (3f) voraus
```

## Naechste Schritte nach Phase 1

1. Phase 2 durch V-Model: BA ist erledigt (Code-Review), RE + ADRs erstellen
2. Phase 3 durch V-Model: EPIC-014 existiert, Feature-Specs schreiben
3. Phase 4 planen nach Phase 3 Abschluss
