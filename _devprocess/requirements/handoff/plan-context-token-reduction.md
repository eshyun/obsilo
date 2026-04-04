# Plan Context: Token-Kostenreduktion (EPIC-018)

> **Purpose:** Technische Zusammenfassung fuer Claude Code
> **Created by:** Architect
> **Date:** 2026-04-04
> **Epic:** EPIC-018

---

## Technical Stack

**Bestehendes Projekt:**
- Language: TypeScript (strict)
- Framework: Obsidian Plugin API
- Build: esbuild mit Deploy-Plugin
- Runtime: Electron (via Obsidian)
- AI APIs: Anthropic SDK, OpenAI SDK, OpenRouter, GitHub Copilot

**Bestehende Infrastruktur (relevant):**
- Agent Loop: ReAct-Pattern in AgentTask.run() (~800 Zeilen)
- Tool Pipeline: ToolExecutionPipeline (Governance, Approval, Caching, Logging)
- Recipe System: RecipeMatchingService + RecipeStore (ADR-058, gerade implementiert)
- System Prompt: Modular (14 Sections in systemPrompt.ts)
- Prompt Caching: Anthropic-Provider hat cache_control (teilweise implementiert)
- Parallel Execution: read-safe Tools via Promise.all (bestehendes Pattern)
- File System: GlobalFileService (.obsidian-agent/ Verzeichnis)

**Keine neuen Dependencies noetig.**

## Architecture Style

- Pattern: Bestehende Architektur erweitern (kein neues Framework)
- Key Quality Goals:
  1. **80-90% Token-Kostenreduktion** ohne Qualitaetsverlust
  2. **KV-Cache-Stabilitaet** (Manus Context Engineering Prinzipien)
  3. **Provider-Agnostik** (keine Provider-exklusiven Features)

## Key Architecture Decisions (ADR Summary)

| ADR | Title | Vorgeschlagene Entscheidung | Impact |
|-----|-------|-----------------------------|--------|
| ADR-061 | Fast Path Execution | Hybrid: Pre-Loop Batch (Planner + deterministische Execution) + Loop Fallback | High |
| ADR-062 | KV-Cache-Optimized Prompt | Section-Reordering (stabile zuerst) + Adapter-Pattern fuer Cache-Hints | High |
| ADR-063 | Context Externalization | Zentrale Externalization in ToolExecutionPipeline (Dateisystem als Kontext) | High |

**Detail pro ADR:**

1. **ADR-061 (Fast Path):** Wenn Recipe matcht: 1 LLM-Call (Planner) parametrisiert die
   Steps, dann deterministische Tool-Batch-Execution via Pipeline, dann Loop fuer
   Praesentation. 2-3 Iterationen statt 8. Fallback auf normale Loop bei Fehlern.
   - Rationale: 75% Token-Reduktion bei erkannten Patterns
   - Key: Tool-Liste NICHT aendern (Manus), tool_choice nicht noetig (Planner bestimmt)

2. **ADR-062 (KV-Cache Prompt):** System Prompt Sections umordnen: Stabile Sections
   (Mode, Tools, Routing, Capabilities) zuerst, dynamische Sections (Skills, Memory,
   DateTime) zuletzt. Adapter-Pattern fuer Provider-spezifische Cache-Hints.
   DateTime von Position 1 auf Position 15 (letzte Section).
   - Rationale: Stabiler Prefix = 90% Cache-Hit-Rate bei Anthropic, 50% bei OpenAI
   - Risk: Skills verlieren Primacy Effect → Mitigation via Recency-Anker (Todo-Liste)

3. **ADR-063 (Context Externalization):** ToolExecutionPipeline prueft Result-Groesse.
   Ueber Threshold (2000 chars): Volles Result in temp-Datei, kompakte Referenz im
   Kontext. Agent laedt bei Bedarf per read_file nach. Einheitliches Pattern fuer alle Tools.
   - Rationale: 50-70% weniger History-Tokens, Append-only, wiederherstellbar
   - Key: read_file wird externalisiert mit Heading-Summary (Original bleibt im Vault nachladbar)
   - Key: Im Fast Path (ADR-061) ist Externalization deaktiviert (Presenter braucht volle Inhalte)

## KV-Cache Design-Prinzipien (Manus, gelten fuer ALLE Aenderungen)

1. **Stabiles Prompt-Prefix**: Kein Token darf sich im stabilen Anteil aendern
2. **Append-only History**: Nie modifizieren, nur anhaengen
3. **Maskieren statt Entfernen**: Tool-Liste bleibt konstant
4. **Dateisystem als Kontext**: Grosse Daten extern, Referenzen intern
5. **Deterministische Serialisierung**: Stabile Key-Reihenfolge in JSON
6. **Todo-Liste als Recency-Anker**: Aktueller Task-Status wird automatisch als
   letzte User-Message vor jedem LLM-Call angehaengt (nicht als Tool-Call, sondern
   als System-Nachricht). Nutzt den Recency Bias des Modells um Zielabweichung
   bei langen Tasks zu verhindern. Kompensiert den Primacy-Effect-Verlust durch
   Section-Reordering (ADR-062). Implementiert in FEATURE-1800 (Fast Path).

## Neue Module und Dateien

```
src/core/
  FastPathExecutor.ts         -- Planner + Batch Execution + History-Aufbau (ADR-061)
  tool-execution/
    ResultExternalizer.ts     -- Groessencheck + temp-Datei-Write + Referenz-Generierung (ADR-063)
  prompts/
    cacheAdapter.ts           -- PromptCacheAdapter Interface + Provider-Implementierungen (ADR-062)
```

## Bestehende Dateien die geaendert werden

| Datei | Aenderung | ADR | Risiko |
|-------|-----------|-----|--------|
| `src/core/systemPrompt.ts` | Section-Reihenfolge: Stabile zuerst, DateTime ans Ende | ADR-062 | Medium -- Primacy Effect testen |
| `src/core/AgentTask.ts` | Vor Loop: FastPath-Check, bei Match FastPath starten | ADR-061 | Medium -- neuer Code-Pfad |
| `src/core/tool-execution/ToolExecutionPipeline.ts` | Nach Tool-Exec: ResultExternalizer aufrufen | ADR-063 | Low -- Erweiterung, keine Aenderung |
| `src/api/providers/anthropic.ts` | Cache-Breakpoint praeziser platzieren (nach stabilen Sections) | ADR-062 | Low |
| `src/main.ts` | tmp-Cleanup beim Plugin-Start | ADR-063 | Low |

## Bestehende Dateien die NICHT geaendert werden

| Datei | Grund |
|-------|-------|
| Alle Tool-Implementierungen (SearchFilesTool, etc.) | Externalization in Pipeline, nicht im Tool |
| RecipeMatchingService, RecipeStore | Werden nur abgefragt, nicht geaendert |
| MemoryRetriever, MemoryService | Unabhaengig von Token-Optimierung |
| Context Condensing Logik | Wird seltener noetig, aber Mechanismus bleibt |

## Implementation Priorities

| Phase | Was | ADR | Abhaengigkeiten | Aufwand |
|-------|-----|-----|-----------------|---------|
| 1 | Section-Reordering + Cache-Adapter | ADR-062 | Keine | 2-3 Tage |
| 2 | Context Externalization | ADR-063 | Keine | 3-4 Tage |
| 3 | Fast Path Execution | ADR-061 | ADR-058 (Recipes, bereits implementiert) | 4-5 Tage |

**Reihenfolge-Begruendung:** Phase 1 (Prompt-Reordering) hat den hoechsten ROI bei
geringstem Risiko und kann sofort getestet werden. Phase 2 (Externalization) reduziert
die History unabhaengig vom Fast Path. Phase 3 (Fast Path) ist der groesste Hebel,
aber auch der komplexeste und profitiert davon dass Phase 1+2 die Token-Basis
bereits gesenkt haben.

## Performance & Security

**Performance (Zielwerte):**
- Input-Tokens pro Standard-Task: <130.000 (aktuell 634.000)
- LLM-Iterationen bei erkanntem Recipe: <=3 (aktuell 8)
- KV-Cache-Hit-Rate (stabiler Prefix): >90%
- EXTERNALIZE_THRESHOLD: 2.000 chars (~500 Tokens)
- Fast Path Planner-Call: <30.000 Tokens
- Keine Latenz-Verschlechterung (weniger Roundtrips = schneller)

**Kompatibilitaet:**
- GitHub Copilot (168k Limit): Standard-Tasks muessen funktionieren
- OpenRouter/Anthropic: Prompt Caching aktiv
- Ollama/LM Studio: Keine Kosten, aber profitiert von weniger Iterationen (schneller)

**Security:**
- ToolExecutionPipeline Governance bleibt (Approval, Checkpoints, Logging)
- Temp-Dateien in .obsidian-agent/tmp/ (nicht im Vault sichtbar)
- Cleanup: Nach Task + beim Plugin-Start (Crash-Recovery)

## Verifikation

### Phase 1 (Prompt Caching)
- [ ] DateTime steht an letzter Position im System Prompt
- [ ] Skills stehen im dynamischen Block (nach Cache-Breakpoint)
- [ ] Anthropic meldet Cache-Hits (sichtbar in Response Headers)
- [ ] A/B-Test: Ergebnisqualitaet mit neuer Section-Reihenfolge identisch

### Phase 2 (Context Externalization)
- [ ] Tool-Results > 2000 chars werden in temp-Dateien geschrieben
- [ ] Kompakte Referenz im Kontext (Pfad + Summary + Top-N)
- [ ] Agent laedt externalisierte Results bei Bedarf per read_file
- [ ] Temp-Cleanup nach Task-Completion und beim Start

### Phase 3 (Fast Path)
- [ ] Standard-Task mit Recipe: <=3 LLM-Iterationen
- [ ] Fallback auf normale Loop bei Fehler
- [ ] Planner-Call erzeugt gueltige Tool-Parameter
- [ ] Gesamte Input-Tokens < 130.000

### Uebergreifend
- [ ] Keine Qualitaetsregression (Vergleichstest gleiche Aufgabe)
- [ ] Token-Counter im Log zeigt Reduktion
- [ ] KV-Cache: Kein History-Eintrag wird modifiziert (Append-only)

---

## Kontext-Dokumente fuer Claude Code

Claude Code sollte folgende Dokumente als Kontext lesen:

1. `_devprocess/architecture/ADR-061-fast-path-execution.md`
2. `_devprocess/architecture/ADR-062-kv-cache-optimized-prompt.md`
3. `_devprocess/architecture/ADR-063-context-externalization.md`
4. `_devprocess/requirements/features/FEATURE-1800-fast-path-execution.md`
5. `_devprocess/requirements/features/FEATURE-1801-prompt-caching.md`
6. `_devprocess/requirements/features/FEATURE-1802-context-externalization.md`
7. `_devprocess/requirements/handoff/architect-handoff-token-reduction.md`
8. `_devprocess/analysis/BA-012-token-cost-reduction.md`

**Bestehende Code-Referenzen (zum Lesen VOR Implementierung):**
- `src/core/AgentTask.ts` (Haupt-Agent-Loop, Fast Path Integrationspunkt)
- `src/core/systemPrompt.ts` (Section-Reihenfolge, Cache-Breakpoint)
- `src/core/tool-execution/ToolExecutionPipeline.ts` (Externalization-Integrationspunkt)
- `src/api/providers/anthropic.ts` (bestehendes cache_control Pattern)
- `src/core/mastery/RecipeMatchingService.ts` (Recipe-Match fuer Fast Path Trigger)
- `src/core/mastery/RecipeStore.ts` (Recipe-Format)
- `src/core/storage/GlobalFileService.ts` (temp-Datei-Schreiben)

**Referenz-Material:**
- Manus Blog: "Context Engineering for AI Agents" (2025)
- Anthropic Docs: Prompt Caching
- Systemtest 2026-04-03/04: 634k Tokens / $2.00 pro Standard-Task
