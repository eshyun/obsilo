# Plan Context: FEATURE-1504 Local Reranking (transformers.js)

> **Feature**: FEATURE-1504
> **Epic**: EPIC-015 - Unified Knowledge Layer
> **ADRs**: ADR-051 (Pipeline Stufe 4), ADR-052 (Reranker: transformers.js)
> **Erstellt**: 2026-03-30

---

## 1. Ziel

Top-20 Retrieval-Kandidaten durch lokalen Cross-Encoder Reranker priorisieren.
Kein API-Call, kein Native Addon. Reines JS + WASM via @huggingface/transformers.

## 2. Technologie-Stack

- **Package:** `@huggingface/transformers` (npm install)
- **Modell:** `Xenova/ms-marco-MiniLM-L-6-v2` (INT8 quantisiert, ~23MB)
- **Runtime:** ONNX Runtime Web (WASM) -- integriert in transformers.js
- **Backend:** Explizit WASM forcieren (Electron Detection Workaround)

## 3. Integration in bestehende Pipeline

**SemanticSearchTool.ts** -- Reranking nach RRF-Fusion + Metadata-Filter, VOR Graph/Implicit:

```
1. HyDE (optional)
2. Hybrid Search: Semantic + Keyword via RRF Fusion
3. Metadata Filters (folder, tags, since)
3b. RERANKING (wenn enabled + Modell geladen)   <-- NEU
4. Graph Expansion
5. Implicit Connections
6. Output
```

## 4. Neue Datei: `src/core/knowledge/RerankerService.ts`

```typescript
class RerankerService {
    constructor(modelDir: string)

    async loadModel(): Promise<void>      // Lazy Load
    isLoaded(): boolean
    unload(): void

    async rerank(query: string, candidates: RerankCandidate[], topK?: number): Promise<RerankResult[]>
}
```

**Lazy Load:** Modell wird erst beim ersten `rerank()`-Aufruf geladen (~3s).
Danach im Speicher bis Plugin-Unload.

**rerank() Ablauf:**
1. Fuer jeden Kandidaten: tokenize(query, candidateText)
2. model(inputs) -> logits
3. Sort by logits DESC, return Top-K

## 5. Modell-Delivery

**Option A (empfohlen):** Im Plugin-Bundle
- esbuild kopiert ONNX-Dateien nach Plugin-Verzeichnis (wie sql.js WASM)
- Kein separater Download noetig
- ~23MB zusaetzlich zum Bundle

**Option B:** Lazy Download
- Modell wird beim ersten Aktivieren heruntergeladen
- Gespeichert in `~/.obsidian-agent/models/`
- Download via `requestUrl` (Review-Bot-konform)

## 6. Bestehende Dateien aendern

### settings.ts
```typescript
enableReranking: boolean;       // default: false (muss explizit aktiviert werden)
rerankCandidates: number;       // default: 20
```

### main.ts
- RerankerService instanziieren (nach ImplicitConnectionService)
- Lazy: Modell wird nicht beim Start geladen, erst bei erstem rerank()
- Plugin-Unload: `rerankerService.unload()`

### SemanticSearchTool.ts
- Nach Metadata-Filter (Zeile ~171), VOR Graph-Expansion:
- `if (rerankerService?.isLoaded()) results = await rerankerService.rerank(query, results, topK)`

### EmbeddingsTab.ts
- Reranking Toggle
- Kandidaten-Anzahl Slider
- Status: "Model loaded" / "Not loaded" / "Loading..."

### esbuild.config.mjs
- ONNX-Modell-Dateien in Plugin-Verzeichnis kopieren (wie sql.js WASM)

## 7. Performance-Ziele

| Metrik | Target |
|--------|--------|
| Reranking 20 Kandidaten | <200ms (WASM) |
| Modell-Laden (Lazy) | <3s (einmalig) |
| Memory waehrend Inference | <150MB |
| Modell-Groesse (INT8) | ~23MB |

## 8. Implementierungsreihenfolge

1. `npm install @huggingface/transformers`
2. RerankerService.ts (NEU)
3. Settings: enableReranking, rerankCandidates
4. main.ts: Wiring
5. SemanticSearchTool: Reranking-Step
6. EmbeddingsTab: UI
7. esbuild: Modell-Dateien kopieren (oder Lazy Download)
8. Build + Deploy + Test
