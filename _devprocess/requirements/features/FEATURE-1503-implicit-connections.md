# Feature: Implicit Connection Discovery

> **Feature ID**: FEATURE-1503
> **Epic**: EPIC-015 - Unified Knowledge Layer
> **Priority**: P1-High
> **Effort Estimate**: M

## Feature Description

Obsilo erkennt implizite Verbindungen zwischen Notes: Paare von Notes die semantisch nah sind (hohe Vektor-Aehnlichkeit) aber keinen direkten Wikilink oder gemeinsames MOC-Thema haben. Diese versteckten Zusammenhaenge werden vorberechnet (Batch-Job) und sowohl passiv in der Suche genutzt (bessere Ergebnisse) als auch aktiv dem User vorgeschlagen ("Diese Notes koennten zusammenhaengen").

Dies ist das Kern-Feature fuer vernetztes Denken: Obsilo zeigt Verbindungen die der User nicht gemacht hat -- ueber die Semantik.

## Benefits Hypothesis

**Wir glauben dass** die Erkennung impliziter Verbindungen
**Folgende messbare Outcomes liefert:**
- User entdeckt Zusammenhaenge zwischen Notes die er bisher uebersehen hat
- Suchergebnisse enthalten semantisch verwandte Notes jenseits expliziter Links
- Vault-Vernetzung verbessert sich ueber Zeit (User folgt Vorschlaegen und verlinkt)

**Wir wissen dass wir erfolgreich sind wenn:**
- Mindestens 50% der Vorschlaege vom User als relevant bewertet werden
- Der User neue Wikilinks basierend auf Vorschlaegen erstellt

## User Stories

### Story 1: Versteckte Verbindungen entdecken
**Als** Knowledge Worker
**moechte ich** erfahren welche meiner Notes thematisch zusammenhaengen ohne direkt verlinkt zu sein
**um** Wissensluecken und fehlende Verbindungen in meinem Vault zu schliessen

### Story 2: Suche ueber implizite Verbindungen
**Als** Knowledge Worker
**moechte ich** dass die Suche auch semantisch verwandte Notes findet die keinen direkten Link zum Treffer haben
**um** ein vollstaendigeres Bild eines Themas zu erhalten

### Story 3: Verbindungsvorschlaege
**Als** Knowledge Worker
**moechte ich** aktive Vorschlaege erhalten wenn Obsilo eine potenziell relevante Verbindung erkennt
**um** mein Wissensnetz gezielt erweitern zu koennen

---

## Success Criteria (Tech-Agnostic)

| ID | Criterion | Target | Measurement |
|----|-----------|--------|-------------|
| SC-01 | Implizite Verbindungen werden erkannt und gespeichert | >0 Verbindungen pro Note (durchschnittlich) | Zaehlung der erkannten Paare |
| SC-02 | Vorschlaege sind relevant (nicht nur zufaellig aehnlich) | >50% subjektiv relevant | User-Bewertung einer Stichprobe |
| SC-03 | Vorberechnung laeuft im Hintergrund ohne UI-Blockade | Keine spuerbaren Verzoegerungen | Subjektive UI-Responsiveness waehrend Berechnung |
| SC-04 | Implizite Verbindungen werden in Suchergebnisse integriert | Mindestens 1 impliziter Treffer pro Suche (wenn vorhanden) | Pruefung der Ergebnis-Metadaten |
| SC-05 | Empfindlichkeit ist einstellbar | Konfigurierbare Schwelle | Settings-Aenderung veraendert Anzahl der Vorschlaege |

---

## Technical NFRs (fuer Architekt)

### Performance
- **Vorberechnung (Full)**: 826 Notes in <5 Minuten (Hintergrund-Job, async)
- **Vorberechnung (Incremental)**: Neue/geaenderte Note in <10s (nur deren Paare neu berechnen)
- **Lookup**: Implizite Nachbarn einer Note in <5ms (DB-Query)

### Scalability
- **Note-Paare**: Bei 826 Notes = 340.725 moegliche Paare. Nur Paare >threshold speichern (erwartet: 1-5% = 3.000-17.000 Eintraege)
- **Speicher**: implicit_edges Tabelle < 5MB

### Data Model
- **implicit_edges Tabelle**: source_path, target_path, similarity_score, computed_at
- **Schwelle**: Konfigurierbar (default 0.7), aendert die Anzahl gespeicherter Edges

---

## Architecture Considerations

### Architecturally Significant Requirements (ASRs)

**CRITICAL ASR #1**: Vorberechnung darf den Vault nicht blockieren (826 Notes = 340K Paare)
- **Warum ASR**: Brute-Force alle-gegen-alle waere O(n^2) -- bei 826 Notes ~340K Cosine-Similarity-Berechnungen
- **Impact**: Batch-Job mit Yielding, ggf. nur Note-Level-Vektoren statt Chunk-Level
- **Quality Attribute**: Performance, Responsiveness

**MODERATE ASR #2**: Note-Level-Vektor als Aggregation der Chunk-Vektoren
- **Warum ASR**: Chunk-to-Chunk Vergleiche waeren O(chunks^2) statt O(notes^2) -- zu viel
- **Impact**: Pro Note einen aggregierten Vektor berechnen (Mittelwert der Chunk-Vektoren) fuer den paarweisen Vergleich
- **Quality Attribute**: Performance, Scalability

### Open Questions fuer Architekt
- Note-Level-Vektor: Mittelwert aller Chunk-Vektoren oder nur Chunk-0 (Einleitung/Frontmatter)?
- Sollen implizite Verbindungen auch MOC-Zugehoerigkeit beruecksichtigen (Notes mit gleichem Thema haben reduzierten Schwellenwert)?
- Wie oft Vorberechnung: bei jedem Build, taeglich, oder nur auf User-Anfrage?
- UI fuer Vorschlaege: Notification, Seitenleiste, oder eigenes Dashboard?

---

## Definition of Done

### Functional
- [ ] Implizite Verbindungen werden vorberechnet und in DB gespeichert
- [ ] Schwellenwert ist in Settings konfigurierbar
- [ ] Suchergebnisse enthalten implizite Treffer (markiert als "implizit verwandt")
- [ ] Aktive Vorschlaege werden dem User angezeigt (FEATURE-1506 fuer UI)

### Quality
- [ ] Unit Tests fuer Similarity-Berechnung und Threshold-Filterung
- [ ] Performance Test: Vorberechnung <5 Minuten fuer 826 Notes
- [ ] Noise-Test: Stichprobe von 20 Vorschlaegen, >50% subjektiv relevant

### Documentation
- [ ] Feature-Spec aktualisiert
- [ ] Settings-Dokumentation fuer Threshold-Konfiguration

---

## Dependencies
- **FEATURE-1500**: SQLite Knowledge DB (implicit_edges Tabelle)
- **FEATURE-1501**: Enhanced Vector Retrieval (Integration in Suchergebnisse)

## Assumptions
- Note-Level-Vektor (Mittelwert der Chunks) ist ausreichend fuer paarweisen Vergleich
- 0.7 Cosine-Similarity ist ein sinnvoller Default-Schwellenwert

## Out of Scope
- UI fuer Verbindungsvorschlaege (FEATURE-1506)
- Automatisches Erstellen von Wikilinks basierend auf Vorschlaegen
- Community-Detection (Cluster-Erkennung) -- spaeteres Feature
