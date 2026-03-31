# Architect Handoff: EPIC-014 MCP Connector

> **Erstellt**: 2026-03-31 (revidiert)
> **Input**: BA-MCP-CONNECTOR.md, EPIC-014, 12 Feature-Specs

---

## 1. Architektur-Kernprinzipien

### Rollenverteilung

| | Claude | Obsilo |
|---|---|---|
| **Denken, Planen, Entscheiden** | Ja | Nein (kein LLM-Call im Connector-Modus) |
| **Vault durchsuchen** | Nein | Ja (4-Stufen-Pipeline) |
| **Vault lesen/schreiben** | Nein | Ja (Approval-Pipeline) |
| **Zusammenfassen, Analysieren** | Ja | Nein |
| **Memory persistieren** | Nein | Ja (Claude berichtet, Obsilo speichert) |
| **Lernen (Recipes, Patterns)** | Claude extrahiert Learnings | Obsilo persistiert + promovert |

### Zero-Impact auf Standalone

- **0 Aenderungen** an bestehenden Services
- Neues `src/mcp/` Verzeichnis, komplett separat
- main.ts: nur +5 Zeilen (if-guarded by `enableMcpServer`)
- MCP Server ruft nur bestehende Public APIs auf (read-only)

### System-Prompt-Ersatz

| Standalone | Connector (MCP) |
|---|---|
| `buildSystemPromptForMode()` -> LLM-Call | MCP Prompt `obsilo-system-context` -> Claude liest beim Connect |
| Tool-Definitionen im Prompt | MCP Tool Definitions (automatisch) |
| Skills im System-Prompt | MCP Prompts pro Skill |
| Memory im System-Prompt | `get_context` Tool (dynamisch pro Konversation) |

### Memory-Sharing (eine gemeinsame History)

Claude hat die Konversation, Obsilo hat den Speicher. Bruecke via Learning-Tools:
- `sync_session` -> Obsilo speichert Session-Summary + Episode
- `update_memory` -> Obsilo schreibt in user-profile/patterns/errors
- `record_episode` (via sync_session) -> Obsilo trackt Tool-Sequenzen fuer Recipes

Beide Modi (Standalone + Connector) fuettern denselben Memory-Speicher.
`source`-Feld unterscheidet Herkunft.

## 2. Scope

3 P0, 5 P1, 4 P2 Features.
**Phase 1 (P0):** Lokaler MCP Server + 8 Tools + Settings UI
**Phase 2 (P1):** Remote + Auth + Resources + Prompts + Sandbox + Memory Transparency
**Phase 3 (P2):** Plugin Skills + Remote Approval + Directory Submission

## 3. ASRs

### CRITICAL

| ID | ASR | Feature | Impact |
|----|-----|---------|--------|
| ASR-1 | MCP Server als separater Prozess (Electron Renderer kann nicht stdio bedienen) | F-1400 | child_process.fork + IPC |
| ASR-2 | Bestehende Tool-Pipeline wiederverwenden (0 Aenderungen) | F-1401 | MCP-Layer nur Adapter |
| ASR-3 | Claude ist der Agent, Obsilo macht keine LLM-Calls | F-1400 | Kein Agent-Loop im Connector-Modus |
| ASR-4 | System-Prompt muss via MCP Prompts uebertragbar sein | F-1406 | Memory + Skills + Rules als MCP Prompts |

### MODERATE

| ID | ASR | Feature | Impact |
|----|-----|---------|--------|
| ASR-5 | Remote-Transport ohne nativen HTTP-Server in Electron | F-1403 | Tunnel-basiert |
| ASR-6 | Memory-Sharing zwischen Standalone und Connector | F-1411 | Source-Tracking, gemeinsame DB |

## 4. MCP Tool-Design (8 + 2 Learning-Tools)

| Tool | Typ | Interne APIs (read-only) |
|------|-----|--------------------------|
| `get_context` | Intelligence | MemoryService + VaultStats + SkillsManager |
| `search_vault` | Intelligence | SemanticIndex + Graph + Implicit + Reranker |
| `read_notes` | Read | Vault.cachedRead + metadataCache |
| `write_vault` | Write | Vault.create/modify/delete + Approval |
| `create_document` | Write | CreateDocx/Pptx/Xlsx |
| `execute_vault_op` | Mixed | Canvas, Frontmatter, Base, etc. |
| `evaluate_expression` | Execute | SandboxExecutor |
| `sync_session` | Learning | MemoryService + EpisodicExtractor |
| `update_memory` | Learning | MemoryService |

## 5. NFR Summary

- **Latenz:** <500ms (lokal), <2s (remote)
- **Token-Budget:** MCP Tool-Definitionen < 3000 Token
- **Security:** stdio lokal (keine Auth), OAuth 2.1 remote, Approval fuer Writes
- **Privacy:** Remote opt-in, keine Cloud-Speicherung
- **Standalone-Impact:** 0 Aenderungen, 0 Regressionen

## 6. Open Questions fuer Architektur

1. **child_process.fork vs. Worker Thread** fuer den MCP Server?
2. **IPC-Protokoll:** JSON-RPC oder eigenes Format?
3. **MCP SDK:** `@modelcontextprotocol/sdk` direkt oder eigener Wrapper?
4. **Claude Desktop Auto-Config:** Kann Obsilo `claude_desktop_config.json` automatisch schreiben? Pfad OS-abhaengig.
5. **MCP Prompt-Qualitaet:** Performt `obsilo-system-context` als MCP Prompt vergleichbar zum System-Prompt? Frueh testen.
6. **Tunnel:** Cloudflare Tunnel Free Tier noch kostenlos und stabil?
7. **Embedding-API-Key:** User braucht trotzdem einen Key fuer den Index. Option B (lokales Embedding-Modell) spaeter evaluieren?

## 7. Next Step

```
/architecture
Erstelle:
- ADR fuer MCP Server Prozess-Architektur (fork, IPC, Transport)
- ADR fuer Tool-Mapping (8 Tools, keine 46)
- ADR fuer System-Prompt-via-MCP-Prompts
- plan-context.md
```
