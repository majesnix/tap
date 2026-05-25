# GSD context snapshot (2026-05-25T21:21:37.470Z)

## Active context
Active: M001 / S05 / T03 - Add SchemaExplorer tests covering tree rendering, recursion guard, and click-to-select

## Top project memories
- [MEM008] (gotcha) react-hotkeys-hook v5 useHotkeys does not fire with fireEvent.keyDown in jsdom. Must use native `new KeyboardEvent` with explicit `code` property and dispatch via `document.dispatchEvent`. Use `ctrlKey: true` (not `metaKey`) since jsdom reports non-Mac user agent.
- [MEM009] (pattern) Cross-component action signaling uses monotonic counter pattern in useProtoStore (sendRequested, openFileRequested). Consumer components watch the counter via useEffect and trigger their local action on increment. Avoids prop-drilling callback functions across component boundaries.
- [MEM001] (architecture) Keyboard shortcut library for React Chose: react-hotkeys-hook@^5.3.2. Rationale: Lightweight, well-maintained, supports enableOnFormTags for inhibit control, integrates with React lifecycle. Native addEventListener rejected for boilerplate and cleanup complexity..
- [MEM002] (architecture) Cmd+Enter registration strategy for CodeMirror coexistence Chose: Dual registration: window-level useHotkeys handler + CodeMirror keymap extension in JsonEditor. Window handler checks event.target.closest('.cm-editor') to prevent double-fire.. Rationale: CodeMirror captures keyboard events before they reach the window. Neither window-only nor CM-only handler covers all focus states..
- [MEM003] (architecture) Form reset and draft restore path Chose: All form resets (Clear, draft restore, randomizer) route through setPendingReplayValues. Never call resetRef.current() directly.. Rationale: setPendingReplayValues is the established mandatory form-fill path that correctly handles map/repeated fields via the mapReplaceRegistry pattern from Phase 25. Direct reset corrupts complex field sta….
- [MEM004] (architecture) Proto reload strategy for DescriptorPool Chose: reload_proto Rust command rebuilds entire Desc
…[truncated]
