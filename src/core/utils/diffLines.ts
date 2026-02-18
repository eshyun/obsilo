/**
 * Simple line-level diff using the Myers diff algorithm.
 * Returns an array of DiffLine objects describing which lines were added,
 * removed, or unchanged between oldText and newText.
 */

export interface DiffLine {
    type: 'added' | 'removed' | 'unchanged';
    content: string;
}

export interface DiffStats {
    added: number;
    removed: number;
}

export function diffLines(oldText: string, newText: string): DiffLine[] {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');

    // Myers shortest-edit-script via dynamic-programming LCS table
    const lcs = buildLCS(oldLines, newLines);
    return buildDiff(oldLines, newLines, lcs);
}

export function getDiffStats(lines: DiffLine[]): DiffStats {
    let added = 0;
    let removed = 0;
    for (const l of lines) {
        if (l.type === 'added') added++;
        else if (l.type === 'removed') removed++;
    }
    return { added, removed };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function buildLCS(a: string[], b: string[]): number[][] {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (a[i - 1] === b[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
            }
        }
    }
    return dp;
}

function buildDiff(a: string[], b: string[], dp: number[][]): DiffLine[] {
    const result: DiffLine[] = [];
    let i = a.length;
    let j = b.length;

    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
            result.unshift({ type: 'unchanged', content: a[i - 1] });
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            result.unshift({ type: 'added', content: b[j - 1] });
            j--;
        } else {
            result.unshift({ type: 'removed', content: a[i - 1] });
            i--;
        }
    }

    return result;
}
