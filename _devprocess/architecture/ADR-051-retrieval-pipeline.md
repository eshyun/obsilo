# ADR-051: 4-Stufen Retrieval-Pipeline

**Status:** Proposed
**Date:** 2026-03-29
**Deciders:** Sebastian Hanke

## Context

Die aktuelle Suche in Obsilo ist ein einfacher Cosine-Similarity-Lookup: Query embedden, gegen alle Chunk-Vektoren vergleichen, besten Chunk pro Datei zurueckgeben. Dies ignoriert den reichen Obsidian-Graph (Wikilinks, Tags, MOC-Properties), erkennt keine impliziten Verbindungen, und liefert nur isolierte Chunks ohne Kontext.

Der User will vernetztes Denken: implizite Verbindungen erkennen, MOC-Struktur nutzen, zusammenhaengende Informationen statt isolierte Chunks.

**Triggering ASRs:**
- ASR-3 (FEATURE-1502): Incremental Graph Updates
- ASR-4 (FEATURE-1504): Graceful Degradation (jede Stufe ueberspringbar)
- ASR-6 (FEATURE-1503): Scalable Pairwise Computation

## Decision Drivers

- **Vernetztes Denken**: Ergebnisse muessen strukturelle und semantische Zusammenhaenge zeigen
- **Graceful Degradation**: Jede Stufe muss optional sein (Mobile: kein Reranking; neuer Vault: kein Graph)
- **Performance**: Gesamte Pipeline <300ms (mit Reranking), <100ms (ohne)
- **Bestehende API**: `semantic_search` Tool-Signatur muss kompatibel bleiben
- **Token-Budget**: Ergebnisse muessen in endliches LLM-Context-Window passen

## Considered Options

### Option 1: Starre 4-Stufen-Kette (immer alle Stufen)

Jede Suche durchlaeuft immer: Vector -> Graph -> Implicit -> Rerank.

- Pro: Einfache Implementierung, deterministisches Verhalten
- Con: Scheitert wenn eine Stufe nicht verfuegbar ist (kein Graph, kein Reranker)
- Con: Overhead fuer einfache Queries die keinen Graph brauchen

### Option 2: Konfigurierbare Pipeline (Stufen einzeln an/aus)

Jede Stufe ist ein eigenstaendiger Service. Pipeline-Orchestrator ruft nur aktivierte Stufen auf. Ergebnisse werden zwischen Stufen als vereinheitlichtes `SearchResult[]` Format weitergereicht.

- Pro: Graceful Degradation -- Mobile hat kein Reranking, neuer Vault hat keinen Graph
- Pro: Performance -- einfache Queries koennen Stufen ueberspringen
- Pro: Testbar -- jede Stufe unabhaengig testbar
- Pro: Erweiterbar -- neue Stufen (z.B. Full-Text) leicht hinzufuegbar
- Con: Komplexere Architektur (Orchestrator + einheitliches Result-Format)
- Con: Ergebnis-Fusion zwischen Stufen braucht Scoring-Strategie

### Option 3: Single monolithischer Retriever (alles in einer Methode)

Eine grosse search() Methode die alle Logik enthaelt, mit if-Bedingungen fuer optionale Teile.

- Pro: Einfach zu verstehen (alles an einem Ort)
- Con: Nicht testbar, nicht erweiterbar, nicht konfigurierbar
- Con: Wiederholt das aktuelle Problem (SemanticIndexService ist bereits monolithisch)

## Decision

**Vorgeschlagene Option:** Option 2 -- Konfigurierbare Pipeline

**Begruendung:**
ASR-4 verlangt Graceful Degradation -- eine starre Kette scheitert daran. Die Pipeline-Architektur erlaubt Mobile-Support (ohne Reranking), frische Vaults (ohne Graph), und User-Konfiguration (Stufen an/aus). Das einheitliche `SearchResult[]` Format zwischen Stufen macht die Pipeline erweiterbar.

**Hinweis:** Dies ist ein VORSCHLAG. Claude Code entscheidet final basierend auf dem realen Zustand der Codebase.

## Consequences

### Positive
- Jede Stufe unabhaengig entwickelbar und testbar
- Mobile nutzt Stufe 1-3 (ohne Rerank), Desktop alle 4
- User kann Stufen in Settings deaktivieren
- Neue Stufen (z.B. Full-Text Search, Temporal Ranking) spaeter einfach hinzufuegbar

### Negative
- Scoring-Fusion zwischen Stufen ist nicht trivial (wie kombiniert man Cosine-Score mit Graph-Hop-Distance?)
- Pipeline-Orchestrator ist eine neue Abstraktion die gewartet werden muss
- Mehr Dateien / Services als die aktuelle monolithische Loesung

### Risks
- **Score-Normalisierung**: Cosine-Similarity (0-1) und Graph-Hop (1-2) haben verschiedene Skalen. Mitigation: Gewichtete Kombination mit konfigurierbaren Gewichten.
- **Latenz-Kumulierung**: 4 Stufen hintereinander koennten >300ms werden. Mitigation: Stufe 2+3 parallel ausfuehrbar (beide arbeiten auf DB-Queries, nicht auf API-Calls).

## Implementation Notes

### Pipeline-Architektur

```typescript
interface RetrievalStage {
    name: string;
    enabled: boolean;
    execute(input: SearchContext): Promise<SearchResult[]>;
}

interface SearchContext {
    query: string;
    queryVector: Float32Array;
    topK: number;
    results: SearchResult[];      // Akkumuliert ueber Stufen
    settings: KnowledgeSettings;
}

interface SearchResult {
    path: string;
    text: string;                 // Chunk-Text (ggf. mit Adjacent)
    score: number;                // Normalisierter Relevanz-Score (0-1)
    source: 'vector' | 'graph' | 'implicit';
    context?: string;             // "via [[Kuenstliche Intelligenz]]" etc.
    chunkIndex?: number;
}

class RetrievalPipeline {
    private stages: RetrievalStage[] = [];

    async search(query: string, topK: number): Promise<SearchResult[]> {
        const queryVector = await this.embed(query);
        const ctx: SearchContext = { query, queryVector, topK, results: [], settings };

        for (const stage of this.stages) {
            if (!stage.enabled) continue;
            ctx.results = await stage.execute(ctx);
        }

        return ctx.results.slice(0, topK);
    }
}
```

### Stufe 1: VectorSearchStage

```
Input:  queryVector
Output: Top-N Chunks sortiert nach Cosine-Similarity
        + Adjacent Chunks (chunk-1, chunk+1) pro Treffer
        + Multi-Chunk pro Datei (bis zu 3)

Implementierung: Bulk-Load Vektoren aus SQLite, JS Cosine-Similarity
Performance: <50ms fuer 6K Vektoren
```

### Stufe 2: GraphExpansionStage

```
Input:  Stufe-1 Ergebnisse (Pfade der Treffer)
Output: Stufe-1 + erweiterte Notes (1-2 Hops ueber Wikilinks/MOC)
        Jeder erweiterte Treffer hat context: "via [[Link]]"

Implementierung: SQL Query auf edges-Tabelle, BFS mit max 2 Hops
Performance: <10ms (DB Lookup)
Parallel mit Stufe 3 ausfuehrbar
```

### Stufe 3: ImplicitConnectionStage

```
Input:  Stufe-1 Ergebnisse (Pfade der Treffer)
Output: Stufe-1+2 + implizit verwandte Notes (hohe Similarity, kein Link)
        Jeder Treffer hat source: 'implicit', score aus implicit_edges

Implementierung: SQL Query auf implicit_edges-Tabelle
Performance: <5ms (DB Lookup)
Parallel mit Stufe 2 ausfuehrbar
```

### Stufe 4: RerankingStage

```
Input:  Alle bisherigen Ergebnisse (~20 Kandidaten)
Output: Top-K reranked (Cross-Encoder Score ersetzt/gewichtet bisherigen Score)

Implementierung: ONNX Runtime mit BGE-Reranker
Performance: <200ms auf Desktop
Fallback: Nicht ausgefuehrt auf Mobile (Stage.enabled = false)
```

### Ergebnis-Fusion (Score-Normalisierung)

```typescript
// Gewichtete Kombination
const WEIGHTS = {
    vector: 0.5,    // Cosine Similarity (Stufe 1)
    graph: 0.3,     // Graph-Naehe (Stufe 2) -- 1/hop_distance
    implicit: 0.2,  // Implicit Similarity (Stufe 3)
};

// Nach Reranking (Stufe 4): Rerank-Score ersetzt den kombinierten Score
// (Cross-Encoder betrachtet Query+Text gemeinsam = zuverlaessigster Score)
```

### Settings-Integration

```typescript
interface KnowledgeLayerSettings {
    // Stufe 1
    enableSemanticIndex: boolean;       // existiert bereits
    adjacentChunks: number;             // default: 1 (chunk-1 + chunk+1)
    maxChunksPerFile: number;           // default: 3

    // Stufe 2
    enableGraphExpansion: boolean;      // default: true
    graphHops: number;                  // default: 1, max: 2
    mocProperties: string[];            // default: ['Themen', 'Konzepte', 'Personen', ...]

    // Stufe 3
    enableImplicitConnections: boolean; // default: true
    implicitThreshold: number;          // default: 0.7
    enableActiveProposals: boolean;     // default: true

    // Stufe 4
    enableReranking: boolean;           // default: true (Desktop), false (Mobile auto)
    rerankModel: string;                // default: 'bge-reranker-v2-m3'
    rerankCandidates: number;           // default: 20
}
```

## Related Decisions

- ADR-050: SQLite Knowledge DB (Storage-Grundlage)
- ADR-052: Reranker Integration (Stufe 4 Detail)

## References

- FEATURE-1501: Enhanced Vector Retrieval
- FEATURE-1502: Graph Extraction & Expansion
- FEATURE-1503: Implicit Connections
- FEATURE-1504: Local Reranking
