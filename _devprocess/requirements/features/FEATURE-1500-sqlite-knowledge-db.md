# Feature: SQLite Knowledge DB

> **Feature ID**: FEATURE-1500
> **Epic**: EPIC-015 - Unified Knowledge Layer
> **Priority**: P0-Critical
> **Effort Estimate**: L

## Feature Description

Die vectra-basierte Vektor-Speicherung wird durch eine SQLite-Datenbank (sql.js WASM) ersetzt. Vektoren werden als binaere BLOBs gespeichert statt als JSON-Text, Updates erfolgen inkrementell pro Chunk (INSERT/DELETE) statt als Full-Rewrite der gesamten Datei. Die Persistenz nutzt Obsidians vault.adapter fuer plattformuebergreifende Kompatibilitaet (Desktop + Mobile).

Dies loest den kritischen Bug (507MB JSON sprengt V8 String-Limit) und schafft die Grundlage fuer alle weiteren Knowledge-Layer-Features.

## Benefits Hypothesis

**Wir glauben dass** die Migration auf SQLite mit vault.adapter-Persistenz
**Folgende messbare Outcomes liefert:**
- Index-Build laeuft zu 100% durch (statt 58% Abbruch bei RangeError)
- Index-Groesse sinkt von 507MB auf <120MB
- Inkrementelle Updates nach Datei-Aenderung in <5s (statt komplettem Rebuild)

**Wir wissen dass wir erfolgreich sind wenn:**
- Der gesamte Vault (826+ Dateien) vollstaendig indexiert wird
- Plugin-Reload keinen Full Rebuild mehr triggert
- Die DB auf Desktop und Mobile geoeffnet und gelesen werden kann

## User Stories

### Story 1: Zuverlaessige Indexierung
**Als** Knowledge Worker
**moechte ich** dass mein gesamter Vault indexiert wird ohne abzubrechen
**um** semantische Suche ueber alle meine Notes nutzen zu koennen

### Story 2: Schnelle Aktualisierung
**Als** Knowledge Worker
**moechte ich** dass Aenderungen an Notes innerhalb von Sekunden im Index reflektiert werden
**um** immer aktuelle Suchergebnisse zu erhalten

### Story 3: Mobile Suche
**Als** mobiler Obsidian-Nutzer
**moechte ich** den semantischen Index auch auf meinem Smartphone nutzen
**um** unterwegs in meinem Vault suchen zu koennen

---

## Success Criteria (Tech-Agnostic)

| ID | Criterion | Target | Measurement |
|----|-----------|--------|-------------|
| SC-01 | Alle Vault-Dateien werden vollstaendig indexiert | 100% Completion | Vergleich indexierte Dateien vs. Vault-Gesamtzahl |
| SC-02 | Einzelne Datei-Aenderungen werden schnell reflektiert | Unter 5 Sekunden | Zeitmessung: Datei aendern bis Suche den neuen Inhalt findet |
| SC-03 | Index-Datei ist deutlich kleiner als bisher | Mindestens 75% Reduktion | Dateigroessen-Vergleich vorher/nachher |
| SC-04 | Neustart des Plugins baut den Index nicht komplett neu | Inkrementelles Update | Beobachtung: nur geaenderte Dateien werden reindexiert |
| SC-05 | Index ist auf Desktop und Mobile nutzbar | Beide Plattformen | Funktionstest auf Desktop + Mobile |
| SC-06 | Kein Datenverlust bei unerwartetem Plugin-Absturz | 0 verlorene Eintraege | Crash-Simulation waehrend Index-Update |

---

## Technical NFRs (fuer Architekt)

### Performance
- **Index-Build (Full)**: 826 Dateien in <5 Minuten (vs. aktuell: scheitert)
- **Index-Update (Incremental)**: Einzelne Datei in <2s, Batch 10 Dateien in <10s
- **DB-Open**: <500ms beim Plugin-Start
- **Memory**: DB im Speicher <200MB peak waehrend Bulk-Insert

### Scalability
- **Dateien**: Bis 10.000 Markdown-Dateien ohne Performance-Einbruch
- **Chunks**: Bis 100.000 Vektoren in einer DB
- **Dimensionen**: 1536 (OpenAI) bis 4096 (Qwen) Dimensionen unterstuetzt

### Availability
- **Crash-Safety**: SQLite WAL-Mode oder Transaktionen -- kein korrupter Zustand nach Absturz
- **Migration**: Bestehende vectra-Checkpoints erkennen, einmalig neu indexieren

---

## Architecture Considerations

### Architecturally Significant Requirements (ASRs)

**CRITICAL ASR #1**: Storage-Backend muss auf Desktop (Electron/Node) und Mobile (WebView) identisch funktionieren
- **Warum ASR**: Bestimmt die gesamte Persistenz-Architektur des Knowledge Layers
- **Impact**: Entscheidet ueber sql.js + vault.adapter vs. alternative Backends
- **Quality Attribute**: Portability

**CRITICAL ASR #2**: Inkrementelle Updates muessen atomar sein (kein korrupter Index nach Crash)
- **Warum ASR**: Aktuelles vectra-Problem: korrupte Index-Datei nach gescheitertem endUpdate()
- **Impact**: SQLite Transaction-Management, WAL-Mode, Checkpoint-Strategie
- **Quality Attribute**: Reliability

**MODERATE ASR #3**: DB-Schema muss erweiterbar sein fuer Graph-Daten (FEATURE-1502) und Konsolidierung (FEATURE-1505)
- **Warum ASR**: Knowledge DB ist Fundament fuer alle weiteren Features
- **Impact**: Schema-Design muss Sessions, Episodes, Recipes, Graph-Edges aufnehmen koennen
- **Quality Attribute**: Modifiability

### Constraints
- **sql.js WASM**: ~1.5MB Bundle-Groesse, muss als ES-Import oder dynamischer WASM-Load funktionieren
- **vault.adapter**: Binaere Dateien lesen/schreiben ueber writeBinary/readBinary
- **Review-Bot**: Kein `require()`, kein `fetch()` -- sql.js muss Review-Bot-konform eingebunden werden
- **Existing API**: SemanticIndexService public API (search, buildIndex, removeFile, indexFile) muss kompatibel bleiben

### Open Questions fuer Architekt
- sql.js: Bundled WASM oder Runtime-Download? Bundle erhoeht Plugin-Groesse, Download braucht Netzwerk.
- DB-Location: Innerhalb vault.adapter (syncbar) oder plugin-lokal (nicht syncbar)?
- Cosine-Similarity: In SQL (langsam) oder in JS nach Vektor-Load (schnell)?
- Schema-Migration: Wie werden kuenftige Schema-Aenderungen gehandhabt (Versioning)?

---

## Definition of Done

### Functional
- [ ] Alle User Stories implementiert
- [ ] Alle Success Criteria erfuellt (verifiziert)
- [ ] vectra komplett entfernt (keine Abhaengigkeit mehr)
- [ ] Bestehende semantic_search API funktioniert identisch

### Quality
- [ ] Unit Tests fuer DB-Operationen (CRUD, Cosine-Similarity)
- [ ] Integration Test: Full Index Build + Incremental Update
- [ ] Crash-Safety Test: Absturz waehrend Update -> kein korrupter Zustand
- [ ] Mobile-Test: DB oeffnen + lesen auf iOS/Android

### Documentation
- [ ] ADR fuer SQLite-Migration erstellt
- [ ] Feature-Spec aktualisiert (Status: Implemented)
- [ ] Backlog aktualisiert

---

## Dependencies
- **Keine externen Blocker**: sql.js ist Open Source, stabil, weit verbreitet

## Assumptions
- sql.js WASM laeuft in Obsidian Electron und Mobile WebViews
- vault.adapter.writeBinary/readBinary funktioniert zuverlaessig fuer >100MB Dateien

## Out of Scope
- Graph-Daten in der DB (FEATURE-1502)
- Session/Episode/Recipe Konsolidierung (FEATURE-1505)
- Reranking (FEATURE-1504)
