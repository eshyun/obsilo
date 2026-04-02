# Plan Context: FEATURE-1508 Storage Consolidation

> **Feature**: FEATURE-1508
> **Epic**: EPIC-015 - Unified Knowledge Layer
> **Erstellt**: 2026-03-30

---

## 1. Ziel

Storage auf zwei klar getrennte Orte konsolidieren:
- **User-global**: `{vault-parent}/.obsidian-agent/` -- Memory, History, Recipes, Settings
- **Vault-spezifisch**: `{vault}/.obsidian-agent/` -- knowledge.db, VaultDNA

`~/.obsidian-agent/` entfaellt komplett. SyncBridge entfaellt. Legacy-Verzeichnisse werden bereinigt.

## 2. Kern-Aenderung: GlobalFileService Root

Eine Zeile:

```typescript
// VORHER (GlobalFileService.ts):
this.root = path.join(os.homedir(), '.obsidian-agent');
// Ergebnis: ~/.obsidian-agent/

// NACHHER:
this.root = path.join(path.dirname(vaultBasePath), '.obsidian-agent');
// Ergebnis: ~/Obsidian/.obsidian-agent/ (neben dem Vault)
```

GlobalFileService braucht dafuer den `vaultBasePath` im Konstruktor.
Diesen bekommt es aus `vault.adapter.getBasePath()` in main.ts.

## 3. KnowledgeDB Location aendern

```typescript
// VORHER (main.ts):
this.knowledgeDB = new KnowledgeDB(vault, pluginDir, 'global');
// Ergebnis: ~/.obsidian-agent/knowledge.db

// NACHHER:
this.knowledgeDB = new KnowledgeDB(vault, pluginDir, 'local');
// Ergebnis: {vault}/.obsidian-agent/knowledge.db
```

## 4. MemoryDB Location aendern

MemoryDB wechselt von `{vault}/.obsidian-agent/` nach `{vault-parent}/.obsidian-agent/`.
Da MemoryDB intern KnowledgeDB mit `storageLocation='local'` nutzt, muss es
stattdessen den GlobalFileService-Pfad nutzen.

Einfachste Loesung: MemoryDB bekommt den absoluten Pfad direkt:

```typescript
// VORHER:
this.knowledgeDB = new KnowledgeDB(vault, pluginDir, 'local', 'memory.db');
// Ergebnis: {vault}/.obsidian-agent/memory.db

// NACHHER: MemoryDB nutzt GlobalFileService Root
const memoryDbPath = path.join(globalFs.getRoot(), 'memory.db');
// Ergebnis: ~/Obsidian/.obsidian-agent/memory.db
```

## 5. SyncBridge entfernen

- `src/core/storage/SyncBridge.ts` -- Datei entfernen
- `src/main.ts` -- Alle SyncBridge-Referenzen entfernen:
  - Import
  - `this.syncBridge` Property
  - pullFromVault(), pushToVault(), pullFromLegacyVaultRoot()
  - Legacy Plugin-Dir Migration
  - `_syncDirMigrated` Setting

## 6. Migration: ~/.obsidian-agent/ -> {vault-parent}/.obsidian-agent/

Einmalig beim Plugin-Start:

```
if (!settings._parentDirMigrated) {
    const oldRoot = path.join(os.homedir(), '.obsidian-agent');
    const newRoot = globalFs.getRoot();  // {vault-parent}/.obsidian-agent/

    if (oldRoot existiert UND oldRoot !== newRoot) {
        Kopiere: memory/, history/, settings.json, rules/, skills/,
                 workflows/, pending-extractions.json, logs/
        NICHT kopieren: knowledge.db (wird in vault/.obsidian-agent/ neu gebaut oder migriert)
        NICHT kopieren: semantic-index/ (vectra legacy)
        NICHT kopieren: episodes/, patterns/ (in memory.db)
    }

    settings._parentDirMigrated = true;
}
```

## 7. knowledge.db Migration

knowledge.db liegt aktuell in `~/.obsidian-agent/knowledge.db` (global).
Muss nach `{vault}/.obsidian-agent/knowledge.db` (vault-lokal).

```
if (knowledge.db in ~/.obsidian-agent/ existiert UND nicht in {vault}/.obsidian-agent/) {
    Kopiere ~/.obsidian-agent/knowledge.db -> {vault}/.obsidian-agent/knowledge.db
}
```

## 8. Legacy-Cleanup

Nach erfolgreicher Migration:
```
- {vault}/.obsilo-sync/              -> loeschen
- {vault}/.obsilo/                   -> loeschen
- {vault}/.obsidian/.obsilo/         -> loeschen
- ~/.obsidian-agent/semantic-index/  -> loeschen
```

`~/.obsidian-agent/` selbst NICHT loeschen (User koennte andere Vaults haben
die noch nicht migriert sind). Wird beim naechsten Start jedes Vaults migriert.

## 9. Prompt-Pfade aktualisieren

`src/core/prompts/sections/memory.ts`:
- `.obsilo-sync/memory/` -> `.obsidian-agent/memory/` (relativer Pfad fuer Agent)
- Achtung: Der Agent sieht nur den Vault, nicht das Eltern-Verzeichnis.
  Memory-Dateien muessen ueber einen Bridge-Pfad oder Tool erreichbar sein.

WICHTIG: Das ist ein Problem. Der Agent kann nur Dateien innerhalb des Vaults
lesen/schreiben. Memory-Dateien liegen aber AUSSERHALB des Vaults
(`{vault-parent}/.obsidian-agent/`). Loesung: MemoryService liest/schreibt
weiterhin ueber GlobalFileService (fs.promises), nicht ueber vault.adapter.
Der Agent nutzt Memory indirekt ueber den System-Prompt (buildMemoryContext).

## 10. Dateien aendern

| Datei | Aenderung |
|-------|-----------|
| `src/core/storage/GlobalFileService.ts` | Root: `os.homedir()` -> `path.dirname(vaultBasePath)` |
| `src/core/storage/SyncBridge.ts` | **ENTFERNEN** |
| `src/main.ts` | SyncBridge entfernen, Migration, KnowledgeDB 'local', GlobalFileService mit vaultBasePath |
| `src/core/knowledge/MemoryDB.ts` | Pfad auf GlobalFileService Root umstellen |
| `src/core/prompts/sections/memory.ts` | Pfade aktualisieren |
| `src/types/settings.ts` | `_syncDirMigrated` -> `_parentDirMigrated` |

## 11. Verifikation

1. Build erfolgreich
2. Plugin-Start: Migration laeuft, Console zeigt `Migrated X files`
3. `~/Obsidian/.obsidian-agent/` existiert mit memory/, history/, settings.json
4. `~/Obsidian/NexusOS/.obsidian-agent/knowledge.db` existiert
5. Memory funktioniert (System-Prompt enthaelt user-profile)
6. Semantic Search funktioniert (knowledge.db am neuen Ort)
7. `.obsilo-sync/`, `.obsilo/` sind weg
