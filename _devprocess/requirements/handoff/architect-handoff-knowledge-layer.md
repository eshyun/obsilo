# Architect Handoff: Unified Knowledge Layer

> **Epic**: EPIC-015
> **BA**: _devprocess/analysis/BA-009-knowledge-layer.md
> **Features**: FEATURE-1500 bis FEATURE-1506
> **Erstellt**: 2026-03-29

---

## 1. Aggregierte ASRs (Architecturally Significant Requirements)

### CRITICAL

**ASR-1 (FEATURE-1500): Cross-Platform Storage**
Storage-Backend muss auf Desktop (Electron/Node) und Mobile (WebView) identisch funktionieren.
- Quality Attribute: Portability
- Entscheidung erforderlich: sql.js (WASM) + vault.adapter als Persistenz-Schicht

**ASR-2 (FEATURE-1500): Crash-Safe Incremental Updates**
Inkrementelle Updates muessen atomar sein -- kein korrupter Index nach Plugin-Crash.
- Quality Attribute: Reliability
- Entscheidung erforderlich: SQLite WAL-Mode, Transaktionen, Checkpoint-Strategie

**ASR-3 (FEATURE-1502): Incremental Graph Updates**
Graph-Daten muessen bei Vault-Aenderungen inkrementell aktualisiert werden, nicht Full-Rebuild.
- Quality Attribute: Performance, Responsiveness
- Entscheidung erforderlich: Event-basierte Architektur mit vault.on() Events

**ASR-4 (FEATURE-1504): Graceful Degradation**
Reranking muss optional sein -- Mobile hat kein ONNX, Modell-Download kann scheitern.
- Quality Attribute: Availability, Portability
- Entscheidung erforderlich: Pipeline-Design das jede Stufe ueberspringen kann

### MODERATE

**ASR-5 (FEATURE-1500): Extensible DB Schema**
DB-Schema muss erweiterbar sein fuer Graph-Daten, Sessions, Episodes, Recipes, Implicit Edges.
- Quality Attribute: Modifiability
- Entscheidung erforderlich: Schema-Versioning, Migrations-Strategie

**ASR-6 (FEATURE-1503): Scalable Pairwise Computation**
Vorberechnung impliziter Verbindungen: O(n^2) Note-Paare duerfen UI nicht blockieren.
- Quality Attribute: Performance, Responsiveness
- Entscheidung erforderlich: Note-Level-Vektoren (Aggregation), Batch mit Yielding

**ASR-7 (FEATURE-1502): Configurable MOC Property Names**
MOC-Properties (Themen, Konzepte, Personen etc.) muessen konfigurierbar sein (DE/EN).
- Quality Attribute: Usability, Internationalization
- Entscheidung erforderlich: Settings-Schema fuer Property-Name-Mapping

**ASR-8 (FEATURE-1505): Lossless Data Migration**
Bestehende Sessions, Episodes, Recipes muessen verlustfrei in die DB migriert werden.
- Quality Attribute: Reliability, Data Integrity
- Entscheidung erforderlich: Migrations-Logik mit Validierung

---

## 2. Aggregierte NFRs

### Performance

| Metrik | Target | Feature |
|--------|--------|---------|
| Full Index Build (826 Dateien) | <5 Minuten | FEATURE-1500 |
| Incremental Update (1 Datei) | <2 Sekunden | FEATURE-1500 |
| DB Open beim Start | <500ms | FEATURE-1500 |
| Semantische Suche (Ende-zu-Ende) | <100ms (ohne Rerank), <300ms (mit Rerank) | FEATURE-1501 |
| Adjacent Chunk Lookup | <5ms | FEATURE-1501 |
| Graph-Extraktion (Full Vault) | <30s | FEATURE-1502 |
| Graph-Expansion Query (1-2 Hops) | <10ms | FEATURE-1502 |
| Implicit Connections Vorberechnung | <5 Minuten (826 Notes) | FEATURE-1503 |
| Reranking (20 Kandidaten) | <200ms | FEATURE-1504 |
| Session/Recipe Query | <10ms | FEATURE-1505 |

### Scalability

| Dimension | Target |
|-----------|--------|
| Vault-Dateien | Bis 10.000 |
| Chunks/Vektoren | Bis 100.000 |
| Vektor-Dimensionen | 1536 bis 4096 |
| Graph-Kanten | Bis 50.000 |
| Implicit Edges | 3.000-17.000 (bei 826 Notes, Threshold 0.7) |

### Storage

| Artefakt | Target |
|----------|--------|
| Knowledge DB (aktueller Vault) | <150MB (vs. 507MB vectra) |
| Reranker-Modell (optional) | ~125MB (INT8) oder ~500MB (FP32) |
| sql.js WASM | ~1.5MB im Plugin-Bundle |

### Platform

| Plattform | Stufe 1-3 | Stufe 4 (Reranking) |
|-----------|-----------|---------------------|
| Desktop (Electron) | Vollstaendig | Vollstaendig (ONNX) |
| Mobile (iOS/Android) | Vollstaendig | Cosine-Fallback |

---

## 3. Constraints

| Constraint | Auswirkung | Feature |
|------------|------------|---------|
| Obsidian Plugin Review-Bot | Kein `require()`, kein `fetch()`, kein `innerHTML`. sql.js muss als ES-Import oder WASM-Load. ONNX braucht eslint-disable mit Begruendung. | Alle |
| vault.adapter API | Binaere Dateien ueber writeBinary/readBinary. Groessenlimit testen fuer >100MB. | FEATURE-1500 |
| Bundle-Groesse | sql.js WASM (~1.5MB) im Bundle akzeptabel. ONNX-Modell (~125-500MB) NICHT im Bundle -- separater Download. | FEATURE-1500, 1504 |
| Mobile: Kein ONNX | Reranking nur auf Desktop. Stufe 1-3 muessen vollstaendig ohne Reranking funktionieren. | FEATURE-1504 |
| Existing API-Kompatibilitaet | SemanticIndexService public API (search, buildIndex, removeFile, indexFile) muss kompatibel bleiben. | FEATURE-1500, 1501 |
| Frontmatter-Format | MOC-Properties als Wikilinks in YAML: `Themen: [[KI]]` oder Array `Themen: [[[KI]], [[ML]]]`. | FEATURE-1502 |
| Body-Wikilinks | `[[Note Name]]` im Fliesstext sind ebenfalls Graph-Kanten (link_type: 'body'). Extraktion via metadataCache.links/resolvedLinks. | FEATURE-1502 |

---

## 4. Open Questions (fuer Architektur-Entscheidungen / ADRs)

### Storage & Schema
1. **sql.js WASM**: Bundled oder Runtime-Download? Bundle +1.5MB vs. Download braucht Netzwerk.
2. **DB-Location**: vault.adapter (syncbar via Obsidian Sync) oder plugin-lokal (nicht syncbar)?
3. **Schema-Migration**: Versionierung mit Schema-Version-Tabelle? Wie kuenftige Aenderungen handhaben?
4. **Cosine-Similarity**: In SQL (Custom Function) oder in JS nach Bulk-Vektor-Load?

### Retrieval-Pipeline
5. **Pipeline-Architektur**: Starre 4-Stufen-Kette oder flexibel konfigurierbar (Stufen an/aus)?
6. **Ergebnis-Fusion**: Wie werden Ergebnisse aus Vector (Score), Graph (Hop-Distance), Implicit (Similarity) kombiniert?
7. **Token-Budget**: Wie viel Kontext maximal an den LLM senden? Hartes Limit oder adaptiv?

### Graph
8. **Graph-Extraktion**: Obsidian metadataCache (live, schnell) vs. eigener Frontmatter-Parser (robust)?
9. **Expansion-Strategie**: BFS (breit) oder gewichtet nach Kantentyp (MOC-Links wertvoller als Wikilinks)?
10. **Broken Links**: Wie mit Wikilinks zu nicht-existierenden Notes umgehen?

### Implicit Connections
11. **Note-Level-Vektor**: Mittelwert aller Chunk-Vektoren oder nur Chunk-0 (Einleitung)?
12. **Vorberechnungs-Frequenz**: Bei jedem Build, taeglich, oder nur on-demand?
13. **Feedback-Loop**: Abgelehnte Vorschlaege in DB speichern fuer bessere Threshold-Anpassung?

### Reranking
14. **ONNX Runtime**: onnxruntime-node (Native, schneller) vs. onnxruntime-web (WASM, portabler)?
15. **Modell-Auswahl**: BGE-Reranker-v2-m3 (278M, best quality) vs. kleinere Alternative (TinyBERT, 60MB)?
16. **Quantisierung**: INT8 (~125MB, ~10% Quality-Loss) vs. FP32 (~500MB, volle Quality)?
17. **Modell-Storage**: ~/.obsidian-agent/models/ (global pro Rechner)?

### Migration & Kompatibilitaet
18. **vectra-Migration**: Bestehende index.json + index-meta.json loeschen und clean rebuild?
19. **Datei-Migration**: Alte Session/Episode/Recipe Dateien nach Migration loeschen oder archivieren?

---

## 5. Bestehendes System (Referenzen fuer Architekt)

### Dateien die ersetzt/modifiziert werden

| Datei | LOC | Aktion |
|-------|-----|--------|
| `src/core/semantic/SemanticIndexService.ts` | 1.088 | Kern-Umbau (vectra -> SQLite) |
| `src/core/memory/MemoryRetriever.ts` | ~200 | Session-Retrieval auf DB umstellen |
| `src/core/memory/SessionExtractor.ts` | ~300 | Session-Speicherung auf DB umstellen |
| `src/core/mastery/RecipeStore.ts` | 126 | Recipe-Speicherung auf DB umstellen |
| `src/core/mastery/RecipePromotionService.ts` | 209 | Pattern-Speicherung auf DB umstellen |
| `src/core/mastery/EpisodicExtractor.ts` | 166 | Episode-Speicherung auf DB umstellen |
| `src/core/memory/LongTermExtractor.ts` | ~300 | Routing-Logik aendern (kein learnings.md) |
| `src/main.ts` | 1.288 | Service-Initialisierung anpassen |
| `src/ui/AgentSidebarView.ts` | 3.808 | Suche-Integration fuer Graph/Implicit |

### Neue Dateien (geschaetzt)

| Datei | Zweck |
|-------|-------|
| `src/core/knowledge/KnowledgeDB.ts` | SQLite DB Wrapper, Schema, Migrations |
| `src/core/knowledge/VectorStore.ts` | Vektor-CRUD, Cosine-Similarity |
| `src/core/knowledge/GraphStore.ts` | Wikilinks, Tags, MOC-Edges |
| `src/core/knowledge/ImplicitConnectionService.ts` | Vorberechnung + Lookup |
| `src/core/knowledge/RerankerService.ts` | ONNX Reranker Wrapper |
| `src/core/knowledge/RetrievalPipeline.ts` | 4-Stufen Orchestrierung |
| `src/core/knowledge/GraphExtractor.ts` | Vault-Events -> Graph-Updates |

### Dependencies (neu)

| Package | Zweck | Groesse |
|---------|-------|---------|
| sql.js | SQLite WASM | ~1.5MB |
| onnxruntime-node oder onnxruntime-web | Reranker Inference | ~10MB (Runtime) + ~125-500MB (Modell) |

### Dependencies (entfaellt)

| Package | Grund |
|---------|-------|
| vectra | Ersetzt durch SQLite |
| @orama/orama | War nie genutzt, kann auch entfernt werden |

---

## 6. Naechster Schritt

```
Naechster Schritt: /architecture
Input: Dieses Handoff-Dokument

Zu erstellende ADRs:
- ADR: SQLite Migration (sql.js, Schema, vault.adapter Persistenz)
- ADR: Retrieval-Pipeline Architektur (4 Stufen, Konfigurierbarkeit)
- ADR: Reranker Integration (ONNX, Modell-Auswahl, Download-Strategie)
- plan-context.md fuer Claude Code Implementierung
```
