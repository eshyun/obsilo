/**
 * SupportPrompts - Quick-Action prompt templates (Sprint 2.3)
 *
 * Provides predefined prompt templates for common Obsidian tasks.
 * Triggered by the ✨ button in the chat toolbar.
 *
 * Adapted from Kilo Code's src/shared/support-prompt.ts (simplified + Obsidian-specific).
 */

export type SupportPromptType = 'ENHANCE' | 'SUMMARIZE' | 'EXPLAIN' | 'FIX';

const TEMPLATES: Record<SupportPromptType, string> = {
    ENHANCE: `Improve and enhance the following prompt. Reply with only the improved prompt — no explanations, lead-in, or surrounding quotes:

\${userInput}`,

    SUMMARIZE: `Summarize the currently active note in a concise, well-structured format.\${activeFileHint}

Please include:
1. A one-sentence TL;DR at the top
2. Key points or sections
3. Any action items or open questions`,

    EXPLAIN: `Explain the currently active note.\${activeFileHint}

Please provide:
1. The overall purpose and context of this note
2. Key concepts and ideas covered
3. How this note connects to related topics`,

    FIX: `Review the currently active note and fix any issues you find.\${activeFileHint}

Please:
1. Correct any factual errors, broken links, or formatting problems
2. Improve clarity where needed
3. Note what was changed and why`,
};

export interface SupportPromptParams {
    userInput?: string;
    activeFile?: string;
}

/**
 * Generate a support prompt from a template type and parameters.
 */
export function createSupportPrompt(type: SupportPromptType, params: SupportPromptParams): string {
    let template = TEMPLATES[type];
    const activeFileHint = params.activeFile
        ? ` (active file: ${params.activeFile})`
        : '';
    template = template
        .replace(/\${userInput}/g, params.userInput ?? '')
        .replace(/\${activeFileHint}/g, activeFileHint);
    return template.trim();
}

export const SUPPORT_PROMPT_LABELS: Record<SupportPromptType, string> = {
    ENHANCE:   'Improve prompt',
    SUMMARIZE: 'Summarize note',
    EXPLAIN:   'Explain note',
    FIX:       'Fix issues',
};
