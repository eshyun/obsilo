import { ItemView, WorkspaceLeaf, setIcon, Menu, MarkdownRenderer } from 'obsidian';
import type ObsidianAgentPlugin from '../main';
import { AgentTask } from '../core/AgentTask';
import type { MessageParam } from '../api/types';

export const VIEW_TYPE_AGENT_SIDEBAR = 'obsidian-agent-sidebar';

/**
 * Agent Sidebar View
 *
 * Matches Kilo Code's UI/UX patterns:
 * - Clean header with title + New Chat button
 * - Scrollable messages area with Markdown rendering
 * - Chat input with integrated toolbar (mode, settings, send/stop)
 * - Persistent conversation history across messages
 * - Cancel running requests
 */
export class AgentSidebarView extends ItemView {
    plugin: ObsidianAgentPlugin;
    private chatContainer: HTMLElement | null = null;
    private inputArea: HTMLElement | null = null;
    private textarea: HTMLTextAreaElement | null = null;
    private modeButton: HTMLElement | null = null;
    private sendButton: HTMLElement | null = null;
    private stopButton: HTMLElement | null = null;

    // Feature 1: Persistent conversation history (survives across messages)
    private conversationHistory: MessageParam[] = [];

    // Feature 3: AbortController for cancelling in-flight requests
    private currentAbortController: AbortController | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: ObsidianAgentPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return VIEW_TYPE_AGENT_SIDEBAR;
    }

    getDisplayText(): string {
        return 'Obsidian Agent';
    }

    getIcon(): string {
        return 'bot';
    }

    async onOpen(): Promise<void> {
        const container = this.containerEl.children[1] as HTMLElement;
        container.empty();
        container.addClass('obsidian-agent-sidebar');

        this.buildHeader(container);
        this.buildChatContainer(container);
        this.buildChatInput(container);

        if (this.plugin.settings.showWelcomeMessage) {
            this.showWelcomeMessage();
        }
    }

    async onClose(): Promise<void> {
        this.currentAbortController?.abort();
    }

    private buildHeader(container: HTMLElement): void {
        const header = container.createDiv('agent-header');

        const title = header.createDiv('agent-title');
        title.setText('Obsidian Agent');

        const headerRight = header.createDiv('agent-header-right');

        // New Chat button — clears conversation history
        const newChatBtn = headerRight.createEl('button', {
            cls: 'header-button',
            attr: { 'aria-label': 'New chat' },
        });
        setIcon(newChatBtn, 'square-pen');
        newChatBtn.addEventListener('click', () => this.clearConversation());

        const meta = header.createDiv('agent-meta');
        meta.setText(this.getModeDisplayName(this.plugin.settings.currentMode));
    }

    private buildChatContainer(container: HTMLElement): void {
        this.chatContainer = container.createDiv('chat-messages');
    }

    private buildChatInput(container: HTMLElement): void {
        this.inputArea = container.createDiv('chat-input-container');
        const inputWrapper = this.inputArea.createDiv('chat-input-wrapper');

        this.textarea = inputWrapper.createEl('textarea', {
            cls: 'chat-textarea',
            attr: { placeholder: 'Type your message here...', rows: '3' },
        });

        this.textarea.addEventListener('input', () => this.autoResizeTextarea());

        this.textarea.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });

        const toolbar = inputWrapper.createDiv('chat-toolbar');
        const toolbarLeft = toolbar.createDiv('chat-toolbar-left');
        this.buildContextIndicator(toolbarLeft);

        const toolbarRight = toolbar.createDiv('chat-toolbar-right');

        // Mode button
        this.modeButton = toolbarRight.createEl('button', {
            cls: 'toolbar-button mode-button',
            attr: { 'aria-label': 'Select mode' },
        });
        this.updateModeButton();
        this.modeButton.addEventListener('click', (e) => this.showModeMenu(e));

        // Settings button
        const settingsBtn = toolbarRight.createEl('button', {
            cls: 'toolbar-button',
            attr: { 'aria-label': 'Settings' },
        });
        setIcon(settingsBtn.createSpan('toolbar-icon'), 'settings');
        settingsBtn.addEventListener('click', () => {
            // Open Obsidian settings at our tab
            (this.app as any).setting?.open();
            (this.app as any).setting?.openTabById('obsidian-agent');
        });

        // Feature 3: Stop button (hidden by default, shown when task is running)
        this.stopButton = toolbarRight.createEl('button', {
            cls: 'toolbar-button stop-button',
            attr: { 'aria-label': 'Stop' },
        });
        setIcon(this.stopButton.createSpan('toolbar-icon'), 'square');
        this.stopButton.style.display = 'none';
        this.stopButton.addEventListener('click', () => this.handleStop());

        // Send button
        this.sendButton = toolbarRight.createEl('button', {
            cls: 'toolbar-button send-button',
            attr: { 'aria-label': 'Send message' },
        });
        setIcon(this.sendButton.createSpan('toolbar-icon'), 'send');
        this.sendButton.addEventListener('click', () => this.handleSendMessage());
    }

    private buildContextIndicator(container: HTMLElement): void {
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            const indicator = container.createDiv('context-badge');
            setIcon(indicator.createSpan('context-icon'), 'file-text');
            indicator.createSpan('context-label').setText(activeFile.basename);
        }
    }

    private updateModeButton(): void {
        if (!this.modeButton) return;
        this.modeButton.empty();
        const currentMode = this.plugin.settings.currentMode;
        setIcon(this.modeButton.createSpan('toolbar-icon'), this.getModeIcon(currentMode));
        this.modeButton.createSpan('mode-label').setText(this.getModeDisplayName(currentMode));
        setIcon(this.modeButton.createSpan('mode-chevron'), 'chevron-down');
    }

    private showModeMenu(event: MouseEvent): void {
        const menu = new Menu();
        const modes = [
            { id: 'ask', name: 'Ask', icon: 'help-circle' },
            { id: 'writer', name: 'Writer', icon: 'pencil' },
            { id: 'architect', name: 'Architect', icon: 'layout' },
        ];
        modes.forEach((mode) => {
            menu.addItem((item) =>
                item
                    .setTitle(mode.name)
                    .setIcon(mode.icon)
                    .setChecked(this.plugin.settings.currentMode === mode.id)
                    .onClick(() => this.switchMode(mode.id))
            );
        });
        menu.showAtMouseEvent(event);
    }

    private getModeIcon(modeId: string): string {
        return { ask: 'help-circle', writer: 'pencil', architect: 'layout' }[modeId] ?? 'help-circle';
    }

    private getModeDisplayName(modeId: string): string {
        return { ask: 'Ask', writer: 'Writer', architect: 'Architect' }[modeId] ?? 'Ask';
    }

    private autoResizeTextarea(): void {
        if (!this.textarea) return;
        this.textarea.style.height = 'auto';
        this.textarea.style.height = Math.min(this.textarea.scrollHeight, 15 * 24) + 'px';
    }

    private showWelcomeMessage(): void {
        if (!this.chatContainer) return;
        const welcomeMarkdown = `## Welcome to Obsidian Agent

An agentic AI assistant integrated into your vault.

**Capabilities**
- Answer questions about your notes
- Edit and create content
- Organize and structure your vault

**How to use**
Select a mode in the toolbar below and start chatting. The agent can read and write files in your vault.`;

        this.renderMarkdownMessage(welcomeMarkdown, 'assistant');
    }

    /**
     * Feature 1+3: Handle sending a message with persistent history and cancellation
     */
    private async handleSendMessage(): Promise<void> {
        if (!this.textarea) return;

        const text = this.textarea.value.trim();
        if (!text) return;
        if (this.currentAbortController) return; // Already running

        this.addUserMessage(text);
        this.textarea.value = '';
        this.autoResizeTextarea();

        if (!this.plugin.apiHandler) {
            this.addAssistantMessage(
                'No LLM provider configured. Please add an API key in **Settings → Obsidian Agent**.'
            );
            return;
        }

        // Feature 3: Create AbortController, show stop button
        this.currentAbortController = new AbortController();
        this.setRunningState(true);

        // Prepare streaming message elements
        const { messageEl, contentEl } = this.createStreamingMessageEl();
        let accumulatedText = '';

        const taskId = `task-${Date.now()}`;
        const mode = this.plugin.settings.currentMode;

        const task = new AgentTask(
            this.plugin.apiHandler,
            this.plugin.toolRegistry,
            {
                onText: (chunk) => {
                    accumulatedText += chunk;
                    // Feature 2: Re-render as Markdown on each chunk
                    contentEl.empty();
                    MarkdownRenderer.render(
                        this.app,
                        accumulatedText,
                        contentEl,
                        '',
                        this,
                    );
                    this.chatContainer?.scrollTo({ top: this.chatContainer.scrollHeight });
                },
                onToolStart: (name) => {
                    const toolEl = messageEl.createDiv('tool-call');
                    setIcon(toolEl.createSpan('tool-icon'), 'wrench');
                    toolEl.createSpan('tool-name').setText(name);
                    toolEl.createSpan('tool-status tool-running').setText('running...');
                    // Store ref so we can update it in onToolResult
                    (toolEl as any)._toolName = name;
                },
                onToolResult: (name, _content, isError) => {
                    // Find the tool-call div and update status
                    messageEl.querySelectorAll('.tool-call').forEach((el) => {
                        if ((el as any)._toolName === name) {
                            const statusEl = el.querySelector('.tool-status');
                            if (statusEl) {
                                statusEl.removeClass('tool-running');
                                statusEl.addClass(isError ? 'tool-error' : 'tool-done');
                                statusEl.setText(isError ? 'error' : 'done');
                            }
                        }
                    });
                },
                onComplete: () => {
                    messageEl.removeClass('message-streaming');
                    this.currentAbortController = null;
                    this.setRunningState(false);
                    this.chatContainer?.scrollTo({ top: this.chatContainer.scrollHeight });
                },
                onError: (error) => {
                    contentEl.empty();
                    const errEl = messageEl.createDiv('message-error');
                    setIcon(errEl.createSpan('error-icon'), 'alert-triangle');
                    errEl.createSpan('error-text').setText(error.message);
                    messageEl.removeClass('message-streaming');
                    this.currentAbortController = null;
                    this.setRunningState(false);
                },
            }
        );

        // Feature 1: Pass the shared history — it accumulates across messages
        await task.run(text, taskId, mode, this.conversationHistory, this.currentAbortController.signal);
    }

    /**
     * Feature 3: Cancel the running request
     */
    private handleStop(): void {
        this.currentAbortController?.abort();
        this.currentAbortController = null;
        this.setRunningState(false);
    }

    /**
     * Toggle between send and stop button states
     */
    private setRunningState(running: boolean): void {
        if (this.sendButton) this.sendButton.style.display = running ? 'none' : '';
        if (this.stopButton) this.stopButton.style.display = running ? '' : 'none';
        if (this.textarea) this.textarea.disabled = running;
    }

    /**
     * Clear conversation history and chat UI (New Chat)
     */
    private clearConversation(): void {
        this.conversationHistory = [];
        if (this.chatContainer) {
            this.chatContainer.empty();
        }
        if (this.plugin.settings.showWelcomeMessage) {
            this.showWelcomeMessage();
        }
    }

    /**
     * Create the streaming message container
     */
    private createStreamingMessageEl(): { messageEl: HTMLElement; contentEl: HTMLElement } {
        if (!this.chatContainer) throw new Error('Chat container not initialized');
        const messageEl = this.chatContainer.createDiv('message assistant-message message-streaming');
        const contentEl = messageEl.createDiv('message-content');
        this.chatContainer.scrollTo({ top: this.chatContainer.scrollHeight });
        return { messageEl, contentEl };
    }

    /**
     * Feature 2: Render markdown into a new assistant message (for static messages)
     */
    private renderMarkdownMessage(markdown: string, role: 'assistant' | 'user'): void {
        if (!this.chatContainer) return;
        const msgEl = this.chatContainer.createDiv(`message ${role}-message`);
        const contentEl = msgEl.createDiv('message-content');
        MarkdownRenderer.render(this.app, markdown, contentEl, '', this);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    private addUserMessage(text: string): void {
        if (!this.chatContainer) return;
        const msgEl = this.chatContainer.createDiv('message user-message');
        msgEl.createDiv('message-content').setText(text);
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    private addAssistantMessage(markdown: string): void {
        this.renderMarkdownMessage(markdown, 'assistant');
    }

    private switchMode(modeId: string): void {
        this.plugin.settings.currentMode = modeId;
        this.plugin.saveSettings();
        this.updateModeButton();
        const meta = this.containerEl.querySelector('.agent-meta');
        if (meta) meta.setText(this.getModeDisplayName(modeId));
    }
}
