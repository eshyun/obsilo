# Plan Context: Unified Knowledge Layer

> **Purpose:** Technische Zusammenfassung fuer Claude Code
> **Created by:** Architect
> **Date:** 2026-03-29

---

## Technical Stack

**Runtime:**
- Language: TypeScript (strict)
- Framework: Obsidian Plugin API
- Build: esbuild
- Runtime: Electron (Desktop), WebView (Mobile)

**Knowledge DB:**
- Database: SQLite via sql.js (WASM) -- ADR-050
- Persistence: Fallback-Kette -- vault.adapter (local/obsidian-sync) oder fs.promises (global)
- Location: Folgt bestehender Storage-Location-Logik (global/local/obsidian-sync)
- Vektoren: Float32Array als BLOB (4 Bytes/Float)

**Retrieval:**
- Pipeline: 4 Stufen, konfigurierbar (ADR-051)
- Vector Search: Cosine-Similarity in JS (Bulk-Load + Loop)
- Graph: SQL Queries auf edges/tags Tabellen
- Implicit: SQL Query auf implicit_edges Tabelle
- Reranking: BGE-Reranker-v2-m3 (INT8) via onnxruntime-node (ADR-052)

**ML/Embedding:**
- Embedding: Konfigurierbar (Qwen3-Embedding-8b aktuell, 4096 dim)
- Reranker: BGE-Reranker-v2-m3-INT8 (~125MB, Download zu ~/.obsidian-agent/models/)
- Tokenizer: @xenova/transformers (fuer Reranker-Input)

## Architecture Style

- Pattern: Modular Services innerhalb Plugin-Monolith
- Key Quality Goals:
  1. **Skalierbarkeit**: 10.000 Dateien, 100.000 Chunks, 4096-dim Vektoren
  2. **Graceful Degradation**: Jede Pipeline-Stufe optional, Mobile ohne Reranking
  3. **Vernetztes Denken**: Graph + Implicit Connections als Kern-Differenzierung

## Key Architecture Decisions (ADR Summary)

| ADR | Title | Vorgeschlagene Entscheidung | Impact |
|-----|-------|-----------------------------|--------|
| ADR-050 | SQLite Knowledge DB | sql.js WASM + vault.adapter | Critical |
| ADR-051 | Retrieval-Pipeline | 4-Stufen konfigurierbar, Result-Fusion | Critical |
| ADR-052 | Local Reranker | BGE-Reranker INT8 via onnxruntime-node | High |

**Detail pro ADR:**

1. **ADR-050 SQLite Knowledge DB:** vectra durch sql.js (WASM) ersetzen. Vektoren als Float32Array BLOBs. vault.adapter fuer Desktop+Mobile Persistenz. Unified Schema fuer Vektoren, Graph, Sessions, Episodes, Recipes.
   - Rationale: Loest 507MB Bug, ermoeglicht Mobile, inkrementelle Updates, Cross-Referenzen.

2. **ADR-051 Retrieval-Pipeline:** Konfigurierbare 4-Stufen-Pipeline (Vector -> Graph -> Implicit -> Rerank). Jede Stufe ist ein eigenstaendiger Service mit vereinheitlichtem SearchResult-Format. Stufen koennen einzeln deaktiviert werden.
   - Rationale: ASR-4 Graceful Degradation. Mobile nutzt Stufe 1-3, Desktop alle 4.

3. **ADR-052 Local Reranker:** BGE-Reranker-v2-m3 (INT8, ~125MB) via onnxruntime-node. Separater Modell-Download. Fallback auf Cosine-Only wenn nicht verfuegbar.
   - Rationale: Lokal, keine API-Kosten, 33-47% bessere Precision. Showcase-Wert.

## Data Model (Core Entities)

```
vectors
  id: INTEGER PRIMARY KEY
  path: TEXT (vault-relative)
  chunk_index: INTEGER
  text: TEXT (chunk content)
  vector: BLOB (Float32Array)
  mtime: INTEGER

edges
  source_path: TEXT
  target_path: TEXT
  link_type: TEXT ('body' | 'frontmatter')
  property_name: TEXT (null | 'Themen' | 'Konzepte' | ...)

tags
  path: TEXT
  tag: TEXT

implicit_edges
  source_path: TEXT
  target_path: TEXT
  similarity: REAL
  computed_at: TEXT

sessions
  id: TEXT PRIMARY KEY
  title: TEXT
  summary: TEXT
  embedding: BLOB
  source: TEXT ('human' | 'mcp' | 'subtask')
  created_at: TEXT

episodes
  id: TEXT PRIMARY KEY
  user_message: TEXT
  mode: TEXT
  tool_sequence: TEXT (JSON)
  tool_ledger: TEXT
  success: INTEGER
  result_summary: TEXT
  created_at: TEXT

recipes
  id: TEXT PRIMARY KEY
  name: TEXT
  trigger_keywords: TEXT
  steps: TEXT (JSON)
  source: TEXT ('static' | 'learned')
  success_count: INTEGER
  last_used: TEXT

patterns
  pattern_key: TEXT PRIMARY KEY
  tool_sequence: TEXT (JSON)
  episodes: TEXT (JSON)
  success_count: INTEGER

schema_meta
  version: INTEGER
```

## External Integrations

| System | Type | Protocol | Purpose |
|--------|------|----------|---------|
| Embedding API (Qwen/OpenAI/etc.) | Outbound | HTTPS (Anthropic/OpenAI SDK) | Chunk-Embeddings generieren |
| ONNX Runtime | Local | Native Binding | Reranker Inference |
| Obsidian metadataCache | Inbound | Plugin API (in-process) | Wikilinks, Tags, Frontmatter extrahieren |
| Obsidian vault.adapter | Inbound/Outbound | Plugin API (in-process) | DB-Persistenz (Desktop+Mobile) |
| Obsidian vault events | Inbound | Plugin API (Events) | Inkrementelle Graph/Index-Updates |

## Performance & Security

**Performance:**
- Full Index Build: <5 Minuten (826 Dateien)
- Incremental Update: <2 Sekunden (1 Datei)
- Semantic Search (ohne Rerank): <100ms
- Semantic Search (mit Rerank): <300ms
- Graph Expansion: <10ms
- Implicit Connection Lookup: <5ms
- DB Open: <500ms

**Security:**
- Alle Daten lokal (keine Cloud-DB)
- Reranker lokal (kein API-Aufruf fuer Ranking)
- Embedding API-Keys in SafeStorageService (verschluesselt)
- vault.adapter nutzt Obsidians Sandbox (keine direkten fs-Aufrufe)

---

## Kontext-Dokumente fuer Claude Code

Claude Code sollte folgende Dokumente als Kontext lesen:

1. `_devprocess/architecture/ADR-050-sqlite-knowledge-db.md`
2. `_devprocess/architecture/ADR-051-retrieval-pipeline.md`
3. `_devprocess/architecture/ADR-052-local-reranker.md`
4. `_devprocess/requirements/features/FEATURE-1500-sqlite-knowledge-db.md` (P0)
5. `_devprocess/requirements/features/FEATURE-1501-enhanced-vector-retrieval.md` (P0)
6. `_devprocess/requirements/features/FEATURE-1502-graph-extraction-expansion.md` (P0)
7. `_devprocess/requirements/features/FEATURE-1503-implicit-connections.md` (P1)
8. `_devprocess/requirements/features/FEATURE-1504-local-reranking.md` (P1)
9. `_devprocess/requirements/features/FEATURE-1505-knowledge-data-consolidation.md` (P1)
10. `_devprocess/requirements/features/FEATURE-1506-implicit-connection-ui.md` (P2)
11. `_devprocess/requirements/epics/EPIC-015-knowledge-layer.md`
12. `_devprocess/analysis/BA-009-knowledge-layer.md`

**Bestehende Dateien die modifiziert werden:**
- `src/core/semantic/SemanticIndexService.ts` -- Kern-Umbau
- `src/core/memory/MemoryRetriever.ts` -- Session-Retrieval auf DB
- `src/core/memory/SessionExtractor.ts` -- Session-Speicherung auf DB
- `src/core/memory/LongTermExtractor.ts` -- Routing (kein learnings.md)
- `src/core/mastery/RecipeStore.ts` -- Recipes auf DB
- `src/core/mastery/RecipePromotionService.ts` -- Patterns auf DB
- `src/core/mastery/EpisodicExtractor.ts` -- Episodes auf DB
- `src/main.ts` -- Service-Initialisierung

**Neue Dateien (vorgeschlagen):**
- `src/core/knowledge/KnowledgeDB.ts` -- SQLite Wrapper, Schema, Migrations
- `src/core/knowledge/VectorStore.ts` -- Vektor-CRUD, Cosine-Similarity
- `src/core/knowledge/GraphStore.ts` -- Wikilinks, Tags, MOC-Edges
- `src/core/knowledge/GraphExtractor.ts` -- Vault-Events -> Graph-Updates
- `src/core/knowledge/ImplicitConnectionService.ts` -- Vorberechnung + Lookup
- `src/core/knowledge/RerankerService.ts` -- ONNX Reranker Wrapper
- `src/core/knowledge/RetrievalPipeline.ts` -- 4-Stufen Orchestrierung

**Dependencies:**
- Neu: sql.js (~1.5MB WASM), onnxruntime-node (~10MB), @xenova/transformers (~5MB)
- Entfaellt: vectra, @orama/orama

**Implementierungsreihenfolge (empfohlen):**
1. FEATURE-1500: SQLite Knowledge DB (loest den Bug, Grundlage fuer alles)
2. FEATURE-1501: Enhanced Vector Retrieval (Adjacent Chunks, Multi-Chunk)
3. FEATURE-1502: Graph Extraction & Expansion (Wikilinks, Tags, MOC)
4. FEATURE-1505: Knowledge Data Consolidation (Sessions, Episodes, Recipes in DB)
5. FEATURE-1503: Implicit Connections (Vorberechnung + Suche-Integration)
6. FEATURE-1504: Local Reranking (ONNX, Modell-Download)
7. FEATURE-1506: Implicit Connection UI (Vorschlaege anzeigen)
