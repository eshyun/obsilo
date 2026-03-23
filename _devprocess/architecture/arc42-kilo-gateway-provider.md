# arc42: Kilo Gateway Provider Integration

> Ergaenzung zur bestehenden arc42.md fuer EPIC-013
> Scope: MVP

---

## 1. Introduction and Goals

### 1.1 Requirements Overview

Kilo Gateway wird als weiterer LLM Provider in Obsilo Agent integriert. Nutzer sollen ihren bestehenden Kilo-Zugang fuer Chat und moeglichst auch Embeddings verwenden koennen, ohne fuer jedes Modell einen separaten Direkt-Provider zu konfigurieren. Die Integration umfasst Device Authorization, optionalen manuellen Token-Modus, dynamisches Modell-Listing, optionalen Organisationskontext und die Nutzung der OpenAI-kompatiblen Gateway-API.

### 1.2 Quality Goals

| Priority | Quality Goal | Scenario |
|----------|--------------|----------|
| 1 | Maintainability | Kilo-spezifische Auth- und Metadatenlogik kann erweitert werden, ohne den generischen OpenAI-Pfad fuer andere Provider zu destabilisieren |
| 2 | Security | Tokens werden verschluesselt gespeichert, nur an Kilo-Endpunkte gesendet und bei Disconnect vollstaendig entfernt |
| 3 | Correctness | Organisationskontext, `kilo/auto` und Kilo-Header werden nur auf Kilo-Requests angewendet |
| 4 | Availability | Fehler bei Modell-Listing oder Auth blockieren andere Obsilo-Provider nicht |
| 5 | UX Consistency | Kilo fuegt sich in das bestehende Provider-Dropdown und ModelConfigModal ein |

### 1.3 Stakeholders

| Stakeholder | Concern |
|-------------|---------|
| Obsilo-Nutzer mit Kilo-Zugang | Einmal verbinden, viele Modelle nutzen, klare Fehlerbehandlung |
| Team- und Enterprise-Nutzer | Richtiger Organisationskontext und passende Policies |
| Plugin-Entwickler | Geringe Regression, klare Schichten, Review-Bot-Compliance |
| Obsidian Community Review | Keine verbotenen Browser- oder DOM-Patterns |
| Kilo Plattform | Korrekte Header, stabile Gateway-Nutzung, sauberer Auth-Flow |

---

## 2. Constraints

| Constraint | Beschreibung |
|-----------|-------------|
| Review-Bot Compliance | Kein direktes fetch im Plugin-Code, keine floating promises, kein innerHTML, keine any-Types |
| Bestehende Provider-Architektur | Neue Integration muss in ProviderType, ApiHandler und Settings-UI passen |
| SafeStorage-Verwendung | Secrets duerfen nur ueber SafeStorageService persistiert werden |
| Gateway-API | Chat-Seite ist OpenAI-kompatibel, Auth und Metadaten jedoch proprietaer |
| Embedding-Unklarheit | Embedding-Endpoint ist noch nicht vollstaendig verifiziert |
| Kein stiller Fallback | Nutzer muessen bei Fehlern eine explizite Entscheidung treffen |

---

## 3. Context and Scope

### 3.1 Business Context

```text
                    +--------------------------------+
                    |         Obsilo Agent           |
                    |       Obsidian Plugin          |
                    +---------------+----------------+
                                    |
               +--------------------+--------------------+
               |                    |                    |
               v                    v                    v
        +-------------+      +-------------+      +--------------+
        | Existing     |      | Existing    |      | Kilo Gateway |
        | BYOK APIs    |      | Copilot API |      | API Platform |
        +-------------+      +-------------+      +------+-------+
                                                           |
                                      +--------------------+--------------------+
                                      |                    |                    |
                                      v                    v                    v
                            Device Authorization     Models Metadata     Chat and Embeddings
                            and Session Lifecycle    and Defaults        OpenAI-compatible API
```

### 3.2 Technical Context

| Interface | Protocol | Purpose |
|-----------|----------|---------|
| `POST /api/device-auth/codes` | HTTPS JSON | Device Authorization starten |
| `GET /api/device-auth/codes/{code}` | HTTPS JSON | Authorization Status pollen |
| `GET /api/profile` | HTTPS JSON | Profil- und Organisationsdaten laden |
| `GET /api/defaults` | HTTPS JSON | Standardmodell oder Defaults laden |
| `GET /api/organizations/{organizationId}/defaults` | HTTPS JSON | Organisationsspezifische Defaults laden |
| `GET /api/gateway/models` | HTTPS JSON | Modellliste laden |
| `GET /api/gateway/providers` | HTTPS JSON | Provider-Metadaten laden |
| `GET /api/gateway/models-by-provider` | HTTPS JSON | Gruppierte Modelllisten laden |
| `POST /api/gateway/chat/completions` | HTTPS SSE/JSON | Chat, Streaming, Tool Calling |
| `POST /api/gateway/embeddings` | HTTPS JSON | Embeddings, falls kompatibel und aktiviert |

---

## 4. Solution Strategy

### Technology Decisions

| Decision | Technology | ADR Reference |
|----------|------------|---------------|
| Provider-Schnitt | Eigener KiloGatewayProvider mit OpenAI-kompatiblem Transport-Reuse | ADR-040 |
| Auth und Session | Eigener KiloAuthService mit vereinheitlichtem Session-Modell | ADR-041 |
| Modell- und Org-Metadaten | Metadata-Service mit Session-Cache und Fallback | ADR-042 |
| Embedding-Support | Capability-gegated Reuse des bestehenden Embedding-Pfads | ADR-043 |

### Architecture Style

Die Loesung erweitert das bestehende Adapter Pattern der LLM-Provider um einen fachlich eigenstaendigen Gateway-Provider. Kilo wird nicht als blosse Base-URL-Konfiguration behandelt, sondern als eigener Provider-Typ mit dediziertem Auth- und Metadatenpfad. Die technische Inferenzschicht bleibt jedoch moeglichst nah am bestehenden OpenAI-kompatiblen Pfad.

### Quality Approach

| Quality Goal | Approach |
|-------------|---------|
| Maintainability | Klare Trennung in Provider, Auth-Service und Metadata-Service |
| Security | SafeStorageService fuer Secrets, Kilo-Header nur pro Kilo-Request |
| Correctness | Org-ID, Mode-Hints und Modellwerte lokal im Kilo-Provider behandeln |
| Availability | Session-Cache und manuelle Fallback-Eingaben fuer Modellkonfiguration |
| UX Consistency | Integration in vorhandene Settings-Tabs und Modale |

---

## 5. Building Block View

### Level 1: System Context

```text
+----------------------------------------------------------------+
|                        Obsilo Agent Plugin                      |
|                                                                |
|  +------------------+  +------------------+  +---------------+ |
|  | AnthropicProvider|  | OpenAiProvider   |  | KiloGateway   | |
|  | ApiHandler       |  | ApiHandler       |  | Provider      | |
|  +--------+---------+  +--------+---------+  +-------+-------+ |
|           |                      |                    |         |
|           +----------------------+--------------------+         |
|                                  |                              |
|                         +--------+---------+                    |
|                         | AgentTask /      |                    |
|                         | Pipeline         |                    |
|                         +------------------+                    |
|                                                                |
|                 +-------------------------------+              |
|                 | KiloAuthService               |              |
|                 | KiloMetadataService           |              |
|                 +---------------+---------------+              |
|                                 |                              |
+---------------------------------+------------------------------+
                                  |
                        +---------+----------+
                        |     Kilo API       |
                        | Auth, Metadata,    |
                        | Chat, Embeddings   |
                        +--------------------+
```

### Level 2: Kilo Components

```text
+----------------------------------------------------------------+
| KiloAuthService                                                 |
|----------------------------------------------------------------|
| Responsibilities:                                               |
| - Device Auth initiieren                                        |
| - Polling und Abbruch steuern                                   |
| - Manual Token validieren                                       |
| - Profil und Defaults abrufen                                   |
| - Session-State aufbauen                                        |
| - Secrets ueber SafeStorageService persistieren                 |
+----------------------------------------------------------------+

+----------------------------------------------------------------+
| KiloMetadataService                                             |
|----------------------------------------------------------------|
| Responsibilities:                                               |
| - Modelle laden                                                 |
| - Modelle optional gruppieren                                   |
| - Organisationsbezogene Defaults cachen                         |
| - Cache invalidieren bei Disconnect oder Org-Wechsel            |
+----------------------------------------------------------------+

+----------------------------------------------------------------+
| KiloGatewayProvider                                             |
|----------------------------------------------------------------|
| Responsibilities:                                               |
| - ApiHandler implementieren                                     |
| - Token und Header vom Auth-Service beziehen                    |
| - OpenAI-kompatiblen Transport fuer Chat nutzen                 |
| - Kilo-Fehler in handlungsorientierte Meldungen abbilden        |
| - `kilo/auto` und optionale Mode-Hints behandeln                |
+----------------------------------------------------------------+
```

---

## 6. Runtime View

### Scenario 1: Device Authorization and Session Bootstrap

```text
User -> Settings UI: Connect with Kilo
Settings UI -> KiloAuthService: startDeviceAuth()
KiloAuthService -> Kilo API: POST /api/device-auth/codes
Kilo API -> KiloAuthService: verificationUrl, code, expiresIn
KiloAuthService -> User: Browser-Flow und Status anzeigen
KiloAuthService -> Kilo API: GET /api/device-auth/codes/{code} (polling)
Kilo API -> KiloAuthService: approved + token
KiloAuthService -> Kilo API: GET /api/profile
KiloAuthService -> Kilo API: GET /api/defaults or org defaults
KiloAuthService -> SafeStorageService: store token
KiloAuthService -> Settings UI: authenticated session state
```

### Scenario 2: Chat Completion with Organization Context

```text
AgentTask -> KiloGatewayProvider: createMessage()
KiloGatewayProvider -> KiloAuthService: getActiveSession()
KiloGatewayProvider -> OpenAI-compatible transport: build request
OpenAI-compatible transport -> Kilo API: POST /api/gateway/chat/completions
Headers: Authorization, optional X-KiloCode-OrganizationId, X-KiloCode-Version, optional x-kilocode-mode
Kilo API -> KiloGatewayProvider: streaming response
KiloGatewayProvider -> AgentTask: ApiStreamChunks
```

### Scenario 3: Metadata Loading with Fallback

```text
Settings UI -> KiloMetadataService: listModels(session, organization)
KiloMetadataService -> Cache: lookup
Cache miss -> Kilo API: GET /api/gateway/models
Kilo API -> KiloMetadataService: models
KiloMetadataService -> Cache: store
KiloMetadataService -> Settings UI: model list
Error path: Settings UI keeps manual model input and shows retry action
```

---

## 7. Deployment View

### Infrastructure

```text
+--------------------------------------------------------------+
| Local User Machine                                            |
|--------------------------------------------------------------|
| Obsidian Desktop                                              |
|  -> Obsilo Plugin                                             |
|     -> SafeStorageService via Electron safeStorage            |
|     -> KiloAuthService / KiloMetadataService / Provider       |
+-------------------------------+------------------------------+
                                |
                                | HTTPS
                                v
+--------------------------------------------------------------+
| Kilo Cloud                                                      |
|--------------------------------------------------------------|
| Device Auth endpoints                                           |
| Profile and defaults endpoints                                  |
| Gateway models and providers endpoints                          |
| Gateway chat and embedding endpoints                            |
+--------------------------------------------------------------+
```

### Environments

| Environment | Purpose | URL |
|-------------|---------|-----|
| Development | Lokale Plugin-Entwicklung in Obsidian | Lokaler Vault + Kilo Cloud |
| Test | Manuelle E2E-Pruefung mit Kilo-Account | Kilo Cloud |
| Production | Nutzerbetrieb im Desktop-Plugin | Kilo Cloud |

---

## 8. Crosscutting Concepts

### 8.1 Domain Model

```text
KiloSession
  authMode: device-auth | manual-token
  tokenRef: string
  organizationId: string?
  accountLabel: string?
  expiresAt: timestamp?
  lastValidatedAt: timestamp?
  relations: [KiloModelCatalog, KiloDefaults]

KiloModelCatalog
  source: gateway-models
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

### 8.2 Security Concept

- Tokens werden nur verschluesselt ueber SafeStorageService gespeichert.
- Nicht-sensitive Statusinformationen duerfen in normalen Plugin-Settings liegen.
- Kilo-spezifische Header werden ausschliesslich im KiloGatewayProvider gesetzt.
- Disconnect entfernt Token, Organisationskontext, Cache und laufende Polling-Operationen.
- Manual Token und Device Auth durchlaufen dieselbe Validierung vor produktiver Nutzung.

### 8.3 Error Handling

| Failure | Detection | User Action |
|--------|-----------|-------------|
| Device Auth denied/expired | Polling-Status | Erneut verbinden |
| Invalid token | Profil- oder Gateway-Request scheitert | Token erneuern oder neu anmelden |
| Invalid organization | Org-spezifischer Request scheitert | Organisation neu waehlen |
| Metadata fetch failed | Modelle/Defaults nicht ladbar | Retry oder manuelle Model-ID |
| Embeddings unsupported | Capability check negativ | Anderen Embedding-Provider waehlen |

### 8.4 Logging and Monitoring

- Nur technische Statuslogs ohne Secrets ausgeben.
- Fehlerkategorien fuer Auth, Metadaten und Chat trennen.
- Optional in Debug-Logs: Endpoint-Kategorie, Provider-Typ, Cache-Hit oder Cache-Miss.

### 8.5 UX and State Model

- Settings-UI kennt klar getrennte States: disconnected, connecting, connected, error, stale-metadata.
- Modellliste wird asynchron geladen, blockiert aber nicht die manuelle Eingabe.
- Aktive Organisation wird sichtbar angezeigt.
- Keine stillen Providerwechsel oder automatischen Fallbacks.

---

## 9. Architecture Decisions

| ADR | Title | Status | Decision |
|-----|-------|--------|----------|
| ADR-040 | Kilo Gateway Provider Architecture | Proposed | Eigener Provider-Typ mit OpenAI-kompatiblem Transport-Reuse |
| ADR-041 | Kilo Auth and Session Architecture | Proposed | Eigener Auth-Service mit vereinheitlichtem Session-Modell |
| ADR-042 | Kilo Metadata Discovery Strategy | Proposed | Session-Cache plus manuelle Fallback-Eingabe |
| ADR-043 | Kilo Embedding Gating Strategy | Proposed | Embeddings architektonisch vorbereiten, aber capability-gegated aktivieren |

---

## 10. Quality Requirements

### Quality Tree

```text
Maintainability
  - klare Schichten zwischen Auth, Metadata und Provider
  - minimale Regressionsflaeche fuer bestehende Provider

Security
  - keine Klartext-Secrets
  - Header-Isolation
  - sauberer Disconnect

Correctness
  - richtige Org-ID pro Request
  - korrekte Behandlung von kilo/auto
  - kein Uebertrag von Kilo-Kontext auf andere Provider

Availability
  - Fallback bei Metadatenfehlern
  - andere Provider bleiben funktionsfaehig
```

### Quality Scenarios

| Scenario | Stimulus | Expected Response |
|----------|----------|------------------|
| Auth Flow | Nutzer startet Device Auth | UI zeigt Status, Polling laeuft kontrolliert, Session wird sicher gespeichert |
| Org Context | Nutzer waehlt Team-Organisation | Nachfolgende Requests tragen nur dann den Org-Header |
| Metadata Failure | Models-Endpoint ist temporaer nicht erreichbar | UI erlaubt Retry oder manuelle Model-ID |
| Provider Isolation | Kilo ist fehlerhaft konfiguriert | Andere Provider bleiben unveraendert nutzbar |
| Embedding Uncertainty | Embedding-Endpoint ist nicht kompatibel | Kilo wird fuer Embeddings deaktiviert, Chat bleibt verfuegbar |

---

## 11. Risks and Technical Debt

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Device-Auth-Aenderungen bei Kilo | M | M | Endpunkte zentral kapseln, Auth-Service isolieren |
| Unterschiedliche Scopes fuer Manual Token und Device Auth | M | M | Session nach Login validieren und Capabilities ableiten |
| Tenant-abhaengige Modellunterschiede | M | H | Cache-Key um Organization ID erweitern, Org-Wechsel invalidiert Cache |
| Embedding-Kompatibilitaet bleibt unklar | M | M | Capability Gate und frueher technischer Spike |
| Versteckte Kopplung an OpenAI-Provider-Implementierung | L | H | Shared Transport explizit modularisieren |

### Technical Debt

Der einzige bewusst akzeptierte Technical Debt ist die moegliche Zwischenphase, in der Kilo fuer Chat produktiv ist, Embeddings aber noch hinter einem Gate liegen. Diese Schuld ist kontrolliert und absichtlich, um den Chat-MVP nicht an unbestaetigte Embedding-Annahmen zu koppeln.

---

## 12. Glossary

| Term | Definition |
|------|------------|
| Kilo Gateway | OpenAI-kompatible Gateway-Plattform von Kilo fuer viele Modellanbieter |
| Device Authorization | Browsergestuetzter Login-Flow mit Code und Polling |
| Manual Token Mode | Alternativer Auth-Modus mit direkt hinterlegtem Kilo-Token |
| Organization Context | Request-Kontext ueber X-KiloCode-OrganizationId fuer Team- oder Enterprise-Nutzung |
| Metadata Service | Laufzeitdienst fuer Modelle, Defaults und weitere Gateway-Metadaten |
| Capability Gate | Mechanismus, der Features wie Embeddings erst nach positiver Kompatibilitaetspruefung freischaltet |
| kilo/auto | Virtuelles Modell, das anhand des Mode-Headers ein konkretes Modell auswaehlt |
