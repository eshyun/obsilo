# Architect Handoff: Kilo Gateway Provider

> **Source BA**: _devprocess/analysis/BA-008-kilo-gateway-provider.md
> **Epic**: EPIC-013 - Kilo Gateway LLM Provider Integration
> **Related Features**: FEATURE-1301 bis FEATURE-1307
> **Status**: Ready for Architect

## Executive Summary

Kilo Gateway soll als weiterer LLM-Provider in Obsilo integriert werden. Im Unterschied zu GitHub Copilot ist die Inferenzseite OpenAI-kompatibel, waehrend Authentifizierung und Session-Aufbau proprietaer sind. Daraus ergibt sich voraussichtlich eine Architektur mit eigener Kilo-Auth-/Session-Komponente und maximaler Wiederverwendung des bestehenden OpenAI-kompatiblen Provider-Pfads fuer Chat und moeglicherweise Embeddings.

## Zielbild

Der Nutzer kann in Obsilo den Provider `Kilo Gateway` auswaehlen, sich per Device Authorization oder alternativ per manuellem Token authentifizieren, Modelle dynamisch laden, optional einen Organisationskontext setzen und den Provider sowohl fuer Chat als auch fuer Semantic Search nutzen.

## Functional Scope

### In Scope
- Device Authorization Flow fuer Kilo
- Sichere Speicherung und Wiederverwendung von Session- oder API-Tokens
- Chat Completions ueber Kilo Gateway
- Streaming, Tool-Calling und Modellwahl inklusive `kilo/auto`
- Dynamische Modellliste aus Gateway-Endpoints
- Optionaler Organisationskontext fuer Team-/Enterprise-Nutzer
- Manueller Token-Modus als Fallback
- Embedding-Support, sofern Gateway-Kompatibilitaet technisch bestaetigt wird

### Out of Scope
- Verwaltung von Kilo BYOK-Providern oder Gateway-Dashboard-Funktionen
- Automatische Fallback-Logik auf andere Obsilo-Provider
- Anonyme Free-Model-Automation ohne explizite Nutzerentscheidung
- Team- oder Organisationsverwaltung

## Aggregierte Architecturally Significant Requirements (ASRs)

### Critical ASR-01: Separate Kilo Auth and Session Service
- **Beschreibung**: Authentifizierung darf nicht in den generischen OpenAI-Provider gepresst werden.
- **Warum kritisch**: Kilo nutzt Device Authorization, Polling, Session-/Profil-Endpunkte und ggf. Organisationskontext.
- **Auswirkung**: Eigener Service fuer Auth, Token-Lifecycle, Persistenz und Statusverwaltung erforderlich.
- **Quality Attribute**: Security, Maintainability

### Critical ASR-02: Reuse OpenAI-Compatible Request Path Where Possible
- **Beschreibung**: Chat- und ggf. Embedding-Inferenz soll auf dem bestehenden OpenAI-kompatiblen Pfad aufsetzen, statt einen vollstaendig separaten LLM-Stack zu bauen.
- **Warum kritisch**: Minimiert Implementierungs- und Wartungsaufwand.
- **Auswirkung**: Provider-Schicht braucht klare Trennung zwischen Auth-Beschaffung und Request-Ausfuehrung.
- **Quality Attribute**: Maintainability, Delivery Speed

### Moderate ASR-03: Unified Session Model for Device Auth and Manual Token
- **Beschreibung**: Beide Auth-Modi muessen denselben Laufzeitpfad bedienen.
- **Warum relevant**: Verhindert doppelte Implementierungslogik und divergierende Fehlerbilder.
- **Auswirkung**: Session-State darf nicht an einen einzelnen Auth-Modus gekoppelt sein.
- **Quality Attribute**: Maintainability, Correctness

### Moderate ASR-04: Runtime-Loaded Model and Organization Metadata
- **Beschreibung**: Modelle und ggf. Organisationen kommen dynamisch aus dem Gateway.
- **Warum relevant**: Statische Konfiguration reicht fuer Kilo nicht aus.
- **Auswirkung**: UI und Provider-Metadaten brauchen asynchronen Datenpfad mit Caching/Fallback.
- **Quality Attribute**: UX, Maintainability

### Moderate ASR-05: Embedding Support Must Be Technically Verified Before Commitment
- **Beschreibung**: Embeddings sind gewuenscht, aber Gateway-Kompatibilitaet ist noch zu bestaetigen.
- **Warum relevant**: Verhindert falsche Architekturannahmen.
- **Auswirkung**: Architektur sollte Embeddings ermoeglichen, aber per Feature Gate deaktivierbar halten.
- **Quality Attribute**: Reliability

## Consolidated Technical NFRs

### Performance
- Device-Auth-Status-Polling darf UI nicht blockieren
- Modelllisten-Requests sollen in <3 Sekunden abgeschlossen sein
- Chat-Streaming muss vom Nutzer als durchgaengig wahrgenommen werden
- Embedding-Batches sollen den bestehenden Batch-Mechanismus wiederverwenden, falls kompatibel

### Security
- Tokens duerfen nie im Klartext persistent gespeichert werden
- Kilo-spezifische Header duerfen nur an Kilo-Endpoints gesendet werden
- Logout/Disconnect muss alle relevanten Session-Artefakte loeschen
- Manueller Token-Modus muss denselben Secure-Storage-Pfad nutzen wie Device Auth

### Reliability
- Klare Fehlerabbildung fuer Auth-Abbruch, abgelaufene Sessions, ungueltige Organisationen und Gateway-Fehler
- Modelllisten- und Organisations-Fetches brauchen Fallback-Verhalten
- Embedding-Support muss bei fehlender Kompatibilitaet isoliert deaktivierbar sein

### Scalability
- Architektur soll mehrere Kilo-Modelle und Gateway-Metadaten ohne Code-Aenderung aufnehmen koennen
- Session-/Metadata-Caching soll unnötige wiederholte Requests vermeiden

### Availability
- Fehlgeschlagene Kilo-Requests duerfen andere Obsilo-Provider nicht beeintraechtigen
- Kein globaler Ausfallpfad durch Kilo-spezifische UI- oder Session-Fehler

## Constraints

### Product Constraints
- Integration erfolgt im bestehenden Provider-Dropdown und ModelConfigModal
- Keine stillen automatischen Fallbacks auf andere Provider
- Nutzer muessen klare Fehlermeldungen und explizite Handlungsoptionen erhalten

### Technical Constraints
- Obsidian Plugin Review Rules bleiben verbindlich
- Bestehender OpenAI-kompatibler Provider-Pfad soll bevorzugt wiederverwendet werden
- Secure Storage muss ueber SafeStorageService erfolgen

### External Constraints
- Kilo-Endpunkte und Header-Konventionen muessen stabil genug fuer Plugin-Integration sein
- Device Authorization erfordert externen Browser- oder Freigabeflow

## Architektur-Fragen fuer den Architekten

1. Soll Kilo als eigener Provider-Typ mit dediziertem ApiHandler auftreten oder als spezialisierte Konfiguration des OpenAI-kompatiblen Providers mit vorgelagertem Auth-Service?
2. Wo wird der Session-State am saubersten verankert: im Settings-Modell, in einem dedizierten Runtime-Service oder hybrid?
3. Wie werden Modellliste und Organisationsliste gecacht, invalidiert und im UI aktualisiert?
4. Welcher minimale Satz an Kilo-spezifischen Headern ist fuer Chat, Modelle und Embeddings erforderlich?
5. Wie wird der manuelle Token-Modus im UI exponiert, ohne den Standard-Login-Flow unnoetig zu verkomplizieren?
6. Wie wird Embedding-Support technisch validiert und ggf. hinter einem Feature Gate gehalten?

## Empfohlene Architektur-Richtung

1. Eigener KiloAuthService fuer Device Auth, Session-Lifecycle, Profil-/Defaults-Lookups und Secure Storage.
2. Eigene Kilo-Provider-Integration auf Typ-Ebene, die fuer Inferenz intern den OpenAI-kompatiblen Request-Pfad wiederverwendet.
3. Metadata-Service oder Service-Erweiterung fuer Modelle und Organisationen mit Session-Cache.
4. Embeddings nur dann aktivieren, wenn ein technischer Spike die Gateway-Kompatibilitaet bestaetigt.

## Open Risks

- Kilo-Embedding-Kompatibilitaet ist noch nicht final bestaetigt
- Organisationsmodell und Defaults koennten sich zwischen Free-, Team- und Enterprise-Konten unterscheiden
- Session-Tokens und manuelle Tokens koennten unterschiedliche Laufzeit- oder Scope-Eigenschaften haben
- Kilo-spezifische Header-Anforderungen koennten je Endpoint variieren

## Naechste Schritte

1. Architect erstellt ADR-Vorschlaege zur Provider-Struktur, Auth-/Session-Architektur und Embedding-Strategie.
2. Architect erstellt arc42-Ergaenzung fuer Kilo Gateway.
3. Danach kann Claude Code die technische Implementierung in kleinen Schritten planen.
