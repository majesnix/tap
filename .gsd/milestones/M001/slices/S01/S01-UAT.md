# S01: Keyboard Shortcuts + Field Copy — UAT

**Milestone:** M001
**Written:** 2026-05-25T19:34:12.260Z

# S01: Keyboard Shortcuts + Field Copy — UAT

**Milestone:** M001
**Written:** 2026-05-25

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: All shortcuts and copy behavior are exercised by integration tests that dispatch real KeyboardEvents and verify state changes. No runtime server or RabbitMQ connection is needed — the slice is purely frontend UI behavior testable in jsdom.

## Preconditions

- Node 20+ with pnpm installed
- `pnpm install` completed in worktree
- No dev server required (tests run in jsdom)

## Smoke Test

Run `pnpm vitest run src/__tests__/keyboard-shortcuts.test.tsx` — all 12 tests pass, confirming all shortcuts fire and produce expected state changes.

## Test Cases

### 1. Cmd+Enter sends message from form

1. Load a proto file and fill in form fields
2. Press Cmd+Enter (or Ctrl+Enter on Windows/Linux)
3. **Expected:** `sendRequested` counter in useProtoStore increments; PublishBar triggers message send

### 2. Cmd+Enter sends message from CodeMirror JSON editor

1. Toggle JSON editor mode in FormPanel
2. Focus the CodeMirror editor
3. Press Cmd+Enter
4. **Expected:** CodeMirror keymap extension fires, `sendRequested` increments (window handler skips due to `.cm-editor` target check to prevent double-fire)

### 3. Cmd+Shift+R clears form

1. Fill in several form fields with values
2. Press Cmd+Shift+R
3. **Expected:** All form fields reset to defaults via `setPendingReplayValues({})`

### 4. Cmd+O opens file picker

1. Press Cmd+O from anywhere in the app
2. **Expected:** `openFileRequested` counter increments; FileSection triggers native file picker dialog

### 5. Cmd+1/2/3 switches tabs

1. Press Cmd+1
2. **Expected:** First tab in RightPanel becomes active (data-state='active')
3. Press Cmd+2
4. **Expected:** Second tab becomes active
5. Press Cmd+3
6. **Expected:** Third tab becomes active

### 6. Clear button resets form

1. Fill in form fields
2. Click the Clear button (RotateCcw icon) in FormPanel header
3. **Expected:** All fields reset to defaults

### 7. Copy icon on scalar field

1. Hover over a filled scalar field label
2. **Expected:** Copy icon appears (group-hover reveal)
3. Click the copy icon
4. **Expected:** Icon swaps to checkmark for 1500ms, field value written to clipboard

### 8. Shortcut tooltips are platform-correct

1. Hover over Send button
2. **Expected:** Tooltip shows "⌘+Enter" on macOS, "Ctrl+Enter" on Windows/Linux
3. Hover over Clear button
4. **Expected:** Tooltip shows platform-correct shortcut
5. Hover over RightPanel tab triggers
6. **Expected:** Each shows platform-correct Cmd+N / Ctrl+N shortcut

## Edge Cases

### Copy on empty field

1. Hover over an empty scalar field
2. Click the copy icon
3. **Expected:** Empty string written to clipboard, checkmark feedback still shows

### Rapid copy clicks

1. Click copy icon on a field
2. Immediately click copy on a different field
3. **Expected:** Both show checkmark independently; no stacking or visual glitch

### Cmd+Enter with no proto loaded

1. Press Cmd+Enter with no proto file loaded
2. **Expected:** sendRequested increments but PublishBar's send logic handles the empty state gracefully (no crash)

## Failure Signals

- Any keyboard shortcut not firing → check react-hotkeys-hook registration and `enableOnFormTags` config
- Copy icon not appearing on hover → check Tailwind group/group-hover classes
- Double-fire on Cmd+Enter in CodeMirror → check `.cm-editor` target guard in window handler
- Tab switch not working → check `setActiveTabRef.current` is connected

## Not Proven By This UAT

- Real Tauri native file picker dialog opening (mocked in tests)
- Actual RabbitMQ message send (PublishBar send is mocked)
- Real clipboard API in Tauri webview (navigator.clipboard.writeText is mocked)
- Shortcut behavior on Windows/Linux (tests use ctrlKey mapping, but no real cross-platform verification)

## Notes for Tester

- react-hotkeys-hook v5 requires `code` property on KeyboardEvents — standard `fireEvent.keyDown` from testing-library does not set this, so tests use native `new KeyboardEvent()` with `dispatchEvent`
- jsdom reports non-Mac user agent, so all tests use Ctrl modifiers; Mac-specific ⌘ behavior is only testable in a real browser
- The CodeMirror dual-registration pattern (window handler + CM keymap) is the most fragile part — if shortcuts double-fire in production, check the `.cm-editor` closest() guard
