# ADR-063: Context Externalization -- Dateisystem als erweiterter Kontext

**Status:** Proposed
**Date:** 2026-04-04
**Deciders:** Sebastian Hanke
**Feature:** FEATURE-1802 (Context Externalization)

## Context

Tool-Results (search_files: 50 Matches, semantic_search: 10 Excerpts mit je 2000 chars,
read_file: bis 20.000 chars) akkumulieren in der Conversation History. Bei 8 Iterationen
wachsen die Input-Tokens von 28k auf 200k+. Die History wird bei jedem API-Call komplett
neu gesendet.

Bisherige Ansaetze (In-Place-Compression, Truncation) verletzen entweder das Append-only-
Prinzip (Cache-Invalidierung) oder fuehren zu Informationsverlust.

Manus Context Engineering zeigt einen besseren Weg: Das Dateisystem als erweiterten
Kontext nutzen. Grosse Daten in Dateien auslagern, im Kontext nur eine kompakte Referenz
mit den wichtigsten Informationen behalten. Der Agent kann bei Bedarf nachladen.

**Triggering ASR:**
- C-4: Context Externalization als einheitliches Pattern in der Pipeline
- Quality Attributes: Cost Efficiency, Consistency, Maintainability

## Decision Drivers

- **Einheitliches Pattern**: Alle Tools, eine Stelle, ein Verhalten
- **KV-Cache-Kompatibilitaet**: Append-only, keine History-Manipulation
- **Wiederherstellbarkeit**: Externalisierte Daten muessen nachladbar bleiben
- **Qualitaetserhalt**: Agent muss alle Informationen erreichen koennen
- **Wartbarkeit**: Kein Tool-spezifischer Sondercode

## Considered Options

### Option 1: Tool-spezifische Optimierung

Jedes Tool optimiert seinen eigenen Output: search_files gibt weniger Results,
semantic_search kuerzere Excerpts, read_file kuerzere Inhalte.

- Pro: Einfachste Implementierung (Limits pro Tool anpassen)
- Pro: Kein neuer Mechanismus noetig
- Con: Inkonsistent (jedes Tool anders)
- Con: Loest das Problem nicht fundamental (50 vs 15 Matches sind beide zu viel bei 8 Iterationen)
- Con: Informationsverlust (kuerzere Results = weniger Kontext)

### Option 2: Zentrale Externalization in der ToolExecutionPipeline

NACH der Tool-Ausfuehrung und VOR dem Zurueckgeben des Results: Pipeline
prueft die Groesse. Wenn ueber Threshold: Schreibt volles Result in temp-Datei,
gibt kompakte Referenz zurueck. Einheitliches Pattern fuer alle Tools.

- Pro: Eine Stelle, alle Tools
- Pro: Tools muessen nicht geaendert werden
- Pro: Append-only (Referenz wird von Anfang an in die History geschrieben)
- Pro: Wiederherstellbar (Datei bleibt nachladbar)
- Con: Erfordert temp-Datei-Management (Schreiben, Cleanup)
- Con: Agent muss verstehen dass er nachladen kann

### Option 3: Lazy Result Loading (Results nie in History, immer on-demand)

Tool-Results werden IMMER in Dateien geschrieben. In der History steht NUR
eine Referenz. Agent muss jeden Result per read_file nachladen.

- Pro: Minimale History (nur Referenzen)
- Pro: Konsequentestes Modell
- Con: Mehr Iterationen (Agent muss nachladen = mehr LLM-Calls)
- Con: Widerspricht dem Ziel weniger Iterationen
- Con: Kleine Results (200 chars) unnoetig externalisieren

## Decision

**Vorgeschlagene Option:** Option 2 -- Zentrale Externalization in der Pipeline

**Begruendung:**

Option 1 loest das Problem nicht fundamental. Option 3 ist zu radikal und
erzeugt mehr Iterationen. Option 2 ist der Sweet Spot: Kleine Results bleiben
im Kontext (schneller Zugriff), grosse Results werden externalisiert (Token-Ersparnis).
Ein einheitliches Pattern in der Pipeline verhindert inkonsistentes Verhalten.

**Konkreter Ablauf:**

```
Tool.execute() liefert Result (voller Inhalt)
    ↓
ToolExecutionPipeline prueft Groesse:
    ↓
result.content.length <= EXTERNALIZE_THRESHOLD (2000 chars)?
    JA → Normales Result (unveraendert in History)
    NEIN ↓
        1. Schreibe volles Result in temp-Datei:
           .obsidian-agent/tmp/{taskId}/{tool}-{iteration}.md
        2. Erstelle kompakte Referenz:
           "[{tool}] {summary}. Full results saved to: {path}"
           + Top-N Items mit Score/Relevanz (tool-spezifisch)
        3. Gib Referenz als tool_result zurueck
    ↓
History erhaelt entweder volles Result oder kompakte Referenz
(Append-only -- einmal geschrieben, nie geaendert)
```

**Tool-spezifische Referenz-Generierung:**

```typescript
interface ExternalizationFormatter {
    /** Generate a compact reference for the externalized result. */
    formatReference(toolName: string, result: string, tempPath: string): string;
}

// Default: Erste 500 chars + Dateipfad
// search_files: "Found N matches. Top 5: [path (count)]... Full: {path}"
// semantic_search: "N results. Top 3: [path (score)]... Full: {path}"
// web_fetch: "Fetched {url} (N chars). Summary: {first 500 chars}... Full: {path}"
// read_file: Keine Externalization (Original-Datei existiert im Vault)
```

**Sonderfaelle:**
- `read_file`: Wird NIE externalisiert. Die Originaldatei existiert bereits im Vault.
  Stattdessen: `read_file` Result truncation (bestehende MAX_CONTENT_CHARS=20000) reicht.
- Tool Result Cache: Cached das VOLLE Result (vor Externalization). Wiederholter
  identischer Call liefert gecachtes volles Result → wird erneut externalisiert
  (deterministische, identische Referenz).

## Implementation Sketch

### Neue Dateien
- `src/core/tool-execution/ResultExternalizer.ts` -- Groessencheck + Datei-Write + Referenz-Generierung

### Geaenderte Dateien

| Datei | Aenderung | Risiko |
|-------|-----------|--------|
| `ToolExecutionPipeline.ts` | Nach Tool-Ausfuehrung: ResultExternalizer aufrufen | Low |
| `AgentTask.ts` | taskId an Pipeline uebergeben (fuer temp-Pfad) | Low |
| `main.ts` | Cleanup verwaister tmp-Verzeichnisse beim Plugin-Start | Low |

### Nicht geaendert
- Alle Tool-Implementierungen (SemanticSearchTool, SearchFilesTool, etc.)
- RecipeMatchingService, RecipeStore
- systemPrompt.ts
- MemoryRetriever

### Temp-Datei Management

```
Schreiben: GlobalFileService.write(`tmp/${taskId}/${tool}-${iteration}.md`, content)
Cleanup (nach Task): GlobalFileService.remove(`tmp/${taskId}/`) rekursiv
Crash-Recovery: Beim Plugin-Start alle `tmp/` Unterverzeichnisse aelter als 1h loeschen
```

## Consequences

### Positive
- 50-70% weniger History-Tokens bei Multi-Step-Tasks
- Einheitliches Pattern fuer alle Tools (eine Stelle im Code)
- KV-Cache-stabil (Append-only, keine History-Manipulation)
- Wiederherstellbar (Agent kann nachladen)
- Kein Tool muss geaendert werden

### Negative
- Zusaetzliche Datei-I/O (Schreiben + ggf. Nachladen)
- Agent muss "lernen" dass er nachladen kann (Referenz-Format muss selbsterklaerend sein)
- Temp-Dateien im .obsidian-agent/ Verzeichnis

### Risks
- **Agent laed nie nach**: Referenz-Format enthaelt expliziten Hinweis
  "Use read_file({path}) to see full results". Im Prompt-Routing-Rules
  wird ergaenzt: "When a tool result contains a file reference, use read_file
  to load the full content if needed."
- **Temp-Dateien haeufen sich an**: Mitigation durch Task-Level-Cleanup
  und Crash-Recovery beim Start.
- **EXTERNALIZE_THRESHOLD zu niedrig/hoch**: Konfigurierbarer Threshold
  mit konservativem Default (2000 chars). Kann spaeter angepasst werden.

## Related Decisions

- ADR-001: ToolExecutionPipeline (Externalization wird hier integriert)
- ADR-061: Fast Path (profitiert: weniger Tokens im Planner-Kontext)
- ADR-062: KV-Cache-Optimized Prompt (komplementaer: Prompt stabil, Results extern)
- ADR-012: Context Condensing (wird seltener noetig wenn Results extern sind)

## References

- FEATURE-1802: Context Externalization
- Manus Context Engineering: "Use the filesystem as context"
- Manus: "Our compression strategies are always designed to be recoverable"
