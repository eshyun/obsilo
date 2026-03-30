# Plan Context: FEATURE-1504 Local Reranking

> **Feature**: FEATURE-1504
> **Epic**: EPIC-015 - Unified Knowledge Layer
> **ADRs**: ADR-051 (Pipeline Stufe 4), ADR-052 (Reranker Integration)
> **Erstellt**: 2026-03-30

---

## 1. Ziel

Nach den 3 bisherigen Retrieval-Stufen (Vector, Graph, Implicit) die ~20 Kandidaten
durch einen lokalen Cross-Encoder Reranker auf die besten Top-K priorisieren.
Kein API-Call, kein Netzwerk -- 100% lokal. Auf Mobile: Graceful Fallback.

## 2. Technologie-Entscheidung

**Modell:** BGE-Reranker-v2-m3 (BAAI) -- INT8 quantisiert, ~125MB
**Runtime:** onnxruntime-node (Native, schneller als WASM)
**Tokenizer:** @xenova/transformers (BERT WordPiece)
**Modell-Storage:** `~/.obsidian-agent/models/bge-reranker-v2-m3-int8/` (global)
**Download:** Via requestUrl (Review-Bot konform), mit Fortschrittsanzeige

## 3. Integration in bestehende Pipeline

SemanticSearchTool.ts -- aktueller Flow:
```
1. HyDE (optional) -> Query-Embedding
2. Hybrid Search: Semantic + Keyword via RRF Fusion -> Top-K
3. Metadata Filters (folder, tags, since)
4. Graph Expansion (FEATURE-1502)
5. Implicit Connections (FEATURE-1503)
6. Output
```

Reranking wird nach Schritt 3 (Metadata Filters), VOR Schritt 4 (Graph/Implicit) eingefuegt:
```
3. Metadata Filters
3b. RERANKING: Cross-Encoder auf Top-20 -> reorder -> Top-K  <-- NEU
4. Graph Expansion
5. Implicit Connections
6. Output
```

Begruendung: Reranking verbessert die Qualitaet der Top-K Ergebnisse die dann
fuer Graph/Implicit-Expansion als Startpunkte dienen.

## 4. Neue Dateien

### `src/core/knowledge/RerankerService.ts`

```typescript
class RerankerService {
    constructor(modelDir: string)

    // Lifecycle
    async loadModel(): Promise<void>    // Lazy Load beim ersten rerank()
    async downloadModel(onProgress?): Promise<void>
    isModelAvailable(): boolean
    isLoaded(): boolean
    unload(): void

    // Core
    async rerank(query: string, candidates: RerankCandidate[], topK?: number): Promise<RerankResult[]>
}

interface RerankCandidate {
    path: string;
    text: string;
    score: number;    // Original-Score (Cosine/RRF)
}

interface RerankResult extends RerankCandidate {
    rerankScore: number;  // Cross-Encoder Score
}
```

**rerank() Ablauf:**
1. Fuer jeden Kandidaten: Tokenize `[CLS] query [SEP] text [SEP]`
2. Batch Inference via ONNX Session (alle Kandidaten gleichzeitig)
3. Softmax/Sigmoid auf Output -> rerankScore
4. Sort by rerankScore DESC, return Top-K

## 5. Settings

```typescript
enableReranking: boolean;       // default: false (muss explizit aktiviert werden)
rerankCandidates: number;       // default: 20 (wie viele Kandidaten reranken)
rerankModel: string;            // default: 'bge-reranker-v2-m3-int8'
```

## 6. UI (EmbeddingsTab)

- Reranking Toggle (default: off)
- Modell-Status: "Not downloaded" / "Downloaded (125MB)" / "Loaded"
- Download-Button mit Progress
- Kandidaten-Anzahl Slider (10-30)

## 7. Dependencies

```
npm install onnxruntime-node    -- ONNX Runtime
```

Tokenizer: BGE-Reranker nutzt einen BERT Tokenizer. Optionen:
- @xenova/transformers (~5MB) -- voll-featured, aber gross
- Eigener minimaler WordPiece Tokenizer -- leichter, aber Aufwand

## 8. Review-Bot Compliance

- `require('onnxruntime-node')` braucht eslint-disable mit Begruendung (wie electron, sql.js)
- Modell-Download via `requestUrl` (Obsidian API, nicht `fetch()`)
- Modell NICHT im Plugin-Bundle (extern, ~/.obsidian-agent/models/)

## 9. Performance-Ziele

| Metrik | Target |
|--------|--------|
| Reranking 20 Kandidaten | <200ms |
| Modell-Laden (Lazy) | <3s (einmalig) |
| Memory waehrend Inference | <300MB |
| Modell-Download (125MB) | Abhaengig von Verbindung |

## 10. Risiken

| Risiko | Mitigation |
|--------|-----------|
| onnxruntime-node nicht Electron-kompatibel | Fallback: onnxruntime-web (WASM, langsamer) |
| 125MB Download scheitert | Retry + Resume. Reranking bleibt optional. |
| Memory-Druck auf aelteren Geraeten | Lazy Load, Unload nach Inaktivitaet |
| Review-Bot lehnt require('onnxruntime-node') ab | eslint-disable + ausfuehrliche Begruendung |
