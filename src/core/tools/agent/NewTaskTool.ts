/**
 * NewTaskTool
 *
 * Spawns a child agent task in the specified mode and returns its response.
 * Adapted from Kilo Code's NewTaskTool.ts — simplified for Obsidian (no VSCode provider).
 *
 * The child task runs synchronously within the parent's iteration loop.
 * The parent resumes with the child's response as the tool result.
 *
 * Use case: Orchestrator mode delegates sub-tasks to specialist modes.
 */

import { BaseTool } from '../BaseTool';
import type { ToolDefinition, ToolExecutionContext } from '../types';
import type ObsidianAgentPlugin from '../../../main';

export class NewTaskTool extends BaseTool<'new_task'> {
    readonly name = 'new_task' as const;
    readonly isWriteOperation = false;

    constructor(plugin: ObsidianAgentPlugin) {
        super(plugin);
    }

    getDefinition(): ToolDefinition {
        return {
            name: 'new_task',
            description:
                'Spawn a subtask in a specified agent mode. The subtask runs with a fresh conversation ' +
                'and returns its complete response. Use this to delegate work to a specialist mode. ' +
                'Only available in Orchestrator mode.',
            input_schema: {
                type: 'object',
                properties: {
                    mode: {
                        type: 'string',
                        description: 'Mode slug to run the subtask in (e.g. "researcher", "writer", "librarian")',
                    },
                    message: {
                        type: 'string',
                        description: 'The task description or question to send to the subtask agent',
                    },
                },
                required: ['mode', 'message'],
            },
        };
    }

    async execute(input: Record<string, any>, context: ToolExecutionContext): Promise<void> {
        const { callbacks } = context;
        const mode: string = (input.mode as string ?? '').trim();
        const message: string = (input.message as string ?? '').trim();

        if (!mode) {
            callbacks.pushToolResult(this.formatError(new Error('mode parameter is required')));
            return;
        }
        if (!message) {
            callbacks.pushToolResult(this.formatError(new Error('message parameter is required')));
            return;
        }

        // Only the Orchestrator mode is permitted to spawn subtasks.
        // Check context.mode instead of context.spawnSubtask — spawnSubtask is always
        // injected by AgentTask regardless of mode, so the old check was dead code.
        if (context.mode !== 'orchestrator') {
            callbacks.pushToolResult(
                'new_task is only available in Orchestrator mode. ' +
                'Switch to Orchestrator mode to use multi-agent delegation.'
            );
            return;
        }

        callbacks.log(`Spawning subtask in mode "${mode}": ${message.slice(0, 80)}…`);

        try {
            const result = await context.spawnSubtask!(mode, message);
            callbacks.pushToolResult(
                `[Subtask completed — mode: ${mode}]\n\n${result || '(No response from subtask)'}`
            );
        } catch (error) {
            callbacks.pushToolResult(this.formatError(error));
            await callbacks.handleError('new_task', error);
        }
    }
}
