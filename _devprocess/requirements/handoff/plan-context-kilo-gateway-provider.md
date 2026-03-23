# Plan Context: Kilo Gateway LLM Provider Integration

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

**AI SDKs and Provider Layer:**
- OpenAI SDK: `openai` fuer OpenAI-kompatible Streaming- und Chat-Pfade
- Bestehende Provider-Architektur: `ApiHandler`, `buildApiHandler()`, `ProviderType`
- Zielbild: eigener `KiloGatewayProvider` mit Reuse des OpenAI-kompatiblen Transports

**Security and Storage:**
- Secret Storage: `SafeStorageService` auf Basis von Electron `safeStorage`
- Settings Storage: nicht-sensitive Provider- und Session-Metadaten in `ObsidianAgentSettings`

**HTTP and Integration:**
- Plugin-Code: `requestUrl` fuer Device Auth, Profil, Defaults, Modelle und sonstige Gateway-Metadaten
- OpenAI-kompatibler Chat-Pfad: bestehender SDK-basierter Streaming-Ansatz oder gemeinsame Transport-Hilfslogik
- Kein LangChain

## Architecture Style

- Pattern: Adapter Pattern mit fachlich eigenstaendigem Gateway-Provider
- Key Quality Goals:
  1. Maintainability: Kilo-Auth, Metadaten und Inferenz klar trennen
  2. Security: Tokens verschluesselt speichern und nur an Kilo-Endpunkte senden
  3. Correctness: Kilo-spezifische Header, Org-Kontext und `kilo/auto` nur lokal behandeln

## Key Architecture Decisions (ADR Summary)

| ADR | Title | Vorgeschlagene Entscheidung | Impact |
|-----|-------|-----------------------------|--------|
| ADR-040 | Kilo Gateway Provider Architecture | Eigener Provider-Typ mit delegierter Wiederverwendung des OpenAI-kompatiblen Inferenzpfads | High |
| ADR-041 | Kilo Auth and Session Architecture | Eigener Auth-Service mit einheitlichem Session-Modell fuer Device Auth und Manual Token | High |
| ADR-042 | Kilo Metadata Discovery Strategy | Laufzeit-Metadaten mit Session-Cache und manuellem Fallback | Medium |
| ADR-043 | Kilo Embedding Gating Strategy | Embeddings architektonisch vorbereiten, aber erst nach Capability-Validierung aktivieren | Medium |

**Detail pro ADR:**

1. **ADR-040 Provider-Architektur:** Kilo wird als eigener Provider in Factory und UI sichtbar, nutzt intern aber denselben OpenAI-kompatiblen Chat- und Streaming-Pfad wie andere Gateway-Provider.
   - Rationale: Fachliche Klarheit ohne unnoetige Doppelimplementierung.

2. **ADR-041 Auth und Session:** `KiloAuthService` kapselt Device Authorization, Manual Token Validation, Profil-/Defaults-Lookups, Org-Kontext und Secure Storage.
   - Rationale: Auth-Lifecycle ist proprietaer und darf weder im UI noch im generischen OpenAI-Provider leben.

3. **ADR-042 Metadata Discovery:** Modelle, Defaults und Organisationen werden asynchron geladen, per Session-Cache zwischengespeichert und bei Fehlern durch Retry oder manuelle Modell-Eingabe abgefedert.
   - Rationale: Aktuelle Modellpalette ohne Plugin-Release, aber kein Single Point of Failure im Modal.

4. **ADR-043 Embedding Gating:** Kilo soll denselben Zugang fuer Semantic Search nutzen koennen, aber erst nach technischer Verifikation des Embedding-Contracts produktiv aktiviert werden.
   - Rationale: Chat-MVP nicht an unbestaetigte Embedding-Annahmen koppeln.

## Neue Dateien (zu erstellen)

```text
src/core/security/KiloAuthService.ts
  - Device Authorization starten und pollen
  - Manual Token validieren
  - Profil und Defaults laden
  - Session-State vereinheitlichen
  - Token ueber SafeStorageService speichern und loeschen

src/core/providers/KiloMetadataService.ts
  - Modelle laden
  - Modelle optional gruppieren
  - Defaults und organisationsbezogene Metadaten cachen
  - Cache invalidieren bei Disconnect, Org-Wechsel oder Refresh

src/api/providers/kilo-gateway.ts
  - KiloGatewayProvider implements ApiHandler
  - OpenAI-kompatiblen Transport wiederverwenden
  - Kilo-Header nur lokal injizieren
  - Kilo-Fehler in handlungsorientierte Meldungen mappen
```

## Bestehende Dateien (zu aendern)

```text
src/types/settings.ts
  - ProviderType: 'kilo-gateway' hinzufuegen
  - ObsidianAgentSettings um Kilo-spezifische Status- und Referenzfelder erweitern
  - DEFAULT_SETTINGS anpassen
  - modelToLLMProvider() um Kilo erweitern

src/api/index.ts
  - buildApiHandler(): case 'kilo-gateway' hinzufuegen

src/ui/settings/constants.ts
  - PROVIDER_LABELS und PROVIDER_COLORS um Kilo Gateway erweitern
  - MODEL_SUGGESTIONS fuer Kilo nicht statisch pflegen
  - EMBEDDING_PROVIDERS nur aktivieren, wenn Capability-Gate erfuellt ist

src/ui/settings/ModelConfigModal.ts
  - Kilo als Provider anzeigen
  - Device-Auth-Start, Manual-Token-Option, Status und Disconnect integrieren
  - Asynchrones Modell- und Organisations-Loading anbinden
  - Fallback auf manuelle Model-ID bei Metadata-Fehlern erlauben

src/ui/settings/ModelsTab.ts
  - Provider-Darstellung und Refresh-Verhalten fuer Kilo pruefen

src/ui/settings/EmbeddingsTab.ts
  - Kilo nur anzeigen, wenn Embedding-Capability freigegeben ist

src/core/semantic/SemanticIndexService.ts
  - Kilo-Branch fuer Embeddings vorbereiten oder capability-gegated anschliessen

src/i18n/locales/en.ts
src/i18n/locales/de.ts
src/i18n/locales/es.ts
src/i18n/locales/ja.ts
src/i18n/locales/zh-CN.ts
  - Neue Kilo-Strings fuer Auth, Session, Modelle, Organisation und Fehler
```

## Data Model (Core Entities)

```text
KiloSession
  authMode: 'device-auth' | 'manual-token'
  tokenRef: string
  organizationId: string?
  accountLabel: string?
  expiresAt: timestamp?
  lastValidatedAt: timestamp?
  relations: [KiloModelCatalog, KiloDefaults]

KiloModelCatalog
  source: 'gateway-models'
  fetchedAt: timestamp
  cacheKey: string
  models: KiloModel[]
  relations: [KiloSession]

KiloModel
  id: string
  provider: string?
  supportsChat: boolean?
  supportsTools: boolean?
  supportsEmbeddings: boolean?
  pricing: metadata?
  relations: []

KiloDefaults
  defaultModelId: string?
  organizationScoped: boolean
  relations: [KiloSession]
```

## External Integrations

| System | Type | Protocol | Purpose |
|--------|------|----------|---------|
| Kilo Device Auth API | Outbound | HTTPS (`requestUrl`) | Device Authorization starten und pollen |
| Kilo Profile API | Outbound | HTTPS (`requestUrl`) | Profil- und Organisationsdaten laden |
| Kilo Defaults API | Outbound | HTTPS (`requestUrl`) | Standardmodell und Defaults laden |
| Kilo Gateway Models API | Outbound | HTTPS (`requestUrl`) | Modelle und Provider-Metadaten laden |
| Kilo Gateway Chat API | Outbound | HTTPS/SSE | Chat Completions, Streaming, Tool Calling |
| Kilo Gateway Embeddings API | Outbound | HTTPS JSON | Embeddings nach Capability-Freigabe |

## Kilo API Details

**Auth and Session Endpoints:**
- Device Auth Start: `POST https://api.kilo.ai/api/device-auth/codes`
- Device Auth Polling: `GET https://api.kilo.ai/api/device-auth/codes/{code}`
- Profile: `GET https://api.kilo.ai/api/profile`
- Defaults: `GET https://api.kilo.ai/api/defaults`
- Org Defaults: `GET https://api.kilo.ai/api/organizations/{organizationId}/defaults`

**Gateway Metadata Endpoints:**
- Models: `GET https://api.kilo.ai/api/gateway/models`
- Providers: `GET https://api.kilo.ai/api/gateway/providers`
- Models by Provider: `GET https://api.kilo.ai/api/gateway/models-by-provider`

**Inference Endpoints:**
- Chat: `POST https://api.kilo.ai/api/gateway/chat/completions`
- Embeddings: `POST https://api.kilo.ai/api/gateway/embeddings` nur nach Verifikation

**Relevant Headers:**
```text
Authorization: Bearer <kilo_token>
Content-Type: application/json
X-KiloCode-OrganizationId: <organization_id>    optional
X-KiloCode-TaskId: <task_id>                    optional
X-KiloCode-Version: <plugin_version>            optional
x-kilocode-mode: <mode>                         optional, relevant fuer kilo/auto
```

## Performance & Security

**Performance:**
- Device Auth Start: <2 Sekunden bis zur Anzeige des Browser-/Code-Schritts
- Device Auth Polling: 3-Sekunden-Intervall ohne UI-Blockade
- Model Listing: <3 Sekunden fuer initiales Laden
- First Token Latency im Chat: kein signifikanter Zusatz-Overhead gegenueber anderen OpenAI-kompatiblen Providern
- Metadata Refresh: Session-Cache reduziert redundante Requests innerhalb eines Settings-Durchlaufs

**Security:**
- Token Storage: SafeStorageService, keine Klartext-Persistenz
- Session Cleanup: Disconnect loescht Token, Org-Kontext, Validierungsstatus und laufendes Polling
- Header Isolation: Kilo-spezifische Header nur fuer Kilo-Requests
- Validation Before Use: Manual Token und Device-Auth-Session vor produktiver Nutzung gegen Profil oder Defaults pruefen
- No Plaintext Logging: Keine Tokens, Session-IDs oder sensitiven Defaults in Logs

## Implementierungsleitplanken fuer Claude Code

1. Kilo nicht als blosse OpenAI-BaseURL-Variante modellieren. Der Provider-Typ bleibt fachlich eigenstaendig.
2. Auth-Logik nicht im UI unterbringen. UI triggert nur den Service und rendert Status.
3. Shared OpenAI-Transport nur extrahieren, wenn Kilo-Fachlogik sauber ausserhalb bleibt.
4. Metadatenfehler duerfen das Speichern einer manuellen Model-ID nicht verhindern.
5. Embeddings nicht still aktivieren. Erst technische Verifikation oder explizites Capability-Gate.
6. Andere Provider duerfen von Kilo-spezifischen Headern, Settings oder Fehlerwegen nicht beeinflusst werden.

## Offene technische Risiken

- Der konkrete Embedding-Contract des Kilo Gateways ist noch nicht abschliessend verifiziert.
- Manual Token und Device-Auth-Token koennen unterschiedliche Scopes oder Laufzeiten haben.
- Organisationsspezifische Defaults und Modellverfuegbarkeit koennen je Tenant variieren.
- Der bestehende OpenAI-kompatible Providerpfad koennte zunaechst zu eng gekoppelt sein, um Reuse sauber zu extrahieren.

---

## Kontext-Dokumente fuer Claude Code

Claude Code sollte folgende Dokumente als Kontext lesen:

1. `_devprocess/architecture/ADR-040-kilo-provider-architecture.md`
2. `_devprocess/architecture/ADR-041-kilo-auth-session-architecture.md`
3. `_devprocess/architecture/ADR-042-kilo-metadata-discovery.md`
4. `_devprocess/architecture/ADR-043-kilo-embedding-gating-strategy.md`
5. `_devprocess/architecture/arc42-kilo-gateway-provider.md`
6. `_devprocess/requirements/epics/EPIC-013-kilo-gateway-provider.md`
7. `_devprocess/requirements/features/FEATURE-1301-kilo-auth-session-management.md`
8. `_devprocess/requirements/features/FEATURE-1302-kilo-gateway-chat-provider.md`
9. `_devprocess/requirements/features/FEATURE-1303-kilo-settings-ui.md`
10. `_devprocess/requirements/features/FEATURE-1304-kilo-dynamic-model-listing.md`
11. `_devprocess/requirements/features/FEATURE-1305-kilo-organization-context.md`
12. `_devprocess/requirements/features/FEATURE-1306-kilo-embedding-support.md`
13. `_devprocess/requirements/features/FEATURE-1307-kilo-manual-token-mode.md`
14. `_devprocess/requirements/handoff/architect-handoff-kilo-gateway-provider.md`

**Bestehende Referenz-Dateien:**
- `src/api/providers/openai.ts` fuer OpenAI-kompatiblen Streaming- und Transportpfad
- `src/api/providers/anthropic.ts` fuer eine eigenstaendige ApiHandler-Implementierung
- `src/api/index.ts` fuer Provider-Factory-Erweiterungen
- `src/types/settings.ts` fuer ProviderType und Settings-Felder
- `src/core/security/SafeStorageService.ts` fuer Secret Storage
- `src/ui/settings/ModelConfigModal.ts` fuer Provider-Konfiguration und asynchrones UI-Verhalten
- `src/core/semantic/SemanticIndexService.ts` fuer Embedding-Routing
