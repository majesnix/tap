# GSD context snapshot (2026-05-25T22:21:08.081Z)

## Top project memories
- [MEM008] (gotcha) react-hotkeys-hook v5 useHotkeys does not fire with fireEvent.keyDown in jsdom. Must use native `new KeyboardEvent` with explicit `code` property and dispatch via `document.dispatchEvent`. Use `ctrlKey: true` (not `metaKey`) since jsdom reports non-Mac user agent.
- [MEM017] (gotcha) Tailwind 4 purges dynamic class names like `pl-${depth*4}` — they will not appear in the built CSS. For depth-based indentation in components, use inline `style={{paddingLeft: depth * Npx}}` instead. Discovered in SchemaExplorer (M001-S05-T02).
- [MEM009] (pattern) Cross-component action signaling uses monotonic counter pattern in useProtoStore (sendRequested, openFileRequested). Consumer components watch the counter via useEffect and trigger their local action on increment. Avoids prop-drilling callback functions across component boundaries.
- [MEM016] (pattern) Recursive schema-tree rendering in React: combine a visited-set carried through render with a hard MAX_DEPTH cap (e.g. 5). Either alone is insufficient — visited-set misses non-cyclic deep nesting; depth cap misses cycles at shallow depth. SchemaExplorer (src/components/sidebar/SchemaExplorer.tsx) is the reference impl.
- [MEM018] (pattern) Per-test store mock reset in Vitest: in beforeEach call `vi.resetModules()` then dynamic-import the SUT after re-mocking the store with `vi.mock`. Ensures each test gets a fresh store instance without cross-test leakage. Used in SchemaExplorer.test.tsx (M001-S05-T03) for useProtoStore.
- [MEM001] (architecture) Keyboard shortcut library for React Chose: react-hotkeys-hook@^5.3.2. Rationale: Lightweight, well-maintained, supports enableOnFormTags for inhibit control, integrates with React lifecycle. Native addEventListener rejected for boilerplate and cleanup complexity..

## Recent gsd_exec runs
- [10cdd029-3873-4780-ae34-16e29a4a0f63] bash exit:0 — enumerate planning directory structure
- [ceab2790-daae-4f89-a600-399e280e94
…[truncated]
