# Plan Context: EPIC-014 MCP Connector

> **Epic**: EPIC-014
> **ADRs**: ADR-053 (Server-Architektur), ADR-054 (Tool-Mapping + Prompts)
> **Erstellt**: 2026-03-31

---

## 1. Architektur-Ueberblick

```
Claude Desktop/Code
  └── MCP Client (stdio)
        ↕ JSON-RPC (stdin/stdout)
mcp-server-worker.js (Child Process, Node.js)
        ↕ IPC (process.send / process.on)
ObsidianAgentPlugin (Electron Renderer)
  ├── McpBridge.ts              → spawn + IPC-Management
  ├── SemanticIndexService      → search_vault
  ├── GraphStore                → search_vault (Graph-Expansion)
  ├── ImplicitConnectionService → search_vault (Implicit)
  ├── RerankerService           → search_vault (Reranking)
  ├── Vault API                 → read_notes, write_vault
  ├── MemoryService             → get_context, sync_session, update_memory
  ├── SkillsManager             → MCP Prompts
  ├── RulesLoader               → MCP Prompts
  └── Create*Tool               → create_document
```

## 2. Kern-Entscheidungen

| Entscheidung | ADR | Begruendung |
|---|---|---|
| Separater Prozess (spawn) mit IPC | ADR-053 | Electron Renderer kann nicht stdio, Pattern aus ProcessSandboxExecutor |
| 8+2 Intelligence-Tools statt 46 CRUD | ADR-054 | Token-Effizienz (~1850 statt ~8000), Intelligence-Kapselung |
| System-Prompt via MCP Prompts | ADR-054 | soul.md + Memory + Rules + Skills als MCP Prompt beim Connect |
| Claude = Agent, Obsilo = Backend | ADR-053 | Keine LLM-Calls in Obsilo, MCP ist unidirektional |
| Memory-Sharing via Learning-Tools | ADR-054 | sync_session + update_memory, Claude extrahiert, Obsilo persistiert |

## 3. MCP Tools (10)

| Tool | Typ | Intern |
|------|-----|--------|
| `get_context` | Intelligence | MemoryService + VaultStats + Skills + Rules |
| `search_vault` | Intelligence | Semantic + Keyword + RRF + Reranker + Graph + Implicit |
| `read_notes` | Read | Vault.cachedRead + metadataCache |
| `write_vault` | Write | Vault.create/modify/delete + Approval |
| `create_document` | Write | PPTX/DOCX/XLSX Tools |
| `execute_vault_op` | Mixed | Canvas, Frontmatter, Base, Tags, Daily Note |
| `evaluate_expression` | Execute | SandboxExecutor (FEATURE-1410) |
| `sync_session` | Learning | MemoryService + EpisodicExtractor |
| `update_memory` | Learning | MemoryService (profile, patterns, errors) |

## 4. MCP Prompts

| Prompt | Quelle | Wann |
|--------|--------|------|
| `obsilo-system-context` | soul.md + Memory + Rules | Beim Connect (einmalig) |
| `obsilo-skill-{name}` | SkillsManager | Beim Connect (pro Skill) |

## 5. Neue Dateien (komplett separates Verzeichnis)

```
src/mcp/
├── McpBridge.ts              # Plugin-seitig: spawn, IPC, Lifecycle
├── mcp-server-worker.ts      # Child Process: MCP SDK Server + stdio + IPC
├── types.ts                  # IPC Message Types
├── tools/
│   ├── searchVault.ts        # 4-Stufen-Pipeline in einem Call
│   ├── readNotes.ts          # Batch-Read mit Frontmatter + Links
│   ├── writeVault.ts         # Batch-Write mit Approval
│   ├── getContext.ts          # Memory + Stats + Skills + Rules
│   ├── syncSession.ts        # Session speichern + Episode aufzeichnen
│   ├── updateMemory.ts       # Memory-Dateien aktualisieren
│   ├── createDocument.ts     # PPTX/DOCX/XLSX
│   ├── executeVaultOp.ts     # Canvas, Frontmatter, Base, etc.
│   └── evaluateExpression.ts # Sandbox-Exposure (FEATURE-1410)
└── prompts/
    └── systemContext.ts      # MCP Prompt aus soul.md + Memory + Rules + Skills
```

## 6. Bestehende Dateien: Aenderungen

| Datei | Aenderung |
|-------|-----------|
| `src/main.ts` | +5 Zeilen: `if (enableMcpServer) { new McpBridge(this).start() }` |
| `src/types/settings.ts` | +1 Setting: `enableMcpServer: boolean` (default: false) |
| `esbuild.config.mjs` | mcp-server-worker.js in Plugin-Dir kopieren (wie sandbox-worker.js) |
| **Alle bestehenden Services** | **0 Aenderungen** |

## 7. IPC Message Protocol

```typescript
// Plugin → Server
type PluginToServerMessage =
    | { type: 'tool-result'; id: string; result: unknown }
    | { type: 'context-update'; memory: string; skills: string[] }
    | { type: 'shutdown' };

// Server → Plugin
type ServerToPluginMessage =
    | { type: 'server-ready' }
    | { type: 'tool-call'; id: string; tool: string; args: Record<string, unknown> }
    | { type: 'error'; id: string; message: string };
```

## 8. Claude Desktop Auto-Config

Obsilo schreibt `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "obsilo": {
      "command": "node",
      "args": ["{pluginDir}/mcp-server-worker.js"]
    }
  }
}
```

Pfade: macOS `~/Library/Application Support/Claude/`, Windows `%APPDATA%\Claude/`, Linux `~/.config/Claude/`

## 9. Performance-Ziele

| Metrik | Target |
|--------|--------|
| IPC Roundtrip (Plugin ↔ Server) | <5ms |
| search_vault (4-Stufen-Pipeline) | <500ms |
| read_notes (5 Dateien) | <100ms |
| write_vault (1 Datei + Approval) | <200ms (+ User-Wartezeit) |
| get_context | <50ms |
| Server-Start | <2s |

## 10. Implementierungsreihenfolge (P0)

1. **McpBridge + mcp-server-worker**: spawn, IPC, Lifecycle
2. **get_context + search_vault**: Kern-Intelligence
3. **read_notes + write_vault**: CRUD mit Approval
4. **MCP Prompts**: obsilo-system-context aus Memory + Rules + Skills
5. **Settings UI**: Toggle + Auto-Config Button
6. **esbuild**: Worker-Datei deployen
7. **Test**: Claude Desktop verbinden, search_vault ausfuehren

## 11. Naechster Schritt

```
/coding
Input: Dieses Dokument + ADR-053 + ADR-054 + FEATURE-1400/1401/1402

Starte mit Phase 1 (P0): McpBridge + Worker + 4 Core Tools + Settings
```
