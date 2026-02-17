/**
 * WriteFileTool - Write content to a file, creating it if needed
 *
 * This is a write operation, so:
 * - isWriteOperation = true
 * - Requires approval (Phase 2)
 * - Creates checkpoint (Phase 3)
 */

import { TFile, TFolder } from 'obsidian';
import { BaseTool } from '../BaseTool';
import type { ToolDefinition, ToolExecutionContext } from '../types';
import type ObsidianAgentPlugin from '../../../main';

interface WriteFileInput {
    path: string;
    content: string;
}

export class WriteFileTool extends BaseTool<'write_file'> {
    readonly name = 'write_file' as const;
    readonly isWriteOperation = true; // Triggers approval + checkpoint

    constructor(plugin: ObsidianAgentPlugin) {
        super(plugin);
    }

    getDefinition(): ToolDefinition {
        return {
            name: 'write_file',
            description:
                'Write content to a file in the vault, creating it if it does not exist. Use this to create new notes or completely replace existing content.',
            input_schema: {
                type: 'object',
                properties: {
                    path: {
                        type: 'string',
                        description:
                            'Path to the file relative to vault root (e.g., "folder/note.md")',
                    },
                    content: {
                        type: 'string',
                        description: 'The complete content to write to the file',
                    },
                },
                required: ['path', 'content'],
            },
        };
    }

    async execute(input: Record<string, any>, context: ToolExecutionContext): Promise<void> {
        const { path, content } = input as WriteFileInput;
        const { callbacks } = context;

        try {
            // Validate input
            if (!path) {
                throw new Error('Path parameter is required');
            }
            if (content === undefined || content === null) {
                throw new Error('Content parameter is required');
            }

            // Check if file exists
            const existingFile = this.app.vault.getAbstractFileByPath(path);

            if (existingFile) {
                // File exists - modify it
                if (!(existingFile instanceof TFile)) {
                    throw new Error(`Path exists but is not a file: ${path}`);
                }

                await this.app.vault.modify(existingFile, content);
                callbacks.pushToolResult(
                    this.formatSuccess(`File updated: ${path} (${content.length} chars)`)
                );
                callbacks.log(`Successfully updated file: ${path}`);
            } else {
                // File doesn't exist - create it
                // First ensure parent folder exists
                const parentPath = path.substring(0, path.lastIndexOf('/'));
                if (parentPath) {
                    await this.ensureFolderExists(parentPath);
                }

                await this.app.vault.create(path, content);
                callbacks.pushToolResult(
                    this.formatSuccess(`File created: ${path} (${content.length} chars)`)
                );
                callbacks.log(`Successfully created file: ${path}`);
            }
        } catch (error) {
            callbacks.pushToolResult(this.formatError(error));
            await callbacks.handleError('write_file', error);
        }
    }

    /**
     * Ensure a folder path exists, creating it if needed
     */
    private async ensureFolderExists(folderPath: string): Promise<void> {
        const folder = this.app.vault.getAbstractFileByPath(folderPath);

        if (!folder) {
            // Folder doesn't exist, create it
            await this.app.vault.createFolder(folderPath);
        } else if (!(folder instanceof TFolder)) {
            throw new Error(`Path exists but is not a folder: ${folderPath}`);
        }
    }
}
