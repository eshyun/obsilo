# Feature: Enhanced Vector Retrieval

> **Feature ID**: FEATURE-1501
> **Epic**: EPIC-015 - Unified Knowledge Layer
> **Priority**: P0-Critical
> **Effort Estimate**: M

## Feature Description

Die Vektorsuche wird von "ein bester Chunk pro Datei" auf kontextreiche Ergebnisse erweitert. Bei jedem Treffer werden angrenzende Chunks (davor/danach) mitgeliefert, um Kontext an Chunk-Grenzen zu bewahren. Pro Datei koennen mehrere relevante Chunks zurueckgegeben werden statt nur der beste. Dies verbessert die Antwortqualitaet des LLM erheblich, weil zusammenhaengende Informationen nicht mehr durch Chunk-Grenzen abgeschnitten werden.

## Benefits Hypothesis

**Wir glauben dass** die Erweiterung auf Adjacent-Chunk und Multi-Chunk Retrieval
**Folgende messbare Outcomes liefert:**
- Suchergebnisse enthalten 3-5 zusammenhaengende Chunks statt 1 isolierten Chunk
- LLM-Antworten auf Vault-Fragen werden vollstaendiger und praeziser

**Wir wissen dass wir erfolgreich sind wenn:**
- Antworten auf Fragen die sich ueber mehrere Absaetze erstrecken keine Informationsluecken mehr haben
- Der User nicht mehr manuell Dateien oeffnen muss um fehlenden Kontext zu finden

## User Stories

### Story 1: Vollstaendiger Kontext
**Als** Knowledge Worker
**moechte ich** dass Suchergebnisse den vollstaendigen Kontext um einen Treffer zeigen
**um** nicht manuell in der Datei nach dem Rest der Information suchen zu muessen

### Story 2: Mehrere relevante Stellen pro Datei
**Als** Knowledge Worker
**moechte ich** dass mehrere relevante Stellen aus derselben Datei gefunden werden
**um** ein vollstaendiges Bild des Themas in dieser Datei zu erhalten

---

## Success Criteria (Tech-Agnostic)

| ID | Criterion | Target | Measurement |
|----|-----------|--------|-------------|
| SC-01 | Suchergebnisse enthalten zusammenhaengenden Kontext | 3-5 Chunks pro Treffer | Zaehlung der zurueckgegebenen Chunks pro Ergebnis |
| SC-02 | Relevante Stellen aus derselben Datei werden nicht verworfen | Bis zu 3 Stellen pro Datei | Vergleich: Frage die 2+ Abschnitte einer Datei betrifft |
| SC-03 | Suche bleibt schnell trotz mehr Ergebnissen | Unter 1 Sekunde | Zeitmessung Ende-zu-Ende |
| SC-04 | Bestehende Suche-Aufrufe funktionieren weiterhin | 100% Rueckwaertskompatibilitaet | Alle existierenden Tool-Aufrufe testen |

---

## Technical NFRs (fuer Architekt)

### Performance
- **Adjacent Chunk Lookup**: <5ms (einfacher DB-Query auf chunk_index)
- **Multi-Chunk Ranking**: <10ms fuer Top-3 Chunks pro Datei
- **Gesamt-Suchzeit**: <100ms inkl. Embedding + Similarity + Adjacent + Ranking

### Scalability
- **Token-Budget**: Adjacent Chunks erhoehen Ergebnis-Groesse -- konfigurierbares Limit (default: 5000 Chars)

---

## Architecture Considerations

### Architecturally Significant Requirements (ASRs)

**MODERATE ASR #1**: Adjacent-Chunk-Retrieval erfordert chunk_index als stabilen Sortier-Key in der DB
- **Warum ASR**: Ohne zuverlaessigen chunk_index koennen Nachbar-Chunks nicht gefunden werden
- **Impact**: DB-Schema muss (path, chunk_index) als zusammengesetzten Key unterstuetzen
- **Quality Attribute**: Performance, Correctness

### Open Questions fuer Architekt
- Wie viele Adjacent Chunks (1 oder 2 pro Seite)?
- Sollen Adjacent Chunks zusammengefuegt oder als separate Excerpts zurueckgegeben werden?
- Token-Budget: Hart begrenzen oder dem LLM ueberlassen?

---

## Definition of Done

### Functional
- [ ] Adjacent Chunks (chunk-1, chunk+1) werden bei jedem Treffer mitgeliefert
- [ ] Mehrere Chunks pro Datei werden zurueckgegeben (konfigurierbar, default 3)
- [ ] Bestehende search() API ist rueckwaertskompatibel

### Quality
- [ ] Unit Tests fuer Adjacent-Chunk-Lookup
- [ ] Performance-Test: Suche bleibt unter 100ms

### Documentation
- [ ] Feature-Spec aktualisiert

---

## Dependencies
- **FEATURE-1500**: SQLite Knowledge DB (chunk_index als DB-Spalte)

## Out of Scope
- Graph-basierte Kontext-Erweiterung (FEATURE-1502)
- Reranking der erweiterten Ergebnisse (FEATURE-1504)
