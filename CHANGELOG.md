# Changelog

## 2.2.12

- Fixed GitHub Actions release workflow failing on Linux by ensuring platform-specific Rollup binary packages are treated as optional.

## 2.2.11

- Fixed GitHub Actions release workflow failing on Linux due to a platform-specific dev dependency.

## 2.2.10

- Fixed potential document-level event listener leaks when closing UI popovers (vault file picker, tool picker) and source citation popups.

## 2.2.9

- Fixed response export formatting for machine-readable blocks (`[sources]` / `[followups]`) to be more tolerant of malformed blocks (e.g. missing closing tags) and non-numbered source lines (e.g. plain URLs), especially when using Callout format.
- Improved macOS keyboard shortcut reliability for sending messages when **Send with enter** is off by handling `Cmd+Enter` at a higher-priority capture stage.
- Added `Esc` as a shortcut to cancel a running agent request while "Working..." is shown.

## 2.2.8

- Added a configurable export format for machine-readable response blocks (`[sources]` / `[followups]`) when using **Create note from response** and **Insert at cursor** (Settings → Advanced → Interface → Response blocks format).
- Fixed macOS keyboard shortcut handling when **Send with enter** is off: `Cmd+Enter` now sends reliably (also supports `NumpadEnter`).
