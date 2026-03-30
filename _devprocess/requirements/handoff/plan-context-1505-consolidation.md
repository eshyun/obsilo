# Plan Context: FEATURE-1505 Knowledge Data Consolidation

> **Feature**: FEATURE-1505
> **Epic**: EPIC-015 - Unified Knowledge Layer
> **ADRs**: ADR-050 (Zwei-DB-Strategie: memory.db)
> **Erstellt**: 2026-03-30

---

## 1. Ziel

Sessions, Episodes, Recipes und Patterns von losen Dateien (JSON/Markdown) in
eine SQLite-Datenbank (memory.db) konsolidieren. Einmalige Migration beim
ersten Start. learnings.md entfernen und LongTermExtractor-Routing anpassen.

## 2. ADR-050 Zwei-DB-Strategie

| DB | Inhalt | Location | IO | Sync |
|----|--------|----------|----|------|
| knowledge.db | Vektoren, Graph, Implicit | `~/.obsidian-agent/` (global) | fs.promises | Nein |
| **memory.db** | Sessions, Episodes, Recipes, Patterns | `{vault}/.obsidian-agent/` (local) | vault.adapter | Ja |

memory.db ist klein (<5MB), synct via Vault-Sync (iCloud, Syncthing etc.).
KnowledgeDB-Klasse unterstuetzt bereits 'local' Mode mit vault.adapter.

## 3. Bestehende Services (Ist-Zustand)

| Service | Storage | Format | Dateien |
|---------|---------|--------|---------|
| MemoryService | `~/.obsidian-agent/memory/sessions/*.md` | Markdown | ~N Sessions |
| RecipeStore | `~/.obsidian-agent/recipes/*.json` | JSON | Statisch (bundled) + Gelernt |
| EpisodicExtractor | `~/.obsidian-agent/episodes/*.json` | JSON | Max 500 (FIFO) |
| RecipePromotionService | `~/.obsidian-agent/patterns/*.json` | JSON | Transient |

Alle nutzen FileAdapter (GlobalFileService) als Persistenz-Abstraktion.

## 4. Scope-Reduzierung (Pragmatisch)

**In Scope:**
- memory.db erstellen (zweite KnowledgeDB-Instanz, 'local' Mode)
- Sessions, Episodes, Recipes, Patterns als Tabellen
- Einmalige Migration der bestehenden Dateien
- Services auf DB umstellen (RecipeStore, EpisodicExtractor, RecipePromotionService)
- MemoryService: Session-Summaries in DB statt .md
- learnings.md entfernen + LongTermExtractor Routing anpassen

**Explizit NOT in Scope:**
- Andere Memory-Dateien (user-profile.md, patterns.md, soul.md, errors.md) -- bleiben als .md
- ExtractionQueue -- bleibt als JSON (transient, klein)
- MemoryService Core-API aendern (loadMemoryFiles etc.) -- bleibt File-basiert fuer .md Dateien

## 5. Schema (memory.db)

```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    title TEXT,
    summary TEXT,
    source TEXT DEFAULT 'human',
    created_at TEXT NOT NULL
);

CREATE TABLE episodes (
    id TEXT PRIMARY KEY,
    user_message TEXT,
    mode TEXT,
    tool_sequence TEXT,     -- JSON array
    tool_ledger TEXT,
    success INTEGER NOT NULL,
    result_summary TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE recipes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    trigger_keywords TEXT,  -- pipe-separated
    steps TEXT NOT NULL,     -- JSON array
    source TEXT NOT NULL,    -- 'static' | 'learned'
    schema_version INTEGER NOT NULL,
    success_count INTEGER DEFAULT 0,
    last_used TEXT,
    modes TEXT               -- JSON array
);

CREATE TABLE patterns (
    pattern_key TEXT PRIMARY KEY,
    tool_sequence TEXT NOT NULL, -- JSON array
    episodes TEXT NOT NULL,      -- JSON array
    success_count INTEGER DEFAULT 0
);
```

## 6. Implementierungsreihenfolge

1. **KnowledgeDB**: Neue memory.db Instanz (reuse KnowledgeDB mit storageLocation='local')
2. **MemoryDB Schema**: Neue Klasse oder DDL in separater Konstante
3. **RecipeStore**: Von JSON-Files auf DB umstellen
4. **EpisodicExtractor**: Von JSON-Files auf DB umstellen
5. **RecipePromotionService**: Von JSON-Files auf DB umstellen
6. **MemoryService**: Session-Summaries in DB statt .md
7. **Migration**: Einmalige Dateien->DB Migration beim Start
8. **LongTermExtractor**: learnings.md entfernen, Routing anpassen
9. **main.ts**: Wiring (memory.db Instanz, Migration)
10. **Tests + Build + Deploy**
