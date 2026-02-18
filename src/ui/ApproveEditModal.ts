/**
 * ApproveEditModal
 *
 * Shows a unified line-by-line diff of a proposed file change.
 * The user can Accept or Reject before the change is applied.
 *
 * Inspired by Obsidian Copilot's ApplyView pattern, adapted to vanilla Obsidian API.
 */

import { App, Modal, setIcon } from 'obsidian';
import { diffLines, getDiffStats } from '../core/utils/diffLines';

/** Number of unchanged lines to show around a changed block before collapsing. */
const CONTEXT_LINES = 3;

export class ApproveEditModal extends Modal {
    private resolved = false;

    constructor(
        app: App,
        private filePath: string,
        private oldContent: string,
        private newContent: string,
        private onDecision: (accepted: boolean) => void,
    ) {
        super(app);
        this.modalEl.addClass('approve-edit-modal');
    }

    onOpen(): void {
        const { contentEl, titleEl } = this;

        const lines = diffLines(this.oldContent, this.newContent);
        const stats = getDiffStats(lines);

        titleEl.setText('Review Changes');

        // Header: file path + stats
        const header = contentEl.createDiv('approve-edit-header');
        const pathEl = header.createDiv('approve-edit-path');
        setIcon(pathEl.createSpan('approve-edit-path-icon'), 'file-text');
        pathEl.createSpan('approve-edit-path-text').setText(this.filePath);

        const statsEl = header.createDiv('approve-edit-stats');
        if (stats.added > 0) {
            statsEl.createSpan({ cls: 'diff-stat-added', text: `+${stats.added}` });
        }
        if (stats.removed > 0) {
            statsEl.createSpan({ cls: 'diff-stat-removed', text: `-${stats.removed}` });
        }
        if (stats.added === 0 && stats.removed === 0) {
            statsEl.createSpan({ cls: 'diff-stat-none', text: 'No changes' });
        }

        // Diff view
        const diffEl = contentEl.createDiv('approve-edit-diff');
        this.renderDiff(diffEl, lines);

        // Footer buttons
        const footer = contentEl.createDiv('approve-edit-footer');

        const rejectBtn = footer.createEl('button', { cls: 'approve-edit-reject', text: 'Reject' });
        rejectBtn.addEventListener('click', () => this.decide(false));

        const acceptBtn = footer.createEl('button', { cls: 'mod-cta approve-edit-accept', text: 'Accept' });
        acceptBtn.addEventListener('click', () => this.decide(true));
    }

    onClose(): void {
        // If closed without clicking Accept/Reject, treat as rejected
        if (!this.resolved) {
            this.onDecision(false);
        }
    }

    private decide(accepted: boolean): void {
        this.resolved = true;
        this.onDecision(accepted);
        this.close();
    }

    private renderDiff(container: HTMLElement, lines: ReturnType<typeof diffLines>): void {
        // Group lines into blocks: changed regions + context
        const groups = this.groupLines(lines);

        for (const group of groups) {
            if (group.type === 'collapse') {
                const btn = container.createEl('button', {
                    cls: 'diff-collapse-btn',
                    text: `... ${group.count} unchanged lines`,
                });
                const captured = group;
                btn.addEventListener('click', () => {
                    btn.remove();
                    for (const l of captured.lines) {
                        this.renderLine(container, l);
                    }
                });
            } else {
                for (const l of group.lines) {
                    this.renderLine(container, l);
                }
            }
        }
    }

    private renderLine(container: HTMLElement, line: ReturnType<typeof diffLines>[number]): void {
        const row = container.createDiv(`diff-line diff-line-${line.type}`);
        const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
        row.createSpan({ cls: 'diff-line-prefix', text: prefix });
        row.createSpan({ cls: 'diff-line-content', text: line.content });
    }

    /**
     * Group the diff lines so that long unchanged blocks can be collapsed,
     * while keeping CONTEXT_LINES of context around each changed region.
     */
    private groupLines(lines: ReturnType<typeof diffLines>): Array<
        | { type: 'show'; lines: typeof lines }
        | { type: 'collapse'; count: number; lines: typeof lines }
    > {
        // Mark which indices are "near a change"
        const changed = lines.map((l) => l.type !== 'unchanged');
        const visible = new Array(lines.length).fill(false);

        for (let i = 0; i < lines.length; i++) {
            if (changed[i]) {
                for (let j = Math.max(0, i - CONTEXT_LINES); j <= Math.min(lines.length - 1, i + CONTEXT_LINES); j++) {
                    visible[j] = true;
                }
            }
        }

        const result: Array<
            | { type: 'show'; lines: typeof lines }
            | { type: 'collapse'; count: number; lines: typeof lines }
        > = [];
        let i = 0;

        while (i < lines.length) {
            if (visible[i]) {
                const start = i;
                while (i < lines.length && visible[i]) i++;
                result.push({ type: 'show', lines: lines.slice(start, i) });
            } else {
                const start = i;
                while (i < lines.length && !visible[i]) i++;
                const collapsed = lines.slice(start, i);
                if (collapsed.length <= CONTEXT_LINES * 2) {
                    // Too few to bother collapsing
                    result.push({ type: 'show', lines: collapsed });
                } else {
                    result.push({ type: 'collapse', count: collapsed.length, lines: collapsed });
                }
            }
        }

        return result;
    }
}
