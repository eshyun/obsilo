# Plan Context: FEATURE-1502 Graph Extraction & Expansion

> **Feature**: FEATURE-1502
> **Epic**: EPIC-015 - Unified Knowledge Layer
> **ADRs**: ADR-050 (Schema), ADR-051 (Pipeline Stufe 2)
> **Erstellt**: 2026-03-30

---

## 1. Ziel

Obsidians Graph (Wikilinks, Tags, MOC-Properties) in die Knowledge DB extrahieren
und bei der Suche fuer 1-2 Hop Expansion nutzen. Ersetzt das aktuelle Regex-basierte
Wikilink-Parsing in SemanticSearchTool durch systematische DB-Queries.

## 2. Bestehende Architektur (Ist-Zustand)

### Schema (v2 -- aktuell in KnowledgeDB.ts)
- `vectors` (id, path, chunk_index, text, vector, mtime, enriched)
- `checkpoint` (key, value)
- `schema_meta` (version)
- **Keine edges/tags Tabellen**

### Suche (SemanticSearchTool.ts)
- Hybrid: Semantic (Cosine) + Keyword (TF-IDF) via RRF Fusion
- 1-Hop Wikilink-Enrichment via Regex auf Excerpts (Zeile 214-247)
- Limit: 5 zusaetzliche Notes, nur Links die zufaellig im Excerpt vorkommen

### Graph-Zugriff (bestehende Patterns)
- `metadataCache.getFileCache(file).links` -- Forward-Wikilinks (body)
- `metadataCache.getFileCache(file).frontmatter` -- MOC-Properties
- `metadataCache.getBacklinksForFile(file)` -- Reverse-Links
- `metadataCache.getFirstLinkpathDest(linktext, sourcePath)` -- Link-Resolution
- `metadataCache.getFileCache(file).tags` -- Inline-Tags
- Frontmatter-Tags: `cache.frontmatter?.tags`

## 3. Schema-Migration (v2 -> v3)

### Neue Tabellen (aus ADR-050)

```sql
-- Graph: Wikilinks + MOC-Edges
CREATE TABLE IF NOT EXISTS edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_path TEXT NOT NULL,
    target_path TEXT NOT NULL,
    link_type TEXT NOT NULL,         -- 'body' | 'frontmatter'
    property_name TEXT,              -- null fuer body, 'Themen'/'Konzepte'/etc. fuer frontmatter
    UNIQUE(source_path, target_path, link_type, property_name)
);
CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_path);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_path);

-- Graph: Tags
CREATE TABLE IF NOT EXISTS tags (
    path TEXT NOT NULL,
    tag TEXT NOT NULL,
    UNIQUE(path, tag)
);
CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
```

### Migration in KnowledgeDB.ts
- SCHEMA_VERSION: 2 -> 3
- `migrateSchema()`: `if (currentVersion < 3)` -> CREATE TABLE IF NOT EXISTS
- SCHEMA_DDL erweitern (fuer frische DBs)

## 4. Neue Dateien

### `src/core/knowledge/GraphStore.ts`
CRUD-Operationen auf edges/tags Tabellen. Analog zu VectorStore.

```typescript
class GraphStore {
    constructor(knowledgeDB: KnowledgeDB)

    // Write
    replaceEdgesForPath(sourcePath: string, edges: Edge[]): void
    replaceTagsForPath(path: string, tags: string[]): void
    deleteByPath(path: string): void  // edges + tags

    // Read (fuer Expansion)
    getNeighbors(path: string, hops: number, maxResults: number): GraphNeighbor[]
    getFilesByTag(tag: string): string[]
    getEdgeCount(): number
    getTagCount(): number
}

interface Edge {
    targetPath: string;
    linkType: 'body' | 'frontmatter';
    propertyName: string | null;
}

interface GraphNeighbor {
    path: string;
    hopDistance: number;
    viaPath: string;      // "gefunden via [[X]]"
    linkType: string;
    propertyName: string | null;
}
```

**getNeighbors()**: BFS ueber edges-Tabelle, max 2 Hops.
Query-Strategie:
- Hop 1: `SELECT target_path FROM edges WHERE source_path = ?` UNION `SELECT source_path FROM edges WHERE target_path = ?` (bidirektional)
- Hop 2: Gleiche Query auf Hop-1-Ergebnisse
- Deduplizieren, Ursprungspfad ausschliessen

### `src/core/knowledge/GraphExtractor.ts`
Extrahiert Graph-Daten aus Obsidians metadataCache und schreibt in GraphStore.

```typescript
class GraphExtractor {
    constructor(app: App, graphStore: GraphStore, mocProperties: string[])

    // Full extraction (einmalig beim Start)
    extractAll(): Promise<{ edgeCount: number; tagCount: number }>

    // Inkrementell (Vault-Events)
    extractFile(file: TFile): void
    removeFile(path: string): void
}
```

**extractFile()** Logik:
1. `metadataCache.getFileCache(file)` laden
2. Body-Wikilinks: `cache.links` -> resolve via `getFirstLinkpathDest` -> edges (link_type='body')
3. MOC-Properties: `cache.frontmatter?.[propName]` -> Wikilinks parsen -> edges (link_type='frontmatter', property_name)
4. Tags: `cache.frontmatter?.tags` + `cache.tags` -> tags-Tabelle
5. `graphStore.replaceEdgesForPath()` + `graphStore.replaceTagsForPath()`

**MOC-Property Wikilink-Parsing:**
Frontmatter-Werte koennen verschiedene Formate haben:
- String: `Themen: "[[KI]]"` -> parse `[[...]]`
- Array: `Themen: [[[KI]], [[ML]]]` -> parse jedes Element
- Obsidian-Resolved: `Themen: [[KI]]` (ohne Quotes, via metadataCache)
- `frontmatterLinks` ist undokumentiert -- stattdessen `cache.frontmatter?.[propName]` nutzen (bewaehrtes Pattern aus QueryBaseTool + GetFrontmatterTool)

## 5. Bestehende Dateien aendern

### `src/core/knowledge/KnowledgeDB.ts`
- SCHEMA_VERSION: 3
- SCHEMA_DDL: edges + tags Tabellen hinzufuegen
- migrateSchema(): v2->v3 Migration

### `src/types/settings.ts`
Neue Settings (in ObsidianAgentSettings):
```typescript
// Graph Expansion (FEATURE-1502)
enableGraphExpansion: boolean;      // default: true
graphExpansionHops: number;         // default: 1, max: 2
mocPropertyNames: string[];         // default: ['Themen', 'Konzepte', 'Personen', 'Notizen', 'Meeting-Notes', 'Quellen']
```

### `src/main.ts`
- GraphStore instanziieren (nach VectorStore)
- GraphExtractor instanziieren + extractAll() beim Start
- Vault-Events fuer inkrementelle Graph-Updates registrieren
- Graph-Extraction ist schnell (<30s) -> synchron beim Start, kein Background-Pass noetig

### `src/core/tools/vault/SemanticSearchTool.ts`
- Regex-basiertes 1-Hop Enrichment (Zeile 214-247) ersetzen durch GraphStore.getNeighbors()
- Fuer jeden Top-K Treffer: 1-2 Hops aus edges-Tabelle
- Ergebnis-Format: `"via [[Note]] (Themen)"` statt generisches "linked context"
- Tag-basierte Expansion: Dateien mit gleichen Tags als Bonus-Ergebnisse

### `src/ui/settings/EmbeddingsTab.ts` (oder neuer Tab)
- Graph-Expansion Toggle
- Hop-Anzahl Dropdown (1 oder 2)
- MOC-Property-Namen Liste (editierbar)
- Graph-Statistiken anzeigen (Kanten-Anzahl, Tag-Anzahl)

## 6. Open Questions -- Antworten

| Frage (aus Handoff) | Antwort |
|---|---|
| Tags als Kanten oder Attribut? | **Eigene tags-Tabelle** (ADR-050). Tags sind kein Kantentyp, sondern File-Metadaten. Query: "alle Dateien mit Tag X" |
| Broken Links? | **Ueberspringen.** `getFirstLinkpathDest()` returned null -> Edge wird nicht gespeichert. Nur aufgeloeste Links in der DB. |
| metadataCache vs. eigener Parser? | **metadataCache.** Bereits bewaehrtes Pattern in 5+ Tools. `frontmatterLinks` fuer MOC-Properties. |
| BFS oder gewichtet? | **BFS mit max 2 Hops** (ADR-051). Keine Gewichtung in MVP -- alle Kantentypen gleich. Gewichtung in spaeterer Iteration. |

## 7. Abhaengigkeiten

- **FEATURE-1500** (Done): KnowledgeDB + VectorStore
- **FEATURE-1501** (Done): Enhanced Vector Retrieval
- **Obsidian API**: metadataCache (stabil, seit v0.15+)

## 8. Performance-Ziele

| Metrik | Target |
|--------|--------|
| Graph-Extraktion (Full, 695 Dateien) | <30s |
| Graph-Extraktion (1 Datei, inkrementell) | <100ms |
| Graph-Expansion Query (1-2 Hops) | <10ms |
| Vault-Event Debounce | 500ms |
| Edges im Vault (geschaetzt) | ~2000-5000 |

## 9. Implementierungsreihenfolge

1. **KnowledgeDB**: Schema v3 (edges + tags Tabellen)
2. **GraphStore**: CRUD + getNeighbors (BFS)
3. **GraphExtractor**: Full + Inkrementell
4. **Settings**: enableGraphExpansion, graphExpansionHops, mocPropertyNames
5. **main.ts**: Wiring (GraphStore, GraphExtractor, Vault-Events)
6. **SemanticSearchTool**: Regex-Enrichment ersetzen durch GraphStore-Queries
7. **EmbeddingsTab/UI**: Graph-Settings + Statistiken
8. **Tests**: GraphStore + GraphExtractor
9. **Doku**: Feature-Spec + ADR-051 aktualisieren

## 10. Naechster Schritt

```
Naechster Schritt: /coding
Input: Dieses Dokument + ADR-050 + ADR-051 + FEATURE-1502 Spec

Der Coding-Skill wird:
1. Dieses Dokument + ADRs + Feature laden
2. Kritischer Review gegen die aktuelle Codebase
3. Plan-Mode: Implementierungsplan
4. Inkrementell implementieren (Build+Deploy nach jedem Schritt)
5. Feature-Spec + Backlog aktualisieren
```
