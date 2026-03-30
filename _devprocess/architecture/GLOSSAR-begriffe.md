# Glossar: Tools, Skills, Sandbox und Memory

**Status:** Gueltig ab 2026-03-06 (erweitert 2026-03-30)

---

## Begriffsabgrenzung

### Tools
Alles was der Agent als Funktion aufrufen kann. Tools haben ein Input-Schema, fuehren eine Aktion aus, und geben ein Ergebnis zurueck.

| Typ | Beschreibung | Laufzeitumgebung | Beispiele |
|-----|--------------|-------------------|-----------|
| **Built-in Tools** | Von uns geschrieben und reviewed | Plugin-Kontext (Node.js) | read_file, write_file, semantic_search |
| **Custom Tools** | Vom Agent erstellt via manage_skill | Sandbox (isoliert) | custom_* |
| **Plugin Tools** | Obsidian-Plugin-Integration | Plugin-Kontext | execute_command, call_plugin_api |
| **MCP Tools** | Von externen MCP-Servern | Externer Prozess | use_mcp_tool |

### Skills
Anleitungen in Markdown, die den Agent bei bestimmten Aufgabentypen steuern. Skills fuehren keinen Code aus -- sie werden per Keyword-Matching ins System Prompt injiziert. Skills koennen auch ueber das `/`-Autocomplete im Chat aufgerufen werden.

| Typ | Quelle | Speicherort |
|-----|--------|-------------|
| **User Skills** | Manuell vom Benutzer erstellt | ~/.obsidian-agent/skills/{name}/SKILL.md |
| **Plugin Skills** | Auto-generiert durch VaultDNA Scanner | ~/.obsidian-agent/plugin-skills/{id}.skill.md |

### Sandbox
Isolierte Laufzeitumgebung fuer Agent-generierten Code. Zwei Implementierungen:
- **IframeSandboxExecutor** -- Browser-iframe mit sandbox="allow-scripts" (Mobile)
- **ProcessSandboxExecutor** -- child_process mit vm.createContext() (Desktop)

**Sandbox kann:**
- Text/JSON verarbeiten (String-Manipulation, Regex, Parsing)
- Vault-Dateien lesen/schreiben (ueber Bridge: vault.read, vault.write, vault.list)
- HTTP-Requests ausfuehren (ueber Bridge: requestUrl, URL-Allowlist)
- npm-Pakete als ESM-Bundles vom CDN laden (nur browser-kompatible)

**Sandbox kann NICHT:**
- Binaere Dateiformate erzeugen (DOCX, PPTX, XLSX, PDF) -- benoetigt Buffer, stream, JSZip
- Node.js APIs nutzen (require, fs, child_process, crypto, Buffer, stream)
- DOM-APIs nutzen (document, window, Blob)
- Aus der Isolation ausbrechen -- die Bridge ist der einzige Kommunikationskanal

### Workflows
Feste Schritt-fuer-Schritt-Anleitungen als Markdown-Dateien. Werden per `/`-Autocomplete im Chat ausgeloest. Keine Code-Ausfuehrung.

---

## Abgrenzung: Was ist was?

| Frage | Antwort |
|-------|---------|
| Der Agent soll eine Datei lesen | **Tool** (read_file) |
| Der Agent soll wissen, wie man Meeting-Notizen erstellt | **Skill** (meeting-notes SKILL.md) |
| Der Agent soll ein DOCX erzeugen | **Built-in Tool** (muss von uns implementiert werden) |
| Der Agent soll 200 Dateien umbenennen | **Sandbox** (evaluate_expression mit vault.read/write) |
| Der Agent soll einen Obsidian-Befehl ausfuehren | **Plugin Tool** (execute_command) |
| Der Agent soll eine bestimmte Methodik immer anwenden | **Skill** oder **Rule** |

---

## Sicherheitsmodell

```
Schicht 1: Betriebssystem (voller Zugriff)
Schicht 2: Plugin-Kontext (Built-in Tools, Bridge) -- reviewed Code
Schicht 3: Sandbox (Custom Tools, evaluate_expression) -- untrusted Code, isoliert
```

Agent-generierter Code laeuft **immer** in Schicht 3 (Sandbox). Er kann nicht in Schicht 2 (Plugin-Kontext) "befoerdert" werden. Fuer Faehigkeiten die Node.js APIs benoetigen (binaere Dateiformate), muessen Built-in Tools in Schicht 2 implementiert werden.

---

## Lern- und Gedaechtnissystem (Memory Layer)

Der Agent lernt aus vergangenen Interaktionen. Die Daten bilden eine Kette:

```
Conversation -> Session -> Episode -> Pattern -> Recipe
```

### Conversation / History
Der rohe Chat-Verlauf: User-Nachrichten, Agent-Antworten, Tool-Aufrufe, Ergebnisse.
Wird als JSON pro Konversation gespeichert. Basis fuer alle abgeleiteten Daten.

### Session
Zusammenfassung einer Konversation -- Titel, Kerninhalt, genutzter Kontext.
Wird nach Abschluss einer Konversation vom SessionExtractor erzeugt.
Dient dem Cross-Session-Retrieval: "Was haben wir letzte Woche zu Thema X besprochen?"

### Episode
Einzelne Aufgabe mit Ergebnis. Speichert: User-Nachricht, aktiver Mode, Tool-Sequenz,
Erfolg/Misserfolg, Ergebnis-Zusammenfassung. Wird vom EpisodicExtractor nach jeder
abgeschlossenen Aufgabe erzeugt (ADR-018).

### Pattern
Wiederkehrende Tool-Sequenz die der PatternTracker ueber mehrere Episodes erkennt.
Beispiel: `read_file -> search_files -> create_pptx` taucht in 5 verschiedenen Episodes auf.
Patterns sind Kandidaten fuer automatisch gelernte Recipes.

### Recipe
Schritt-fuer-Schritt-Anleitung fuer eine bestimmte Aufgabe (ADR-017, Skill Mastery).

| Typ | Quelle | Beispiel |
|-----|--------|----------|
| **Static** | Vordefiniert (von Entwickler/User) | Office-Workflow, Presentation-Design |
| **Learned** | Automatisch aus Patterns promoviert | Agent hat 5x erfolgreich read->search->pptx gemacht |

Recipes werden vom RecipeMatchingService per Keyword-Matching auf User-Nachrichten aktiviert.

### Zusammenspiel

| Daten | Natur | Aktueller Speicherort | Kuenftig (FEATURE-1505) |
|-------|-------|-----------------------|-------------------------|
| Conversations | Primaerdaten | `~/.obsidian-agent/conversations/` (JSON) | bleibt als Dateien |
| Sessions | Primaerdaten | `~/.obsidian-agent/memory/sessions/` (MD) | `memory.db` im Vault |
| Episodes | Primaerdaten | `~/.obsidian-agent/episodes/` (JSON) | `memory.db` im Vault |
| Patterns | Abgeleitet | `~/.obsidian-agent/patterns/` (JSON) | `memory.db` im Vault |
| Recipes | Primaer/Abgeleitet | `~/.obsidian-agent/recipes/` (JSON) | `memory.db` im Vault |

**Architektur-Entscheidung (ADR-050):** Memory-Daten wandern in eine separate `memory.db`
im Vault (`{vault}/.obsidian-agent/memory.db`), damit sie ueber Geraete syncen.
Der Vektor-Index (`knowledge.db`) bleibt global und pro Geraet.

---

## Referenzen

- ADR-017: Agent Skill Mastery (Recipes, Patterns)
- ADR-018: Episodic Memory (Episodes)
- ADR-021: Sandbox OS-Level Process Isolation
- ADR-050: SQLite Knowledge DB (Zwei-DB-Strategie: knowledge.db + memory.db)
- FEATURE-0502-sandbox-os-isolation.md
- FEATURE-1505: Knowledge Data Consolidation (Memory -> memory.db)
- src/core/sandbox/ (IframeSandboxExecutor, ProcessSandboxExecutor, SandboxBridge)
- src/core/memory/ (SessionExtractor, MemoryRetriever, LongTermExtractor)
- src/core/mastery/ (EpisodicExtractor, RecipeStore, RecipePromotionService, PatternTracker)
- src/core/tools/toolMetadata.ts (Single Source of Truth fuer Tool-Metadaten)
- src/core/skills/ (SelfAuthoredSkillLoader, VaultDNAScanner)
