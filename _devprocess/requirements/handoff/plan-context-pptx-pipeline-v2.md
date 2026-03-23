# plan-context: PPTX Pipeline v2 (plan_presentation + Catalog-Enrichment)

**Datum:** 2026-03-23
**ADRs:** ADR-048 (plan_presentation), ADR-047 (Validierung, bleibt), ADR-046 (Engine, bleibt)
**Features:** FEATURE-1117 (plan_presentation Tool), FEATURE-1118 (Catalog-Enrichment)
**Branch:** feature/css-svg-slide-engine

---

## Kontext-Zusammenfassung

Nach 8 Architektur-Iterationen (ADR-030 bis ADR-047) und einem gescheiterten End-to-End-Test
(2026-03-23) steht fest: Die PPTX-Engine (pptx-automizer) funktioniert, die technischen
Constraints (Validierung) greifen, aber der Agent transformiert Quellmaterial nicht in
Folien-Content. Die Loesung: Ein neues `plan_presentation` Tool das die Content-Transformation
als internen LLM-Call ausfuehrt.

---

## Implementierung: 7 Phasen

### Phase 1: Types (types.ts)

**Datei:** `src/core/office/pptx/types.ts`
**Position:** Nach dem bestehenden `PptxBuildResult` Interface (~Zeile 510)

**Neue Types:**

```typescript
/* ------------------------------------------------------------------ */
/*  Deck Plan (plan_presentation output, ADR-048)                      */
/* ------------------------------------------------------------------ */

/** Complete deck plan produced by plan_presentation tool. */
export interface DeckPlan {
    /** Presentation title. */
    title: string;
    /** Storytelling framework used (SCR, SCQA, Pyramid, DataStory, StatusReport). */
    narrative_framework: string;
    /** Speaker or Reading deck. */
    deck_mode: 'speaker' | 'reading';
    /** Vault path of the source note (if provided). */
    source_path?: string;
    /** Planned slides in presentation order. */
    slides: PlannedSlide[];
}

/** A single planned slide with full content for all shapes. */
export interface PlannedSlide {
    /** 1-based position in the output presentation. */
    position: number;
    /** Template slide number to clone. */
    source_slide: number;
    /** Slide type ID from the catalog (e.g. "kpi-folie"). */
    slide_type_id: string;
    /** Narrative purpose (e.g. "Hook: Bold opening claim"). */
    purpose: string;
    /** The ONE key message of this slide. */
    key_message: string;
    /** Content for shapes. Keys = exact shape names from catalog. */
    content: Record<string, string | ContentValue>;
    /** Shapes to remove (content-adaptive layout). */
    remove?: string[];
    /** Speaker notes. */
    notes?: string;
}
```

**Erweiterungen an bestehenden Types:**

```typescript
// In ShapeEntry (nach removable):
/** Spezifische Funktion (z.B. Kapitelnummer auf Trennfolien). */
special_role?: 'section_number';

// In SlideTypeShape (nach group_hint):
/** Maschinenlesbare Gruppen-ID fuer zusammengehoerige Shapes. */
group_id?: string;
```

**Verifikation:** `npm run build`

---

### Phase 2: Catalog-Enrichment (IngestTemplateTool + TemplateCatalog)

**2a: special_role Erkennung**

**Datei:** `src/core/tools/vault/IngestTemplateTool.ts`
**Position:** In `classifyShape()` (~Zeile 471), nach der `removable` Berechnung

```typescript
// Nach Zeile 508 (nach entry.duplicate_index):
// Detect section number shapes on divider layouts
if (role === 'body' && sampleText && /^\d$/.test(sampleText.trim())) {
    entry.special_role = 'section_number';
}
```

**2b: group_id Generierung**

**Datei:** `src/core/tools/vault/IngestTemplateTool.ts`
**Position:** In `tagShapeGroups()` (~Zeile 410), nach dem bestehenden group_hint Code

```typescript
// Nach dem bestehenden group_hint Assignment (~Zeile 435):
// Assign machine-readable group_id to shapes with group_hint
if (hasHorizontalSpread) {
    const groupId = `${role}_group_${groupCounter++}`;
    for (let idx = 0; idx < group.length; idx++) {
        group[idx].group_id = groupId;
    }
}
```

Zusaetzlich: Beschreibungstexte der gleichen Position wie ein Chevron bekommen die
gleiche group_id. Dafuer muessen Position-Matches gemacht werden (aehnliche X-Koordinate).

**2c: JSON-Beispiele mit allen Shapes**

**Datei:** `src/core/office/pptx/TemplateCatalog.ts`
**Position:** In `generateSlideExample()` (~Zeile 298)

Aendern: `if (!sh.required) continue;` entfernen. Stattdessen ALLE nicht-dekorativen Shapes einbeziehen:

```typescript
private static generateSlideExample(st: SlideType): string {
    const content: Record<string, string> = {};
    for (const sh of st.shapes) {
        // Include ALL non-decorative shapes (not just required)
        const key = sh.duplicate_index != null && sh.duplicate_index > 0
            ? `${sh.name}#${sh.duplicate_index}` : sh.name;
        content[key] = this.exampleValueForRole(sh);
    }
    // ...
}
```

`exampleValueForRole()` ergaenzen um `special_role`:

```typescript
private static exampleValueForRole(sh: SlideTypeShape): string {
    // Special roles first
    if (sh.special_role === 'section_number') return '1';

    switch (sh.role) {
        // ... bestehende Cases ...
    }
}
```

**2d: Guide zeigt special_role und group_id**

**Datei:** `src/core/office/pptx/TemplateCatalog.ts`
**Position:** In `formatSlideTypeGuide()` (~Zeile 283)

```typescript
// Bestehende Zeile erweitern:
const specialTag = sh.special_role ? ` [${sh.special_role}]` : '';
const groupTag = sh.group_id ? ` {group:${sh.group_id}}` : '';
lines.push(`  - \`${key}\` [${req}] ${sh.role}${specialTag}${groupTag}${chars}${pos}${annotation}`);
```

**Verifikation:** `npm run build` + `npm run deploy` + Re-Ingest EnBW-Template

---

### Phase 3: PlanPresentationTool (KERN, neues Tool)

**Datei:** `src/core/tools/vault/PlanPresentationTool.ts` (NEU)

**Struktur:**

```typescript
/**
 * PlanPresentationTool — plans a presentation from source material and template catalog.
 *
 * Uses an internal constrained LLM call to:
 * 1. Analyze source material and extract key messages
 * 2. Select appropriate slide types from the template catalog
 * 3. Generate content for EVERY non-decorative shape
 * 4. Validate the plan against the catalog (required shapes, shape names, placeholders)
 *
 * Returns a DeckPlan that can be directly fed into create_pptx.
 * This tool does NOT create a PPTX file -- it only plans.
 *
 * ADR-048: Content transformation must happen at tool level, not as prompt suggestion.
 */

import { BaseTool } from '../BaseTool';
import type { ToolDefinition, ToolExecutionContext } from '../types';
import type ObsidianAgentPlugin from '../../../main';
import { TemplateCatalogLoader } from '../../office/pptx/TemplateCatalog';
import type { DeckPlan, PlannedSlide, TemplateCatalog, SlideType } from '../../office/pptx/types';

export class PlanPresentationTool extends BaseTool<'plan_presentation'> {
    readonly name = 'plan_presentation' as const;
    readonly isWriteOperation = false;  // Read-only: plans, does not write files

    private catalogLoader: TemplateCatalogLoader;

    constructor(plugin: ObsidianAgentPlugin) {
        super(plugin);
        this.catalogLoader = new TemplateCatalogLoader(plugin);
    }

    getDefinition(): ToolDefinition {
        return {
            name: 'plan_presentation',
            description:
                'Plan a presentation from source material using a corporate template. ' +
                'Reads the source note, loads the template catalog, and generates a complete ' +
                'deck plan with content for every shape on every slide. ' +
                'Returns the plan as a table + JSON block ready for create_pptx. ' +
                'ALWAYS call this before create_pptx when using corporate templates.',
            input_schema: {
                type: 'object',
                properties: {
                    source: {
                        type: 'string',
                        description: 'Vault path to the source note, or direct text content.',
                    },
                    template: {
                        type: 'string',
                        description: 'Theme name (e.g. "enbw"). Must be an ingested corporate template.',
                    },
                    deck_mode: {
                        type: 'string',
                        enum: ['speaker', 'reading'],
                        description: 'Speaker deck (max 25 words/slide, notes carry detail) or Reading deck (max 170 words/slide, self-explanatory).',
                    },
                    goal: {
                        type: 'string',
                        description: 'What should the audience learn, decide, or do after seeing this presentation?',
                    },
                    audience: {
                        type: 'string',
                        description: 'Who is the target audience? What do they already know?',
                    },
                    slide_count: {
                        type: 'number',
                        description: 'Target number of slides (optional, auto-determined if omitted).',
                    },
                },
                required: ['source', 'template', 'deck_mode'],
            },
        };
    }

    async execute(input: Record<string, unknown>, context: ToolExecutionContext): Promise<void> {
        const { callbacks } = context;

        // 1. Parse and validate input
        const source = ((input.source as string) ?? '').trim();
        const template = ((input.template as string) ?? '').trim();
        const deckMode = (input.deck_mode as string) ?? 'reading';
        const goal = (input.goal as string) ?? '';
        const audience = (input.audience as string) ?? '';
        const slideCount = input.slide_count as number | undefined;

        if (!source) { callbacks.pushToolResult(this.formatError(new Error('source is required'))); return; }
        if (!template) { callbacks.pushToolResult(this.formatError(new Error('template is required'))); return; }

        try {
            // 2. Read source material
            callbacks.log('Reading source material...');
            const sourceContent = await this.readSource(source);
            if (!sourceContent.trim()) {
                callbacks.pushToolResult(this.formatError(new Error(`Source is empty: ${source}`)));
                return;
            }

            // 3. Load template catalog
            callbacks.log(`Loading template "${template}"...`);
            const resolved = await this.catalogLoader.loadTemplate(template);
            const guide = TemplateCatalogLoader.formatSlideTypeGuide(resolved.catalog);

            // 4. Internal LLM call (constrained planning)
            callbacks.log('Planning presentation (LLM call)...');
            const plan = await this.callPlanningLLM(sourceContent, guide, {
                deckMode, goal, audience, slideCount,
            });

            // 5. Validate plan against catalog
            const warnings = this.validatePlan(plan, resolved.catalog);

            // 6. Format output
            const output = this.formatPlanOutput(plan, warnings, template);
            callbacks.pushToolResult(output);
            callbacks.log(`Plan complete: ${plan.slides.length} slides, ${warnings.length} warnings`);

        } catch (error) {
            callbacks.pushToolResult(this.formatError(error));
            await callbacks.handleError('plan_presentation', error);
        }
    }

    // --- Private methods ---

    private async readSource(source: string): Promise<string> {
        // Try as vault path first
        const file = this.app.vault.getAbstractFileByPath(source);
        if (file) {
            return await this.app.vault.read(file as import('obsidian').TFile);
        }
        // If not a path, treat as direct text
        if (source.length > 50 && !source.includes('/')) {
            return source;
        }
        throw new Error(`Source not found in vault: ${source}`);
    }

    private async callPlanningLLM(
        sourceContent: string,
        guide: string,
        options: { deckMode: string; goal: string; audience: string; slideCount?: number },
    ): Promise<DeckPlan> {
        const { buildApiHandlerForModel } = await import('../../../api');
        const model = this.plugin.getActiveModel();
        if (!model) throw new Error('Kein aktives Modell konfiguriert');

        const api = buildApiHandlerForModel(model);

        const userPrompt =
            `SOURCE MATERIAL:\n${sourceContent}\n\n` +
            `TEMPLATE GUIDE:\n${guide}\n\n` +
            `DECK MODE: ${options.deckMode}\n` +
            `GOAL: ${options.goal || 'Informieren und Entscheidung vorbereiten'}\n` +
            `AUDIENCE: ${options.audience || 'Fachpublikum'}\n` +
            (options.slideCount ? `TARGET SLIDES: ~${options.slideCount}\n` : '') +
            `\nReturn a complete DeckPlan as JSON. Every slide must have source_slide, ` +
            `slide_type_id, purpose, key_message, content (ALL non-decorative shapes filled), ` +
            `remove (if needed), and notes.`;

        const stream = api.createMessage(
            PLANNING_SYSTEM_PROMPT,
            [{ role: 'user', content: userPrompt }],
            [], // no tools
        );

        let responseText = '';
        for await (const chunk of stream) {
            if (chunk.type === 'text') responseText += chunk.text;
        }

        if (!responseText.trim()) throw new Error('LLM returned empty response');

        // Parse JSON (strip markdown fences if present)
        let cleaned = responseText.trim();
        if (cleaned.startsWith('```')) {
            cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
        }

        try {
            return JSON.parse(cleaned) as DeckPlan;
        } catch (parseError) {
            throw new Error(
                `Failed to parse DeckPlan JSON from LLM response. ` +
                `First 500 chars: ${cleaned.substring(0, 500)}`
            );
        }
    }

    private validatePlan(plan: DeckPlan, catalog: TemplateCatalog): string[] {
        const warnings: string[] = [];
        const slideTypeLookup = new Map<number, SlideType>();
        for (const st of catalog.slide_types) {
            slideTypeLookup.set(st.representative_slide, st);
            for (const alt of st.alternate_slides) slideTypeLookup.set(alt, st);
        }

        const PLACEHOLDERS = new Set([
            'Your slide title', 'Your title here', 'Subtitle or context line',
            'Main content paragraph', 'Content here', 'Step name', 'Brief description',
            'Metric name', 'Section headline',
        ]);

        for (const slide of plan.slides) {
            const st = slideTypeLookup.get(slide.source_slide);
            if (!st) {
                warnings.push(`Folie ${slide.position}: source_slide ${slide.source_slide} nicht im Catalog`);
                continue;
            }

            // Check required shapes
            for (const shape of st.shapes) {
                if (!shape.required) continue;
                const key = shape.duplicate_index != null && shape.duplicate_index > 0
                    ? `${shape.name}#${shape.duplicate_index}` : shape.name;
                if (!slide.content[key] && !slide.remove?.includes(key)) {
                    warnings.push(`Folie ${slide.position} (${st.id}): REQUIRED "${key}" fehlt`);
                }
            }

            // Check placeholders
            for (const [key, value] of Object.entries(slide.content)) {
                if (typeof value === 'string' && PLACEHOLDERS.has(value)) {
                    warnings.push(`Folie ${slide.position}: "${key}" hat Platzhalter "${value}"`);
                }
            }

            // Check group consistency (remove whole group)
            if (slide.remove) {
                for (const removedName of slide.remove) {
                    const removedShape = st.shapes.find(s => {
                        const k = s.duplicate_index != null && s.duplicate_index > 0
                            ? `${s.name}#${s.duplicate_index}` : s.name;
                        return k === removedName;
                    });
                    if (removedShape?.group_id) {
                        const groupMembers = st.shapes.filter(s => s.group_id === removedShape.group_id);
                        for (const member of groupMembers) {
                            const memberKey = member.duplicate_index != null && member.duplicate_index > 0
                                ? `${member.name}#${member.duplicate_index}` : member.name;
                            if (memberKey !== removedName && !slide.remove.includes(memberKey) && !slide.content[memberKey]) {
                                warnings.push(
                                    `Folie ${slide.position}: "${removedName}" entfernt aber Gruppen-Mitglied "${memberKey}" nicht`
                                );
                            }
                        }
                    }
                }
            }
        }

        return warnings;
    }

    private formatPlanOutput(plan: DeckPlan, warnings: string[], template: string): string {
        const lines: string[] = [];

        lines.push(`## Folienplan: ${plan.title}\n`);
        lines.push(`**Narrativ:** ${plan.narrative_framework}`);
        lines.push(`**Modus:** ${plan.deck_mode === 'speaker' ? 'Speaker Deck' : 'Reading Deck'}`);
        lines.push(`**Folien:** ${plan.slides.length}`);
        lines.push(`**Template:** ${template}\n`);

        // Overview table
        lines.push('| # | Typ | Kernaussage | Phase |');
        lines.push('|---|-----|-------------|-------|');
        for (const slide of plan.slides) {
            lines.push(`| ${slide.position} | ${slide.slide_type_id} | ${slide.key_message} | ${slide.purpose} |`);
        }
        lines.push('');

        // Warnings
        if (warnings.length > 0) {
            lines.push('**Validierungs-Hinweise:**');
            for (const w of warnings) lines.push(`- ${w}`);
            lines.push('');
        }

        // JSON block for create_pptx
        const slidesJson = plan.slides.map(s => ({
            source_slide: s.source_slide,
            content: s.content,
            remove: s.remove,
            notes: s.notes,
        }));

        lines.push('<details><summary>JSON fuer create_pptx (klicken zum Aufklappen)</summary>\n');
        lines.push('```json');
        lines.push(JSON.stringify({
            output_path: 'presentations/output.pptx',
            template,
            slides: slidesJson,
        }, null, 2));
        lines.push('```');
        lines.push('</details>\n');

        lines.push('→ Soll ich diesen Plan als PPTX generieren? Bei Aenderungswuenschen beschreibe was angepasst werden soll.');

        return lines.join('\n');
    }
}

// --- Planning System Prompt ---

const PLANNING_SYSTEM_PROMPT = `You are an expert presentation designer. Your task is to create
a complete deck plan from source material and a template catalog guide.

PROCESS (follow this order):
1. ANALYZE: Read the source material completely. Extract 5-8 key messages.
2. NARRATIVE: Choose a storytelling framework (SCR, SCQA, Pyramid, DataStory, StatusReport).
   Assign each key message to a narrative phase (Hook, Build, Turn, Resolution, Echo).
3. LAYOUT SELECTION: For each key message, choose the slide type that fits the CONTENT:
   - Numbers/metrics → KPI slides or chart slides
   - Sequence/process → Process chevrons or timeline
   - Comparison/contrast → Two-column or comparison slides
   - Overview/list → Content slides (LAST RESORT)
   Layout is determined by CONTENT, not the other way around.
4. CONTENT: Fill EVERY non-decorative shape with real content from the source material.

SOURCE-GROUNDING RULES:
- EVERY text must be derivable from the source material
- NEVER invent data, numbers, facts, or quotes
- If source material is insufficient for a shape, remove the shape (add to "remove")
- Transform FORMAT (prose → bullets, paragraphs → action titles), not CONTENT

SHAPE RULES:
- Titles are ACTION TITLES: "Plan comparisons consume resources" not "Problem statement"
- Shapes with [section_number]: Set the running chapter number ("1", "2", ...)
- Shapes with {group:X}: Remove or fill the ENTIRE group together
- Respect max_chars limits per shape
- Use styled_text or html_text for body shapes with multiple lines/bullets
- Use EXACT shape names from the template guide (case-sensitive)
- For duplicate shapes use "ShapeName#N" notation (0-based)

DECK MODE RULES:
- Speaker: Max 25 words visible per slide. Details in speaker notes (2-3 talking points).
- Reading: Max 170 words per slide. Complete sentences. Speaker notes optional.

QUALITY CHECKS (verify before output):
- Does every slide have exactly ONE key message?
- Are ALL required shapes filled (not empty, no placeholder text)?
- Are all texts derivable from the source material?
- Are chapter numbers on section dividers correct and sequential?
- Are unused shapes correctly removed (including all group members)?
- Is the narrative arc complete (Hook → Build → Turn → Resolution → Echo)?

OUTPUT: Valid JSON matching the DeckPlan schema. Every slide must have:
source_slide, slide_type_id, purpose, key_message, content (ALL shapes), remove (if needed), notes.

Return ONLY the JSON object, no additional text or markdown fences.`;
```

---

### Phase 4: Tool-Registrierung und Wiring

**4a: ToolRegistry.ts**

**Datei:** `src/core/tools/ToolRegistry.ts`
**Position:** Nach Zeile ~164 (nach IngestTemplateTool Registrierung)

```typescript
import { PlanPresentationTool } from './vault/PlanPresentationTool';
// ...
// In registerInternalTools():
this.register(new PlanPresentationTool(this.plugin));
```

**4b: toolMetadata.ts**

**Datei:** `src/core/tools/toolMetadata.ts`
**Position:** Nach dem ingest_template Eintrag (falls vorhanden) oder nach create_pptx (~Zeile 295)

```typescript
plan_presentation: {
    group: 'edit',
    label: 'Plan Presentation',
    icon: 'layout-list',
    description: 'Plan a presentation from source material and corporate template — generates a complete deck plan with content for every shape.',
    signature: 'plan_presentation(source, template, deck_mode, goal?, audience?)',
    example: 'plan_presentation("Notes/Q1-Review.md", "enbw", "reading", "Stakeholder informieren")',
    whenToUse: 'ALWAYS before create_pptx when using corporate templates. Reads source material, selects slide types, generates content for all shapes.',
    commonMistakes: 'Skipping this tool and calling create_pptx directly — results in empty shapes and placeholder text.',
},
```

**4c: builtinModes.ts**

**Datei:** `src/core/modes/builtinModes.ts`
**Position:** In TOOL_GROUP_MAP, edit-Array (~Zeile 24)

`'plan_presentation'` nach `'ingest_template'` einfuegen.

---

### Phase 5: create_pptx Anpassungen

**Datei:** `src/core/tools/vault/CreatePptxTool.ts`
**Position:** In `buildTemplatePresentation()`, nach der Required-Shape-Validierung

```typescript
// After validateRequiredShapes (existing):
// ADR-048: Detect placeholder content from JSON examples
const placeholderWarnings = this.detectPlaceholderContent(slides);
if (placeholderWarnings.length > 0) {
    result.warnings.push(...placeholderWarnings);
}

// In output message:
// Add: "Tipp: Rufe render_presentation auf um das Ergebnis visuell zu pruefen."
```

```typescript
private detectPlaceholderContent(slides: TemplateSlideInput[]): string[] {
    const PLACEHOLDERS = new Set([
        'Your slide title', 'Your title here', 'Subtitle or context line',
        'Main content paragraph', 'Content here', 'Step name', 'Brief description',
        'Metric name', 'Section headline',
    ]);
    const warnings: string[] = [];

    for (let i = 0; i < slides.length; i++) {
        if (!slides[i].content) continue;
        for (const [key, value] of Object.entries(slides[i].content!)) {
            if (typeof value === 'string' && PLACEHOLDERS.has(value)) {
                warnings.push(
                    `Slide ${i + 1}: "${key}" contains placeholder text "${value}". ` +
                    `Use plan_presentation to generate real content.`
                );
            }
        }
    }

    return warnings;
}
```

---

### Phase 6: Skill-Update

**6a: office-workflow/SKILL.md**

Kompletter Rewrite mit plan_presentation als Kern:

```markdown
# Office Document Workflow

## Step 1: CONTEXT
Ask: Goal, Audience, Deck Mode (Speaker/Reading), Material (source note)

## Step 2: TEMPLATE
Check if corporate template exists. If not: ingest_template.
For defaults (executive/modern/minimal): skip to Step 3 with adhoc mode.

## Step 3: PLAN (THE KEY STEP)
Call plan_presentation:
  source: vault path to source note
  template: theme name
  deck_mode: speaker or reading
  goal: from Step 1
  audience: from Step 1

Show the plan to the user. Wait for feedback.
On changes: describe what to adjust, call plan_presentation again.

## Step 4: GENERATE
Copy the slides JSON from the plan output into create_pptx.
Do NOT modify the plan's content — it was generated and validated.

## Step 5: VERIFY
Call render_presentation on 2-3 representative slides.
Check for: empty shapes, text overflow, placeholder text, layout issues.
Fix specific slides if needed (max 2 rounds).
```

**6b: presentation-design/SKILL.md**

Ergaenzung in "Template Mode Rules":
```
8. ALWAYS call plan_presentation before create_pptx for corporate templates.
   plan_presentation handles content transformation — do not do it manually.
```

---

### Phase 7: Test

**Testfall:** Genema Use Case (identisch zum gescheiterten Test vom 2026-03-23)

| # | Schritt | Erwartung |
|---|---------|-----------|
| 7.1 | Agent liest Note | Quellmaterial vollstaendig erfasst |
| 7.2 | Agent ruft plan_presentation auf | Tool erzeugt vollstaendigen DeckPlan |
| 7.3 | Plan-Validierung | 0 Warnings (alle Shapes, keine Platzhalter) |
| 7.4 | Plan an User | Uebersichts-Tabelle + JSON-Block sichtbar |
| 7.5 | User approved | Agent ruft create_pptx mit Plan-Slides auf |
| 7.6 | PPTX generiert | Keine Reparatur noetig |
| 7.7 | render_presentation | Keine leeren Boxen, kein Lorem Ipsum |

**Vergleichs-Kriterien (vs. Test vom 2026-03-23):**

| Kriterium | Test 2026-03-23 | Erwartung nach Implementierung |
|-----------|-----------------|-------------------------------|
| Folien mit korrektem Content | 1/18 (nur Titel) | 16/18+ |
| Leere Boxen / Lorem Ipsum | 12 Folien betroffen | 0 |
| Trennfolien mit Nummerierung | 0/4 | 4/4 |
| Prozess-Slides korrekt | Teilweise (Chevrons ja, Texte nein) | Vollstaendig |
| Qualitaetskontrolle | Nicht durchgefuehrt | Durchgefuehrt (render_presentation) |
| PPTX-Reparatur | Noetig | Nicht noetig (oder separat gefixt) |

---

## Reihenfolge und Abhaengigkeiten

```
Phase 1: Types              (keine Abhaengigkeit)
    |
    v
Phase 2: Catalog-Enrichment (abhaengig von Phase 1 fuer neue Type-Felder)
    |
    v
Phase 3: PlanPresentationTool (abhaengig von Phase 1 fuer DeckPlan Type)
    |                          (nutzt Catalog aus Phase 2 fuer Validierung)
    v
Phase 4: Tool-Wiring        (abhaengig von Phase 3 fuer Import)
    |
    v
Phase 5: create_pptx        (unabhaengig, kann parallel zu Phase 3)
    |
    v
Phase 6: Skills             (abhaengig von Phase 3/4 fuer Tool-Referenz)
    |
    v
Phase 7: Test               (abhaengig von allen vorherigen Phasen)
```

**Parallelisierbar:** Phase 2 (Catalog) und Phase 5 (create_pptx) koennen parallel laufen.
