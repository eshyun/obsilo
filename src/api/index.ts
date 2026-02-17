/**
 * API Handler Factory
 *
 * Adapted from Kilo Code's src/api/index.ts (buildApiHandler)
 *
 * Routes to the correct provider implementation based on
 * the configured provider type.
 */

import type { LLMProvider } from '../types/settings';
import { AnthropicProvider } from './providers/anthropic';
import { OpenAiProvider } from './providers/openai';

export type { ApiHandler, ApiStream, ApiStreamChunk, MessageParam, ContentBlock, ModelInfo } from './types';

/**
 * Factory function - adapted from Kilo Code's buildApiHandler()
 * Creates the correct provider based on the settings.
 */
export function buildApiHandler(config: LLMProvider) {
    switch (config.type) {
        case 'anthropic':
            return new AnthropicProvider(config);
        case 'openai':
        case 'ollama':
        case 'custom':
            return new OpenAiProvider(config);
        default:
            throw new Error(`Unknown provider type: ${(config as any).type}`);
    }
}
