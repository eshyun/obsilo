/**
 * ToolExecutionPipeline - Central execution and governance layer
 *
 * ⭐ CRITICAL COMPONENT (ASR-02)
 *
 * ALL tool executions (internal and MCP) MUST flow through this pipeline.
 * This ensures:
 * - Central governance (approval, validation)
 * - Checkpoint creation before writes
 * - Comprehensive logging
 * - Error handling
 *
 * Phase 1: Basic execution (no approval/checkpoints yet)
 * Phase 2: Add approval system
 * Phase 3: Add checkpoint creation
 */

import type ObsidianAgentPlugin from '../../main';
import type { ToolRegistry } from '../tools/ToolRegistry';
import type {
    ToolUse,
    ToolResult,
    ToolCallbacks,
    ToolExecutionContext,
    ValidationResult,
} from '../tools/types';

export class ToolExecutionPipeline {
    private plugin: ObsidianAgentPlugin;
    private toolRegistry: ToolRegistry;
    private taskId: string;
    private mode: string;

    constructor(
        plugin: ObsidianAgentPlugin,
        toolRegistry: ToolRegistry,
        taskId: string,
        mode: string
    ) {
        this.plugin = plugin;
        this.toolRegistry = toolRegistry;
        this.taskId = taskId;
        this.mode = mode;
    }

    /**
     * CENTRAL EXECUTION METHOD
     * All tools MUST flow through here
     */
    async executeTool(toolCall: ToolUse, callbacks: ToolCallbacks): Promise<ToolResult> {
        const startTime = Date.now();
        console.log(`[Pipeline] Executing tool: ${toolCall.name}`, toolCall.input);

        try {
            // 1. Validate tool exists
            const tool = this.toolRegistry.getTool(toolCall.name);
            if (!tool) {
                const error = `Unknown tool: ${toolCall.name}`;
                console.error(`[Pipeline] ${error}`);
                callbacks.pushToolResult(`<error>${error}</error>`);
                return {
                    type: 'tool_result',
                    tool_use_id: toolCall.id,
                    content: `<error>${error}</error>`,
                    is_error: true,
                };
            }

            // 2. Validate operation (ignore/protect checks)
            // TODO: Phase 2 - Add .obsidian-agentignore checks
            const validation = await this.validateOperation(toolCall);
            if (!validation.allowed) {
                const error = `Operation denied: ${validation.reason}`;
                console.warn(`[Pipeline] ${error}`);
                callbacks.pushToolResult(`<error>${error}</error>`);
                return {
                    type: 'tool_result',
                    tool_use_id: toolCall.id,
                    content: `<error>${error}</error>`,
                    is_error: true,
                };
            }

            // 3. Check approval (Phase 2)
            // TODO: Phase 2 - Request user approval for write operations
            // if (tool.isWriteOperation) {
            //     const approved = await this.requestApproval(toolCall);
            //     if (!approved) {
            //         return this.createDeniedResult(toolCall.id, 'User denied approval');
            //     }
            // }

            // 4. Create checkpoint (Phase 3)
            // TODO: Phase 3 - Create checkpoint before write operations
            // let checkpointHash: string | undefined;
            // if (tool.isWriteOperation) {
            //     checkpointHash = await this.createCheckpoint(`Before ${toolCall.name}`);
            // }

            // 5. Execute the tool
            // Wrap callbacks to collect content for ToolResult
            const collectedContent: string[] = [];
            let executionHadError = false;

            const wrappedCallbacks: ToolCallbacks = {
                pushToolResult: (content: string) => {
                    collectedContent.push(content);
                    // Check if the tool reported an error via its result
                    if (content.startsWith('<error>')) {
                        executionHadError = true;
                    }
                    callbacks.pushToolResult(content);
                },
                handleError: callbacks.handleError,
                log: callbacks.log,
            };

            const context: ToolExecutionContext = {
                taskId: this.taskId,
                mode: this.mode,
                callbacks: wrappedCallbacks,
            };

            await tool.execute(toolCall.input, context);

            // 6. Log operation
            await this.logOperation(toolCall, !executionHadError);

            const duration = Date.now() - startTime;
            console.log(`[Pipeline] Tool executed successfully in ${duration}ms: ${toolCall.name}`);

            const content = collectedContent.join('\n');
            return {
                type: 'tool_result',
                tool_use_id: toolCall.id,
                content,
                is_error: executionHadError,
            };
        } catch (error) {
            // 7. Handle execution error
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[Pipeline] Tool execution failed: ${toolCall.name}`, error);

            await callbacks.handleError(toolCall.name, error);
            await this.logOperation(toolCall, false, errorMessage);

            return {
                type: 'tool_result',
                tool_use_id: toolCall.id,
                content: `<error>${errorMessage}</error>`,
                is_error: true,
            };
        }
    }

    /**
     * Validate operation (Phase 1: placeholder, Phase 2: real validation)
     */
    private async validateOperation(toolCall: ToolUse): Promise<ValidationResult> {
        // TODO: Phase 2 - Check .obsidian-agentignore
        // TODO: Phase 2 - Check .obsidian-agentprotected
        // TODO: Phase 2 - Validate file paths

        // For now, allow everything
        return { allowed: true };
    }

    /**
     * Log operation (Phase 1: console, Phase 8: persistent log)
     */
    private async logOperation(
        toolCall: ToolUse,
        success: boolean,
        errorMessage?: string
    ): Promise<void> {
        const logEntry = {
            timestamp: new Date().toISOString(),
            taskId: this.taskId,
            mode: this.mode,
            tool: toolCall.name,
            input: toolCall.input,
            success,
            error: errorMessage,
        };

        // TODO: Phase 8 - Write to persistent log file
        console.log('[Pipeline] Operation logged:', logEntry);
    }

    /**
     * Create a denied result
     */
    private createDeniedResult(toolUseId: string, reason: string): ToolResult {
        return {
            type: 'tool_result',
            tool_use_id: toolUseId,
            content: `<error>Operation denied: ${reason}</error>`,
            is_error: true,
        };
    }
}
