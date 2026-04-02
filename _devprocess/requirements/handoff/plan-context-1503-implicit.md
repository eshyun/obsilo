# Plan Context: FEATURE-1503 Implicit Connection Discovery

> **Feature**: FEATURE-1503
> **Epic**: EPIC-015 - Unified Knowledge Layer
> **ADRs**: ADR-050 (Schema: implicit_edges), ADR-051 (Pipeline Stufe 3)
> **Erstellt**: 2026-03-30

---

## 1. Ziel

Semantisch aehnliche Notes erkennen die keinen expliziten Link haben.
Vorberechnete Paare in `implicit_edges` Tabelle speichern. In der Suche
als "implizit verwandt" anzeigen. Aktive Vorschlaege via FEATURE-1506 (spaeter).

## 2. Bestehende Architektur (Ist-Zustand)

### VectorStore (src/core/knowledge/VectorStore.ts)
- Speichert Chunk-Vektoren (Float32Array BLOBs) in `vectors`-Tabelle
- `search()` berechnet Cosine-Similarity in JS (Bulk-Load + Loop)
- Kein Note-Level-Vektor vorhanden -- nur Chunk-Level

### GraphStore (src/core/knowledge/GraphStore.ts)
- Speichert explizite Edges (Wikilinks, MOC) in `edges`-Tabelle
- `getNeighbors()` findet explizit verlinkte Notes (BFS)

### Schema (v3 -- aktuell)
- `implicit_edges` Tabelle existiert NICHT im aktuellen Schema
- ADR-050 definiert sie: `source_path, target_path, similarity, computed_at`

### SemanticSearchTool (src/core/tools/vault/SemanticSearchTool.ts)
- Graph-Expansion (Stufe 2) nach RRF-Fusion
- Kein Implicit-Connection-Lookup

## 3. Schema-Migration (v3 -> v4)

```sql
CREATE TABLE IF NOT EXISTS implicit_edges (
    source_path TEXT NOT NULL,
    target_path TEXT NOT NULL,
    similarity REAL NOT NULL,
    computed_at TEXT NOT NULL,
    UNIQUE(source_path, target_path)
);
CREATE INDEX IF NOT EXISTS idx_implicit_source ON implicit_edges(source_path);
CREATE INDEX IF NOT EXISTS idx_implicit_target ON implicit_edges(target_path);
```

## 4. Neue Datei: `src/core/knowledge/ImplicitConnectionService.ts`

### Kern-Algorithmus

1. **Note-Level-Vektoren berechnen:** Pro Note: Mittelwert aller Chunk-Vektoren
   - Laedt alle Vektoren aus VectorStore (bereits im Cache)
   - Gruppiert nach Pfad, berechnet Durchschnittsvektor
   - Nur Vault-Dateien (keine session:/episode: Prefixes)

2. **Paarweiser Vergleich:** Cosine-Similarity aller Note-Paare
   - N Notes = N*(N-1)/2 Vergleiche (695 Notes = ~241K Paare)
   - Nur Paare ueber Threshold speichern (default 0.7)
   - Nur Paare die KEINEN expliziten Link haben (edges-Tabelle pruefen)

3. **Yielding:** Alle 1000 Paare `await sleep(0)` fuer UI-Thread

### API

```typescript
class ImplicitConnectionService {
    constructor(knowledgeDB: KnowledgeDB, vectorStore: VectorStore, graphStore: GraphStore)

    // Full computation (Background-Job nach Build/Startup)
    computeAll(threshold?: number): Promise<{ computed: number; stored: number }>

    // Incremental: nur Paare fuer eine geaenderte Note neu berechnen
    recomputeForPath(path: string, threshold?: number): Promise<void>

    // Lookup (fuer Suche)
    getImplicitNeighbors(path: string, limit?: number): ImplicitNeighbor[]

    // Stats
    getCount(): number

    // Cancel
    cancel(): void
}

interface ImplicitNeighbor {
    path: string;
    similarity: number;
}
```

### computeAll() Detail

```
1. Lade alle Vektoren aus VectorStore (ensureCache)
2. Gruppiere nach path -> Map<string, Float32Array[]>
3. Berechne Note-Level-Vektor: mean(chunks) -> Map<string, Float32Array>
4. Lade explizite Edges aus GraphStore (Set<"pathA|pathB">)
5. Fuer jedes Paar (i, j) wo i < j:
   - cos = cosineSimilarity(noteVec[i], noteVec[j])
   - Wenn cos >= threshold UND kein expliziter Link:
     - INSERT INTO implicit_edges
6. Alle 1000 Paare: yield (setTimeout 0)
7. Am Ende: KnowledgeDB.save()
```

## 5. Bestehende Dateien aendern

### KnowledgeDB.ts
- SCHEMA_VERSION: 3 -> 4
- SCHEMA_DDL: implicit_edges Tabelle + Indices
- migrateSchema(): v3->v4

### settings.ts
```typescript
// Implicit Connections (FEATURE-1503)
enableImplicitConnections: boolean;  // default: true
implicitThreshold: number;           // default: 0.7 (0.5-0.9)
```

### main.ts
- ImplicitConnectionService instanziieren (nach GraphStore)
- Nach buildIndex() oder nach Plugin-Start (wenn Index existiert): computeAll() im Hintergrund
- Inkrementell: nach updateFile() auch recomputeForPath()

### SemanticSearchTool.ts
- Nach Graph-Expansion: Implicit-Lookup ergaenzen
- `implicitConnectionService.getImplicitNeighbors(path)`
- Ergebnis: "implizit verwandt (similarity: 0.82)"

### EmbeddingsTab.ts
- Implicit-Connection Toggle + Threshold-Slider
- Statistik: "X implicit connections found"

## 6. Open Questions -- Antworten

| Frage | Antwort |
|-------|---------|
| Note-Level-Vektor: Mittelwert oder Chunk-0? | **Mittelwert aller Chunks** -- robuster, repraesentiert gesamte Note |
| MOC-Zugehoerigkeit beruecksichtigen? | **Nein in MVP** -- nur Cosine-Similarity + expliziter-Link-Filter |
| Wie oft Vorberechnung? | **Automatisch nach Build** + bei Startup wenn veraltet. Inkrementell bei File-Updates. |
| UI fuer Vorschlaege? | **FEATURE-1506** (Out of Scope hier) -- nur DB-Berechnung + Such-Integration |

## 7. Performance-Ziele

| Metrik | Target |
|--------|--------|
| Full Computation (695 Notes, ~241K Paare) | <60s |
| Incremental (1 Note, ~694 Paare) | <1s |
| Lookup (implicit neighbors) | <5ms |
| Note-Level-Vektor Berechnung | <2s (in-memory) |

## 8. Implementierungsreihenfolge

1. **KnowledgeDB**: Schema v4 (implicit_edges)
2. **ImplicitConnectionService**: computeAll + getImplicitNeighbors
3. **Settings**: enableImplicitConnections, implicitThreshold
4. **main.ts**: Wiring + Auto-Compute nach Build
5. **SemanticSearchTool**: Implicit-Lookup integrieren
6. **EmbeddingsTab**: Settings + Statistik
7. **Tests**: ImplicitConnectionService
8. **Doku**: Feature-Spec + ADR aktualisieren
