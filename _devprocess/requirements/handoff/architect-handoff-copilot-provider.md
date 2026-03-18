# Architect Handoff: GitHub Copilot LLM Provider Integration

> **Epic**: EPIC-012
> **BA**: _devprocess/analysis/BA-007-github-copilot-provider.md
> **Features**: FEATURE-1201 bis FEATURE-1205
> **Erstellt**: 2026-03-18

---

## 1. Aggregierte ASRs

### Critical

| ASR | Feature | Quality Attribute | Beschreibung |
|-----|---------|-------------------|-------------|
| Token-Lifecycle als Singleton-Service | FEATURE-1201 | Reliability, Concurrency | Token-State muss plugin-weit konsistent sein. Parallele Refresh-Aufrufe muessen serialisiert werden (Promise-Lock). Generation Counter gegen Race Conditions bei Auth-Reset. |
| Content-Normalisierung im Stream-Handler | FEATURE-1202 | Correctness, Interoperability | Claude via Copilot sendet `delta.content` als Array statt String. Ohne Normalisierung werden Text-Chunks verworfen. Muss auch fehlende `delta.role` (bei Claude-Proxy) auf "assistant" defaulten. |
| SafeStorageService-Integration | FEATURE-1201 | Security | Access Token (langlebig) und Copilot Token (kurzlebig) muessen ueber SafeStorageService verschluesselt werden. Neue Settings-Felder erforderlich. |

### Moderate

| ASR | Feature | Quality Attribute | Beschreibung |
|-----|---------|-------------------|-------------|
| requestUrl statt fetch/SDK | FEATURE-1201, 1202 | Compliance | Alle HTTP-Requests ueber Obsidians `requestUrl`. OAuth-Flow (url-encoded POST), Copilot Token Exchange, Chat Completions, Model Listing, Embeddings. |
| Provider-Typ Erweiterung | FEATURE-1203 | Type Safety | `ProviderType` Union erweitern um `github-copilot`. Beeinflusst alle exhaustive switch-Statements im Codebase. |
| ModelConfigModal Erweiterung | FEATURE-1203 | Maintainability | Modal braucht conditional rendering: OAuth-Section statt API-Key fuer Copilot. Rueckwaertskompatibilitaet. |
| Async Model-Suggest | FEATURE-1205 | UX, Maintainability | Bestehende Provider nutzen statische `MODEL_SUGGESTIONS`. Copilot braucht async Fetch. Modal muss Loading-State unterstuetzen. |
| Embedding-Request-Routing | FEATURE-1204 | Modularity | SemanticIndexService muss Copilot-spezifischen Embedding-Pfad unterstuetzen (requestUrl + Custom Headers statt OpenAI SDK). |

---

## 2. Aggregierte NFRs

### Performance
| NFR | Wert | Feature |
|-----|------|---------|
| Token Refresh Latency | <500ms | FEATURE-1201 |
| Auth Flow Device Code Request | <2s | FEATURE-1201 |
| First Token Latency | Kein messbarer Overhead vs. direkter API-Zugriff | FEATURE-1202 |
| Model List Loading | <3s | FEATURE-1205 |
| Embedding Throughput | >50 Embeddings/Minute | FEATURE-1204 |

### Security
| NFR | Beschreibung | Feature |
|-----|-------------|---------|
| Token Storage | Alle Tokens ueber SafeStorageService (OS-Keychain) | FEATURE-1201 |
| Token Scope | Nur `read:user` OAuth Scope | FEATURE-1201 |
| No Plaintext Logging | Tokens nie in console.debug/warn/error | FEATURE-1201 |
| Per-Request Authorization | Token pro Request vom Auth-Service, keine Persistenz im Provider | FEATURE-1202 |

### Reliability
| NFR | Beschreibung | Feature |
|-----|-------------|---------|
| 401 Auto-Retry | Einmal Token refreshen, dann Error | FEATURE-1201, 1202 |
| Polling Cancellation | AbortController fuer Device Code Polling | FEATURE-1201 |
| Refresh Attempt Limit | Max 3 Attempts bevor Error | FEATURE-1201 |
| Fallback Model Input | Manuelles Textfeld wenn /models fehlschlaegt | FEATURE-1205 |

### Compatibility
| NFR | Beschreibung | Feature |
|-----|-------------|---------|
| Copilot Headers | User-Agent, Editor-Version, Editor-Plugin-Version, Copilot-Integration-Id, Openai-Intent, X-GitHub-Api-Version | FEATURE-1202 |
| Content Normalisierung | delta.content Array → String, fehlende delta.role → "assistant" | FEATURE-1202 |
| Error Classification | 401 → retry, 429 → rate limit msg, 403 → no sub msg, 400 → model policy msg | FEATURE-1202 |

### Compliance (Review-Bot)
| NFR | Beschreibung |
|-----|-------------|
| Kein `fetch()` | Nur `requestUrl` aus obsidian |
| Kein `innerHTML` | Obsidian DOM API (createEl, createDiv) |
| Keine `any` Types | `unknown` + Type Guards |
| Keine Floating Promises | `void` Prefix oder `.catch()` |
| Kein `element.style.X = Y` | CSS-Klassen |

---

## 3. Constraints

| Constraint | Beschreibung | Impact |
|-----------|-------------|--------|
| Inoffizielle API | `api.githubcopilot.com` ist nicht offiziell fuer Drittanbieter dokumentiert. Kein SLA. | Disclaimers erforderlich; API kann brechen |
| VSCode Client ID | Default `Iv1.b507a08c87ecfe98`. GitHub koennte sperren. | Custom Client ID Feld als Escape Hatch |
| requestUrl Einschraenkung | Gibt `ArrayBuffer` zurueck, kein `ReadableStream`. SSE Streaming nicht nativ unterstuetzt. | Streaming-Implementierung erfordert Alternative |
| Token-Hierarchie | 2 Token-Ebenen: Access Token (langlebig) → Copilot Token (~1h). Beide muessen verwaltet werden. | Eigener Token-Lifecycle noetig |
| Kein LangChain | Obsilo nutzt direkte SDK-Integration. Referenz-Implementierung nutzt LangChain → nicht 1:1 uebertragbar. | Eigener Stream-Parser noetig |
| Copilot Header-Requirements | Spezifische Headers bei jedem Request. Ohne → 403/400. | Headers als Konstanten, bei jedem Request |

---

## 4. Open Questions (priorisiert)

### Hoch (architektur-bestimmend)

1. **Streaming ueber requestUrl**: `requestUrl` liefert keine `ReadableStream`. Wie SSE-Streaming implementieren?
   - Option A: `requestUrl` mit vollstaendiger Response, dann parsen (kein echtes Streaming)
   - Option B: OpenAI SDK mit Custom `fetch`-Wrapper (SDK ueber `dangerouslyAllowBrowser`)
   - Option C: Nativen XMLHttpRequest nutzen (nicht requestUrl, aber auch nicht `fetch`)
   - **Empfehlung BA**: Option B klingt pragmatisch (OpenAI SDK wird bereits genutzt), muss aber Review-Bot-konform sein

2. **Provider-Architektur**: Eigener `GitHubCopilotProvider` oder Erweiterung des bestehenden `OpenAiProvider`?
   - Option A: Neuer Provider (saubere Trennung, Copilot-spezifische Logik isoliert)
   - Option B: `OpenAiProvider` erweitern (weniger Code, Copilot API ist OpenAI-kompatibel)
   - **Empfehlung BA**: Option A bevorzugt wegen Token-Management-Komplexitaet

3. **Auth-Service Architektur**: Eigener Singleton-Service oder Token-Management im Provider?
   - Option A: `GitHubCopilotAuthService` Singleton (wie Referenz)
   - Option B: Token-Logic direkt im Provider
   - **Empfehlung BA**: Option A (Singleton) wegen Wiederverwendung in Chat + Embedding

### Mittel (design-relevant)

4. **Settings-Struktur**: Copilot-Tokens flach in `ObsidianAgentSettings` oder verschachteltes Objekt?
   - Flach: `githubCopilotAccessToken`, `githubCopilotToken`, `githubCopilotTokenExpiresAt`
   - Verschachtelt: `copilotAuth: { accessToken, copilotToken, expiresAt }`

5. **Content-Normalisierung**: Im Provider oder als generischer Stream-Transformer?
   - Im Provider: Einfacher, aber Provider-spezifisch
   - Stream-Transformer: Wiederverwendbar, aber mehr Abstraktion

6. **Modell-Listing Timing**: Beim Modal-Open oder erst bei Provider-Wechsel auf github-copilot?

### Niedrig (implementierungs-detail)

7. **Provider-Farbe**: GitHub-Schwarz (#000000) oder GitHub-Lila (#6e40c9)?
8. **Copilot API Version Header**: Aktuell `2025-05-01` -- wie oft aktualisieren?

---

## 5. Feature-Abhaengigkeiten

```
FEATURE-1201 (Auth & Token)
    |
    +---> FEATURE-1202 (Chat Completions)
    |         |
    |         +---> FEATURE-1203 (Settings UI) ---> FEATURE-1205 (Model Listing)
    |
    +---> FEATURE-1204 (Embeddings)
```

**Implementierungs-Reihenfolge:**
1. FEATURE-1201 (Auth) -- Grundlage fuer alles
2. FEATURE-1202 (Chat Provider) -- Kernfunktionalitaet
3. FEATURE-1203 (Settings UI) -- User-facing
4. FEATURE-1205 (Model Listing) -- UX-Verbesserung
5. FEATURE-1204 (Embeddings) -- Erweiterung, parallel zu 3-5 moeglich

---

## 6. Betroffene Dateien (Blast Radius)

| Datei | Aenderung | Risiko |
|-------|----------|--------|
| `src/types/settings.ts` | `ProviderType` erweitern, neue Settings-Felder | Mittel (beeinflusst gesamte Codebase) |
| `src/api/index.ts` | `buildApiHandler` Switch erweitern | Niedrig |
| `src/api/providers/` | Neuer `github-copilot.ts` Provider | Niedrig (neue Datei) |
| `src/core/security/` | Neuer `GitHubCopilotAuthService.ts` | Niedrig (neue Datei) |
| `src/ui/settings/ModelConfigModal.ts` | Conditional OAuth UI | Mittel |
| `src/ui/settings/constants.ts` | PROVIDER_LABELS, PROVIDER_COLORS, EMBEDDING_PROVIDERS | Niedrig |
| `src/i18n/locales/*.ts` | Neue Strings | Niedrig |
| `src/core/semantic/SemanticIndexService.ts` | Copilot Embedding-Pfad | Niedrig |

---

## Naechste Schritte

Die Requirements sind bereit!

1. **Architektur:** Wechsle nun zum **Architect Agent**, um ADR-Vorschlaege
   und arc42-Dokumentation zu erstellen.
   -> Tippe: `@Architect`
