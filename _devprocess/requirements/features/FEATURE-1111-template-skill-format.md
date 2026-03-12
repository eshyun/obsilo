# Feature: Template-Skill-Format + Generator

> **Feature ID**: FEATURE-1111
> **Epic**: EPIC-011 - Office Document Quality
> **Priority**: P0-Critical
> **Effort Estimate**: M (3-5 Tage)

## Feature Description

Spezifikation und Generator fuer Template-Skills. Das Analyse-Tool (FEATURE-1108) erzeugt einen SKILL.md der vom SkillsManager als User-Skill erkannt und bei Praesentation-Erstellung automatisch geladen wird.

## Technical Design

### Skill-Format

```markdown
---
name: enbw-template
description: EnBW Master Gallery 2025 -- 108 Slides mit Corporate Design
trigger: enbw|EnBW
source: user
requiredTools: [create_pptx, analyze_pptx_template]
---

# EnBW Template

## Brand-DNA
- Primary: #00529C (EnBW Blau)
- Accent: #E30613 (EnBW Rot), #F7A600, #76B82A
- Heading Font: EnBW DIN Pro
- Body Font: EnBW DIN Pro

## Element-Katalog

### Content-Bearing Elements
| ID | Name | Geometrie | Geeignet fuer |
|----|------|-----------|---------------|
| E-001 | Chevron | prstGeom:chevron | Prozessschritte, Sequenzen |
| E-002 | KPI-Karte | prstGeom:roundRect | Einzelne Metrik + Label |
| E-003 | Pyramide | custGeom (Trapez) | Hierarchien, Priorisierungen |

### Decorative Elements
| ID | Name | Geometrie | Zweck |
|----|------|-----------|-------|
| E-010 | Akzentbalken | prstGeom:rect 1280x4 | Visuelle Trennung |
| E-011 | Hintergrund | prstGeom:rect fullsize | Slide-Hintergrund |

## Slide-Kompositionen

### Slide 23: KPI-Dashboard
Klassifikation: kpi
Elemente: 3x E-002 + E-010 + Title-PH
Shape-Name-Mapping:
- "Title 1" -> Folientitel
- "TextBox 5" -> KPI-Wert 1
- "TextBox 6" -> KPI-Label 1
- "TextBox 7" -> KPI-Wert 2
- "TextBox 8" -> KPI-Label 2
- "TextBox 9" -> KPI-Wert 3
- "TextBox 10" -> KPI-Label 3

### Slide 34: Prozessablauf
Klassifikation: process
...
```

### Generator in PptxTemplateAnalyzer

Die `generateTemplateSkill()` Funktion:
1. Nimmt TemplateAnalysis als Input
2. Formatiert als Markdown mit Frontmatter
3. Beachtet 16k-char-Limit des SkillsManagers
4. Priorisiert content-bearing Elemente
5. Komprimiert decorative Elemente (nur Zusammenfassung)

### SkillsManager-Integration

- Generierter Skill wird in Vault gespeichert (z.B. `skills/enbw-template/SKILL.md`)
- SkillsManager erkennt `source: user` Skills automatisch
- Trigger-Regex matched bei Praesentation-Anfragen mit Template-Name

## Definition of Done

- [ ] Skill-Format spezifiziert und dokumentiert
- [ ] Generator formatiert Analyse-Output als SKILL.md
- [ ] Generierter Skill <16k chars (SkillsManager-Limit)
- [ ] SkillsManager laedt generierten Skill korrekt
- [ ] Trigger-Matching funktioniert (User sagt "EnBW" -> Skill wird geladen)

## Dependencies

- **FEATURE-1108**: Template-Analyse liefert die Daten
- **SkillsManager**: Muss User-Skills laden koennen (bereits implementiert)
