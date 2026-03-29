# Feature: Graph Data Extraction & Expansion

> **Feature ID**: FEATURE-1502
> **Epic**: EPIC-015 - Unified Knowledge Layer
> **Priority**: P0-Critical
> **Effort Estimate**: M

## Feature Description

Obsilos existierender Graph (Wikilinks, Tags, MOC-Properties) wird in die Knowledge DB extrahiert und fuer die Suche nutzbar gemacht. Bei jedem Suchtreffer folgt das System automatisch 1-2 Hops ueber Wikilinks und MOC-Verbindungen (Themen, Konzepte, Personen, Notizen, Meeting-Notes, Quellen) um verwandte Notes als erweiterten Kontext einzubeziehen. Die Ergebnisse werden mit Verbindungskontext angereichert ("gefunden via [[Kuenstliche Intelligenz]]").

## Benefits Hypothesis

**Wir glauben dass** die Nutzung des Obsidian-Graphs fuer Retrieval
**Folgende messbare Outcomes liefert:**
- Suchergebnisse enthalten strukturell verbundene Notes (1-2 Hops)
- Der User versteht warum ein Ergebnis relevant ist (Verbindungskontext)
- Antworten beruecksichtigen die MOC-Vernetzung des Vaults

**Wir wissen dass wir erfolgreich sind wenn:**
- Eine Suche nach "Agent-Architekturen" auch verlinkte Notes zu "EAM" und "Infrastructure Map" findet
- Der Verbindungspfad im Ergebnis sichtbar ist

## User Stories

### Story 1: Vernetzte Suche
**Als** Knowledge Worker
**moechte ich** dass die Suche meinen Wikilinks und MOC-Verbindungen folgt
**um** alle zusammenhaengenden Informationen zu einem Thema zu finden, nicht nur einzelne Treffer

### Story 2: Verbindungskontext
**Als** Knowledge Worker
**moechte ich** sehen ueber welchen Pfad ein Ergebnis gefunden wurde
**um** die Relevanz besser einschaetzen zu koennen

### Story 3: MOC-bewusste Suche
**Als** Knowledge Worker mit MOC-Frontmatter (Themen, Konzepte, Personen)
**moechte ich** dass meine Frontmatter-Vernetzung fuer die Suche genutzt wird
**um** thematische Cluster automatisch zu erfassen

---

## Success Criteria (Tech-Agnostic)

| ID | Criterion | Target | Measurement |
|----|-----------|--------|-------------|
| SC-01 | Suchergebnisse enthalten strukturell verbundene Notes | Mindestens 2 zusaetzliche Notes via Graph | Vergleich: Suche mit/ohne Graph-Expansion |
| SC-02 | Verbindungspfad ist im Ergebnis sichtbar | Jedes Graph-erweiterte Ergebnis zeigt den Pfad | Pruefung der Ergebnis-Metadaten |
| SC-03 | MOC-Properties werden fuer Expansion genutzt | Themen/Konzepte/Personen als Verbindungskanten | Test: Note mit Thema X findet andere Notes mit Thema X |
| SC-04 | Graph-Expansion verlangsamt die Suche nicht spuerbar | Unter 1 Sekunde Gesamtzeit | Zeitmessung mit/ohne Graph-Expansion |
| SC-05 | Property-Namen sind konfigurierbar | DE und EN unterstuetzt | Konfiguration umschalten und testen |

---

## Technical NFRs (fuer Architekt)

### Performance
- **Graph-Extraktion (Full Vault)**: 826 Dateien in <30s (einmalig beim Start)
- **Graph-Extraktion (Incremental)**: Einzelne Datei in <100ms
- **Graph-Expansion Query**: 1-2 Hops in <10ms (DB-Lookup)
- **Vault-Event-Handling**: Debounced (500ms) bei modify/rename/delete

### Scalability
- **Kanten**: Bis 50.000 Wikilinks + MOC-Edges ohne Performance-Einbruch
- **Hops**: Konfigurierbar 1-2 (default 1), max 2 um Explosion zu vermeiden

### Data Model
- **wikilinks Tabelle**: source_path, target_path, link_type ('body' | 'frontmatter'), property_name (null fuer body-links, 'Themen'/'Konzepte'/etc. fuer frontmatter)
- **tag_map Tabelle**: path, tag
- Zwei Quellen fuer Kanten:
  - **Body-Wikilinks**: `[[Note Name]]` Referenzen im Fliesstext -- kontextuelle Verweise
  - **Frontmatter-MOC-Properties**: Strukturierte Verknuepfungen via Themen, Konzepte, Personen etc.
  - Beide werden als Kanten extrahiert, aber mit unterschiedlichem link_type fuer spaetere Gewichtung

---

## Architecture Considerations

### Architecturally Significant Requirements (ASRs)

**CRITICAL ASR #1**: Graph-Daten muessen bei Vault-Aenderungen inkrementell aktualisiert werden
- **Warum ASR**: Full-Rebuild des Graphs bei jeder Aenderung waere zu langsam
- **Impact**: Event-basierte Architektur mit Obsidian vault.on('modify'/'rename'/'delete')
- **Quality Attribute**: Performance, Responsiveness

**MODERATE ASR #2**: MOC-Property-Namen muessen konfigurierbar sein
- **Warum ASR**: Deutsche und englische Vaults nutzen unterschiedliche Property-Namen
- **Impact**: Settings-Erweiterung mit Property-Name-Mapping
- **Quality Attribute**: Usability, Internationalization

### Constraints
- **Frontmatter-Parsing**: Obsidian's metadataCache nutzen statt eigenen YAML-Parser
- **Body-Link-Parsing**: Obsidian's metadataCache.links bzw. resolvedLinks nutzen (enthaelt alle Body-Wikilinks)
- **Property-Format**: MOC-Properties sind Wikilinks in YAML: `Themen: [[Kuenstliche Intelligenz]]` oder als Array: `Themen: [[[KI]], [[ML]]]`

### Open Questions fuer Architekt
- Sollen Tags als eigene Kanten oder als Attribut an Notes modelliert werden?
- Wie mit broken Links umgehen (Ziel-Note existiert nicht)?
- Graph-Extraktion: Obsidian metadataCache (live) vs. eigener Parser (robust)?
- Expansion-Strategie: BFS (breit) oder gewichtet nach Kantentyp?

---

## Definition of Done

### Functional
- [ ] Body-Wikilinks ([[Note Name]] im Fliesstext) werden extrahiert und in DB gespeichert
- [ ] Frontmatter-MOC-Properties (Themen, Konzepte, Personen, Notizen, Meeting-Notes, Quellen) werden extrahiert
- [ ] Beide Kantentypen (body, frontmatter) sind unterscheidbar in der DB
- [ ] Tags werden extrahiert und in DB gespeichert
- [ ] Suchtreffer werden um 1-2 Hops erweitert
- [ ] Verbindungspfad ist in Ergebnissen sichtbar
- [ ] Property-Namen sind in Settings konfigurierbar

### Quality
- [ ] Unit Tests fuer Graph-Extraktion (Wikilinks, Tags, MOC)
- [ ] Integration Test: Datei aendern -> Graph wird inkrementell aktualisiert
- [ ] Performance Test: Graph-Expansion <10ms

### Documentation
- [ ] Feature-Spec aktualisiert
- [ ] Settings-Dokumentation fuer MOC-Property-Konfiguration

---

## Dependencies
- **FEATURE-1500**: SQLite Knowledge DB (Graph-Tabellen in derselben DB)

## Assumptions
- Obsidian metadataCache ist zuverlaessig fuer Frontmatter-Extraktion
- MOC-Properties nutzen konsistent Wikilink-Syntax im YAML

## Out of Scope
- Implizite Verbindungen (FEATURE-1503) -- Graph Expansion nutzt nur explizite Links
- Gewichtung von Kanten-Typen (alle Kanten gleich behandelt in MVP)
