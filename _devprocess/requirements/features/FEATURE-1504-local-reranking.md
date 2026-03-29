# Feature: Local Reranking

> **Feature ID**: FEATURE-1504
> **Epic**: EPIC-015 - Unified Knowledge Layer
> **Priority**: P1-High
> **Effort Estimate**: M

## Feature Description

Nach den ersten drei Retrieval-Stufen (Vector Search, Graph Expansion, Implicit Connections) werden die ~20 Kandidaten-Ergebnisse durch einen lokalen Cross-Encoder Reranker auf die besten 5 priorisiert. Der Reranker betrachtet Query und Chunk gemeinsam (nicht separat wie Cosine-Similarity) und erkennt dadurch feine Relevanz-Unterschiede.

Auf Desktop laeuft ein lokales ML-Modell (ONNX). Auf Mobile faellt das System auf Cosine-Similarity-Ranking zurueck (Stufe 1-3 funktionieren vollstaendig ohne Reranking).

## Benefits Hypothesis

**Wir glauben dass** lokales Reranking
**Folgende messbare Outcomes liefert:**
- Die Top-5 Ergebnisse sind praeziser und relevanter als reine Cosine-Similarity
- Weniger irrelevante Ergebnisse in der Antwort des LLM

**Wir wissen dass wir erfolgreich sind wenn:**
- Subjektive Relevanz der Top-5 Ergebnisse verbessert sich gegenueber Cosine-Only
- Reranking laeuft lokal ohne externe API-Aufrufe (Datenschutz)

## User Stories

### Story 1: Praezisere Ergebnisse
**Als** Knowledge Worker
**moechte ich** dass die relevantesten Ergebnisse zuoberst stehen
**um** schneller die richtige Information zu finden

### Story 2: Lokale Verarbeitung
**Als** datenschutzbewusster User
**moechte ich** dass das Relevanz-Ranking lokal auf meinem Geraet laeuft
**um** meine Vault-Inhalte nicht an externe Dienste senden zu muessen

---

## Success Criteria (Tech-Agnostic)

| ID | Criterion | Target | Measurement |
|----|-----------|--------|-------------|
| SC-01 | Ergebnisqualitaet verbessert sich gegenueber Basis-Ranking | Spuerbare Verbesserung | Subjektiver Vergleich: gleiche Queries mit/ohne Reranking |
| SC-02 | Ranking laeuft vollstaendig lokal | Keine externen Aufrufe | Netzwerk-Monitor: 0 Requests waehrend Reranking |
| SC-03 | Ranking verlangsamt die Suche nicht spuerbar | Unter 1 Sekunde Gesamtzeit | Zeitmessung Ende-zu-Ende |
| SC-04 | Auf Mobile funktioniert die Suche ohne Reranking | Vollstaendige Ergebnisse, nur ohne Rerank-Schritt | Funktionstest auf Mobile |
| SC-05 | Reranking ist deaktivierbar | Toggle in Settings | Deaktivieren und pruefen dass Suche weiterhin funktioniert |

---

## Technical NFRs (fuer Architekt)

### Performance
- **Reranking 20 Kandidaten**: <200ms auf Desktop (M1/Intel)
- **Modell-Laden**: <3s beim ersten Aufruf (lazy load), danach im Speicher
- **Memory**: <300MB zusaetzlich waehrend Reranking

### Platform
- **Desktop**: ONNX Runtime (Node oder WASM) -- BGE-Reranker-v2-m3 (278M Params, ~500MB Modell)
- **Mobile**: Kein Reranking (Fallback auf Cosine-Similarity)
- **Modell-Download**: Separater Download, nicht im Plugin-Bundle

### Scalability
- **Kandidaten**: 10-30 Chunks pro Reranking-Durchlauf (konfigurierbar)
- **Modell-Alternativen**: TinyBERT-Reranker (~60MB) als leichtere Option

---

## Architecture Considerations

### Architecturally Significant Requirements (ASRs)

**CRITICAL ASR #1**: Reranking muss optional und graceful-degradable sein
- **Warum ASR**: Mobile hat kein ONNX. Modell-Download kann scheitern. User kann es deaktivieren.
- **Impact**: Retrieval-Pipeline muss ohne Stufe 4 vollstaendig funktionieren
- **Quality Attribute**: Availability, Portability

**MODERATE ASR #2**: Modell-Download ausserhalb des Plugin-Bundles
- **Warum ASR**: 500MB im Plugin-Bundle wuerde Review-Bot und User abschrecken
- **Impact**: Download-Manager mit Progress, Cache in globalem Storage (~/.obsidian-agent/)
- **Quality Attribute**: Usability, Bundle Size

### Constraints
- **ONNX Runtime**: Muss in Electron (Node.js) laufen. WASM-Variante als Fallback.
- **Review-Bot**: `require('onnxruntime-node')` braucht eslint-disable mit Begruendung
- **Speicher**: 500MB Modell + 300MB Runtime = ~800MB peak. Auf aelteren Geraeten problematisch.

### Open Questions fuer Architekt
- ONNX Runtime: onnxruntime-node (Native) oder onnxruntime-web (WASM)? Native ist schneller, WASM portabler.
- Modell-Storage: ~/.obsidian-agent/models/ (global, einmal pro Rechner)?
- Soll ein kleineres Default-Modell mitgeliefert werden und das groessere optional?
- Quantisierung: INT8-quantisiertes Modell (~125MB) statt FP32 (~500MB)?

---

## Definition of Done

### Functional
- [ ] Reranking der Top-20 Kandidaten auf Top-5
- [ ] Lokal auf Desktop (kein Netzwerk-Aufruf)
- [ ] Graceful Fallback auf Mobile (Cosine-Only)
- [ ] Deaktivierbar in Settings
- [ ] Modell-Download mit Fortschrittsanzeige

### Quality
- [ ] Performance Test: Reranking 20 Chunks <200ms
- [ ] Relevanz-Test: Stichprobe von 10 Queries, subjektiv bessere Top-5
- [ ] Fallback-Test: Suche funktioniert vollstaendig wenn Reranking deaktiviert

### Documentation
- [ ] ADR fuer Reranker-Modell-Auswahl
- [ ] Feature-Spec aktualisiert
- [ ] User-Dokumentation: Modell-Download-Anleitung

---

## Dependencies
- **FEATURE-1500**: SQLite Knowledge DB (Vektoren laden fuer Kandidaten-Selektion)
- **FEATURE-1501**: Enhanced Vector Retrieval (liefert die Kandidaten)

## Assumptions
- BGE-Reranker-v2-m3 laeuft in ONNX Runtime auf Desktop mit akzeptabler Latenz
- 500MB Modell-Download ist fuer Desktop-User akzeptabel
- INT8-Quantisierung reduziert Groesse ohne signifikanten Qualitaetsverlust

## Out of Scope
- Cloud-basiertes Reranking (Cohere, Jina API)
- Reranking auf Mobile
- Fine-Tuning des Reranker-Modells auf Vault-Daten
