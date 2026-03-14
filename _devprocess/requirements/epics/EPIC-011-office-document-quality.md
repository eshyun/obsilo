# Epic: Office Document Quality -- Template Design Intelligence

> **Epic ID**: EPIC-011
> **Business Alignment**: _devprocess/analysis/BA-006-office-document-quality.md, _devprocess/analysis/TEMPLATE-DESIGN-INTELLIGENCE-ANALYSIS.md
> **Scope**: MVP
> **Vorgaenger**: EPIC-010 (Office Document Creation -- Basis-Implementierung)

## Epic Hypothesis Statement

FUER Wissensarbeiter und Berater
DIE professionelle Praesentationen aus ihrem Vault erstellen wollen
IST DAS Template Design Intelligence System
EIN Paradigmenwechsel von mechanischem Template-Cloning zu semantischem Design-Verstaendnis
DAS beliebige Corporate-Templates automatisch analysiert, deren visuelle Formen als Design-Sprache uebersetzt und dem LLM visuelles Denken ermoeglicht
IM GEGENSATZ ZU Key-Value-Mapping-Systemen die das LLM auf Feldfuellen reduzieren und manuellen Template-Skills die nicht skalieren
UNSERE LOESUNG erzeugt Praesentationen mit narrativer Struktur und bewussten Design-Entscheidungen aus jedem Template

## Business Outcomes (messbar)

1. **Template-Universalitaet**: Jede PPTX-Vorlage kann automatisch analysiert und als semantische Design-Sprache genutzt werden -- kein manuelles Reverse-Engineering
2. **Design-Intelligenz**: Agent trifft bewusste Design-Entscheidungen (warum DIESE visuelle Form fuer DIESEN Inhalt) statt nur Felder zu fuellen
3. **Narrative Qualitaet**: Praesentationen folgen einer erkennbaren Erzaehlstruktur (SCQA, Sparkline, Data Story etc.)
4. **Skalierbarkeit**: Neue Templates in unter 5 Minuten vollstaendig analysiert und einsatzbereit

## Leading Indicators (Fruehindikatoren)

- Template-Analyse: Multimodale Pipeline erzeugt Visual Design Language Document aus beliebiger PPTX
- Visuelle Vielfalt: Agent nutzt mind. 5 verschiedene Slide-Kompositionen pro 15-Folien-Deck
- Narrative Struktur: Agent waehlt und benennt ein Storytelling-Framework VOR der Slide-Planung
- Design-Reasoning: Agent begruendet Slide-Typ-Wahl mit semantischer Bedeutung der visuellen Form
- Shape-Name-Matching: 100% Ersetzungsrate bei allen Content-Shapes

## Architektur: Template Design Intelligence

### Root Cause: LLM als Key-Value-Mapper

Das bisherige System reduziert ein starkes LLM auf einen mechanischen Mapper:

```
Content -> Slide-Nummer waehlen -> Shape-Namen nachschlagen -> Text einsetzen
```

Es fehlt jede Form von:
- **Visuellem Verstaendnis**: Was BEDEUTEN die Formen im Template?
- **Narrativer Planung**: Welche Geschichte erzaehlt die Praesentation?
- **Design-Reasoning**: Warum ist eine bestimmte visuelle Form die richtige?
- **Kreativem Spielraum**: Das LLM kann keine Design-Entscheidungen treffen

### Drei Schichten des Design-Verstaendnisses

**Schicht 1: Visuelles Vokabular** -- Was Formen BEDEUTEN

Jede geometrische Form traegt eine semantische Bedeutung (Chevron = Sequenz, Pyramide = Hierarchie, Kreislauf = Iteration, 2x2-Matrix = Analyse, etc.). Diese Bedeutung wird im Template-Skill explizit gemacht.

**Schicht 2: Visuelle Kompositionen** -- Wie Formen Slides bilden

Einzelne Formen kombinieren sich zu Slide-Kompositionen mit eigener Bedeutung und narrativer Funktion. Jede Komposition hat: semantische Bedeutung, emotionale Wirkung, Kapazitaet, Einsatzregeln.

**Schicht 3: Narrative Muster** -- Wie Slides Geschichten erzaehlen

Slide-Sequenzen folgen narrativen Mustern (SCQA, Sparkline, Data Story, SCR, Status Report). Die Muster bestimmen die Slide-Reihenfolge und den Erzaehlbogen.

### Architektur-Schichten

```
Schicht 1: Template-Analyse (einmalig pro Template)
           Primaer: Multimodaler Analyzer (Cloud Run + Claude Vision)
           Fallback: In-Plugin Analyzer (deterministisch, ohne Bilder)
           Output: Visual Design Language Document (Template-Skill)

Schicht 2: Universelle Design-Prinzipien (presentation-design Skill)
           Visuelles Vokabular, Gestalt-Prinzipien, Signal-to-Noise-Regeln
           Content Classification, Visualization Decision Tree
           Storytelling Frameworks (SCQA, Sparkline, Pyramid, etc.)

Schicht 3: Template-Skill (generiert, pro Vorlage)
           Brand-DNA, Visuelles Vokabular des Templates
           Kompositionen mit semantischer Bedeutung + Shape-Name-Mapping
           Design-Regeln und Constraints
```

### Multimodale Analyse-Pipeline

```
Template.pptx (beliebig)
         |
    [OOXML-Parser] ← deterministisch (JSZip/DOMParser)
    Shapes: Position, Groesse, Geometrie, Farbe, Text, Gruppen
         |
    [Slide-Renderer] ← deterministisch (LibreOffice headless, Cloud Run)
    PNG-Bilder aller Slides (pixelperfekt, inkl. Custom Fonts/Effekte)
         |
    [Spatial Analyzer] ← deterministisch + Heuristik
    Kompositionsmuster: Sequenzen, Grids, Radial, Hierarchien
         |
    [Theme-Extraktor] ← deterministisch
    Brand-DNA: Farben, Fonts, Linien aus theme1.xml
         |
    [Claude Vision] ← multimodal (Bilder + strukturierte Daten)
    Output: Visual Design Language Document (SKILL.md)
```

### Recherche-Grundlage

| Quelle | Uebernommenes Konzept |
|--------|----------------------|
| **PPTAgent** (EMNLP 2025) | deepcopy(shape._element) -- Shapes als XML klonen |
| **Presenton** (Open Source) | Brand-DNA-Extraktion aus Templates |
| **Nancy Duarte** (Resonate) | Sparkline-Framework, visuelles Denken |
| **Barbara Minto** (Pyramid) | SCQA, Top-Down-Kommunikation |
| **Edward Tufte** | Data-Ink Ratio, Signal-to-Noise |
| **Gestalt-Prinzipien** | Proximity, Similarity, Closure als Layout-Constraints |
| **Andrew Abela** | Chart Chooser Framework |

## MVP Features

### Phase 1: Implementiert (Basis-Infrastruktur)

| Feature ID | Name | Priority | Effort | Status |
|------------|------|----------|--------|--------|
| FEATURE-1100 | Template-Engine (JSZip + OOXML) | P0 | L | **Implementiert** |
| FEATURE-1101 | Default-Templates (HTML-Pipeline) | P0 | M | **Teilweise** |
| FEATURE-1102 | Pre-Creation Dialog & Template-Upload | P0 | S | **Implementiert** |
| FEATURE-1110 | Shape-Name-Matching (S0) | P0 | S | **Implementiert** |

### Phase 2: Template Design Intelligence (neuer Fokus)

| Feature ID | Name | Priority | Effort | Status |
|------------|------|----------|--------|--------|
| FEATURE-1105 | Universelle Design-Prinzipien (Skill-Erweiterung) | P0 | M | **Implementiert** |
| FEATURE-1111 | Visual Design Language Document (Skill-Format) | P0 | M | **Implementiert** |
| FEATURE-1108 | In-Plugin Template-Analyzer (Spatial Analysis) | P1 | M | **Ersetzt durch FEATURE-1115** |
| FEATURE-1115 | Visual Intelligence (Agent-Analyse + LibreOffice Rendering) | P0 | L | **Implementiert** |
| FEATURE-1112 | Multimodaler Template-Analyzer (Cloud Run Backend) | P2 | L | **Ersetzt durch Agent-Analyse** |
| FEATURE-1113 | Template-Analyzer Web-Frontend (obsilo.ai) | P2 | M | **Zurueckgestellt** |
| FEATURE-1114 | Template Gallery (Community) | P2 | S | **Zurueckgestellt** |

**Effort:** S (1-2 Tage), M (3-5 Tage), L (1-2 Wochen)

### Entfallene Features (mit Begruendung)

| Feature ID | Name | Grund |
|------------|------|-------|
| FEATURE-1103 | Theme-Extraktion (vereinfacht) | In FEATURE-1108 integriert |
| FEATURE-1104 | Storyline-Framework-Skills | In FEATURE-1105 integriert |
| FEATURE-1106 | Design-Memory-Integration | Spaeter als eigenstaendiges Feature |
| FEATURE-1107 | Follow-up Questions | Durch office-workflow Skill abgedeckt |
| FEATURE-1109 | Content Classification Framework | In FEATURE-1105 integriert (bereits im presentation-design Skill) |

## Explizit Out-of-Scope

- **Animations/Uebergaenge:** Keine Slide-Transitions oder Element-Animationen
- **Video/Audio-Embedding:** Keine Multimedia-Inhalte in PPTX
- **Bearbeitung bestehender Slides:** Kein "oeffne PPTX und aendere Folie 3"
- **DOCX/XLSX Template-System:** Nur PPTX in dieser Epic
- **Freie Element-Komposition:** Slides werden als Ganzes geklont, nicht aus Einzelelementen zusammengesetzt
- **Custom-Theme-Editor in Settings:** Design ueber Chat/Template
- **Eigenes LLM-Hosting:** BYOK-only, User nutzt eigenen API Key

## Dependencies & Risks

### Dependencies
- **JSZip / DOMParser:** Bereits vorhanden (In-Plugin, fuer OOXML-Analyse)
- **LibreOffice headless:** Lokal installiert, fuer visuelle Qualitaetskontrolle (optional)
- **Anthropic API (BYOK):** Fuer LLM-basierte Template-Analyse und Praesentation

### Risks
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Generierter Skill >16k chars (SkillsManager-Limit) | L | H | Two-Tier-Retrieval: SKILL.md ~5k + compositions.json on-demand |
| SmartArt nicht korrekt analysierbar (dgm-Namespace) | H | M | Als Sonderfall behandeln oder vorab konvertieren |
| LibreOffice nicht installiert | M | L | Rendering optional, Constraints-basierter Fallback |
| Agent vergisst get_composition_details | L | M | Expliziter Hinweis in SKILL.md Rules + requiredTools |
| PDF-Export nicht verfuegbar | M | M | Strukturelle Analyse funktioniert, semantische Anreicherung fehlt |

## Abhaengigkeit von EPIC-010

EPIC-010 bleibt bestehen. EPIC-011 ERWEITERT die Engine um:
- Shape-Name-Matching (S0) in PptxTemplateCloner
- Template-Analyse-Tool (in-plugin + externer Service)
- Visual Design Language Documents als Skill-Format
- Universelle Design-Prinzipien im presentation-design Skill

Bestehende Infrastruktur wird weiterhin genutzt:
- `writeBinaryToVault()` fuer Vault-Speicherung
- Input-Schema (ADR-029) fuer LLM-Schnittstelle
- Tool-Registrierung und Mode-Integration
- PptxTemplateCloner mit Strategien S0-S6
