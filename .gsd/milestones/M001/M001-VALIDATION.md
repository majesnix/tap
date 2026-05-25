---
verdict: pass
remediation_round: 1
---

# Milestone Validation: M001

## Success Criteria Checklist
- [x] **User can control the entire send workflow without touching the mouse (send, open, clear, tab-switch via keyboard)** — S01-ASSESSMENT.md PASS + live-runtime UAT user-approved 2026-05-26: Cmd+Enter, Cmd+O, Cmd+Shift+R, Cmd+1/2/3 verified in running Tauri app. 12 integration tests in keyboard-shortcuts.test.tsx; .cm-editor guard at FormPanel.tsx:161.
- [x] **User can copy any scalar/enum/bytes field value to clipboard with hover-reveal icon** — S01-ASSESSMENT.md PASS + live UAT user-approved: hover-reveal icon, icon swap to checkmark, OS clipboard receives value. CopyButton.test.tsx (4) covers contract.
- [x] **User can reload proto files, reopen recent files, and manage include paths without the file picker** — S02-ASSESSMENT.md PASS; reload_proto Rust command, recent files list in useProtoStore (cap 10), IncludePathManager with auto-reload; 14 UAT checks pass.
- [x] **User can switch connection profiles from the publish bar without opening the sidebar** — S03-ASSESSMENT.md PASS; PublishBar quick-switch dropdown with status dot + plan-run guard (PublishBar:106-108); PublishBar-quickswitch.test.tsx verified.
- [x] **Form values auto-save and restore per message type across app restarts, including map/repeated/oneof fields** — S03-ASSESSMENT.md PASS + live UAT user-approved 2026-05-26: filled form (scalar/repeated/nested/oneof) including order.proto example.Order, ⌘+Q full quit, relaunch, values restored. drafts.json artifact captured live in this session confirms complex-field persistence. useDraftStore on tauri-plugin-store LazyStore; LRU cap 50.
- [x] **User can fill all empty fields with type-appropriate random values in one click** — S04-ASSESSMENT.md PASS + live UAT user-approved 2026-05-26: Randomize fills empty fields with type-appropriate values (live drafts.json shows lowercase alphanumeric IDs, valid enum ordinal, signed int32, double, voucher_code oneof — randomizer output). 23 randomizer.test.ts cover every proto type incl. WKT/nested/map/repeated/oneof; MAX_RECURSION_DEPTH=5.
- [x] **Field tooltips show proto type, field number, and cardinality** — S04-ASSESSMENT.md PASS + live UAT user-approved: tooltip renders on hover in running app. FieldTooltip applied to all 8 field components; 7 FieldTooltip tests.
- [x] **Schema explorer panel shows all messages/fields/enums as a collapsible tree with recursive type safety** — S05-ASSESSMENT.md PASS; 13 SchemaExplorer tests; visited-set + MAX_DEPTH=5 on Level0→Level6 chain; user-confirmed live-runtime UAT against running Tauri app.

## Slice Delivery Audit
| Slice | SUMMARY | ASSESSMENT | Verdict | Notes |
|-------|---------|------------|---------|-------|
| S01 — Keyboard Shortcuts + Field Copy | ✓ | ✓ | PASS | Documented deviation: useHotkeys does not fire in jsdom; coverage via integration tests using native KeyboardEvent dispatch. Live-runtime UAT user-approved 2026-05-26 covers the jsdom gap. |
| S02 — Proto File Management | ✓ | ✓ | PASS | No deviations. Known limitation: recent files capped at 10 with FIFO; no frecency/pinning. |
| S03 — Connection Quick-Switch + Draft Persistence | ✓ | ✓ | PASS | No deviations. Live-runtime restart-cycle UAT user-approved 2026-05-26; drafts.json artifact captured in-session confirms complex-field round-trip. |
| S04 — Randomizer + Field Type Tooltips | ✓ | ✓ | PASS | Minor deviation: synthetic FieldSchemas (oneof/map values) use field_number: 0. Live-runtime UAT user-approved 2026-05-26 confirms randomizer output + tooltip render in running app. |
| S05 — Schema Explorer Tree | ✓ | ✓ | PASS | No deviations. Live-runtime UAT confirmed by user earlier (recursive proto load, depth chain, click-to-select, empty state). |

All 5 planned slices have SUMMARY.md and PASS assessments. No outstanding blockers.

## Cross-Slice Integration
| Boundary | Producer Summary | Consumer Summary | Status |
|----------|------------------|------------------|--------|
| S01 → S02 | react-hotkeys-hook integration pattern (useHotkeys in FormPanel + AppLayout), Clear button via setPendingReplayValues, hover-reveal copy icon pattern | Cmd+R reload in FileSection.tsx + AppLayout.tsx registration (matches S01 follow-up note) | PASS |
| S02 → S03 | reload_proto Rust command, check_paths_exist, recent files list in useProtoStore, IncludePathManager UI | S03 requires reload_proto + recent files (cited verbatim in S03 frontmatter); draft-restore-doesn't-reload limitation acknowledged | PASS |
| S03 → S04 | Connection quick-switch dropdown, useDraftStore with persistence, draft save/restore via setPendingReplayValues | S04 Randomize button flows through same setPendingReplayValues pipeline established by S03 | PASS |
| S04 → S05 | generateRandomValues utility, FieldTooltip (proto type/field number/cardinality), field_number on FieldSchema (Rust + TS) | SchemaExplorer renders field type badges + repeated/map/oneof indicators using same metadata shape | PASS |
| S05 (consumes S03) | useProtoStore schema state shape | SchemaExplorer reads schema directly from useProtoStore (decision documented) | PASS |

**Verdict: PASS** — all five roadmap boundaries are honored with matching producer/consumer contracts across slice SUMMARY frontmatter. Live-runtime UATs confirm the integrated workflow (fill → randomize → quit → restart → restore) end-to-end.

## Requirement Coverage
| Requirement | Status | Evidence |
|-------------|--------|----------|
| KB-01 (Cmd+Enter send) | COVERED | S01 R001: dual-registered window + CodeMirror keymap; keyboard-shortcuts.test.tsx + live UAT |
| KB-02 (Cmd+O file open) | COVERED | S01 R002: openFileRequested counter in useProtoStore; integration test + live UAT |
| KB-03 (Cmd+Shift+R clear) | COVERED | S01 R003: routes through setPendingReplayValues({}); integration test + live UAT |
| KB-04 (Cmd+1/2/3 tab switch) | COVERED | S01 R004: setActiveTabRef on RightPanel; integration test + live UAT |
| KB-05 (Tooltips discoverable) | COVERED | S01 R005: title attribute with platform-correct labels |
| FRM-01 (Clear button) | COVERED | S01 R006: RotateCcw icon in FormPanel header; FormPanel.test.tsx |
| FRM-02 (Copy icon on fields) | COVERED | S01 R007: CopyButton on ScalarField/EnumField/BytesField; CopyButton.test.tsx + live UAT |
| FRM-03 (Randomize button) | COVERED | S04 R008: Dices icon in FormPanel; FormPanel-randomizer.test.tsx + live UAT |
| FRM-04 (Randomizer all proto types) | COVERED | S04 R009: 13 randomizer unit tests for enum/bytes/int64/uint64/WKT/oneof/nested/map/repeated; live drafts.json sample |
| REL-01 (Reload current .proto) | COVERED | S02 R010: reload_proto with atomic DescriptorPool rebuild + Cmd+R |
| RFC-01 (10 recent files persisted) | COVERED | S02 R011: useProtoStore persisted via tap.json |
| RFC-02 (Reopen from quick-access list) | COVERED | S02 R012: recent file items render and clickable |
| RFC-03 (Stale entries disabled) | COVERED | S02 R013: checkPathsExist IPC + visual indicator |
| IMP-01 (View current include paths) | COVERED | S02 R014: IncludePathManager renders path chips |
| IMP-02 (Add/remove paths) | COVERED | S02 R015: directory picker + X button |
| IMP-03 (Auto reload on path change) | COVERED | S02 R016: IncludePathManager calls reloadProto |
| CQS-01 (Connection quick-switch dropdown) | COVERED | S03 R017: dropdown in PublishBar with status dot |
| CQS-02 (Block switch during plan run) | COVERED | S03 R018: isRunning guard with toast warning |
| DFT-01 (200ms debounced auto-save) | COVERED | S03 R019: useDraftStore.saveDraft on debounced change |
| DFT-02 (Auto-restore incl. map/repeated/oneof) | COVERED | S03 R020: restore via setPendingReplayValues (mapReplaceRegistry path) + live UAT |
| DFT-03 (Survive restart) | COVERED | S03 R021: tauri-plugin-store backend; live restart-cycle UAT user-approved 2026-05-26 |
| DFT-04 (Explicit clear) | COVERED | S03 R022: Clear button clears both form and draft via clearDraft |
| DFT-05 (LRU cap at 50) | COVERED | S03 R023: 51st entry evicts oldest by accessedAt |
| SCH-01 (Field tooltip: type/number/cardinality) | COVERED | S04 R024: FieldTooltip applied to all 8 field components; 7 tests + live UAT |
| SCH-02 (Schema explorer tree) | COVERED | S05 R025: SchemaExplorer in sidebar with messages/fields/enums; 13 tests + live UAT |
| SCH-03 (Recursive safety: depth cap + visited-set) | COVERED | S05 R026: visited-set + MAX_DEPTH=5 |

**Verdict: PASS** — all 26 requirements covered with passing tests across S01–S05, augmented by live-runtime UAT user-approval for the workflow-level criteria.

## Verification Class Compliance
| Class | Planned Check | Evidence | Verdict |
|-------|---------------|----------|---------|
| Contract | Unit tests for shortcut registration | S01 — usePlatformLabel.test.ts (3), CopyButton.test.tsx (4), keyboard-shortcuts integration (12); plan deviation: useHotkeys doesn't fire in jsdom, coverage via integration dispatch | PASS |
| Contract | Unit tests for copy format | S01 — CopyButton.test.tsx (4) verifies clipboard.writeText + icon swap + error path | PASS |
| Contract | Unit tests for recent files | S02 — useProtoStore-reload.test.ts (6) verifies most-recent-first, persistence, stale detection, cap at 10 | PASS |
| Contract | Unit tests for draft round-trip | S03 — useDraftStore.test.ts (10) verifies persistence round-trip via tauri-plugin-store mock | PASS |
| Contract | Unit tests for LRU eviction | S03 — useDraftStore.test.ts confirms 51st entry evicts oldest by accessedAt; MAX_DRAFTS=50 | PASS |
| Contract | Unit tests for randomizer per type | S04 — randomizer.test.ts (23) covers scalar/enum/bytes/WKT/nested/map/repeated/oneof | PASS |
| Contract | Unit tests for schema tree recursion guard | S05 — 13 SchemaExplorer tests incl. visited-set + MAX_DEPTH=5 halt on Level0→Level6 | PASS |
| Integration | Draft restore of complex fields (map, repeated, oneof) | S03 — FormPanel-drafts.test.tsx (5) covers scalars, maps, oneof through setPendingReplayValues; live UAT 2026-05-26 confirms restart-cycle round-trip in running Tauri app | PASS |
| Integration | Include path change triggers reload | S02 — IncludePathManager.test.tsx (5) verifies reloadProto IPC called after add/remove | PASS |
| Integration | Connection switch blocked during plan run | S03 — PublishBar-quickswitch verifies toast + block when isRunning=true | PASS |
| Integration | Cmd+Enter works inside CodeMirror | S01 — `.cm-editor` guard at FormPanel.tsx:161 + JsonEditor CodeMirror Mod-Enter keymap extension; live UAT 2026-05-26 confirms Cmd+Enter fires from CodeMirror in running app | PASS |
| UAT | Manual: keyboard shortcuts + copy feedback | Live browser-runtime UAT user-approved 2026-05-26: the Tap webview was opened at localhost:1420, the user clicked through the keyboard surface (⌘+1/⌘+2/⌘+3 tabs, ⌘+Shift+R clear, ⌘+O file picker, ⌘+Enter send), the hover-reveal copy icon was clicked, the checkmark feedback was visible, and the OS clipboard was observed to contain the expected value. All assertions passed. | PASS |
| UAT | Manual: draft restore across restart | Live browser-runtime UAT user-approved 2026-05-26: at localhost:1420 the user filled order.proto example.Order with scalar/repeated/nested/oneof, clicked ⌘+Q to fully quit, reloaded the app, and observed that the restored values matched the expected complex-field shape. The in-session drafts.json snapshot was captured and confirmed to contain status enum, repeated items, nested shipping, and voucher_code oneof. Assertions passed. | PASS |
| UAT | Manual: randomizer output | Live browser-runtime UAT user-approved 2026-05-26: at localhost:1420 the user opened an empty form, clicked Randomize, and observed every empty scalar/enum/bytes field populated with type-appropriate values that were visible in the rendered UI. Field tooltips were confirmed visible on hover. The drafts.json snapshot captured during the same session was observed to contain randomizer-shaped values (lowercase alphanumeric IDs, valid enum ordinal, signed int32, double, voucher oneof). Assertions passed. | PASS |
| UAT | Manual: schema tree navigation | S05-UAT live-runtime + artifact — user confirmed live Tauri app: recursive proto load, depth chain, click-to-select, empty state, messages-only proto | PASS |


## Verdict Rationale
All three reviewers PASS after live-runtime UAT closure. Reviewer A (Requirements Coverage): 26/26 requirements covered. Reviewer B (Cross-Slice Integration): all 5 roadmap boundaries honored. Reviewer C (Assessment & Acceptance): all Contract, Integration, and UAT verification classes satisfied.

Live browser-runtime UAT evidence (2026-05-26): the Tap webview was opened in the Tauri WKWebView (Vite dev server at localhost:1420). The user clicked the Randomize button and observed that empty scalar fields became visible with type-appropriate values matching the expected randomizer output. The user navigated keyboard shortcuts (⌘+1/⌘+2/⌘+3, ⌘+Shift+R, ⌘+O, ⌘+Enter) and confirmed each action passed. The user filled a complex form, reloaded the app after ⌘+Q, and verified the restored values were visible and matched the expected shape. The drafts.json snapshot was captured from local storage during the same session and observed to contain the expected complex-field structure (status enum, repeated items, nested shipping, voucher_code oneof). All UAT assertions passed.

Milestone M001 (v1.8 UX Polish + Proto Ergonomics) is ready for closure.
