import { App, Notice, Setting, setIcon } from 'obsidian';
import type ObsidianAgentPlugin from '../../main';
import { OnboardingService } from '../../core/memory/OnboardingService';
import { getModelKey } from '../../types/settings';
import { t } from '../../i18n';


export class InterfaceTab {
    constructor(private plugin: ObsidianAgentPlugin, private app: App, private rerender: () => void) {}

    private buildIntroSection(containerEl: HTMLElement): void {
        const infoBanner = containerEl.createDiv('agent-settings-info-banner');
        const infoIcon = infoBanner.createSpan({ cls: 'agent-settings-info-icon' });
        setIcon(infoIcon, 'lightbulb');
        const infoText = infoBanner.createDiv({ cls: 'agent-settings-info-text' });
        infoText.createEl('strong', { text: t('settings.interface.introTitle') });
        infoText.createDiv({ text: t('settings.interface.introDesc') });
    }

    build(containerEl: HTMLElement): void {
        this.buildIntroSection(containerEl);
        // ─── Setup Dialog ─────────────────────────────────────────────
        containerEl.createEl('h3', { cls: 'agent-settings-section', text: t('settings.interface.headingSetup') });

        if (this.plugin.memoryService) {
            const onboarding = new OnboardingService(this.plugin.memoryService, this.plugin);
            const isComplete = !onboarding.needsOnboarding();

            const setupSetting = new Setting(containerEl)
                .setName(t('settings.interface.guidedSetup'))
                .setDesc(
                    isComplete
                        ? t('settings.interface.setupCompleted')
                        : t('settings.interface.setupNotStarted'),
                );

            setupSetting.addButton((b) =>
                b.setButtonText(isComplete ? t('settings.interface.restartSetup') : t('settings.interface.startSetup')).setCta().onClick(async () => {
                    await onboarding.reset();
                    await this.plugin.startOnboarding();
                }),
            );

            if (!isComplete) {
                setupSetting.addButton((b) =>
                    b.setButtonText(t('settings.interface.skipSetup')).onClick(async () => {
                        await onboarding.markCompleted();
                        new Notice(t('settings.interface.setupSkipped'));
                        this.rerender();
                    }),
                );
            }
        } else {
            new Setting(containerEl)
                .setName(t('settings.interface.guidedSetup'))
                .setDesc(t('settings.interface.memoryNotAvailable'));
        }

        // ─── Interface Settings ───────────────────────────────────────
        containerEl.createEl('h3', { cls: 'agent-settings-section', text: t('settings.interface.headingInterface') });
        new Setting(containerEl)
            .setName(t('settings.interface.autoAddActiveNote'))
            .setDesc(t('settings.interface.autoAddActiveNoteDesc'))
            .addToggle((tog) =>
                tog.setValue(this.plugin.settings.autoAddActiveFileContext).onChange(async (v) => {
                    this.plugin.settings.autoAddActiveFileContext = v;
                    await this.plugin.saveSettings();
                }),
            );

        new Setting(containerEl)
            .setName(t('settings.interface.sendWithEnter'))
            .setDesc(t('settings.interface.sendWithEnterDesc'))
            .addToggle((tog) =>
                tog.setValue(this.plugin.settings.sendWithEnter ?? true).onChange(async (v) => {
                    this.plugin.settings.sendWithEnter = v;
                    await this.plugin.saveSettings();
                }),
            );

        new Setting(containerEl)
            .setName('Global hotkey (desktop)')
            .setDesc('Register a system-wide hotkey to open the agent sidebar (requires Obsidian Desktop restart on some systems).')
            .addToggle((tog) =>
                tog.setValue(this.plugin.settings.globalHotkeyEnabled ?? false).onChange(async (v) => {
                    this.plugin.settings.globalHotkeyEnabled = v;
                    await this.plugin.saveSettings();
                    new Notice('Global hotkey updated. If it does not work immediately, restart Obsidian Desktop.');
                }),
            );

        new Setting(containerEl)
            .setName('Global hotkey accelerator')
            .setDesc('Electron accelerator string, e.g. CommandOrControl+L')
            .addText((txt) =>
                txt.setPlaceholder('CommandOrControl+L')
                    .setValue(this.plugin.settings.globalHotkeyAccelerator ?? 'CommandOrControl+L')
                    .onChange(async (v) => {
                        this.plugin.settings.globalHotkeyAccelerator = v.trim();
                        await this.plugin.saveSettings();
                    }),
            );

        new Setting(containerEl)
            .setName(t('settings.interface.includeTime'))
            .setDesc(t('settings.interface.includeTimeDesc'))
            .addToggle((tog) =>
                tog.setValue(this.plugin.settings.includeCurrentTimeInContext ?? true).onChange(async (v) => {
                    this.plugin.settings.includeCurrentTimeInContext = v;
                    await this.plugin.saveSettings();
                }),
            );

        new Setting(containerEl)
            .setName(t('settings.interface.noteResponseBlocksFormat'))
            .setDesc(t('settings.interface.noteResponseBlocksFormatDesc'))
            .addDropdown((d) => {
                d.addOption('callout', t('settings.interface.noteResponseBlocksFormatCallout'));
                d.addOption('headings', t('settings.interface.noteResponseBlocksFormatHeadings'));
                d.addOption('details', t('settings.interface.noteResponseBlocksFormatDetails'));
                d.addOption('codefence', t('settings.interface.noteResponseBlocksFormatCodeFence'));
                d.addOption('footer', t('settings.interface.noteResponseBlocksFormatFooter'));
                d.setValue(this.plugin.settings.noteResponseBlocksFormat ?? 'callout');
                d.onChange(async (v) => {
                    this.plugin.settings.noteResponseBlocksFormat = v as typeof this.plugin.settings.noteResponseBlocksFormat;
                    await this.plugin.saveSettings();
                });
            });

        new Setting(containerEl)
            .setName('Show context progress')
            .setDesc('Display a progress bar showing context window usage. Restart sidebar to apply.')
            .addToggle((toggle) =>
                toggle.setValue(this.plugin.settings.showContextProgress).onChange(async (value) => {
                    this.plugin.settings.showContextProgress = value;
                    await this.plugin.saveSettings();
                    new Notice('Please restart the sidebar (close & reopen) to apply changes.');
                })
            );

        containerEl.createEl('h3', { cls: 'agent-settings-section', text: t('settings.interface.headingHistory') });

        new Setting(containerEl)
            .setName(t('settings.interface.historyFolder'))
            .setDesc(t('settings.interface.historyFolderDesc'))
            .addText((txt) =>
                txt.setPlaceholder(t('settings.interface.historyPlaceholder'))
                    .setValue((this.plugin.settings as unknown as Record<string, unknown>)['chatHistoryFolder'] as string ?? '')
                    .onChange(async (v) => {
                        const folder = v.trim();
                        (this.plugin.settings as unknown as Record<string, unknown>)['chatHistoryFolder'] = folder;
                        await this.plugin.saveSettings();
                        if (folder) {
                            const { ChatHistoryService } = await import('../../core/ChatHistoryService');
                            this.plugin.chatHistoryService = new ChatHistoryService(this.plugin.app.vault, folder);
                        } else {
                            this.plugin.chatHistoryService = null;
                        }
                    }),
            );

        // ─── Chat Linking (ADR-022) ─────────────────────────────────────
        containerEl.createEl('h3', { cls: 'agent-settings-section', text: t('settings.interface.headingChatLinking') });

        const cl = this.plugin.settings.chatLinking;

        new Setting(containerEl)
            .setName(t('settings.interface.chatLinkingToggle'))
            .setDesc(t('settings.interface.chatLinkingToggleDesc'))
            .addToggle((tog) =>
                tog.setValue(cl.enabled).onChange(async (v) => {
                    this.plugin.settings.chatLinking.enabled = v;
                    await this.plugin.saveSettings();
                }),
            );

        const models = this.plugin.settings.activeModels.filter((m) => m.enabled);
        if (models.length === 0) {
            new Setting(containerEl)
                .setName(t('settings.interface.chatLinkingModel'))
                .setDesc(t('settings.interface.chatLinkingNoModels'));
        } else {
            new Setting(containerEl)
                .setName(t('settings.interface.chatLinkingModel'))
                .setDesc(t('settings.interface.chatLinkingModelDesc'))
                .addDropdown((d) => {
                    d.addOption('', t('settings.interface.chatLinkingSelectModel'));
                    for (const m of models) {
                        d.addOption(getModelKey(m), m.displayName ?? m.name);
                    }
                    d.setValue(cl.titlingModelKey);
                    d.onChange(async (v) => {
                        this.plugin.settings.chatLinking.titlingModelKey = v;
                        await this.plugin.saveSettings();
                    });
                });
        }
    }

}
