# Epic: Office Document Quality -- Intelligente Template-basierte PPTX-Erzeugung

> **Epic ID**: EPIC-011
> **Business Alignment**: _devprocess/analysis/BA-006-office-document-quality.md
> **Scope**: MVP
> **Vorgaenger**: EPIC-010 (Office Document Creation -- Basis-Implementierung)

## Epic Hypothesis Statement

FUER Wissensarbeiter und Berater
DIE professionelle Praesentationen aus ihrem Vault erstellen wollen
IST DAS intelligente Template-Analyse- und Kompositionssystem
EIN Architektur-Pivot von text-basiertem Slide-Cloning zu element-basierter Template-Analyse mit Brand-DNA-Extraktion
DAS beliebige Corporate-Templates automatisch versteht, deren Design-Elemente katalogisiert und semantisch korrekt anwendet
IM GEGENSATZ ZU manuell geschriebenen Template-Skills die nicht skalieren und text-basierten Keys die nicht eindeutig sind
UNSERE LOESUNG erzeugt Praesentationen mit voller Design-Treue aus jedem Template direkt aus dem Chat

## Business Outcomes (messbar)

1. **Template-Universalitaet**: Jede PPTX-Vorlage kann automatisch analysiert und genutzt werden -- kein manuelles Reverse-Engineering
2. **Design-Treue**: Template-Elemente (Shapes, Diagramme, Formen) werden semantisch korrekt eingesetzt
3. **Skalierbarkeit**: Neue Templates in <60 Sekunden eingerichtet (einmalige Analyse)

## Leading Indicators (Fruehindikatoren)

- Template-Analyse: Tool extrahiert Element-Katalog + Brand-DNA aus beliebiger PPTX
- Shape-Name-Matching: 100% Ersetzungsrate bei Platzhalter-Texten
- Folientyp-Vielfalt: Agent nutzt mind. 5 verschiedene Folientypen pro 15-Folien-Deck
- Kein Lorem ipsum: Alle Platzhalter-Texte werden zuverlaessig ersetzt

## Architektur: Drei-Schichten-System

### Kern-Paradigmenwechsel: Von Slide-Level zu Element-Level

**Bisheriger Ansatz (Iterationen 1-3):**

1. pptxgenjs programmatisch (Design-Treue nicht erreichbar)
2. Template-Cloning mit text-basierten Keys ("Lorem ipsum" nicht eindeutig)
3. Manuelles SKILL.md pro Template (skaliert nicht)

**Neuer Ansatz: Automatische Template-Analyse + Element-Katalog**

```
Schicht 1: Template-Analyse-Tool (einmalig pro Template, generiert Skill)
           Extrahiert: Element-Katalog + Brand-DNA + Slide-Kompositionen

Schicht 2: Praesentation-Methodik-Skill (generisch, immer geladen)
           Lehrt: Content Classification, Visualisierungs-Entscheidungsbaum, Best Practices

Schicht 3: Template-Skill (generiert, pro Vorlage)
           Beschreibt: Verfuegbare Elemente, Brand-DNA, Shape-Name-Mapping
```

### Recherche-Grundlage

| Service | Pattern | Uebernommenes Konzept |
|---------|---------|----------------------|
| **PPTAgent** (EMNLP 2025) | deepcopy(shape._element) | Shapes als XML-Snippets klonen |
| **Presenton** (Open Source) | Brand-DNA-Extraktion | Design-System aus Template extrahieren |
| **Microsoft Copilot** | Layout-Name-Matching | Layouts ueber Keywords zuordnen |
| **OOXML-Spec** | a:prstGeom / a:custGeom | 187+ Preset-Shapes als XML-Snippets wiederverwendbar |

### Schluessel-Innovationen

1. **Shape-Name-Matching (S0)**: Shapes ueber OOXML-Namen identifizieren statt ueber mehrdeutigen Text
2. **Element-Katalog**: Alle einzigartigen Design-Elemente template-uebergreifend dedupliziert
3. **Brand-DNA**: Farben, Fonts, Spacing programmatisch aus theme1.xml extrahiert
4. **Skill-Generierung**: Analyse-Tool erzeugt automatisch einen Template-Skill

## MVP Features

| Feature ID | Name | Priority | Effort | Status |
|------------|------|----------|--------|--------|
| FEATURE-1100 | Template-Engine (JSZip + OOXML) | P0 | L | **Implementiert** |
| FEATURE-1101 | Default-Templates (HTML-Pipeline) | P0 | M | **Teilweise** |
| FEATURE-1102 | Pre-Creation Dialog & Template-Upload | P0 | S | **Implementiert** |
| FEATURE-1105 | Basis-Praesentationsregeln (Skills) | P0 | S | **Implementiert** |
| FEATURE-1108 | Template-Analyse-Tool | P0 | L | Not Started |
| FEATURE-1109 | Content Classification Framework | P0 | S | Not Started |
| FEATURE-1110 | Shape-Name-Matching (S0) | P0 | S | Not Started |
| FEATURE-1111 | Template-Skill-Format + Generator | P0 | M | Not Started |

**Effort:** S (1-2 Tage), M (3-5 Tage), L (1-2 Wochen)

### Entfallene Features (mit Begruendung)

| Feature ID | Name | Grund |
|------------|------|-------|
| FEATURE-1103 | Theme-Extraktion (vereinfacht) | In FEATURE-1108 integriert (Brand-DNA liefert mehr) |
| FEATURE-1104 | Storyline-Framework-Skills | In FEATURE-1109 integriert |
| FEATURE-1106 | Design-Memory-Integration | Spaeter als eigenstaendiges Feature |
| FEATURE-1107 | Follow-up Questions | Durch office-workflow Skill abgedeckt |

## Explizit Out-of-Scope

- **Animations/Uebergaenge:** Keine Slide-Transitions oder Element-Animationen
- **Video/Audio-Embedding:** Keine Multimedia-Inhalte in PPTX
- **Bearbeitung bestehender Slides:** Kein "oeffne PPTX und aendere Folie 3"
- **DOCX/XLSX Template-System:** Nur PPTX in dieser Epic
- **Freie Element-Komposition:** Slides werden als Ganzes geklont, nicht aus Einzelelementen zusammengesetzt
- **Custom-Theme-Editor in Settings:** Design ueber Chat/Template

## Dependencies & Risks

### Dependencies
- **JSZip:** Bereits vorhanden
- **DOMParser:** Nativ in Electron
- **OOXML-Wissen:** Shape-Geometrie, Theme-XML

### Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Shape-Namen nicht aussagekraeftig (auto-generiert) | M | M | Semantische Alias-Generierung, Kombination mit Position/Typ |
| Template-Analyse >60s fuer grosse Templates | L | M | Einmalige Analyse, Skill persistiert |
| Generierter Skill >16k chars (SkillsManager-Limit) | M | H | Kompakte Formatierung, nur content-bearing Elemente |
| SmartArt nicht korrekt analysierbar (dgm-Namespace) | H | M | Als Sonderfall behandeln oder vorab konvertieren |
| Element-Deduplizierung zu aggressiv/konservativ | M | L | Fingerprint-Tuning, manuelle Skill-Nachbearbeitung |

## Abhaengigkeit von EPIC-010

EPIC-010 bleibt bestehen. EPIC-011 ERWEITERT die Engine um:
- Shape-Name-Matching (S0) in PptxTemplateCloner
- Template-Analyse-Tool (neues Tool)
- Skill-Generierung (neues Tool-Feature)
- Content Classification (Skill-Erweiterung)

Bestehende Infrastruktur wird weiterhin genutzt:
- `writeBinaryToVault()` fuer Vault-Speicherung
- Input-Schema (ADR-029) fuer LLM-Schnittstelle
- Tool-Registrierung und Mode-Integration
- PptxTemplateCloner mit Strategien S1-S6 als Fallback
