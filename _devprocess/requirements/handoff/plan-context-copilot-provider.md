# Plan Context: GitHub Copilot LLM Provider Integration

> **Purpose:** Technische Zusammenfassung fuer Claude Code
> **Created by:** Architect Agent
> **Date:** 2026-03-18

---

## Technical Stack

**Backend (Plugin):**
- Language: TypeScript (strict)
- Framework: Obsidian Plugin API
- Build: esbuild
- Runtime: Electron (via Obsidian)

**AI SDKs:**
- Anthropic SDK: `@anthropic-ai/sdk` (AnthropicProvider)
- OpenAI SDK: `openai` (OpenAiProvider + NEU: GitHubCopilotProvider)
- Kein LangChain

**Security:**
- Token-Verschluesselung: SafeStorageService (Electron OS-Keychain)

**HTTP:**
- Plugin-Code: `requestUrl` (Obsidian API) -- fuer OAuth Flow, Token Exchange, Model Listing
- SDK-intern: `fetch` via OpenAI SDK -- fuer Chat Completions Streaming

## Architecture Style

- Pattern: Adapter Pattern (ADR-011) -- erweitert um dritten ApiHandler
- Key Quality Goals:
  1. Correctness: Content-Normalisierung fuer Claude-via-Copilot Streaming
  2. Security: Verschluesselte Token-Speicherung, kein Plaintext-Logging
  3. Reliability: Automatischer Token-Refresh, klare Fehlermeldungen

## Key Architecture Decisions (ADR Summary)

| ADR | Title | Vorgeschlagene Entscheidung | Impact |
|-----|-------|-----------------------------|--------|
| ADR-036 | Streaming Strategy | OpenAI SDK mit Custom fetch-Wrapper | High |
| ADR-037 | Provider Architecture | Eigener Provider + Auth-Service Singleton | High |
| ADR-038 | Token Storage | Flache Felder in ObsidianAgentSettings | Medium |
| ADR-039 | Content Normalization | Im Provider: Array→String, role→"assistant" | Medium |

**Detail pro ADR:**

1. **ADR-036 Streaming:** OpenAI SDK mit Custom fetch-Wrapper fuer echtes SSE-Streaming. SDK-internes fetch ist Review-Bot-konform (wird seit 2+ Jahren toleriert). Custom fetch injiziert Bearer Token + Copilot Headers.
   - Rationale: Bewaehrtes Pattern (OpenAiProvider nutzt es bereits), echtes Streaming statt Response-Buffering.

2. **ADR-037 Provider-Architektur:** Neuer `GitHubCopilotProvider` + `GitHubCopilotAuthService` Singleton.
   - Rationale: Auth-Lifecycle (OAuth, Token-Refresh, Polling) fundamental anders als API-Key-Provider. Auth-Service wiederverwendbar fuer Chat + Embedding.

3. **ADR-038 Token Storage:** Flache Felder `githubCopilotAccessToken`, `githubCopilotToken`, `githubCopilotTokenExpiresAt`, `githubCopilotCustomClientId` in Settings.
   - Rationale: Konsistent mit bestehendem Pattern. SafeStorageService arbeitet auf String-Ebene.

4. **ADR-039 Content Normalization:** `normalizeDeltaContent()` im Provider. delta.content Array→String, fehlende delta.role→"assistant".
   - Rationale: Copilot-spezifisch, isoliert, minimal.

## Neue Dateien (zu erstellen)

```
src/core/security/GitHubCopilotAuthService.ts
  - Singleton: getInstance()
  - OAuth Device Code Flow (requestUrl)
  - Token-Lifecycle: accessToken → copilotToken (auto-refresh)
  - Promise-Lock fuer concurrent refreshes
  - Generation Counter fuer race-condition safety
  - Model Listing via /models endpoint
  - Copilot Header Builder

src/api/providers/github-copilot.ts
  - GitHubCopilotProvider implements ApiHandler
  - OpenAI SDK Client mit Custom fetch (token + headers injection)
  - createMessage() mit Content-Normalisierung
  - 401 retry: invalidate token, refresh, retry once
```

## Bestehende Dateien (zu aendern)

```
src/types/settings.ts
  - ProviderType: 'github-copilot' hinzufuegen
  - ObsidianAgentSettings: 4 neue Felder (tokens + clientId)
  - DEFAULT_SETTINGS: Default-Werte
  - modelToLLMProvider(): github-copilot Mapping

src/api/index.ts
  - buildApiHandler switch: case 'github-copilot' hinzufuegen

src/ui/settings/constants.ts
  - PROVIDER_LABELS: 'github-copilot' Eintrag
  - PROVIDER_COLORS: Farbwert (z.B. #6e40c9 GitHub-Lila)
  - EMBEDDING_PROVIDERS: 'github-copilot' hinzufuegen
  - MODEL_SUGGESTIONS: Kein statischer Eintrag (dynamisches Listing)
  - EMBEDDING_SUGGESTIONS: statisch oder dynamisch

src/ui/settings/ModelConfigModal.ts
  - updateFieldVisibility(): github-copilot → OAuth-Button statt API-Key
  - Conditional rendering: Connect/Disconnect Button + Status
  - Async Model-Fetch fuer Copilot (optional, nicht statische Suggestions)

src/core/semantic/SemanticIndexService.ts
  - embedBatchViaApi(): github-copilot Branch (Copilot Headers + Token)

src/i18n/locales/en.ts, de.ts, es.ts, ja.ts, zh-CN.ts
  - Neue Strings: provider.github-copilot, copilot.auth.*, copilot.error.*
```

## External Integrations

| System | Type | Protocol | Purpose |
|--------|------|----------|---------|
| github.com OAuth | Outbound | HTTPS (requestUrl) | Device Code Flow + Access Token |
| api.github.com | Outbound | HTTPS (requestUrl) | Copilot Token Exchange |
| api.githubcopilot.com | Outbound | HTTPS (OpenAI SDK fetch) | Chat Completions, Embeddings, Models |

## Copilot API Details

**OAuth Endpoints (via requestUrl, url-encoded body):**
- Device Code: `POST https://github.com/login/device/code`
  - Body: `client_id=Iv1.b507a08c87ecfe98&scope=read:user`
- Access Token: `POST https://github.com/login/oauth/access_token`
  - Body: `client_id=...&device_code=...&grant_type=urn:ietf:params:oauth:grant-type:device_code`
- Copilot Token: `GET https://api.github.com/copilot_internal/v2/token`
  - Header: `Authorization: Bearer <accessToken>`

**API Endpoints (via OpenAI SDK fetch):**
- Chat: `POST https://api.githubcopilot.com/chat/completions`
- Embeddings: `POST https://api.githubcopilot.com/embeddings`
- Models: `GET https://api.githubcopilot.com/models`

**Required Headers (alle API-Calls):**
```
Authorization: Bearer <copilotToken>
Content-Type: application/json
User-Agent: GitHubCopilotChat/0.38.2026022001
Editor-Version: vscode/1.110.0
Editor-Plugin-Version: copilot-chat/0.38.2026022001
Copilot-Integration-Id: vscode-chat
Openai-Intent: conversation-panel
X-GitHub-Api-Version: 2025-05-01
```

## Performance & Security

**Performance:**
- Token Refresh: <500ms
- Auth Flow: <2s Device Code Request + User Interaction + Polling
- First Token Latency: Kein messbarer Overhead vs. direkter API-Zugriff
- Model Listing: <3s

**Security:**
- Token Storage: SafeStorageService (Electron OS-Keychain Encryption)
- Token Scope: `read:user` (minimal)
- No Plaintext Logging: Tokens nie in console-Ausgaben
- Generation Counter: Verhindert veraltete Token-Writes nach Auth-Reset
- Promise-Lock: Verhindert parallele Token-Refresh-Requests

---

## Kontext-Dokumente fuer Claude Code

Claude Code sollte folgende Dokumente als Kontext lesen:

1. `_devprocess/architecture/ADR-036-copilot-streaming-strategy.md`
2. `_devprocess/architecture/ADR-037-copilot-provider-architecture.md`
3. `_devprocess/architecture/ADR-038-copilot-token-storage.md`
4. `_devprocess/architecture/ADR-039-copilot-content-normalization.md`
5. `_devprocess/architecture/arc42-copilot-provider.md`
6. `_devprocess/requirements/features/FEATURE-1201-copilot-auth-token-management.md`
7. `_devprocess/requirements/features/FEATURE-1202-copilot-chat-completions.md`
8. `_devprocess/requirements/features/FEATURE-1203-copilot-settings-ui.md`
9. `_devprocess/requirements/features/FEATURE-1204-copilot-embedding-support.md`
10. `_devprocess/requirements/features/FEATURE-1205-copilot-dynamic-model-listing.md`

**Bestehende Referenz-Dateien:**
- `src/api/providers/openai.ts` -- Pattern fuer OpenAI SDK + Streaming
- `src/api/providers/anthropic.ts` -- ApiHandler Referenz-Implementierung
- `src/api/index.ts` -- Provider Factory (switch erweitern)
- `src/types/settings.ts` -- ProviderType + Settings-Felder
- `src/core/security/SafeStorageService.ts` -- Token-Verschluesselung
- `src/ui/settings/ModelConfigModal.ts` -- UI fuer Provider-Konfiguration
- `src/core/semantic/SemanticIndexService.ts:embedBatchViaApi()` -- Embedding-Routing
