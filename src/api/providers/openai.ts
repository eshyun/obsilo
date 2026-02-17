/**
 * OpenAiProvider - LLM provider for OpenAI-compatible APIs
 *
 * Adapted from Kilo Code's src/api/providers/openai.ts + base-provider.ts
 *
 * Covers: OpenAI, Mistral, Ollama (port 11434), custom OpenAI-compatible endpoints.
 *
 * TODO: Implement in Step 8 after end-to-end Anthropic test passes.
 */

import type { LLMProvider } from '../../types/settings';
import type { ApiHandler, ApiStream, MessageParam, ModelInfo } from '../types';
import type { ToolDefinition } from '../../core/tools/types';

export class OpenAiProvider implements ApiHandler {
    private config: LLMProvider;

    constructor(config: LLMProvider) {
        this.config = config;
    }

    getModel(): { id: string; info: ModelInfo } {
        return {
            id: this.config.model,
            info: {
                contextWindow: 128000,
                supportsTools: true,
                supportsStreaming: true,
            },
        };
    }

    async *createMessage(
        _systemPrompt: string,
        _messages: MessageParam[],
        _tools: ToolDefinition[],
    ): ApiStream {
        // TODO: Implement in Step 8
        throw new Error('OpenAI provider not yet implemented. Use Anthropic for now.');
    }
}
