import { App, PluginSettingTab, Setting } from 'obsidian';
import type ObsidianAgentPlugin from '../main';

/**
 * AgentSettingsTab - Obsidian Settings Tab for Obsidian Agent
 *
 * Adapted from Kilo Code's ApiOptions.tsx concept, using Obsidian's
 * native PluginSettingTab API instead of React components.
 */
export class AgentSettingsTab extends PluginSettingTab {
    plugin: ObsidianAgentPlugin;

    constructor(app: App, plugin: ObsidianAgentPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Obsidian Agent Settings' });

        this.buildProviderSection(containerEl);
        this.buildProviderDetails(containerEl);
        this.buildBehaviorSection(containerEl);
    }

    /**
     * Provider selection and active provider config
     */
    private buildProviderSection(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'LLM Provider' });

        // Active provider dropdown
        new Setting(containerEl)
            .setName('Active Provider')
            .setDesc('Which LLM provider to use for the agent')
            .addDropdown((drop) => {
                drop.addOption('anthropic', 'Anthropic (Claude)');
                drop.addOption('openai', 'OpenAI');
                drop.addOption('ollama', 'Ollama (local)');
                drop.addOption('custom', 'Custom (OpenAI-compatible)');

                drop.setValue(this.plugin.settings.defaultProvider);

                drop.onChange(async (value) => {
                    this.plugin.settings.defaultProvider = value;
                    await this.plugin.saveSettings();
                    // Rebuild provider details for the new selection
                    this.display();
                });
            });
    }

    /**
     * Provider-specific settings (changes based on active provider)
     * Mirrors Kilo Code's conditional rendering in ApiOptions.tsx
     */
    private buildProviderDetails(containerEl: HTMLElement): void {
        const provider = this.plugin.settings.defaultProvider;

        // Initialize provider entry if it doesn't exist yet
        if (!this.plugin.settings.providers[provider]) {
            this.plugin.settings.providers[provider] = {
                type: provider as any,
                model: '',
            };
        }

        const config = this.plugin.settings.providers[provider];

        containerEl.createEl('h3', { text: 'Provider Settings' });

        // --- Anthropic ---
        if (provider === 'anthropic') {
            new Setting(containerEl)
                .setName('API Key')
                .setDesc('Your Anthropic API key (from console.anthropic.com)')
                .addText((text) => {
                    text.inputEl.type = 'password';
                    text.setPlaceholder('sk-ant-...')
                        .setValue(config.apiKey ?? '')
                        .onChange(async (value) => {
                            this.plugin.settings.providers[provider].apiKey = value;
                            await this.plugin.saveSettings();
                        });
                });

            new Setting(containerEl)
                .setName('Model')
                .setDesc('Claude model to use')
                .addDropdown((drop) => {
                    drop.addOption('claude-sonnet-4-5-20250929', 'Claude Sonnet 4.5 (recommended)');
                    drop.addOption('claude-opus-4-6', 'Claude Opus 4.6');
                    drop.addOption('claude-haiku-4-5-20251001', 'Claude Haiku 4.5 (fast)');
                    drop.addOption('claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet');
                    drop.addOption('claude-3-opus-20240229', 'Claude 3 Opus');

                    drop.setValue(config.model || 'claude-sonnet-4-5-20250929');

                    drop.onChange(async (value) => {
                        this.plugin.settings.providers[provider].model = value;
                        await this.plugin.saveSettings();
                    });
                });
        }

        // --- OpenAI ---
        if (provider === 'openai') {
            new Setting(containerEl)
                .setName('API Key')
                .setDesc('Your OpenAI API key (from platform.openai.com)')
                .addText((text) => {
                    text.inputEl.type = 'password';
                    text.setPlaceholder('sk-...')
                        .setValue(config.apiKey ?? '')
                        .onChange(async (value) => {
                            this.plugin.settings.providers[provider].apiKey = value;
                            await this.plugin.saveSettings();
                        });
                });

            new Setting(containerEl)
                .setName('Model')
                .setDesc('OpenAI model to use')
                .addDropdown((drop) => {
                    drop.addOption('gpt-4o', 'GPT-4o (recommended)');
                    drop.addOption('gpt-4o-mini', 'GPT-4o mini (fast)');
                    drop.addOption('gpt-4-turbo', 'GPT-4 Turbo');
                    drop.addOption('o1', 'o1');
                    drop.addOption('o3-mini', 'o3-mini');

                    drop.setValue(config.model || 'gpt-4o');

                    drop.onChange(async (value) => {
                        this.plugin.settings.providers[provider].model = value;
                        await this.plugin.saveSettings();
                    });
                });
        }

        // --- Ollama ---
        if (provider === 'ollama') {
            new Setting(containerEl)
                .setName('Base URL')
                .setDesc('Ollama server URL (default: http://localhost:11434)')
                .addText((text) => {
                    text.setPlaceholder('http://localhost:11434')
                        .setValue(config.baseUrl ?? 'http://localhost:11434')
                        .onChange(async (value) => {
                            this.plugin.settings.providers[provider].baseUrl = value;
                            await this.plugin.saveSettings();
                        });
                });

            new Setting(containerEl)
                .setName('Model')
                .setDesc('Ollama model name (must be pulled locally)')
                .addText((text) => {
                    text.setPlaceholder('llama3.2, mistral, codellama...')
                        .setValue(config.model || '')
                        .onChange(async (value) => {
                            this.plugin.settings.providers[provider].model = value;
                            await this.plugin.saveSettings();
                        });
                });
        }

        // --- Custom (OpenAI-compatible) ---
        if (provider === 'custom') {
            new Setting(containerEl)
                .setName('Base URL')
                .setDesc('OpenAI-compatible API endpoint (e.g. Mistral, LM Studio, custom)')
                .addText((text) => {
                    text.setPlaceholder('https://api.mistral.ai/v1')
                        .setValue(config.baseUrl ?? '')
                        .onChange(async (value) => {
                            this.plugin.settings.providers[provider].baseUrl = value;
                            await this.plugin.saveSettings();
                        });
                });

            new Setting(containerEl)
                .setName('API Key')
                .setDesc('API key for the custom provider (leave empty if not required)')
                .addText((text) => {
                    text.inputEl.type = 'password';
                    text.setPlaceholder('API key...')
                        .setValue(config.apiKey ?? '')
                        .onChange(async (value) => {
                            this.plugin.settings.providers[provider].apiKey = value;
                            await this.plugin.saveSettings();
                        });
                });

            new Setting(containerEl)
                .setName('Model')
                .setDesc('Model identifier for this provider')
                .addText((text) => {
                    text.setPlaceholder('mistral-medium, local-model...')
                        .setValue(config.model || '')
                        .onChange(async (value) => {
                            this.plugin.settings.providers[provider].model = value;
                            await this.plugin.saveSettings();
                        });
                });
        }

        // Max tokens (shared across all providers)
        new Setting(containerEl)
            .setName('Max Tokens')
            .setDesc('Maximum tokens in the response')
            .addText((text) => {
                text.setPlaceholder('8192')
                    .setValue(String(config.maxTokens ?? 8192))
                    .onChange(async (value) => {
                        const parsed = parseInt(value);
                        if (!isNaN(parsed) && parsed > 0) {
                            this.plugin.settings.providers[provider].maxTokens = parsed;
                            await this.plugin.saveSettings();
                        }
                    });
            });
    }

    /**
     * General behavior settings
     */
    private buildBehaviorSection(containerEl: HTMLElement): void {
        containerEl.createEl('h3', { text: 'Behavior' });

        new Setting(containerEl)
            .setName('Debug Mode')
            .setDesc('Log detailed information to the console')
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.debugMode)
                    .onChange(async (value) => {
                        this.plugin.settings.debugMode = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Show Welcome Message')
            .setDesc('Show the welcome message when the sidebar is opened')
            .addToggle((toggle) => {
                toggle
                    .setValue(this.plugin.settings.showWelcomeMessage)
                    .onChange(async (value) => {
                        this.plugin.settings.showWelcomeMessage = value;
                        await this.plugin.saveSettings();
                    });
            });
    }
}
