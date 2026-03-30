# Plan Context: FEATURE-0901 AgentSidebarView Refactoring

> **Feature**: FEATURE-0901
> **Erstellt**: 2026-03-31

---

## 1. Ziel

AgentSidebarView.ts von 3937 LOC auf < 1000 LOC reduzieren durch Extraktion
von 4 Modulen. Reines Refactoring -- keine funktionalen Aenderungen.

## 2. Extraktions-Strategie

Jedes Modul wird als Klasse extrahiert die `plugin` und `app` im Constructor erhaelt.
Kommunikation ueber Callbacks (keine Event-Emitter).
AgentSidebarView bleibt koordinierendes Objekt.

Pattern (analog zu bestehenden Modulen):
```typescript
export class ChatRenderer {
    constructor(
        private plugin: ObsidianAgentPlugin,
        private app: App,
        private chatContainer: HTMLElement,
    ) {}

    // Extrahierte Methoden...
}
```

## 3. Module und ihre Methoden

### 3.1 SuggestionBanner.ts (NEU, ~120 LOC)

Methoden aus AgentSidebarView:
- `buildSuggestionBanner()` (Zeile 245)
- `refreshSuggestionBanner()` (Zeile 266)
- `openNotesSplit()` (Zeile 357)
- Properties: `suggestionBannerEl`, `suggestionBannerContainer`, `suggestionPollTimer`

### 3.2 OnboardingFlow.ts (NEU, ~200 LOC)

Methoden aus AgentSidebarView:
- `showWelcomeMessage()` (Zeile 986)
- `showFreeKeyInstructions()` (Zeile 1028)
- `showProviderSelection()` (Zeile 1056)
- `showNoModelSetupMessage()` (Zeile 1093)
- `disableOnboardingButtons()` (Zeile 1200)

Callback an View: `onSendMessage(text)` fuer Onboarding-Buttons die eine Nachricht senden.

### 3.3 ChatRenderer.ts (NEU, ~600 LOC)

Methoden aus AgentSidebarView:
- `createStreamingMessageEl()` (Zeile 2626)
- `getErrorTitle()` (Zeile 2656)
- `renderMarkdownMessage()` (Zeile 2680)
- `addUserMessage()` (Zeile 2688)
- `addUserMessageActions()` (Zeile 2723)
- `addAssistantMessage()` (Zeile 2776)
- `wireInternalLinks()` (Zeile 2913)
- `parseSources()` (Zeile 2935)
- `parseFollowups()` (Zeile 2960)
- `wireCitationBadges()` (Zeile 2977)
- `clampPopupToViewport()` (Zeile 3041)
- `attachPopupCloseHandler()` (Zeile 3063)
- `showSourcePopup()` (Zeile 3076)
- `showSourcesPanel()` (Zeile 3110)
- `addResponseActions()` (Zeile 3156)

### 3.4 ApprovalRenderer.ts (NEU, ~600 LOC)

Methoden aus AgentSidebarView:
- `renderTodoBox()` (Zeile 3255)
- `showQuestionCard()` (Zeile 3309)
- `buildHumanReadableExplanation()` (Zeile 3379)
- `truncateForApproval()` (Zeile 3439)
- `formatInputForDetails()` (Zeile 3447)
- `getToolGroup()` (Zeile 3559)
- `groupToPermKey()` (Zeile 3577)
- `renderCheckpointMarker()` (Zeile 3597)
- `deleteChatFromCheckpoint()` (Zeile 3701)
- `showUndoBar()` (Zeile 3892)
- `getToolIcon()` (Zeile 2871)
- `formatToolLabel()` (Zeile 2875)
- `getToolBriefParam()` (Zeile 2879)
- `formatGroupedLabel()` (Zeile 2887)

## 4. handleSendMessage aufbrechen

Die 1063-LOC-Methode wird in benannte Teilschritte aufgeteilt:

```typescript
private async handleSendMessage(): Promise<void> {
    const context = this.prepareMessageContext();
    if (!context) return;

    this.setRunningState(true);

    try {
        const systemPrompt = this.buildAgentSystemPrompt(context);
        const task = this.createAgentTask(systemPrompt, context);

        await this.runAgentLoop(task, context);
    } finally {
        this.setRunningState(false);
        this.postRunCleanup();
    }
}
```

Die Unterblocks (Tool-Rendering, Streaming-Callbacks, Approval-Callbacks)
werden als Methoden auf AgentSidebarView extrahiert, nicht in separate Module.

## 5. Reihenfolge

1. SuggestionBanner extrahieren -> Build -> Test
2. OnboardingFlow extrahieren -> Build -> Test
3. ChatRenderer extrahieren -> Build -> Test
4. ApprovalRenderer extrahieren -> Build -> Test
5. handleSendMessage aufbrechen -> Build -> Test

## 6. Verifikation pro Schritt

- `npm run build` erfolgreich
- `npx eslint src/ui/AgentSidebarView.ts src/ui/sidebar/*.ts` 0 Errors
- Obsidian Reload: Chat funktioniert, Approval funktioniert, Onboarding funktioniert
- `wc -l src/ui/AgentSidebarView.ts` sinkt nach jedem Schritt
