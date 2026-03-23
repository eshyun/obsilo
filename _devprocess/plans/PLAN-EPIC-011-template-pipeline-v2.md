# Plan: Template-Pipeline v2 -- Qualitaetsoffensive nach EnBW-Test

> EPIC-011: Intelligente Template-basierte Praesentation
> Stand: 2026-03-12
> Status: Bereit zur Implementierung (Phase 1-4)

---

## Kontext

### Ausgangslage

Die Template-Pipeline (EPIC-011) hat drei Schichten, die bereits implementiert sind:
1. **PptxTemplateAnalyzer** (`src/core/office/PptxTemplateAnalyzer.ts`, ~1005 LOC) -- Einmal-Analyse
2. **PptxTemplateCloner** (`src/core/office/PptxTemplateCloner.ts`, ~1225 LOC) -- 7-Strategie-Matching (S0-S6)
3. **Skills** (`presentation-design`, `office-workflow`) -- Content Classification + ANALYZE-Workflow

### Problem (Root Causes aus 17-Slide EnBW-Test)

Der erste End-to-End-Test mit der EnBW-Vorlage (108 Slides) hat 6 Root Causes aufgedeckt:

| RC | Problem | Ursache | Impact |
|----|---------|---------|--------|
| RC-1 | S0 (Shape-Name-Matching) nie aktiviert | Alter text-basierter `enbw-presentation` Skill geladen statt neuen generierten Skill. `analyze_pptx_template` wurde nie aufgerufen. | Alle Slides |
| RC-2 | Alle Chevrons/Milestones identisch befuellt | S1 nutzt `g`-Flag (global), ersetzt ALLE `<a:t>`-Matches uniform | Slides 6, 10, 15 |
| RC-3 | Nur erstes Textfeld gefuellt, Rest Lorem ipsum | S2 `replaced=true` stoppt nach erstem Paragraph-Match | Slides 4, 7, 8, 13, 14 |
| RC-4 | Heading/Body-Formatierung vertauscht | `replaceShapeAtPhPos` nutzt erstes `<a:rPr>` fuer ALLE Paragraphen | Alle Content-Slides |
| RC-5 | Content-Overflow (Text zu lang fuer Textbox) | Agent kennt Textbox-Groessen nicht | Slides 4, 7, 13 |
| RC-6 | Ungematchte Shapes behalten Lorem ipsum | Kein Cleanup-Mechanismus | Slides 8, 14 |

### Kern-Erkenntnis

**V-1 (Semantische IDs + Shape-Names) + V-2 (Formatting-Fix) loesen ~90% der Fehler.**
Das S0-System funktioniert technisch bereits -- es wurde nur nie aktiviert, weil der alte Skill geladen wurde.

---

## Vorbereitung: Vault-Cleanup (ERLEDIGT 2026-03-12)

### Geloeschte Artefakte

| Artefakt | Pfad | Grund |
|----------|------|-------|
| enbw-presentation Skill | `skills/enbw-presentation/` (SKILL.md + design-tokens.json) | Veraltet: text-basierte Keys, konkurriert mit neuem Shape-Name-Ansatz |
| storyline-data-story | `skills/storyline-data-story/` | Nicht im Build, redundant mit office-workflow Storytelling-Frameworks |
| storyline-narrative-arc | `skills/storyline-narrative-arc/` | Nicht im Build, redundant |
| storyline-problem-solution | `skills/storyline-problem-solution/` | Nicht im Build, redundant |
| storyline-pyramid | `skills/storyline-pyramid/` | Nicht im Build, redundant |
| storyline-scqa | `skills/storyline-scqa/` | Nicht im Build, redundant |
| storyline-status-update | `skills/storyline-status-update/` | Nicht im Build, redundant |
| Legacy EnBW Theme | `themes/enbw.json` | Altes Theme-Format, nicht mehr verwendet |

### Verbleibende Skills im Vault

| Skill | Source | Zweck |
|-------|--------|-------|
| office-workflow | bundled | Workflow fuer Office-Dokumente (PPTX/DOCX/XLSX) |
| presentation-design | bundled | HTML-Slide-Design + Content Classification Framework |
| sandbox-environment | bundled | Sandbox-API-Referenz |
| settings-assistant | user | Hilft bei Obsilo-Einstellungen |
| personen-profil-aktualisieren | learned | Web-Recherche fuer Personen-Profile |

---

## Architektur: Semantische Element-IDs (Ansatz 2)

### Zwei-Ebenen-ID-System

Jede Shape bekommt zwei Identitaeten:

```
Ebene 1 (stabil):     shapeName = "TextBox 5"          // aus OOXML <p:cNvPr name="...">, unveraenderlich
Ebene 2 (semantisch): semanticId = "kpi_value_1"       // vom Analyzer generiert, menschenlesbar
```

Der Agent sieht BEIDE im Template-Skill. Er VERSTEHT die Shape ueber die semantische ID, ADRESSIERT sie aber ueber den Shape-Namen als Key im `content`-Objekt.

### Semantische ID-Generierung

**Schema**: `{slideClassification}_{role}_{index}`

**Role-Ableitung** (Prioritaetsreihenfolge):
1. `placeholderType` (title, body, subTitle) -> `_title`, `_body_N`, `_subtitle`
2. Element-Geometrie aus Katalog (chevron -> `_step_N`, roundRect -> `_card_N`)
3. Position (oben+gross -> title-like, unten+klein -> label-like)
4. Fallback: `_text_N`

**Beispiele**:
```
Slide 23 (classification: kpi):
  "Title 1"    -> kpi_title        (placeholderType=title)
  "TextBox 5"  -> kpi_value_1      (klein, gross-formatiert -> value)
  "TextBox 6"  -> kpi_label_1      (klein, klein-formatiert -> label)

Slide 34 (classification: process):
  "Title 1"    -> process_title
  "Chevron 1"  -> process_step_1   (Geometrie=chevron)
  "TextBox 3"  -> process_desc_1   (unter Chevron positioniert)
```

### Kein Code im Cloner noetig

Der Agent schickt Shape-Namen als Keys (nicht semantische IDs). Die semantischen IDs dienen nur dem Verstaendnis:
```
Agent liest Skill:  "kpi_value_1 | TextBox 5 | 36pt | ~15 Zeichen"
Agent versteht:     "TextBox 5 ist der erste KPI-Wert, max 15 Zeichen"
Agent schickt:      { "TextBox 5": "EUR 15.2M" }
Cloner:             S0 matcht <p:cNvPr name="TextBox 5"> -> 100%
```

---

## 7 Verbesserungen (V-1 bis V-7)

### V-1: Semantische Element-IDs im Template-Skill (P0) -- loest RC-1, RC-2, RC-3

**Datei**: `src/core/office/PptxTemplateAnalyzer.ts`

#### Aenderung 1: ShapeInfo Interface erweitern (Zeile 92)

**VORHER**:
```typescript
export interface ShapeInfo {
    shapeName: string;
    shapeId: string;
    elementId?: string;
    placeholderType?: string;
    placeholderIdx?: number;
    text: string;
    isReplaceable: boolean;
    position: { left: number; top: number; width: number; height: number };
}
```

**NACHHER**:
```typescript
export interface ShapeInfo {
    shapeName: string;
    semanticId: string;        // NEU: menschenlesbare ID
    shapeId: string;
    elementId?: string;
    placeholderType?: string;
    placeholderIdx?: number;
    text: string;
    isReplaceable: boolean;
    position: { left: number; top: number; width: number; height: number };
    textCapacity?: TextCapacity;  // NEU (V-4)
}

interface TextCapacity {       // NEU (V-4)
    maxChars: number;
    maxLines: number;
    fontSize: number;          // in pt
}
```

#### Aenderung 2: Neue Funktion `generateSemanticId()`

```typescript
function generateSemanticId(
    classification: SlideClassification,
    shape: ShapeInfo,
    elementCatalog: DesignElement[],
    contentIndex: number,
): string {
    const prefix = classification;

    // 1. Placeholder-Typ
    if (shape.placeholderType === 'title' || shape.placeholderType === 'ctrTitle')
        return `${prefix}_title`;
    if (shape.placeholderType === 'subTitle')
        return `${prefix}_subtitle`;
    if (shape.placeholderType === 'body')
        return `${prefix}_body_${contentIndex}`;

    // 2. Element-Geometrie
    const element = elementCatalog.find(e => e.id === shape.elementId);
    if (element) {
        const geom = element.geometry;
        if (geom.includes('chevron') || geom.includes('homePlate'))
            return `${prefix}_step_${contentIndex}`;
        if (geom.includes('roundRect'))
            return `${prefix}_card_${contentIndex}`;
        if (geom.includes('triangle') || geom.includes('custGeom'))
            return `${prefix}_segment_${contentIndex}`;
    }

    // 3. Fallback
    return `${prefix}_text_${contentIndex}`;
}
```

#### Aenderung 3: `buildSlideComposition()` anpassen (Zeile 663)

Nach Erstellung der ShapeInfo-Objekte: `generateSemanticId()` fuer jede replaceable Shape aufrufen. Index nur fuer replaceable Shapes hochzaehlen.

#### Aenderung 4: `generateTemplateSkill()` anpassen (Zeile 813-943)

Frontmatter:
```yaml
---
name: enbw-template
description: EnBW Corporate Template (108 Slides, Shape-Name-basiert, v2)
trigger: enbw|EnBW
source: user
requiredTools: [create_pptx]
generated_by: analyze_pptx_template
version: 2
---
```

Slide-Details Tabelle erweitern:

**VORHER**:
```markdown
| Shape-Name | Aktueller Text | Zweck |
```

**NACHHER**:
```markdown
| Semantic-ID | Shape-Name | Aktueller Text | Max Zeichen | Zweck |
```

ALLE Slides mit Shape-Mapping auflisten (nicht nur eine pro Klassifikation).

---

### V-2: Paragraph-Level Formatting Preservation (P0) -- loest RC-4

**Datei**: `src/core/office/PptxTemplateCloner.ts`

#### Aenderung 1: Neues Interface + Hilfsfunktion

```typescript
interface ParagraphFormat {
    pPr: string;   // <a:pPr ...> oder ''
    rPr: string;   // <a:rPr ...>
}

function extractAllParagraphFormats(txBody: string): ParagraphFormat[] {
    const formats: ParagraphFormat[] = [];
    const pPattern = /<a:p\b[^>]*>[\s\S]*?<\/a:p>/g;
    let match: RegExpExecArray | null;

    while ((match = pPattern.exec(txBody)) !== null) {
        const para = match[0];
        if (!/<a:r\b/.test(para)) continue; // Skip empty paragraphs

        const pPrSelf = para.match(/<a:pPr\b[^>]*\/>/);
        const pPrOpen = para.match(/<a:pPr\b[^>]*>[\s\S]*?<\/a:pPr>/);
        const pPr = pPrSelf?.[0] ?? pPrOpen?.[0] ?? '';

        const rPr = extractFirstRPr(para);
        formats.push({ pPr, rPr });
    }

    return formats.length > 0
        ? formats
        : [{ pPr: '', rPr: '<a:rPr lang="de-DE" dirty="0"/>' }];
}
```

#### Aenderung 2: `replaceShapeAtPhPos()` umbauen (Zeile 880-925)

**VORHER**:
```typescript
const rPr = extractFirstRPr(txBody);
const lines = value.split('\n');
const paragraphs = lines.map(line => {
    if (!line.trim()) return '<a:p><a:endParaRPr/></a:p>';
    return `<a:p><a:r>${rPr}<a:t>${escapeXml(line)}</a:t></a:r></a:p>`;
}).join('');
```

**NACHHER**:
```typescript
const formats = extractAllParagraphFormats(txBody);
const lines = value.split('\n');
const paragraphs = lines.map((line, i) => {
    if (!line.trim()) return '<a:p><a:endParaRPr/></a:p>';
    const fmt = formats[Math.min(i, formats.length - 1)];
    return `<a:p>${fmt.pPr}<a:r>${fmt.rPr}<a:t>${escapeXml(line)}</a:t></a:r></a:p>`;
}).join('');
```

---

### V-3: (Entfaellt -- durch V-1 + V-2 abgedeckt)

Mit semantischen IDs hat jede Shape ihren eigenen Key. S0 matched per Shape-Name, V-2 liefert korrekte Formatierung.

---

### V-4: Textbox-Groessen im Template-Skill (P1) -- loest RC-5

In V-1 integriert. Neue Funktion in `PptxTemplateAnalyzer.ts`:

```typescript
function estimateTextCapacity(rawShape: RawShape): TextCapacity | undefined {
    if (!rawShape.hasText) return undefined;

    const szMatch = rawShape.xml?.match(/<a:rPr[^>]*\bsz="(\d+)"/);
    const fontSizePt = szMatch ? parseInt(szMatch[1]) / 100 : 18;
    const fontSizePx = fontSizePt * 1.333;

    const widthPx = rawShape.position.width / 914400 * 96;
    const heightPx = rawShape.position.height / 914400 * 96;

    const charsPerLine = Math.floor(widthPx / (fontSizePx * 0.55));
    const maxLines = Math.floor(heightPx / (fontSizePx * 1.4));

    return { maxChars: charsPerLine * maxLines, maxLines, fontSize: fontSizePt };
}
```

---

### V-5: Lorem-ipsum-Cleanup (P2) -- loest RC-6

**Datei**: `src/core/office/PptxTemplateCloner.ts`

Neue Funktion nach Phase 1+2 in `replaceSlideContent()`:

```typescript
function cleanupPlaceholderText(xml: string): string {
    const placeholders = [
        /(<a:t[^>]*>)Lorem ipsum[\s\S]*?(<\/a:t>)/g,
        /(<a:t[^>]*>)Platzhalter[\s\S]*?(<\/a:t>)/g,
        /(<a:t[^>]*>)Beispieltext[\s\S]*?(<\/a:t>)/g,
        /(<a:t[^>]*>)Click to edit[\s\S]*?(<\/a:t>)/g,
    ];
    let result = xml;
    for (const pattern of placeholders) {
        result = result.replace(pattern, '$1$2');
    }
    return result;
}
```

---

### V-6: Workflow-Skill schaerfen + Skill-Versionierung (P1)

**Datei**: `bundled-skills/office-workflow/SKILL.md`

Step 3 praezisieren:

```markdown
1. **Check for existing Template Skill**: A matching template skill may already
   be loaded (visible in `<available_skills>`).
   - **Has `version: 2`** in its description or content?
     -> Use it directly (Shape-Name-basiert, aktuell).
   - **No version field** or text-based keys ("Lorem ipsum...", "Topic 1")?
     -> VERALTET. Run `analyze_pptx_template` to generate a new skill.
   - **No template skill loaded at all?**
     -> Ask user for template file path, then run `analyze_pptx_template`.
```

---

### V-7: S1 First-Match fuer kurze Keys (P2) -- Absicherung fuer RC-2

**Datei**: `src/core/office/PptxTemplateCloner.ts`

**VORHER** (Zeile 565):
```typescript
const exactPattern = new RegExp(
    `(<a:t[^>]*>)${escapeRegex(escapedKey)}(</a:t>)`,
    'g',
);
```

**NACHHER**:
```typescript
const isShortKey = escapedKey.length < 50;
const exactPattern = new RegExp(
    `(<a:t[^>]*>)${escapeRegex(escapedKey)}(</a:t>)`,
    isShortKey ? '' : 'g',
);
```

---

## Skill-Erkennung: Alt vs. Neu

### Flow bei Praesentation-Erstellung

```
User: "Erstelle Praesentation mit EnBW-Vorlage"

SkillsManager matcht per Trigger-Regex:
  -> office-workflow (bundled, "praesentation erstellen")
  -> presentation-design (bundled, "praesentation erstellen")
  -> enbw-template (user, "enbw") -- FALLS generiert UND Toggle aktiv

Agent prueft (gemaess office-workflow Step 3):

  Fall A: Template-Skill geladen MIT version: 2
    -> Direkt nutzen. Shape-Name-basierte Keys.
    -> Kein analyze_pptx_template noetig.

  Fall B: Kein Template-Skill geladen (Normalfall nach Cleanup)
    -> User nach Template-Datei fragen.
    -> analyze_pptx_template mit generate_skill: true
    -> Neuer Skill wird in skills/{name}-template/ gespeichert.
    -> Ab sofort in Settings sichtbar mit Toggle.
```

### Settings-Integration

Generierte Template-Skills (`source: user`) erscheinen automatisch in **Settings > Skills > Manual Skills** mit Toggle. Bestehende UI-Infrastruktur (`manualSkillToggles` in `SkillsTab.ts`) reicht aus -- kein neuer UI-Code noetig.

**Erkennungsmerkmal in der Settings-Liste:**
- Generierter v2-Skill: Description "... Shape-Name-basiert, v2"

---

## Dateien-Zusammenfassung

### Modifizierte Dateien

| Datei | Aenderung | Risiko |
|-------|-----------|--------|
| `src/core/office/PptxTemplateAnalyzer.ts` | ShapeInfo +semanticId +textCapacity, generateSemanticId(), estimateTextCapacity(), Skill-Output erweitern, version:2 Frontmatter, ALLE Slides im Skill | Mittel |
| `src/core/office/PptxTemplateCloner.ts` | replaceShapeAtPhPos: Paragraph-Level rPr (V-2), cleanupPlaceholderText (V-5), S1 first-match (V-7) | Mittel |
| `bundled-skills/office-workflow/SKILL.md` | Step 3: Versionserkennung, Anleitung fuer fehlenden Skill (V-6) | Niedrig |

### Nicht betroffen

| Datei | Grund |
|-------|-------|
| `CreatePptxTool.ts` | 3-Pipeline-Routing unveraendert |
| `AnalyzePptxTemplateTool.ts` | Ruft nur Analyzer auf, braucht keine Aenderung |
| `HtmlSlideParser.ts` | Default-Theme-Pipeline |
| `PptxFreshGenerator.ts` | Legacy-Pipeline |
| `SkillsManager.ts` | Toggle-Infrastruktur funktioniert bereits |
| `SkillsTab.ts` | UI fuer Skill-Toggles funktioniert bereits |
| `presentation-design/SKILL.md` | Content Classification bereits implementiert |

---

## Implementierungsreihenfolge

### Phase 1: Paragraph-Level Formatting (V-2)

**Ziel**: Heading bleibt Heading, Body bleibt Body.
**Effort**: S
**Datei**: `src/core/office/PptxTemplateCloner.ts`

1. Neues Interface `ParagraphFormat` + Funktion `extractAllParagraphFormats()`
2. `replaceShapeAtPhPos()` umbauen: Format-Array statt Single-rPr
3. Build + Deploy
4. Verifikation: Formatierung bei mehrzeiligem Content erhalten?

### Phase 2: Semantische IDs + Skill-Versionierung (V-1 + V-4)

**Ziel**: Template-Skill mit semantischen IDs, Shape-Names, Text-Kapazitaet.
**Effort**: M
**Datei**: `src/core/office/PptxTemplateAnalyzer.ts`

1. `ShapeInfo` Interface erweitern: +semanticId, +textCapacity
2. `generateSemanticId()` implementieren
3. `estimateTextCapacity()` implementieren
4. `buildSlideComposition()` anpassen: semanticId + textCapacity setzen
5. `generateTemplateSkill()` anpassen:
   - Frontmatter: +version:2, +generated_by
   - Tabelle: +Semantic-ID, +Max Zeichen
   - ALLE Slides mit Shape-Mapping (nicht nur eine pro Klassifikation)
6. Build + Deploy
7. `analyze_pptx_template` auf EnBW-Template ausfuehren, generierten Skill pruefen

### Phase 3: Absicherungen (V-5, V-6, V-7)

**Ziel**: Cleanup, Versionserkennung, S1-Fix.
**Effort**: S
**Dateien**: `src/core/office/PptxTemplateCloner.ts`, `bundled-skills/office-workflow/SKILL.md`

1. `office-workflow/SKILL.md` Step 3 schaerfen (V-6)
2. `cleanupPlaceholderText()` implementieren + in replaceSlideContent einhaengen (V-5)
3. S1 first-match fuer kurze Keys (V-7)
4. Build + Deploy

### Phase 4: End-to-End-Test

**Ziel**: Volle Pipeline mit neuem EnBW-Skill verifizieren.

1. Neuen EnBW-Skill in Settings pruefen (sollte mit Toggle sichtbar sein)
2. 15-Slide Praesentation erstellen lassen
3. Slide-fuer-Slide Auswertung gegen Akzeptanzkriterien

---

## Akzeptanzkriterien

1. **Kein Lorem ipsum**: Alle adressierten Shapes befuellt. Nicht-adressierte leer (nicht Lorem ipsum).
2. **Formatierung korrekt**: Heading bleibt Heading, Body bleibt Body. Kein Formatierungs-Swap.
3. **Diverse Folientypen**: Mind. 5 verschiedene Klassifikationen pro 15-Folien-Deck.
4. **Shape-Name-Matching 100%**: S0 matcht alle Keys wenn Shape-Names verwendet werden.
5. **Content passt in Textbox**: Kein sichtbarer Overflow bei Beachtung der Max-Zeichen.
6. **Skill-Erkennung**: Agent erkennt version:2 und nutzt Shape-Names als Keys.
7. **Settings-Toggle**: Template-Skills in Settings aktivierbar/deaktivierbar.

---

## Build + Deploy nach jedem Schritt

```bash
npm run build && npm run deploy
```
Dann in Obsidian: Cmd+R -> Test
