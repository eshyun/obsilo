# ADR-061: Fast Path Execution -- Recipe-gesteuertes Batching

**Status:** Proposed
**Date:** 2026-04-04
**Deciders:** Sebastian Hanke
**Feature:** FEATURE-1800 (Fast Path Execution)

## Context

Der Agent braucht fuer eine Standard-Aufgabe ("suche Notizen zu X, erstelle Zusammenfassung")
8 LLM-Iterationen mit 634.000 Input-Tokens (~$2.00). Jede Iteration sendet die gesamte
bisherige History erneut. Das Semantic Recipe Promotion System (ADR-058) erkennt bereits
wiederkehrende Patterns und erzeugt Recipes mit Tool-Steps.

Aktuell werden Recipes nur als Text-Hint in den System Prompt injiziert. Der Agent
muss trotzdem bei jedem Step eine vollstaendige LLM-Inferenz durchfuehren.

**Triggering ASRs:**
- C-1: Fast Path muss nahtlos in AgentTask-Loop integriert werden
- C-2: Tool-Execution im Batch muss ToolExecutionPipeline nutzen
- Quality Attributes: Cost Efficiency, Performance, Reliability

## Decision Drivers

- **Token-Reduktion**: 8 Iterationen → 2-3 (75% weniger Tokens)
- **KV-Cache-Stabilitaet** (Manus): Tool-Liste darf sich NICHT aendern zwischen Iterationen
- **Qualitaetserhalt**: Identische Ergebnisse wie normale ReAct-Loop
- **Graceful Degradation**: Unbekannte Tasks muessen weiterhin normal funktionieren
- **Pipeline-Compliance**: Alle Governance-Regeln (Approval, Checkpoints, Logging) bleiben

## Considered Options

### Option 1: Pre-Loop Fast Path (vor der ReAct-Loop)

Vor AgentTask.run() Loop-Start: Pruefen ob ein Recipe matcht. Wenn ja:
1. EIN LLM-Call ("Planner"): Recipe-Steps mit konkreten Parametern fuellen
2. Deterministische Tool-Ausfuehrung via ToolExecutionPipeline
3. EIN LLM-Call ("Presenter"): Ergebnisse zusammenfassen und praesentieren
4. Wenn Fehler: Fallback auf normale Loop mit bereits gesammelten Results

- Pro: Klare Trennung von Fast Path und Normal Path
- Pro: System Prompt wird nur 2x berechnet statt 8x
- Pro: Bestehende Loop bleibt komplett unveraendert
- Con: Zwei verschiedene Ausfuehrungspfade zu warten
- Con: Planner-Call muss alle Parameter auf einmal bestimmen (schwieriger)

### Option 2: First-Iteration Fast Path (innerhalb der Loop)

In der ersten Iteration der bestehenden Loop: Wenn Recipe matcht, sendet man
dem LLM das Recipe als "Plan" und nutzt `tool_choice: "required"` um den
naechsten Tool-Call zu erzwingen. Parallele read-safe Tools via Promise.all.

- Pro: Nur ein Ausfuehrungspfad (die bestehende Loop)
- Pro: Alle bestehenden Mechanismen (Power Steering, Condensing, Error Handling) greifen
- Pro: Weniger neuer Code
- Con: Immer noch 1 LLM-Call pro Tool-Step (nur weniger Steps)
- Con: Kein deterministischer Pfad -- LLM kann vom Recipe abweichen

### Option 3: Hybrid (Pre-Loop Batch + Loop Fallback)

Vor der Loop: Recipe erkennen, Planner-Call, dann Tool-Batch ausfuehren.
Ergebnisse in die History schreiben. Dann die normale Loop starten, aber
mit dem Kontext "Du hast bereits diese Tools ausgefuehrt, hier sind die
Ergebnisse. Vervollstaendige die Aufgabe." Loop macht dann 1-2 Iterationen
fuer Praesentation/Nacharbeit.

- Pro: Deterministischer Batch (keine LLM-Entscheidung pro Step)
- Pro: Falls Batch nicht reicht, uebernimmt die normale Loop
- Pro: History ist Append-only (Batch-Results werden angehaengt, nicht eingefuegt)
- Pro: Bestehende Loop-Mechanismen greifen fuer den Tail
- Con: Komplexeste Option
- Con: History muss die Batch-Results als synthetische Messages enthalten

## Decision

**Vorgeschlagene Option:** Option 3 -- Hybrid (Pre-Loop Batch + Loop Fallback)

**Begruendung:**

Option 1 ist sauber aber fragil (was wenn der Planner-Call nicht alle Parameter
richtig bestimmt?). Option 2 spart zu wenig (immer noch 1 LLM-Call pro Step).
Option 3 kombiniert das Beste: Deterministische Batch-Ausfuehrung fuer die
bekannten Steps, flexible Loop fuer alles Unvorhergesehene.

**Konkreter Ablauf:**

```
1. RecipeMatchingService.match(userMessage) → Recipe gefunden?
   NEIN → Normale ReAct-Loop (unveraendert)
   JA ↓

2. "Planner" LLM-Call:
   System: "Du hast ein bewährtes Recipe für diese Aufgabe."
   User: Recipe-Steps + User-Message
   Output: JSON mit konkreten Tool-Calls [{tool, input}, ...]
   (1 LLM-Call, ~30k Tokens)

3. Deterministische Tool-Batch-Ausfuehrung:
   Fuer jeden Step aus dem Plan:
   - ToolExecutionPipeline.executeTool() (volle Governance)
   - Parallele Ausfuehrung fuer read-safe Tools (Promise.all)
   - Ergebnisse sammeln
   (0 LLM-Calls, nur Tool-Ausfuehrung)

4. History aufbauen:
   - Synthetische Assistant-Message: "Ich habe folgende Schritte ausgefuehrt: ..."
   - Tool-Results als tool_result Blocks
   - Todo-Liste (falls vorhanden) als letzte User-Message (Recency-Anker)

5. Normale Loop starten (mit vorbereiteter History):
   - Agent sieht die Batch-Ergebnisse und praesendiert/vervollstaendigt
   - Typisch: 1-2 weitere Iterationen (write_file + Zusammenfassung)
   (1-2 LLM-Calls, ~40k Tokens)

GESAMT: 2-3 LLM-Calls statt 8 = ~70k Tokens statt 634k
```

**KV-Cache-Kompatibilitaet (Manus):**
- Tool-Liste bleibt UNVERAENDERT zwischen Planner und Loop
- History ist Append-only (Batch-Results werden angehaengt)
- Kein `tool_choice` Filtering noetig (Planner bestimmt Tools, Batch fuehrt aus)

**Hinweis:** Dies ist ein VORSCHLAG. Claude Code entscheidet final
basierend auf dem realen Zustand der Codebase.

## Consequences

### Positive
- 75% weniger Token-Kosten bei erkannten Recipes
- Schnellere Task-Completion (weniger Roundtrips)
- Bestehende Loop bleibt fuer unbekannte Tasks unveraendert
- Pipeline-Governance (Approval, Checkpoints, Logging) greift weiterhin

### Negative
- Neuer Code-Pfad (FastPathExecutor) erhoht Komplexitaet
- Planner-Call kann ungueltige Tool-Parameter erzeugen (braucht Validation)
- Synthetische History-Messages muessen sorgfaeltig formatiert werden

### Risks
- **Planner erzeugt falsche Parameter**: Mitigation durch inputSchema-Validation
  vor Ausfuehrung. Bei Validation-Fehler: Fallback auf normale Loop.
- **Batch-Execution scheitert teilweise**: Mitigation durch Error-Sammlung und
  Uebergabe an die Loop ("Diese Tools haben funktioniert, diese nicht").
- **Recipe passt nicht zum konkreten Task**: Mitigation durch Confidence-Score
  im RecipeMatchingService. Nur bei Score > 0.5 Fast Path nutzen.

## Implementation Notes

### Neue Dateien
- `src/core/FastPathExecutor.ts` -- Orchestriert Planner + Batch + History-Aufbau

### Geaenderte Dateien
- `AgentTask.ts` -- Vor der Loop: FastPath-Check, bei Match FastPath starten
- `AgentSidebarView.ts` -- Fast-Path-Indikator (optional, UI)

### Nicht geaendert
- `ToolExecutionPipeline.ts` -- Wird nur aufgerufen, nicht geaendert
- `RecipeMatchingService.ts` -- Wird nur abgefragt
- `RecipeStore.ts` -- Rezepte bleiben unveraendert
- `systemPrompt.ts` -- Prompt-Struktur bleibt

## Related Decisions

- ADR-058: Semantic Recipe Promotion (liefert die Recipes)
- ADR-017: Procedural Recipes (Format-Definition)
- ADR-001: ToolExecutionPipeline (wird genutzt, nicht umgangen)

## References

- FEATURE-1800: Fast Path Execution
- Manus Context Engineering: Maskieren statt Entfernen, Append-only History
- LLMCompiler (2024): Task-DAG mit paralleler Ausfuehrung
- ReWOO (2023): Planner-Output mit Variablen-Referenzen
