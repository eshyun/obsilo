# Architect Handoff: Token-Kostenreduktion (EPIC-018)

> **Erstellt:** 2026-04-04
> **BA-Input:** _devprocess/analysis/BA-012-token-cost-reduction.md
> **Epic:** EPIC-018 - Token-Kostenreduktion

---

## 1. Aggregierte ASRs

### Critical ASRs (brauchen je ein ADR)

| # | ASR | Feature | Quality Attribute |
|---|-----|---------|-------------------|
| C-1 | Fast Path muss nahtlos in AgentTask-Loop integriert werden | FEATURE-1800 | Reliability |
| C-2 | Tool-Execution im Batch muss ToolExecutionPipeline nutzen (keine Bypass) | FEATURE-1800 | Security, Consistency |
| C-3 | Prompt Caching darf die Prompt-Semantik nicht veraendern | FEATURE-1801 | Correctness |
| C-4 | Context Externalization muss als einheitliches Pattern in der Pipeline implementiert werden | FEATURE-1802 | Consistency, Maintainability |

### Moderate ASRs

| # | ASR | Feature | Quality Attribute |
|---|-----|---------|-------------------|
| M-1 | Recipe-zu-Tool-Parameter-Mapping muss robust sein | FEATURE-1800 | Correctness |
| M-2 | Provider-Abstraktion muss Caching-Hints unterstuetzen | FEATURE-1801 | Extensibility |
| M-3 | Agent muss externalisierte Results selbststaendig nachladen koennen | FEATURE-1802 | Correctness |

---

## 2. NFR-Zusammenfassung

### Performance
- Standard-Task Token-Budget: <130.000 Input-Tokens (aktuell 634.000)
- LLM-Iterationen: <=3 bei erkannten Recipes (aktuell 8)
- Search-Result Tokens: 40-60% Reduktion ohne Recall-Verlust
- Prompt Cache Hit Rate: >80% bei Anthropic/DeepSeek
- Latenz: Gleich oder besser (weniger Roundtrips)

### Reliability
- Fast Path Fallback: 100% nahtloser Uebergang zu normaler ReAct-Loop
- Provider-Kompatibilitaet: 168k-Token-Modelle muessen Standard-Tasks schaffen
- Keine Qualitaetsregression: Agent-Ergebnisse identisch oder besser

### Compatibility
- Multi-Provider: Loesung muss mit und ohne Caching funktionieren
- Review-Bot: Keine neuen Compliance-Verstoesse
- Bestehende Architektur: AgentTask, ToolExecutionPipeline, ReAct-Loop bleiben

---

## 3. Feature-Uebersicht

| Feature | Priority | Key ASRs | Abhaengigkeiten |
|---------|----------|----------|-----------------|
| FEATURE-1800 (Fast Path) | P0 | C-1, C-2, M-1 | ADR-058 (Recipes) |
| FEATURE-1801 (Prompt Caching) | P0 | C-3, M-2 | Provider-Abstraktion (Adapter-Pattern) |
| FEATURE-1802 (Context Externalization) | P1 | C-4, M-3 | ToolExecutionPipeline, GlobalFileService |

---

## 4. Constraints (fuer Architekt)

- **Keine Qualitaetskompromisse**: Absolut. Agent-Ergebnisse muessen identisch oder besser sein.
- **Bestehende Pipeline nutzen**: ToolExecutionPipeline MUSS verwendet werden (keine Bypass).
- **Recipe-Format unveraendert**: ProceduralRecipe Typ bleibt (ADR-058).
- **Multi-Provider**: Loesung darf nicht Provider-exklusiv sein (Caching ist opt-in Bonus).
- **Review-Bot-Compliance**: Keine neuen Verstoesse gegen Obsidian Community Plugin Rules.

### KV-Cache-Prinzipien (Manus Context Engineering -- MUSS beachtet werden)

Diese Prinzipien gelten fuer ALLE Features dieses Epics:

1. **Stabiles Prompt-Prefix**: Kein einziger Token darf sich im stabilen Anteil aendern.
   DateTime, Skills, Memory etc. muessen NACH dem Cache-Breakpoint stehen.
2. **Append-only History**: History-Eintraege duerfen NIE modifiziert oder geloescht werden.
   Nur anhaengen. In-Place-Replacement von Tool-Results ist VERBOTEN.
3. **Maskieren statt Entfernen**: Tool-Liste darf sich zwischen Iterationen NICHT aendern.
   Tool-Steuerung via `tool_choice` Parameter, nicht via Tool-Definitions-Filterung.
4. **Dateisystem als Kontext**: Grosse Daten in Dateien auslagern statt im Kontext halten.
   Kompression muss wiederherstellbar sein (Pfad bleibt, Inhalt nachladbar).
5. **Deterministische Serialisierung**: JSON-Keys muessen stabile Reihenfolge haben.
   Keine Timestamps oder Zufallswerte in History-Eintraegen.

Referenz: Manus Blog "Context Engineering for AI Agents" (2025)

---

## 5. Open Questions (fuer Architekt)

### Fast Path (FEATURE-1800)
1. Wo im AgentTask.run() Flow setzt der Fast Path ein? Vor der Loop? Als Ersatz?
2. Wie fuellt der LLM die Recipe-Steps mit konkreten Parametern? (1 "Planner"-Call?)
3. Wie werden Tool-Errors im Batch behandelt? (Retry einzeln? Ganzen Fast Path abbrechen?)
4. Soll Fast Path ein eigenes Token-Budget haben?
5. Wie interagiert Fast Path mit Power Steering und Soft Iteration Limit?
6. Wie wird `tool_choice` genutzt um Tools zu steuern ohne die Tool-Liste zu aendern? (Manus-Prinzip)
7. Wie wird die Todo-Liste als Aufmerksamkeits-Anker am Ende des Kontexts platziert?

### Prompt Caching (FEATURE-1801)
8. Wo werden cache_control Breakpoints gesetzt? (Provider-Layer oder Prompt-Layer?)
9. DateTime steht aktuell an Position 1 und zerstoert den Cache -- wohin verschieben?
10. Wie erkennt der Code ob der aktuelle Provider Caching unterstuetzt?
11. Veraendert die Section-Umordnung (Skills nach hinten) das Agent-Verhalten messbar?
    (Primacy Effect vs. KV-Cache-Stabilitaet -- empirischer Test noetig)

### Context Externalization (FEATURE-1802)
12. Exakter EXTERNALIZE_THRESHOLD? (2000 chars vorgeschlagen, evtl. abhaengig vom Context Window?)
13. Wo werden temp-Dateien gespeichert? (.obsidian-agent/tmp/ oder unsichtbar?)
14. Wie wird der Agent instruiert dass externalisierte Results nachladbar sind?
15. Soll Externalization per Tool konfigurierbar sein (z.B. read_file nie externalisieren)?
16. Wie werden temp-Dateien nach Task-Completion bereinigt (inkl. Crash-Recovery)?
17. Wie misst man objektiv ob externalisierte Results gleich gute Agent-Ergebnisse liefern?

---

## 6. Messdaten (Referenz)

**Systemtest 2026-04-03/04:**
- Task: "Suche meine Notizen zum Thema Kant und erstelle eine Zusammenfassung"
- Input-Tokens: 634.123 (OpenRouter Sonnet 4.6)
- Output-Tokens: 2.755
- Kosten: ~$2.00
- Iterationen: 8
- Bei GitHub Copilot (168k Limit): Scheitert mit 183.820 Tokens

**Token-Breakdown (geschaetzt pro Iteration):**
- System Prompt + Tools: ~28.000 Tokens (konstant)
- Tool-Results (akkumulierend): +10.000-30.000 pro Iteration
- Assistant-Responses: +2.000-5.000 pro Iteration

---

## 7. Kontext-Dokumente

- `_devprocess/analysis/BA-012-token-cost-reduction.md`
- `_devprocess/requirements/epics/EPIC-018-token-cost-reduction.md`
- `_devprocess/requirements/features/FEATURE-1800-fast-path-execution.md`
- `_devprocess/requirements/features/FEATURE-1801-prompt-caching.md`
- `_devprocess/requirements/features/FEATURE-1802-context-externalization.md`
- `_devprocess/architecture/ADR-058-semantic-recipe-promotion.md` (Grundlage Fast Path)
- `_devprocess/architecture/ADR-012-context-condensing.md` (Interaktion mit FEATURE-1802)
