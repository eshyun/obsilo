/**
 * Verification script for PptxTemplateCloner fixes.
 * Run with: npx tsx _verify_test.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import JSZip from 'jszip';
import { cloneFromTemplate, TemplateSlideInput } from './src/core/office/PptxTemplateCloner';

const TEMPLATE_PATH = '/Users/sebastianhanke/Obsidian/NexusOS/Tools & Settings/Vorlagen/EnBW_Vorlage.pptx';
const OUTPUT_PATH = '/tmp/test_cloned.pptx';

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: string) {
    if (condition) {
        console.error(`  PASS: ${label}`);
        passed++;
    } else {
        console.error(`  FAIL: ${label}${detail ? ' -- ' + detail : ''}`);
        failed++;
    }
}

async function main() {
    // --- Step 1: Load template and clone ---
    console.error('Loading template...');
    const templateBuf = readFileSync(TEMPLATE_PATH);
    const templateData = templateBuf.buffer.slice(
        templateBuf.byteOffset,
        templateBuf.byteOffset + templateBuf.byteLength,
    );

    const selections: TemplateSlideInput[] = [
        {
            template_slide: 1,
            content: {
                'Titel zwei- bis dreizeilig ohne Bild': 'Test Titel',
                'Subline | Referent Datum, Ort': 'Test Subline',
            },
            notes: 'Speaker notes',
        },
        {
            template_slide: 5,
            content: {
                '1': '01',
                'PlatzhalterKapitelname': 'Kapitel Eins',
            },
        },
        {
            template_slide: 9,
            content: {
                'Platzhalter Titelbereich 30pt': 'Action Title Here',
                'Lorem ipsum dolor sit amet': 'Replacement body text',
            },
        },
    ];

    console.error('Cloning slides...');
    const outputBuf = await cloneFromTemplate(templateData, selections);

    // Save output
    writeFileSync(OUTPUT_PATH, Buffer.from(outputBuf));
    console.error(`Output saved to ${OUTPUT_PATH}\n`);

    // --- Step 2: Re-open and verify ---
    console.error('Verifying output...');
    const zip = await JSZip.loadAsync(outputBuf);

    // (a) Count slide files
    const slideFiles: string[] = [];
    zip.forEach((path) => {
        if (/^ppt\/slides\/slide\d+\.xml$/.test(path)) {
            slideFiles.push(path);
        }
    });
    check('(a) Slide file count = 3', slideFiles.length === 3, `found ${slideFiles.length}: ${slideFiles.join(', ')}`);

    // (b) Count <p:sldId> entries in presentation.xml
    const presXml = await zip.file('ppt/presentation.xml')!.async('text');
    const sldIdMatches = presXml.match(/<p:sldId\b[^>]*>/g) || [];
    check('(b) sldIdLst entries = 3', sldIdMatches.length === 3, `found ${sldIdMatches.length}`);

    // (c) Count slide rels in presentation.xml.rels
    const presRels = await zip.file('ppt/_rels/presentation.xml.rels')!.async('text');
    const slideRelMatches = presRels.match(/<Relationship[^>]*\/slide"[^>]*\/>/g) || [];
    check('(c) Slide rels in presentation.xml.rels = 3', slideRelMatches.length === 3, `found ${slideRelMatches.length}`);

    // (d) Count slide overrides in [Content_Types].xml
    const ctXml = await zip.file('[Content_Types].xml')!.async('text');
    const slideOverrides = ctXml.match(/<Override\s+PartName="\/ppt\/slides\/slide\d+\.xml"[^>]*\/>/g) || [];
    check('(d) Slide overrides in [Content_Types].xml = 3', slideOverrides.length === 3, `found ${slideOverrides.length}`);

    // (e) No <p14:sectionLst>
    const hasSectionLst = presXml.includes('<p14:sectionLst');
    check('(e) No <p14:sectionLst> in presentation.xml', !hasSectionLst);

    // (f) Each cloned slide has <a:bodyPr> inside <p:txBody>
    for (const slidePath of slideFiles) {
        const slideXml = await zip.file(slidePath)!.async('text');
        // Check that at least one <p:txBody> contains <a:bodyPr>
        const hasTxBody = slideXml.includes('<p:txBody>');
        const hasBodyPr = slideXml.includes('<a:bodyPr');
        check(`(f) ${slidePath}: <a:bodyPr> exists in <p:txBody>`, hasTxBody && hasBodyPr);
    }

    // (g) Slide 9 (now cloned) should NOT contain "Lorem ipsum" after replacement
    // We need to find which cloned slide came from template_slide 9.
    // Since slides are cloned in order, slide 9 is the 3rd selection.
    // The cloned slides get new file numbers. Let's check all slides for "Lorem ipsum".
    let loremFoundInSlide3 = false;
    // The 3rd slide is the last one in slideFiles (sorted)
    const sortedSlides = slideFiles.sort();
    for (let i = 0; i < sortedSlides.length; i++) {
        const slideXml = await zip.file(sortedSlides[i])!.async('text');
        if (i === 2) {
            // This is the 3rd cloned slide (from template_slide 9)
            // Check specifically for the search key "Lorem ipsum dolor sit amet"
            // The text in XML would be escaped, but "Lorem ipsum" itself has no special chars
            loremFoundInSlide3 = slideXml.includes('Lorem ipsum dolor sit amet');
        }
    }
    check('(g) No "Lorem ipsum dolor sit amet" in slide from template 9', !loremFoundInSlide3);

    // (h) Notes files exist and match slide count
    const notesFiles: string[] = [];
    zip.forEach((path) => {
        if (/^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(path)) {
            notesFiles.push(path);
        }
    });
    // Note: only slide 1 has explicit notes in our test. But the template may have
    // notes on all slides. The cloner clones notes if they exist in the template.
    // The key check: notes files should exist (at least for slides that had notes in template)
    // and their count should be reasonable (not more than slide count, not zero).
    check(`(h) Notes files exist (count: ${notesFiles.length}, slides: ${slideFiles.length})`,
        notesFiles.length > 0 && notesFiles.length <= slideFiles.length,
        `notes: ${notesFiles.join(', ')}`);

    // Also verify the notes override count matches
    const notesOverrides = ctXml.match(/<Override\s+PartName="\/ppt\/notesSlides\/notesSlide\d+\.xml"[^>]*\/>/g) || [];
    check(`(h+) Notes overrides in [Content_Types].xml match notes file count`,
        notesOverrides.length === notesFiles.length,
        `overrides: ${notesOverrides.length}, files: ${notesFiles.length}`);

    // --- Summary ---
    console.error(`\n========================================`);
    console.error(`Results: ${passed} passed, ${failed} failed`);
    console.error(`========================================`);

    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error('ERROR:', err);
    process.exit(2);
});
