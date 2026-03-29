# ADR-052: Local Reranker Integration

**Status:** Proposed
**Date:** 2026-03-29
**Deciders:** Sebastian Hanke

## Context

Die Retrieval-Pipeline (ADR-051) liefert nach Stufe 1-3 ca. 20 Kandidaten-Ergebnisse. Diese sind nach Cosine-Similarity sortiert, aber Cosine-Similarity ist ein schwacher Relevanz-Indikator: sie misst Aehnlichkeit des Themas, nicht Relevanz fuer die spezifische Frage. Ein Cross-Encoder Reranker betrachtet Query und Chunk gemeinsam und verbessert die Precision um 33-47%.

Der User will lokale Verarbeitung (Datenschutz, Showcase). Mobile hat keine ML-Runtime.

**Triggering ASR:**
- ASR-4 (FEATURE-1504): Graceful Degradation -- Reranking muss optional sein
- Quality Attribute: Performance, Availability, Portability

## Decision Drivers

- **Lokal**: Keine externen API-Aufrufe, Vault-Daten bleiben auf dem Geraet
- **Performance**: <200ms fuer 20 Kandidaten auf Desktop
- **Portable**: Desktop ja, Mobile Fallback auf Cosine-Only
- **Bundle-Groesse**: Modell darf NICHT im Plugin-Bundle sein (~500MB)
- **Review-Bot**: ONNX Runtime braucht eslint-disable mit Begruendung

## Considered Options

### Option 1: BGE-Reranker-v2-m3 via onnxruntime-node (Native)

BAAI's Open-Weight Reranker (278M Params). Bestes Open-Source-Modell fuer EN+DE. Laeuft via onnxruntime-node (Native C++ Bindings in Electron).

- Pro: Beste Qualitaet (matching Cohere Rerank)
- Pro: Lokal, keine API-Kosten
- Pro: Multi-lingual (EN, DE, ZH, etc.)
- Pro: onnxruntime-node in Electron gut unterstuetzt
- Con: Modell ~500MB (FP32) oder ~125MB (INT8 quantisiert)
- Con: Separater Download noetig (nicht im Bundle)
- Con: onnxruntime-node ist Native Addon -- Review-Bot-Risiko
- Con: Nicht auf Mobile

### Option 2: BGE-Reranker via onnxruntime-web (WASM)

Gleicher Reranker, aber als WASM statt Native Addon.

- Pro: WASM = kein Native Addon, Review-Bot-sicherer
- Pro: Theoretisch auch auf Mobile moeglich
- Con: 2-5x langsamer als Native (~500ms statt ~200ms fuer 20 Chunks)
- Con: WASM Memory Limits koennten 278M-Modell nicht laden
- Con: Mobile hat zu wenig Memory fuer das Modell

### Option 3: Cohere/Jina Rerank API

Cloud-basiertes Reranking. $0.0009 pro Query.

- Pro: Beste Performance (Server-seitig)
- Pro: Kein lokales Modell, kein Memory-Verbrauch
- Pro: Funktioniert auf Mobile
- Con: Daten verlassen das Geraet -- Datenschutz-Problem
- Con: Braucht Netzwerk -- Offline nicht moeglich
- Con: API-Key Management
- Con: Widerspricht der "lokal"-Anforderung des Users

### Option 4: LLM-basiertes Reranking

Den ohnehin konfigurierten LLM kurz fragen: "Welche 5 dieser 20 Excerpts sind am relevantesten?"

- Pro: Kein zusaetzliches Modell
- Pro: Nutzt bestehende API-Konfiguration
- Pro: Funktioniert auf Mobile (API Call)
- Con: 200-1000 Token pro Reranking-Aufruf = teuer bei haeufiger Nutzung
- Con: Latenz ~1-3s (LLM-Roundtrip) -- zu langsam fuer inline Suche
- Con: Inkonsistente Ergebnisse (LLM-Nondeterminismus)

## Decision

**Vorgeschlagene Option:** Option 1 -- BGE-Reranker-v2-m3 via onnxruntime-node (INT8 quantisiert)

**Begruendung:**
Der User hat explizit lokale Verarbeitung priorisiert. onnxruntime-node ist in Electron bewahrt und bietet die beste Latenz (~100-200ms). INT8-Quantisierung reduziert das Modell auf ~125MB bei <10% Quality-Loss -- ein guter Kompromiss. Der Review-Bot-Risiko ist handhabbar (eslint-disable mit Begruendung, wie bei bestehenden `require('electron')` und `require('child_process')` Ausnahmen).

Graceful Degradation: Auf Mobile und wenn der Reranker nicht heruntergeladen ist, faellt die Pipeline automatisch auf Cosine-Only zurueck (Stufe 1-3).

**Hinweis:** Dies ist ein VORSCHLAG. Claude Code entscheidet final basierend auf dem realen Zustand der Codebase.

## Consequences

### Positive
- Lokales Reranking ohne API-Kosten
- 33-47% bessere Precision fuer Top-5 Ergebnisse
- Datenschutz: Vault-Daten verlassen nie das Geraet
- Showcase-Wert: Lokales ML-Modell im Obsidian Plugin

### Negative
- 125MB Modell-Download (einmalig) -- braucht Download-Manager mit Progress
- onnxruntime-node ist Native Addon (~10MB) -- erhoht Plugin-Komplexitaet
- Nur Desktop -- Mobile hat keinen Reranker
- Memory-Overhead: ~300MB peak waehrend Inference

### Risks
- **Review-Bot lehnt onnxruntime-node ab**: Mitigation: eslint-disable wie bei bestehenden require-Ausnahmen. Falls abgelehnt: Fallback auf onnxruntime-web (WASM, langsamer).
- **Modell zu gross fuer schwache Hardware**: Mitigation: Reranking deaktivierbar in Settings. Kleineres Modell (TinyBERT ~60MB) als Alternative evaluieren.
- **INT8-Quantisierung verschlechtert DE-Qualitaet**: Mitigation: A/B Test mit 20 Queries auf deutschem Content. Falls >20% Quality-Loss: FP16 (~250MB) statt INT8.

## Implementation Notes

### Modell-Download & Storage

```
~/.obsidian-agent/models/
  bge-reranker-v2-m3-int8/
    model.onnx          (~125MB)
    tokenizer.json       (~2MB)
    config.json
```

Download via Obsidians `requestUrl` (Review-Bot-konform, kein `fetch()`).
Mit Progress-Callback fuer UI-Anzeige.

### Inference-Pipeline

```typescript
class RerankerService {
    private session: ort.InferenceSession | null = null;

    async initialize(): Promise<void> {
        if (!this.isModelDownloaded()) return;  // Graceful: kein Modell = kein Reranking
        const modelPath = this.getModelPath();
        this.session = await ort.InferenceSession.create(modelPath);
    }

    async rerank(query: string, candidates: SearchResult[]): Promise<SearchResult[]> {
        if (!this.session) return candidates;  // Fallback: unveraenderte Reihenfolge

        // Tokenize query+chunk Paare
        const pairs = candidates.map(c => [query, c.text]);
        const inputs = this.tokenize(pairs);

        // Inference
        const output = await this.session.run(inputs);
        const scores = output['logits'].data as Float32Array;

        // Score zuweisen und sortieren
        return candidates
            .map((c, i) => ({ ...c, score: scores[i] }))
            .sort((a, b) => b.score - a.score);
    }
}
```

### Tokenizer

BGE-Reranker nutzt einen BERT-Tokenizer. Optionen:
1. `@xenova/transformers` (JS Tokenizer, ~5MB) -- bewahrt, Electron-kompatibel
2. Custom WordPiece Tokenizer (~500 Zeilen JS) -- leichtgewichtiger
3. Tokenizer als WASM -- schneller, aber weitere Dependency

Empfehlung: `@xenova/transformers` fuer den Tokenizer, onnxruntime-node fuer Inference. Bewahrt, gut dokumentiert.

### Settings

```typescript
interface RerankerSettings {
    enabled: boolean;               // default: true
    modelName: string;              // default: 'bge-reranker-v2-m3-int8'
    candidates: number;             // default: 20
    autoDownload: boolean;          // default: false (User muss bestaetigen)
}
```

## Related Decisions

- ADR-050: SQLite Knowledge DB (Vektoren fuer Stufe 1)
- ADR-051: Retrieval-Pipeline (Reranker als Stufe 4)

## References

- FEATURE-1504: Local Reranking
- BGE-Reranker-v2-m3: https://huggingface.co/BAAI/bge-reranker-v2-m3
- onnxruntime-node: https://onnxruntime.ai/docs/get-started/with-javascript/node.html
