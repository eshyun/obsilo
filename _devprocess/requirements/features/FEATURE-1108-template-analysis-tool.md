# Feature: Template-Analyse-Tool

> **Feature ID**: FEATURE-1108
> **Epic**: EPIC-011 - Office Document Quality
> **Priority**: P0-Critical
> **Effort Estimate**: L (1-2 Wochen)
> **Ersetzt**: FEATURE-1103 (Theme-Extraktion)

## Feature Description

Einmal-Analyse-Tool das beliebige PPTX-Templates automatisch versteht. Extrahiert drei Dinge:
1. **Element-Katalog**: Alle einzigartigen Design-Elemente (Shapes, Formen, Diagramme) dedupliziert ueber Vektor-Fingerprint
2. **Brand-DNA**: Farben, Fonts, Spacing aus theme1.xml und slideMaster
3. **Slide-Kompositionen**: Wie Elemente auf den Original-Slides zusammengesetzt sind (inkl. Shape-Namen)

Das Tool generiert einen Template-Skill (SKILL.md) der als User-Skill im Vault gespeichert wird.

## Benefits Hypothesis

**Wir glauben dass** ein automatisches Template-Analyse-Tool
**Folgende messbare Outcomes liefert:**
- Jedes PPTX-Template in <60s analysiert und als Skill nutzbar
- Kein manuelles Reverse-Engineering von Template-Slides mehr noetig
- Agent versteht die verfuegbaren Design-Elemente und kann sie semantisch einsetzen

**Wir wissen dass wir erfolgreich sind wenn:**
- EnBW-Template (108 Slides) korrekt analysiert: ~80 einzigartige Elemente, Brand-Farben erkannt
- Generierter Skill wird vom SkillsManager erkannt und geladen
- Agent kann mit generiertem Skill diverse Folientypen waehlen

## User Stories

### Story 1: Template einrichten
**Als** Berater
**moechte ich** mein Corporate-Template einmal analysieren lassen
**um** ab dann jederzeit Praesentationen im Corporate-Design erstellen zu koennen

### Story 2: Beliebiges Template nutzen
**Als** Wissensarbeiter
**moechte ich** jedes PPTX-Template analysieren koennen
**um** nicht auf vordefinierte Templates beschraenkt zu sein

## Technical Design

### Kernkomponenten

1. **PptxTemplateAnalyzer** (`src/core/office/PptxTemplateAnalyzer.ts`)
   - Oeffnet PPTX via JSZip
   - Extrahiert alle `<p:sp>` Shapes aus allen Slides
   - Vektor-Fingerprint pro Shape: Geometrie-Typ + Fill + Line + Aspect-Ratio
   - Deduplizierung: ~60-120 einzigartige Elemente bei 108-Slide Template
   - Kategorisierung: content-bearing / decorative / structural / connector / media
   - Brand-DNA: clrScheme aus theme1.xml, fontScheme, Spacing aus Master
   - Slide-Kompositionen: welche Elemente + Shape-Namen pro Slide
   - Output: Strukturiertes JSON (TemplateAnalysis Interface)

2. **AnalyzePptxTemplateTool** (`src/core/tools/vault/AnalyzePptxTemplateTool.ts`)
   - Input: `{ template_path: string }`
   - Laedt PPTX aus Vault
   - Ruft PptxTemplateAnalyzer auf
   - Generiert Template-Skill als SKILL.md (siehe FEATURE-1111)
   - Speichert als User-Skill
   - In read-Toolgroup registriert

### Element-Fingerprint

```typescript
interface ElementFingerprint {
  geometryType: string;        // "rect" | "roundRect" | "chevron" | "custGeom:hash"
  fillType: string;            // "solid:accent1" | "gradient:..." | "none"
  lineStyle: string;           // "1pt:solid:accent2" | "none"
  aspectRatio: number;         // width/height
}
```

### Brand-DNA Extraktion

```typescript
interface BrandDNA {
  colors: Record<string, string>;   // dk1, lt1, accent1-6 -> hex
  fonts: { major: string; minor: string };
  spacing: { margins: EMURect; contentArea: EMURect };
  logo?: { position: EMURect; relationship: string };
}
```

## Definition of Done

### Functional
- [ ] PptxTemplateAnalyzer extrahiert alle Shapes aus beliebiger PPTX
- [ ] Vektor-Fingerprint dedupliziert korrekt (~60-120 einzigartige Elemente bei 108 Slides)
- [ ] Kategorisierung unterscheidet content-bearing / decorative / structural
- [ ] Brand-DNA: Farben und Fonts aus theme1.xml korrekt extrahiert
- [ ] Slide-Kompositionen: Shape-Namen korrekt aufgeloest
- [ ] Tool in read-Toolgroup registriert und aufrufbar

### Quality
- [ ] Performance: <60s fuer 108-Slide Template
- [ ] Fehlerbehandlung: Korrupte/leere Templates
- [ ] Review-Bot-konform (kein console.log, kein innerHTML etc.)

## Dependencies

- **JSZip**: Bereits vorhanden
- **DOMParser**: Nativ in Electron
- **FEATURE-1111**: Template-Skill-Format (Output-Format)
- **FEATURE-1110**: Shape-Name-Matching (Konsument der Shape-Namen)
