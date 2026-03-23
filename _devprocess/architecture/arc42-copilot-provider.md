# arc42: GitHub Copilot Provider Integration

> Ergaenzung zur bestehenden arc42.md fuer EPIC-012
> Scope: MVP

---

## 1. Introduction and Goals

### 1.1 Requirements Overview

GitHub Copilot als 8. LLM Provider in Obsilo Agent integrieren. Nutzer mit Copilot-Abo sollen ihre Premium Requests fuer Chat-Modelle und Embedding-Modelle nutzen koennen, ohne separate API Keys. Authentifizierung ueber OAuth Device Code Flow, dynamisches Modell-Listing, sichere Token-Speicherung.

### 1.2 Quality Goals

| Priority | Quality Goal | Scenario |
|----------|--------------|----------|
| 1 | **Correctness** | Claude-Modelle ueber Copilot liefern korrekte Streaming-Responses trotz Content-Format-Quirks |
| 2 | **Security** | Tokens werden verschluesselt im OS-Keychain gespeichert, nie in Plaintext geloggt |
| 3 | **Reliability** | Token-Refresh funktioniert automatisch; bei Failure klare Fehlermeldung statt stiller Fehler |
| 4 | **Compliance** | Alle Patterns Review-Bot-konform (requestUrl, kein innerHTML etc.) |
| 5 | **UX Consistency** | Copilot fuegt sich nahtlos in bestehendes Provider-Pattern ein |

### 1.3 Stakeholders

| Stakeholder | Concern |
|-------------|---------|
| Plugin-Nutzer mit Copilot Abo | Einfache Einrichtung, alle Modelle, stabile Verbindung |
| Plugin-Entwickler | Wartbarkeit, Review-Bot-Compliance, geringes API-Bruch-Risiko |
| Obsidian Community Review | Keine verbotenen Patterns |

---

## 2. Constraints

| Constraint | Beschreibung |
|-----------|-------------|
| Inoffizielle API | `api.githubcopilot.com` ist nicht offiziell fuer Drittanbieter. Kann jederzeit brechen. |
| VSCode Client ID | Default OAuth Client ID von VSCode. Koennte gesperrt werden. |
| requestUrl-Pflicht | Plugin-Code darf kein `fetch()` direkt aufrufen. SDK-internes fetch ist toleriert. |
| Kein LangChain | Obsilo nutzt direkte SDK-Integration (OpenAI + Anthropic SDK). |
| Token-Hierarchie | Zwei Token-Ebenen: Access Token (langlebig) → Copilot Token (~1h). |
| Copilot Headers | Spezifische Request-Headers (User-Agent, Editor-Version, etc.) bei jedem API-Call. |

---

## 3. Context and Scope

### 3.1 Business Context

```
                         +-------------------+
                         |    Obsilo Agent    |
                         |    (Obsidian       |
                         |     Plugin)        |
                         +--------+----------+
                                  |
                  +---------------+---------------+
                  |               |               |
                  v               v               v
           +-----------+  +------------+  +---------------+
           | Anthropic |  |  OpenAI    |  | GitHub Copilot|
           |   API     |  |   API      |  |    API        |
           | (direct)  |  | (direct)   |  | (unofficial)  |
           +-----------+  +------------+  +-------+-------+
                                                  |
                                          +-------+-------+
                                          | github.com    |
                                          | OAuth Device  |
                                          | Code Flow     |
                                          +---------------+
```

### 3.2 Technical Context

| Interface | Protocol | Purpose |
|-----------|----------|---------|
| `github.com/login/device/code` | HTTPS POST (url-encoded) | Device Code Flow starten |
| `github.com/login/oauth/access_token` | HTTPS POST (url-encoded) | Access Token Polling |
| `api.github.com/copilot_internal/v2/token` | HTTPS GET (Bearer) | Copilot Token Exchange |
| `api.githubcopilot.com/chat/completions` | HTTPS POST/SSE (Bearer) | Chat Completions |
| `api.githubcopilot.com/embeddings` | HTTPS POST (Bearer) | Embedding-Generierung |
| `api.githubcopilot.com/models` | HTTPS GET (Bearer) | Modell-Listing |

---

## 4. Solution Strategy

### Technology Decisions

| Decision | Technology | ADR Reference |
|----------|------------|---------------|
| Streaming | OpenAI SDK mit Custom fetch-Wrapper | ADR-036 |
| Provider-Architektur | Eigener Provider + Auth-Service Singleton | ADR-037 |
| Token-Speicherung | Flache Settings-Felder + SafeStorageService | ADR-038 |
| Content-Normalisierung | Im Provider, nicht als generischer Transformer | ADR-039 |

### Architecture Style

Erweitert das bestehende **Adapter Pattern** (ADR-011) um einen dritten `ApiHandler`:
- `AnthropicProvider` → Anthropic API (nativ)
- `OpenAiProvider` → Alle OpenAI-kompatiblen APIs
- `GitHubCopilotProvider` → Copilot API (OpenAI-kompatibel mit OAuth + Custom Headers)

### Quality Approach

| Quality Goal | Approach |
|-------------|---------|
| Correctness | Content-Normalisierung (ADR-039) und E2E-Tests mit Claude + GPT via Copilot |
| Security | SafeStorageService Encryption, No-Plaintext-Logging Audit |
| Reliability | Promise-Lock Token Refresh, Generation Counter, 401 Retry |
| Compliance | Kein direktes fetch(), DOM via Obsidian API, TypeScript strict |

---

## 5. Building Block View

### Level 1: System Context

```
+----------------------------------------------------------------+
|                    Obsilo Agent Plugin                           |
|                                                                  |
|  +------------------+  +------------------+  +-----------------+ |
|  | AnthropicProvider|  |  OpenAiProvider  |  | CopilotProvider | |
|  | (ApiHandler)     |  |  (ApiHandler)    |  | (ApiHandler)    | |
|  +--------+---------+  +--------+---------+  +-------+---------+ |
|           |                      |                    |          |
|           |                      |              +-----+------+   |
|           |                      |              | CopilotAuth|   |
|           |                      |              |  Service   |   |
|           |                      |              +-----+------+   |
|           |                      |                    |          |
|  +--------+----------------------+--------------------+--------+ |
|  |                    ApiHandler Interface                      | |
|  |    createMessage() | getModel() | classifyText()?           | |
|  +-------------------------------------------------------------+ |
|                              |                                    |
|  +---------------------------+----------------------------------+ |
|  |                    AgentTask / Pipeline                       | |
|  +-------------------------------------------------------------+ |
+----------------------------------------------------------------+
```

### Level 2: GitHub Copilot Components

```
+------------------------------------------------------------------+
| GitHubCopilotAuthService (Singleton)                              |
|                                                                    |
| State:                                                             |
|   - authGeneration: number        (race-condition guard)          |
|   - refreshPromise: Promise|null  (concurrent-refresh lock)      |
|   - abortController: AbortController|null (polling cancellation) |
|   - modelPolicyTermsCache: Map    (model enable guidance)        |
|                                                                    |
| Public Methods:                                                    |
|   startDeviceCodeFlow()  → DeviceCodeResponse                    |
|   pollForAccessToken(deviceCode, interval, expiresIn)  → string  |
|   getValidCopilotToken()  → string  (auto-refresh)              |
|   getAuthState()  → CopilotAuthState                            |
|   listModels()  → CopilotModelResponse                          |
|   resetAuth()  → void                                            |
|   abortPolling()  → void                                         |
|   buildCopilotHeaders(token) → Record<string,string>             |
|                                                                    |
| Internal Flow:                                                     |
|   getValidCopilotToken() → check expiry                          |
|     → if valid: return decrypted token                           |
|     → if expired: fetchCopilotToken(accessToken)                 |
|       → if refreshPromise exists: await it (concurrent lock)    |
|       → GET /copilot_internal/v2/token                          |
|       → store encrypted via SafeStorageService                   |
+------------------------------------------------------------------+

+------------------------------------------------------------------+
| GitHubCopilotProvider (implements ApiHandler)                      |
|                                                                    |
| Constructor:                                                       |
|   - Gets auth service singleton                                   |
|   - Creates OpenAI SDK client with:                               |
|     baseURL: 'https://api.githubcopilot.com'                    |
|     fetch: customCopilotFetch (injects token + headers)          |
|                                                                    |
| createMessage(systemPrompt, messages, tools, signal):              |
|   → Converts to OpenAI format                                    |
|   → Streams via SDK (SSE)                                        |
|   → Normalizes delta.content (Array → String)                    |
|   → Defaults delta.role to "assistant"                           |
|   → Accumulates tool calls                                       |
|   → Yields ApiStreamChunks                                       |
|                                                                    |
| getModel():                                                        |
|   → Returns model ID + ModelInfo                                  |
+------------------------------------------------------------------+
```

---

## 8. Crosscutting Concepts

### 8.1 Authentication Flow

```
User                   Plugin                GitHub             Copilot API
 |                       |                      |                   |
 |  "Connect"  --------> |                      |                   |
 |                       |  POST /device/code   |                   |
 |                       | -------------------> |                   |
 |                       | <--- deviceCode ---  |                   |
 | <-- show userCode --- |                      |                   |
 |  enters code -------> |                      |                   |
 |                       |  poll access_token   |                   |
 |                       | -------------------> |                   |
 |                       | <-- accessToken ---  |                   |
 |                       |  encrypt(token)      |                   |
 |                       |  save to settings    |                   |
 |                       |                      |                   |
 |  "Chat with model" -> |                      |                   |
 |                       |  GET /v2/token       |                   |
 |                       | -------------------> |                   |
 |                       | <-- copilotToken --  |                   |
 |                       |  encrypt + save      |                   |
 |                       |                      |                   |
 |                       |  POST /chat/completions                  |
 |                       | ---------------------------------------->|
 |                       | <----- SSE stream ----------------------|
 | <-- streaming text -- |                      |                   |
```

### 8.2 Token-Refresh Lifecycle

```
getValidCopilotToken()
    |
    +-- copilotToken exists AND not expired (>1min buffer)?
    |   YES → decrypt and return
    |
    +-- accessToken exists?
    |   NO → throw "Not authenticated"
    |
    +-- refreshPromise already running?
    |   YES → await existing promise (concurrent lock)
    |
    +-- refreshAttempts >= MAX (3)?
    |   YES → reset attempts, throw "Refresh failed"
    |
    +-- fetchCopilotToken()
        +-- check authGeneration (race-condition guard)
        +-- GET /copilot_internal/v2/token  (Bearer: accessToken)
        +-- parse expires_at (seconds/millis/ISO/expires_in fallback)
        +-- encrypt + store copilotToken + expiresAt
        +-- return copilotToken
```

### 8.3 Error Handling Strategy

| HTTP Status           | Context             | User-Facing Action                                        |
|-----------------------|---------------------|---------------------------------------------------------|
| 401 Unauthorized      | Chat/Embedding      | Auto-retry: refresh token once, then show re-auth prompt |
| 403 Forbidden         | Chat/Embedding      | "No active Copilot subscription. Check github.com/settings/copilot" |
| 429 Too Many Requests | Chat/Embedding      | "Premium Requests aufgebraucht. Bitte waehle ein anderes Modell." |
| 400 Bad Request       | Chat (model policy) | "Modell nicht aktiviert." + Policy Terms Link aus Cache |
| Network Error         | Any                 | "Verbindung fehlgeschlagen. Pruefe deine Internetverbindung." |

### 8.4 Security Concept

- **Token Encryption:** Alle Tokens (Access + Copilot) ueber `SafeStorageService.encrypt()` vor dem Schreiben, `decrypt()` vor dem Lesen
- **Token Scope:** Nur `read:user` OAuth Scope angefragt (minimale Berechtigung)
- **No Logging:** Tokens werden nie in console.debug/warn/error ausgegeben. Nur "[Copilot] Token refreshed" o.ae.
- **Generation Counter:** Bei `resetAuth()` wird eine Generation inkrementiert. Laufende async-Operationen pruefen vor Token-Speicherung ob die Generation noch stimmt. Verhindert: Auth reset → alte Operation ueberschreibt leere Tokens.
- **Polling Cancellation:** `AbortController` fuer Device Code Polling. Wird bei `resetAuth()` und bei neuem Polling-Start abgebrochen.

---

## 9. Architecture Decisions

| ADR | Title | Status | Decision |
|-----|-------|--------|----------|
| ADR-036 | Copilot Streaming Strategy | Proposed | OpenAI SDK mit Custom fetch-Wrapper (echtes SSE Streaming) |
| ADR-037 | Copilot Provider Architecture | Proposed | Eigener Provider + Auth-Service Singleton (Separation of Concerns) |
| ADR-038 | Copilot Token Storage | Proposed | Flache Felder in ObsidianAgentSettings + SafeStorageService |
| ADR-039 | Copilot Content Normalization | Proposed | Im Provider: delta.content Array→String, delta.role→"assistant" |

---

## 11. Risks and Technical Debt

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| GitHub sperrt VSCode Client ID | Niedrig | Hoch | Custom Client ID Feld als Escape Hatch; breites Oekosystem nutzt gleiche ID |
| Copilot API Endpoints aendern sich | Mittel | Mittel | URLs/Headers als Konstanten; API-Version-Header; schnelle Patch-Moeglichkeit |
| Token Refresh Race Condition | Niedrig | Mittel | Promise-Lock + Generation Counter (bewaehertes Pattern aus Referenz) |
| Claude Content-Format aendert sich | Niedrig | Niedrig | Normalisierung ist defensiv (passthrough wenn String) |
| Review-Bot beanstandet SDK-internes fetch | Sehr niedrig | Hoch | Wird seit 2+ Jahren toleriert; Fallback: XMLHttpRequest SSE |
| Copilot Rate Limits unbekannt | Mittel | Niedrig | 429-Error-Handling mit klarer User-Message |

### Technical Debt

Kein geplanter Technical Debt -- dies ist MVP-Scope mit vollstaendiger Implementierung.
Einzige potenzielle Schuld: Wenn Copilot API stabil bleibt, wird der Custom-Client-ID-Mechanismus wahrscheinlich nie genutzt.

---

## 12. Glossary

| Term | Definition |
|------|------------|
| Device Code Flow | OAuth 2.0 Verfahren fuer geraete ohne Browser-Redirect-Faehigkeit |
| Access Token | Langlebiger GitHub OAuth Token (Ergebnis des Device Code Flow) |
| Copilot Token | Kurzlebiger API-Token (~1h) fuer api.githubcopilot.com |
| Premium Requests | Monatlich begrenzte LLM-Aufrufe im Copilot-Abonnement |
| Client ID | OAuth App Identifier gegenueber GitHub. Default: VSCodes ID. |
| Generation Counter | Monoton steigender Zaehler der bei Auth-Reset inkrementiert wird. Laufende Async-Ops pruefen gegen diesen Wert um veraltete Token-Writes zu verhindern. |
| Promise-Lock | Pattern bei dem concurrent Token-Refresh-Aufrufe auf dasselbe Promise warten statt parallele Requests auszuloesen |
| Content Normalization | Konvertierung von Claude-spezifischem Content-Array Format zu Plain String |
