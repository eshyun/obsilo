# Plan Context: Memory & Self-Learning Verbesserungen

> **Purpose:** Technische Zusammenfassung fuer Claude Code
> **Created by:** Architect (basierend auf Systemtest 2026-04-03)
> **Date:** 2026-04-03
> **Epic:** Memory/Self-Learning Optimization

---

## Technical Stack

**Bestehendes Projekt:**
- Language: TypeScript (strict)
- Framework: Obsidian Plugin API
- Build: esbuild mit Deploy-Plugin
- Runtime: Electron (via Obsidian)
- AI APIs: Anthropic SDK, OpenAI SDK, OpenRouter

**Bestehende Infrastruktur (relevant):**
- Embedding Model: qwen/qwen3-embedding-8b (OpenRouter) -- aktiv, 10.783 Vektoren
- Vector Store: knowledge.db (sql.js WASM SQLite, 207 MB)
- Memory DB: memory.db (sql.js, Sessions, Episodes, Patterns, Recipes)
- Memory Model: anthropic/claude-haiku-4.5 (OpenRouter) -- fuer Extraction-LLM-Calls

**Keine neuen Dependencies noetig.**

## Architecture Style

- Pattern: Bestehende Service-Architektur erweitern (kein neues Pattern)
- Key Quality Goals:
  1. **Effectiveness**: Das Lernsystem muss tatsaechlich lernen und anwenden
  2. **Langlebigkeit**: Memory-Qualitaet darf ueber Monate/Jahre nicht degradieren
  3. **Kosteneffizienz**: Verbesserungen duerfen die Token-Kosten nicht erhoehen

## Key Architecture Decisions (ADR Summary)

| ADR | Title | Vorgeschlagene Entscheidung | Impact |
|-----|-------|-----------------------------|--------|
| ADR-058 | Semantic Recipe Promotion | Embedding-basiertes Intent-Matching statt exakte Tool-Sequenzen | High |
| ADR-059 | Memory Decay Prevention | Budget-Aware LongTermExtractor mit 800-char Hard Limit | Medium |
| ADR-060 | Session-Summary Reliability | Bug-Fix + Canary-Check + Logging-Upgrade | High |

**Detail pro ADR:**

1. **ADR-058 (Semantic Recipe Promotion):** RecipePromotionService wechselt von
   Pattern-Key-Matching (exakte Tool-Sequenz) auf Embedding-Similarity der
   User-Messages. Episoden sind bereits im VectorStore indiziert. Methode
   `findSimilarEpisodes()` existiert. Threshold: 0.75 Cosine Similarity,
   3 aehnliche erfolgreiche Episoden fuer Promotion.
   - Rationale: Systemtest bewies dass exakte Sequenzen nie matchen

2. **ADR-059 (Memory Decay Prevention):** LongTermExtractor bekommt das
   Prompt-Budget (800 chars/Datei) als harte Grenze. Bei jedem Update muss
   er die gesamte Datei neu bewerten und das Unwichtigste kuerzen. Eintraege
   bekommen `[YYYY-MM]` Timestamp-Prefix.
   - Rationale: Ohne Budget-Limit waechst die Datei endlos, aber nur 800 chars sind sichtbar

3. **ADR-060 (Session-Summary Reliability):** Bug-Fix fuer fehlende .md-Dateien
   in `memory/sessions/`. Canary-Check nach Write. Logging von `console.debug`
   auf `console.warn` fuer Fehler.
   - Rationale: 0 Session-Summaries trotz 10+ Conversations (fundamentaler Defekt)

## Data Model (Bestehend, wird erweitert)

```
TaskEpisode (MemoryDB.episodes)
  id: string (ep-{timestamp}-{random})
  userMessage: string (max 500 chars)    -- NEU: wird als Embedding-Query genutzt
  toolSequence: string[] (JSON)
  toolLedger: string (max 1500 chars)
  success: boolean
  resultSummary: string (max 300 chars)
  [Embedding im VectorStore: episode:{id}]

ProceduralRecipe (MemoryDB.recipes)
  id: string
  name: string (max 40 chars)
  description: string (max 100 chars)
  trigger: string (pipe-separated keywords)
  steps: RecipeStep[] (JSON)
  source: 'static' | 'learned'
  successCount: number
  [Unveraendert -- Format bleibt]

PatternEntry (MemoryDB.patterns)
  [WIRD OBSOLET durch ADR-058]
  patternKey: string -> NICHT MEHR GENUTZT
  [patterns Table kann nach Migration geloescht werden]

Memory Files (GlobalFileService)
  user-profile.md   (max 800 chars, Budget-enforced)
  projects.md        (max 800 chars, Budget-enforced)
  patterns.md        (max 800 chars, Budget-enforced)
  soul.md            (max 800 chars, Budget-enforced)
  errors.md          (on-demand, kein Budget)
  custom-tools.md    (on-demand, kein Budget)
  sessions/{id}.md   (FIX-09: muss geschrieben werden!)
```

## Bestehende Module die geaendert werden

| Datei | Aenderung | ADR | Risiko |
|-------|-----------|-----|--------|
| `src/core/mastery/RecipePromotionService.ts` | Sequenz-Matching -> Embedding-Similarity | ADR-058 | Medium |
| `src/core/mastery/RecipeMatchingService.ts` | Phase 2 (Semantic Fallback) implementieren | ADR-058 | Medium |
| `src/core/memory/LongTermExtractor.ts` | Budget-Constraint im Prompt, Recency-Header | ADR-059 | Medium |
| `src/core/memory/MemoryRetriever.ts` | DB-Fallback fuer getRecentSessions() + Constructor (MemoryDB) | ADR-060 | Medium |
| `src/ui/AgentSidebarView.ts` | MemoryRetriever-Instanziierung: memoryDB uebergeben | ADR-060 | Low |
| `src/core/memory/ExtractionQueue.ts` | Logging-Upgrade | ADR-060 | Low |
| `src/core/memory/MemoryService.ts` | MAX_CHARS_PER_FILE exportieren | ADR-059 | Low |
| `src/core/knowledge/RerankerService.ts` | Fail-Once-Guard (FIX-07) | -- | Low |
| `src/core/knowledge/ImplicitConnectionService.ts` | DB-Ready-Guard (FIX-08) | -- | Low |

## Bestehende Module die NICHT geaendert werden

| Datei | Grund |
|-------|-------|
| `src/core/mastery/EpisodicExtractor.ts` | Recording + Indexing funktioniert korrekt |
| `src/core/mastery/RecipeStore.ts` | Recipe-Format bleibt identisch |
| `src/core/mastery/staticRecipes.ts` | Static Recipes sind unabhaengig |
| `src/core/mastery/types.ts` | Typen bleiben |
| `src/core/memory/MemoryRetriever.ts` | Retrieval funktioniert (wenn Summaries existieren) |
| `src/core/AgentTask.ts` | Agent-Loop unveraendert |
| `src/core/systemPrompt.ts` | Prompt-Aufbau unveraendert |
| `src/ui/AgentSidebarView.ts` | Verdrahtung funktioniert korrekt |

## Bug-Fixes (Quick Wins, kein ADR noetig)

| ID | Beschreibung | Datei | Aufwand |
|----|-------------|-------|---------|
| FIX-07 | Reranker Fail-Once-Guard (kein Retry nach erstem Fehlschlag) | `RerankerService.ts` | 15min |
| FIX-08 | ImplicitConnections DB-Ready-Guard | `ImplicitConnectionService.ts` | 15min |
| FIX-10 | learnedRecipesEnabled Force-True (bereits gefixt in main.ts) | `main.ts` | Done |
| FIX-11 | ChatLink YAML-Robustheit (Frontmatter-Werte quoten) | `AgentSidebarView.ts` | 1h |

## Implementation Priorities

| Phase | Was | ADR/FIX | Abhaengigkeiten | Geschaetzter Aufwand |
|-------|-----|---------|-----------------|----------------------|
| 0 | Bug-Fixes (FIX-07, FIX-08, FIX-11) | -- | Keine | 2h |
| 1 | Session-Summary Fix + Logging (FIX-09) | ADR-060 | Keine | 4h |
| 2 | Memory Decay Prevention | ADR-059 | Phase 1 (LongTermExtractor muss funktionieren) | 4h |
| 3 | Semantic Recipe Promotion | ADR-058 | Phase 1 (Episoden muessen korrekt indiziert sein) | 8h |
| 4 | Semantic Recipe Matching Fallback | ADR-058 | Phase 3 | 4h |

**Gesamtaufwand: ~22h (verteilt ueber 1-2 Wochen)**

## Verifikation (Akzeptanzkriterien)

### Phase 0 (Bug-Fixes)
- [ ] `[Reranker] Failed to load model` erscheint maximal 1x (nicht bei jedem semantic_search)
- [ ] `[ImplicitConnections] Computation failed` erscheint nicht mehr beim Startup
- [ ] ChatLink schreibt valides YAML auch bei Werten mit Sonderzeichen

### Phase 1 (Session-Retrieval Fix)
- [ ] MemoryRetriever.getRecentSessions() liest aus DB (nicht .md-Dateien)
- [ ] Fallback auf .md-Dateien wenn DB nicht verfuegbar
- [ ] `console.warn` bei Fehlschlag (nicht nur `console.debug`)
- [ ] Test: Nach Conversation findet naechste Conversation die Session-Summary via Retriever

### Phase 2 (Memory Decay Prevention)
- [ ] Keine Memory-Datei ueberschreitet 800 Zeichen nach LongTermExtractor-Run
- [ ] Jeder Eintrag hat `[YYYY-MM]` Prefix
- [ ] Bei Ueberlauf: aelteste/unwichtigste Eintraege werden gekuerzt
- [ ] Bestehende zu lange Dateien werden beim naechsten Extract konsolidiert

### Phase 3 (Semantic Recipe Promotion)
- [ ] 3 funktional aehnliche Aufgaben (unterschiedliche Tool-Sequenzen) erzeugen 1 Recipe
- [ ] Pattern-Key-Matching wird nicht mehr genutzt
- [ ] Promoted Recipes haben sinnvolle Trigger-Keywords
- [ ] Kein zusaetzlicher LLM-Call fuer Matching (nur Embedding-Vergleich)

### Phase 4 (Semantic Recipe Matching)
- [ ] Recipes werden auch bei nicht-exakten Keyword-Matches gefunden
- [ ] Fallback auf VectorStore-Suche wenn Keyword-Score < MAX_RESULTS
- [ ] Gesamtes Recipe-Matching bleibt unter 100ms

---

## Kontext-Dokumente fuer Claude Code

Claude Code sollte folgende Dokumente als Kontext lesen:

1. `_devprocess/architecture/ADR-058-semantic-recipe-promotion.md`
2. `_devprocess/architecture/ADR-059-memory-decay-prevention.md`
3. `_devprocess/architecture/ADR-060-session-summary-reliability.md`
4. `_devprocess/architecture/ADR-013-memory-architecture.md` (Grundarchitektur)
5. `_devprocess/architecture/ADR-017-procedural-recipes.md` (Recipe-Format)
6. `_devprocess/architecture/ADR-018-episodic-task-memory.md` (Episoden-System)
7. `_devprocess/analysis/BUG-007-reranker-onnx-electron.md`
8. `_devprocess/analysis/BUG-008-implicit-connections-statement-closed.md`
9. `_devprocess/analysis/BUG-009-session-summaries-not-written.md`
10. `_devprocess/analysis/BUG-011-chatlink-yaml-parse-error.md`

**Bestehende Code-Referenzen (zum Lesen VOR Implementierung):**
- `src/core/mastery/RecipePromotionService.ts` (Haupt-Umbau ADR-058)
- `src/core/mastery/RecipeMatchingService.ts` (Semantic Fallback ADR-058)
- `src/core/mastery/EpisodicExtractor.ts` (findSimilarEpisodes -- bereits vorhanden)
- `src/core/memory/SessionExtractor.ts` (Bug-Fix FIX-09)
- `src/core/memory/LongTermExtractor.ts` (Budget-Constraint ADR-059)
- `src/core/memory/MemoryService.ts` (MAX_CHARS_PER_FILE)
- `src/core/knowledge/RerankerService.ts` (FIX-07)
- `src/core/knowledge/ImplicitConnectionService.ts` (FIX-08)
