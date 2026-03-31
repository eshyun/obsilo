# Implementation Notes

## Response export: `[sources]` / `[followups]` formatting

### Background

Agent responses may include machine-readable blocks:

- `[sources] ... [/sources]`
- `[followups heading="..."] ... [/followups]`

These are intentionally not standard Markdown so the chat UI can parse them and render citations/followups with custom UX.

### Change

When using **Create note from response**, the plugin now converts these blocks into standard Markdown before creating the note.

- Setting: `noteResponseBlocksFormat`
- UI: Settings → Advanced → Interface → **Response blocks format**
- Supported values:
  - `callout` (default)
  - `headings`
  - `details`
  - `codefence`
  - `footer`

### Implementation

- `AgentSidebarView` continues to parse `[sources]` and `[followups]` for the chat UI.
- For note export only, `formatResponseForNote()` re-parses the raw response text and renders the configured Markdown blocks.
- The export parser is intentionally tolerant:
  - It accepts missing closing tags (`[/sources]`, `[/followups]`) by treating the block as running to end-of-text.
  - It accepts non-numbered source lines (e.g., plain URLs) and auto-numbers them for rendering.

## Keyboard shortcut: macOS Cmd+Enter when "Send with enter" is off

### Background

When `sendWithEnter` is disabled, messages should be sent with `Ctrl+Enter` on Windows/Linux and `Cmd+Enter` on macOS.

### Change

The textarea keydown handler now:

- Recognizes both `Enter` and `NumpadEnter`
- Handles keydown at document level in the capture phase (only when the textarea is focused)
- Calls `stopPropagation()` when triggering send in `sendWithEnter = false` mode

### Cancel shortcut

While a request is in-flight ("Working..." / stop button visible), pressing `Esc` triggers `handleStop()` which aborts the current request and restores the input state.

This makes `Cmd+Enter` more reliable in Electron/Obsidian environments where parent handlers may consume the event.

## Keyboard shortcut: open agent sidebar and focus input (Cmd+L)

### Behavior

The plugin registers a command with a default hotkey (`Mod+L`):

- Opens/reveals the agent sidebar view
- Focuses the message input textarea
- If the sidebar is already open and the textarea is already focused, it starts a new session (clears the current conversation)

### Selected text context

If the hotkey is triggered while a Markdown editor has selected text, the selection is queued and injected into the **next** user message sent to the LLM as a `<context>` block.

This selection context is **one-shot**:

- It is consumed on the next send
- It is not rendered as a user message bubble (it only affects the message payload)

## UI cleanup: prevent document-level event listener leaks

### Background

Some UI popovers/popups attach document-level event listeners (e.g. click-outside handlers). If the UI element is closed programmatically (e.g. `hide()`/`remove()` called directly) instead of via the listener itself, the listener may not be removed, potentially leaking closures and accumulating handlers.

### Change

- `VaultFilePicker` now stores the outside-click handler and always removes it in `hide()`, regardless of how the picker is closed.
- `AgentSidebarView` source popups now track their click-outside handler in a `WeakMap` and explicitly detach it whenever popups are removed programmatically or via internal navigation clicks.
