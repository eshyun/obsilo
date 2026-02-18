import { BaseTool } from '../BaseTool';
import type { ToolDefinition, ToolExecutionContext } from '../types';
import type ObsidianAgentPlugin from '../../../main';

export class SemanticSearchTool extends BaseTool<'semantic_search'> {
    readonly name = 'semantic_search' as const;
    readonly isWriteOperation = false;

    constructor(plugin: ObsidianAgentPlugin) {
        super(plugin);
    }

    getDefinition(): ToolDefinition {
        return {
            name: 'semantic_search',
            description:
                'Search the vault by meaning (semantic similarity) rather than exact keywords. ' +
                'Returns the most relevant note excerpts for a given natural-language query. ' +
                'Requires the Semantic Index to be built first (Settings → Semantic Index).',
            input_schema: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Natural-language search query (e.g. "project planning ideas", "morning routine notes")',
                    },
                    top_k: {
                        type: 'number',
                        description: 'Maximum number of results to return (default: 5, max: 20)',
                    },
                },
                required: ['query'],
            },
        };
    }

    async execute(input: Record<string, any>, context: ToolExecutionContext): Promise<void> {
        const { callbacks } = context;
        const query: string = input.query ?? '';
        const topK: number = Math.min(Number(input.top_k) || 5, 20);

        if (!query.trim()) {
            callbacks.pushToolResult(this.formatError(new Error('query parameter is required')));
            return;
        }

        const semanticIndex = (this.plugin as any).semanticIndex;
        if (!semanticIndex) {
            callbacks.pushToolResult(
                'Semantic Index is not enabled. Enable it in Settings → Semantic Index and click "Build Index".'
            );
            return;
        }

        if (!semanticIndex.isIndexed) {
            callbacks.pushToolResult(
                'Semantic Index has not been built yet. Go to Settings → Semantic Index and click "Build Index".'
            );
            return;
        }

        try {
            const results = await semanticIndex.search(query, topK);

            if (results.length === 0) {
                callbacks.pushToolResult(`No semantic matches found for: "${query}"`);
                return;
            }

            const lines = [`Semantic search results for: "${query}"\n`];
            for (let i = 0; i < results.length; i++) {
                const r = results[i];
                const score = Math.round(r.score * 100);
                lines.push(`${i + 1}. **${r.path}** (${score}% match)`);
                lines.push(`   ${r.excerpt.replace(/\n/g, ' ').slice(0, 200)}`);
                lines.push('');
            }

            callbacks.pushToolResult(lines.join('\n'));
            callbacks.log(`Semantic search: "${query}" → ${results.length} results`);
        } catch (error) {
            callbacks.pushToolResult(this.formatError(error));
            await callbacks.handleError('semantic_search', error);
        }
    }
}
