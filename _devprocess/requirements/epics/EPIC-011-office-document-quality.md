# Epic: Office Document Quality -- Template-basierte PPTX-Erzeugung

> **Epic ID**: EPIC-011
> **Business Alignment**: _devprocess/analysis/BA-006-office-document-quality.md
> **Scope**: MVP
> **Vorgaenger**: EPIC-010 (Office Document Creation -- Basis-Implementierung)

## Epic Hypothesis Statement

FUER Wissensarbeiter und Berater
DIE professionelle Praesentationen aus ihrem Vault erstellen wollen
IST DAS Template-basierte PPTX-Erzeugungssystem
EIN Architektur-Pivot von programmatischer Generierung (pptxgenjs) zu Template-Manipulation (JSZip + OOXML)
DAS Corporate-Designs 1:1 uebernimmt und mitgelieferte Default-Templates auf professionellem Niveau bietet
IM GEGENSATZ ZU programmatisch erzeugten Praesentationen die sofort als "generiert" erkennbar sind
UNSERE LOESUNG erzeugt Praesentationen mit voller Design-Treue direkt aus dem Chat

## Business Outcomes (messbar)

1. **Design-Treue**: User-Template wird 1:1 uebernommen (Hintergruende, Layouts, Logos, Fonts, Farben) -- statt nur Farbe + Font
2. **Professional-Level Default**: Mitgelieferte Templates sind ohne Nachbearbeitung praesentierbar
3. **Einheitlicher Code-Pfad**: Ob mit oder ohne User-Vorlage -- identische Engine, keine Sonderfaelle

## Leading Indicators (Fruehindikatoren)

- OOXML-Slide-Injection: Neue Slides koennen in beliebige PPTX-Templates injiziert werden ohne Korruption
- Default-Templates: 2-3 professionelle Templates sind im Plugin gebundelt und oeffnen fehlerfrei in PowerPoint/LibreOffice
- Pre-Creation-Dialog: Agent fragt vor PPTX-Erstellung nach Template-Praeferenz

## Architektur-Entscheidung: Template-basiert statt Programmatisch

### Problem mit dem bisherigen Ansatz (pptxgenjs)

pptxgenjs erzeugt PPTX-Dateien programmatisch "from scratch". Das bedeutet:
- Keine echten Slide-Masters: Hintergruende, Logos, Akzentformen gehen verloren
- Keine echten Slide-Layouts: Platzhalter-Positionen muessen manuell approximiert werden
- Kein Theme-XML: Farben/Fonts werden pro Element gesetzt statt im zentralen Theme
- Selbst bei perfekter Extraktion aller Design-Elemente sieht das Ergebnis "generiert" aus

Drei Iterationen der Extraktionslogik (Farben/Fonts -> Hintergruende/Shapes -> Positionen/Sizing) haben gezeigt: der Extraktions-Ansatz kann die Design-Treue einer echten Vorlage nicht erreichen.

### Neuer Ansatz: Template-Kopie + OOXML-Injection

1. Template-PPTX kopieren (User-Upload oder Default-Template)
2. Bestehende Slides entfernen (nur Masters/Layouts/Theme behalten)
3. Neue Slides als OOXML-XML erzeugen und in die ZIP-Struktur injizieren
4. Relationships und Content-Types aktualisieren
5. Fertige PPTX speichern

**Vorteil:** Alles was im Template ist -- Masters, Layouts, Theme, Hintergruende, Logos, Schriftarten -- bleibt exakt erhalten. Der Code muss nur Inhalte in die richtigen Platzhalter schreiben.

### Konsequenz fuer "ohne Vorlage"

2-3 Default-Templates werden als Assets im Plugin gebundelt (~50-150 KB pro Template). Der Code-Pfad ist identisch -- nur die Quelle der Template-Datei unterscheidet sich.

## MVP Features

| Feature ID | Name | Priority | Effort | Status |
|------------|------|----------|--------|--------|
| FEATURE-1100 | Template-Engine (JSZip + OOXML) | P0 | L | Not Started |
| FEATURE-1101 | Default-Templates (2-3 bundled PPTX) | P0 | M | Not Started |
| FEATURE-1102 | Pre-Creation Dialog & Template-Upload | P0 | S | Not Started |
| FEATURE-1103 | Theme-Extraktion (vereinfacht) | P1 | S | Not Started |
| FEATURE-1104 | Storyline-Framework-Skills | P1 | M | Not Started |
| FEATURE-1105 | Basis-Praesentationsregeln (Prompt) | P0 | S | Not Started |
| FEATURE-1106 | Design-Memory-Integration | P1 | S | Not Started |
| FEATURE-1107 | Follow-up Questions | P1 | S | Not Started |

**Priority Legend:**
- P0-Critical: Ohne geht MVP nicht
- P1-High: Wichtig fuer vollstaendige User Experience

**Effort:** S (1-2 Sprints), M (3-5 Sprints), L (6+ Sprints)

## Explizit Out-of-Scope

- **Animations/Uebergaenge:** Keine Slide-Transitions oder Element-Animationen
- **Video/Audio-Embedding:** Keine Multimedia-Inhalte in PPTX
- **Bearbeitung bestehender Slides:** Kein "oeffne PPTX und aendere Folie 3" -- nur Neuerstellung
- **DOCX/XLSX Template-System:** Nur PPTX in dieser Epic. DOCX/XLSX bleiben bei bestehenden Libraries
- **Chart-Generierung:** Keine nativen PowerPoint-Charts (Daten als Tabellen dargestellt)
- **Custom-Theme-Editor in Settings:** Design wird ueber Chat/Template gesteuert

## Dependencies & Risks

### Dependencies
- **JSZip:** Bereits als Dependency vorhanden (fuer Document Parsing)
- **DOMParser:** Nativ verfuegbar in Electron
- **OOXML-Wissen:** XML-Strukturen der PPTX-Slides muessen korrekt erzeugt werden

### Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| OOXML-Slide-XML komplex und fehleranfaellig | H | H | Referenz-Slides aus echten PPTX-Dateien extrahieren und als Vorlage nutzen; defensive Validation |
| Verschiedene PowerPoint-Versionen erzeugen unterschiedliches XML | M | M | Testen mit PowerPoint 2016+, LibreOffice, Google Slides; nur Standard-Elemente nutzen |
| Content-Types und Relationships muessen exakt stimmen | H | H | Unit-Tests fuer ZIP-Struktur-Integritaet; Referenz-Dateien als Test-Fixtures |
| Default-Templates erhoehen Plugin-Groesse | L | L | Templates sind typischerweise 50-150 KB; gesamt < 500 KB |
| Template-Cleanup (alte Slides entfernen) kann Referenzen brechen | M | H | Systematisches Relationship-Tracking; nur Slides entfernen, nie Masters/Layouts |
| pptxgenjs-Entfernung bricht bestehende Funktionalitaet | L | M | Parallel implementieren, erst nach vollstaendiger Verifikation umschalten |

## Abhaengigkeit von EPIC-010

EPIC-010 (Basis-Implementierung) bleibt bestehen und wird NICHT geaendert. EPIC-011 ERSETZT die PPTX-Erzeugungslogik in CreatePptxTool, nutzt aber weiterhin:
- `writeBinaryToVault()` fuer die Vault-Speicherung
- Das Input-Schema (ADR-029) fuer die LLM-Schnittstelle
- Die Tool-Registrierung und Mode-Integration
