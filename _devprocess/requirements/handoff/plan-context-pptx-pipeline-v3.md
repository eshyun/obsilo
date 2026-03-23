# plan-context: PPTX Pipeline v3 (Zurueck zu PptxGenJS, weg von pptx-automizer Templates)

**Datum:** 2026-03-23
**Status:** Bereit zur Implementierung
**Branch:** feature/css-svg-slide-engine
**Basis:** dev-Stand der CreatePptxTool.ts (einfacher PptxGenJS Builder, 492 Zeilen)

---

## Kontext

Nach 50+ gescheiterten Iterationen der Template-Manipulation via pptx-automizer (ADR-032 bis ADR-049)
steht fest: **pptx-automizer kann inherited Layout-Shapes nicht modifizieren.** Dies ist eine fundamentale
Limitierung die nicht umgehbar ist -- weder mit modifyElement, removeElement, slide.modify() noch
slide.generate(). Alle Ansaetze scheitern am gleichen Problem.

**Entscheidung:** Zurueck zum funktionierenden dev-Stand (reiner PptxGenJS Builder) mit gezielten
Verbesserungen. Corporate Templates werden als Theme-Konfiguration (Farben, Fonts) genutzt,
nicht als PPTX-Klon.

---

## Was funktioniert (behalten)

1. **plan_presentation Tool** -- Content-Transformation via internem LLM-Call: excellent
   - Quellmaterial wird gelesen, Narrativ-Struktur gewaehlt, Inhalte transformiert
   - Output muss an das einfache SlideInput-Format angepasst werden (title, body, bullets, table)

2. **Memory-System** -- Agent ruft plan_presentation zuverlaessig auf (Patterns bereinigt, Memory-Regel gesetzt)

3. **AdhocSlideBuilder Phase-1 Verbesserungen** -- fit: 'shrink', margin, shadow, compression
   (diese muessen in den dev-CreatePptxTool integriert werden)

4. **Kilo Gateway + GitHub Copilot** -- separate Features, nicht PPTX-bezogen

5. **IngestTemplateTool** -- kann Theme-Farben und Fonts aus PPTX extrahieren
   (muss vereinfacht werden: nur Farben + Fonts, kein Slide-Catalog)

---

## Was nicht funktioniert (entfernen)

1. **pptx-automizer Template-Kloning** -- inherited Shapes nicht modifizierbar
2. **TemplateEngine.ts** -- 1200+ Zeilen, nie zuverlaessig funktioniert
3. **AdhocSlideBuilder.ts** -- durch den verbesserten CreatePptxTool ersetzt
4. **TemplateCatalog.ts** -- Slide-Type-Guide nicht mehr noetig (einfacher Theme-Ansatz)
5. **slideSemantics.ts** -- Gruppierung/Klassifikation nicht mehr noetig
6. **types.ts (office/pptx/)** -- komplexe Template-Types nicht mehr noetig

---

## Implementierungsplan

### Phase 1: CreatePptxTool auf dev-Stand zuruecksetzen

**Datei:** `src/core/tools/vault/CreatePptxTool.ts`
**Aktion:** Dev-Stand (492 Zeilen) wiederherstellen + Phase-1 Verbesserungen anwenden

Verbesserungen gegenueber dev:
- `pres.layout = 'LAYOUT_16x9'` statt `LAYOUT_4x3` (Widescreen)
- `fit: 'shrink'` auf allen Text-Elementen
- `margin` auf Textboxen
- `lineSpacingMultiple: 1.15` auf Body-Text
- `shadow` auf Shapes
- `compression: true` beim Export
- Theme-Parameter erweitern: `background_color`, `text_color`, `accent_color`

**Input-Schema bleibt:** `{ output_path, slides: [{title, subtitle, body, bullets, table, image, notes}], theme }`

### Phase 2: PlanPresentationTool Output anpassen

**Datei:** `src/core/tools/vault/PlanPresentationTool.ts`
**Aktion:** PLANNING_SYSTEM_PROMPT aendern damit der LLM-Output zum einfachen SlideInput passt

Statt:
```json
{"source_slide": 23, "content": {"Titel 1": "...", "Untertitel 2": "..."}}
```

Jetzt:
```json
{"title": "...", "subtitle": "...", "body": "...", "bullets": ["..."], "notes": "..."}
```

Der Plan muss nicht mehr Shape-Namen kennen. Er muss nur wissen:
- title: Ueberschrift (action title)
- subtitle: nur fuer Titelfolien
- body: Fliesstext (fuer Reading Deck)
- bullets: Aufzaehlungspunkte
- table: Tabellendaten
- notes: Speaker Notes

### Phase 3: Theme-Extraktion vereinfachen

**Datei:** `src/core/tools/vault/IngestTemplateTool.ts`
**Aktion:** Vereinfachen auf reine Theme-Extraktion (Farben + Fonts aus theme.xml)

Statt 824 Zeilen Slide-Catalog-Generierung:
- Oeffne PPTX als ZIP
- Lese `ppt/theme/theme1.xml`
- Extrahiere: dk1, lt1, dk2, lt2, accent1-6, majorFont, minorFont
- Speichere als einfache JSON: `{ colors: {...}, fonts: {...} }`

Output fuer den Agent:
```
Theme "enbw" gespeichert:
  Primaer: #000099 (Tiefenblau)
  Akzent: #E4DAD4 (Warmgrau), #84C041 (Gruen), #F5A623 (Orange)
  Fonts: EnBW Sans Headline / EnBW Sans Text Light

Verwende: create_pptx(theme: { primary_color: "#000099", font_family: "EnBW Sans Headline" })
```

### Phase 4: Aufraeumen

**Loeschen:**
- `src/core/office/pptx/TemplateEngine.ts`
- `src/core/office/pptx/AdhocSlideBuilder.ts`
- `src/core/office/pptx/TemplateCatalog.ts`
- `src/core/office/pptx/slideSemantics.ts`
- `src/core/office/pptx/types.ts`
- `src/core/office/pptx/__tests__/`

**Behalten:**
- `src/core/office/pptxRenderer.ts` (LibreOffice Rendering fuer QA)
- `src/core/office/libreOfficeDetector.ts`
- `src/core/tools/vault/RenderPresentationTool.ts`
- `src/core/tools/vault/PlanPresentationTool.ts` (angepasst)
- `src/core/tools/vault/IngestTemplateTool.ts` (vereinfacht)

**pptx-automizer aus package.json entfernen** (spart ~500KB Bundle)

### Phase 5: Skills aktualisieren

**office-workflow/SKILL.md:**
- Step 3: plan_presentation bleibt Kern
- Step 4: create_pptx mit einfachem Input (title, body, bullets)
- Template-Modus entfaellt -- stattdessen Theme-Parameter

**presentation-design/SKILL.md:**
- Template Mode Rules entfernen
- Fokus auf Adhoc-Design mit Theme-Farben

### Phase 6: Build + Deploy + Test

Test mit Genema Use Case. Erwartung:
- Alle Folien haben sichtbaren Content
- Texte passen in ihre Boxen (fit: 'shrink')
- Professionelles Spacing und Shadows
- Keine PPTX-Reparatur noetig
- Corporate-Farben ueber Theme-Parameter

---

## Nicht-PPTX Features die behalten werden

| Feature | Dateien | Status |
|---------|---------|--------|
| Kilo Gateway | KiloMetadataService.ts, ModelConfigModal.ts, constants.ts | Behalten |
| GitHub Copilot | ModelConfigModal.ts, testModelConnection.ts | Behalten |
| Memory Fix | memory.ts (Prompt-Verbesserung) | Behalten |
| Tool Registry | ToolRegistry.ts, toolMetadata.ts, types.ts | Behalten |
| Quality Gates | qualityGates.ts | Behalten |
| ManageSkill | ManageSkillTool.ts | Behalten |
| Visual Intelligence Tab | VisualIntelligenceTab.ts | Behalten |
| Render Presentation | RenderPresentationTool.ts, pptxRenderer.ts | Behalten |

---

## Risiken

- **Corporate Design Treue:** Ohne Template-Kloning sind wir auf PptxGenJS-Styling beschraenkt.
  Farben und Fonts kommen aus dem Theme, aber Hintergruende, Logos und dekorative Formen nicht.
  Mitigation: Fuer echtes Corporate Design bleibt die manuelle Nachbearbeitung noetig.

- **Qualitaetsanspruch:** PptxGenJS erzeugt "gute" aber nicht "perfekte" Slides.
  Mitigation: fit: 'shrink' + margin + shadow + Master-Slides erhoehen die Qualitaet deutlich.

- **Rueckschritt:** Template-Kloning war der gesamte Zweck von ADR-032 bis ADR-049.
  Mitigation: Ein funktionierender einfacher Builder ist besser als ein nicht-funktionierender komplexer.
