# M001: v1.8 UX Polish + Proto Ergonomics

**Gathered:** 2026-05-25
**Status:** Ready for planning

## Project Description

Make Tap faster to use day-to-day — keyboard-first workflow, persistent draft state, quick proto navigation, and a schema explorer for power users. This milestone spans 5 slices covering keyboard shortcuts, proto file management, connection/draft persistence, randomization with field tooltips, and a schema explorer tree.

## Why This Milestone

v1.0–v1.7 delivered the complete functional surface: proto parsing, form generation, publishing, consuming, blocks, plans, and distribution. What's missing is the ergonomic polish that makes the difference between "it works" and "I reach for it first." Developers who use Tap daily spend unnecessary time on repetitive actions: reopening proto files, re-filling forms, switching connections through the sidebar, and navigating with the mouse.

## User-Visible Outcome

### When this milestone is complete, the user can:

- Control the entire send workflow without touching the mouse (send, open, clear, tab-switch via keyboard)
- Copy any field value to clipboard with one click
- Reload a changed proto file, reopen recent files, and manage include paths without the file picker
- Switch connection profiles from the publish bar without opening the sidebar
- Close and reopen the app with form values automatically preserved per message type
- Fill all empty fields with type-appropriate random values in one click
- See proto type metadata on any field via tooltip
- Explore the full schema structure in a collapsible tree panel

### Entry point / environment

- Entry point: Desktop application (Tauri)
- Environment: Local dev (macOS, Windows, Linux)
- Live dependencies involved: RabbitMQ (existing connection profiles)

## Completion Class

- Contract complete means: All 26 requirements pass unit/integration tests; keyboard shortcuts fire correctly; draft round-trips through app restart; randomizer produces valid values for all proto types
- Integration complete means: Shortcuts work inside CodeMirror; draft restore handles map/repeated/oneof via setPendingReplayValues; include path changes trigger proto reload; connection switch is blocked during plan runs
- Operational complete means: none (desktop app, no server lifecycle)

## Final Integrated Acceptance

To call this milestone complete, we must prove:

- User can load a proto file, fill fields, send via Cmd+Enter, clear via Cmd+Shift+R, and switch tabs via Cmd+1/2/3 — all without touching the mouse
- User can close the app, reopen it, select the same message type, and see all previously entered values (including map rows and oneof selections) restored automatically
- User can open the schema explorer on a proto file with recursive message types without freezing or infinite render

## Architectural Decisions

### Keyboard shortcut library

**Decision:** Use `react-hotkeys-hook@^5.3.2`

**Rationale:** Lightweight, well-maintained, supports `enableOnFormTags` for inhibit control, and integrates cleanly with React component lifecycle.

**Alternatives Considered:**
- Native `addEventListener` — more boilerplate, no React lifecycle integration, harder to manage cleanup

### CodeMirror Cmd+Enter dual registration

**Decision:** Register Cmd+Enter both as a window-level `useHotkeys` handler AND as a CodeMirror keymap extension in JsonEditor.

**Rationale:** CodeMirror captures keyboard events before they reach the window. The window handler must check `event.target.closest('.cm-editor')` to avoid double-firing.

**Alternatives Considered:**
- Window-only handler — misses events when focus is inside CodeMirror
- CodeMirror-only handler — misses events when focus is outside CodeMirror

### Form reset path

**Decision:** All form resets (Clear button, keyboard shortcut, draft restore, randomizer) route through `setPendingReplayValues(buildDefaultValues(message))`. Never call `resetRef.current()` directly.

**Rationale:** `setPendingReplayValues` is the established mandatory form-fill path that correctly handles map/repeated fields via the mapReplaceRegistry pattern from Phase 25.

**Alternatives Considered:**
- Direct `resetRef.current()` — breaks map/repeated field state

### Proto reload strategy

**Decision:** `reload_proto` Rust command must rebuild the entire `DescriptorPool` from scratch and atomically replace the `Tauri State Mutex<Option<DescriptorPool>>`.

**Rationale:** `DescriptorPool` is append-only with no `remove_file()`; re-calling `parse_proto` is a silent no-op due to skip-if-exists guard.

**Alternatives Considered:**
- Re-call existing `parse_proto` — silent no-op, doesn't pick up file changes

### Draft persistence via setPendingReplayValues

**Decision:** Draft restore routes through `setPendingReplayValues` with `shouldDirty: false`. Map/repeated fields use `replace()` after `reset()` (mapReplaceRegistry pattern).

**Rationale:** `form.reset(JSON.parse(draft))` corrupts map/repeated/oneof state. The established pattern from Phase 25 block apply handles these correctly.

**Alternatives Considered:**
- Direct `form.reset()` with parsed JSON — corrupts complex field types

### Connection switch guard

**Decision:** Connection quick-switch must check `usePlanExecutionStore.isRunning` before allowing profile change.

**Rationale:** Switching connection mid-plan-run would send remaining steps to wrong RabbitMQ instance, corrupting the run.

**Alternatives Considered:**
- No guard — silent corruption of plan runs

### Copy field feedback

**Decision:** Brief icon swap (Copy → Check for 1500ms), no Sonner toast.

**Rationale:** Lightweight, non-intrusive feedback that doesn't stack toasts during rapid copy operations.

**Alternatives Considered:**
- Sonner toast — too heavy for frequent copy actions, stacks visually

### Copy field visibility

**Decision:** Hover-reveal only using Tailwind `group/group-hover` pattern.

**Rationale:** Keeps the form clean; always-visible copy icons add clutter to an already dense form.

**Alternatives Considered:**
- Always-visible — clutters the form, especially with many fields

## Error Handling Strategy

- **Clipboard write failure:** Sonner toast with "Copy failed — clipboard not available" (FRM-02)
- **Proto reload failure:** Display parse error in existing error UI; do not silently fail
- **Stale recent files:** Show as disabled with visual indicator; do not open file picker on click (RFC-03)
- **Draft restore failure:** Fall back to default values silently; do not block form rendering
- **Connection switch during plan run:** Block with warning dialog; do not allow the switch (CQS-02)
- **Randomizer on recursive messages:** Emit `{}` at MAX_DEPTH=5; no infinite loop, no error

## Risks and Unknowns

- **CodeMirror Cmd+Enter dual registration** — complex event routing between window and CM keymap; risk of double-firing or missed events
- **Draft persistence for complex fields** — map/repeated/oneof require the mapReplaceRegistry pattern; incorrect restore corrupts form state
- **DescriptorPool atomic rebuild** — no remove API; must construct fresh pool from all open files
- **Randomizer infinite loop on recursive messages** — must enforce depth cap matching ProtoFormRenderer

## Existing Codebase / Prior Art

- `src/components/form/FormPanel.tsx` — Clear button location, hotkey registration, setPendingReplayValues, isJsonMode state
- `src/components/form/JsonEditor.tsx` — CodeMirror instance, needs keymap extension prop for Cmd+Enter
- `src/components/form/fields/ScalarField.tsx` — Copy icon target (also EnumField.tsx, BytesField.tsx)
- `src/components/form/ProtoFormRenderer.tsx` — FROZEN switch, buildDefaultValues() export, depth cap pattern
- `src/stores/useProtoStore.ts` — setPendingReplayValues signal, proto state management
- `src/components/sidebar/FileSection.tsx` — Proto file loading, include paths UI
- `src/components/publish/PublishBar.tsx` — Connection quick-switch location
- `src/stores/useConnectionStore.ts` — Profile management
- `src/stores/usePlanExecutionStore.ts` — isRunning guard for connection switch
- `src/lib/blockApply.ts` — buildApplyPlan pattern, mapReplaceRegistry

## Relevant Requirements

- R001–R007 — Keyboard shortcuts + field copy (S01)
- R010–R016 — Proto reload, recent files, include paths (S02)
- R017–R023 — Connection quick-switch + draft persistence (S03)
- R008–R009, R024 — Randomizer + field type tooltips (S04)
- R025–R026 — Schema explorer tree (S05)

## Scope

### In Scope

- Keyboard shortcuts: Cmd+Enter, Cmd+O, Cmd+Shift+R, Cmd+1/2/3 with platform-branched tooltips
- Clear button in form panel header (exits JSON mode, resets via setPendingReplayValues)
- Hover-reveal copy icon on scalar/enum/bytes fields with icon swap feedback
- Proto reload button, recent files list (10 entries, persisted), include path manager
- Connection quick-switch dropdown in publish bar with plan-run guard
- Draft auto-save/restore per (filePath, messageTypeName) with 50-entry LRU cap
- Randomize button for non-dirty fields with type-appropriate values
- Field type tooltips showing proto type, field number, cardinality
- Schema explorer panel with collapsible tree and recursive type safety

### Out of Scope / Non-Goals

- Customizable keyboard shortcuts (deferred to v1.9+)
- Auto-reload on file change via fs watch (deferred to v1.9)
- JSON-mode draft persistence (stretch goal, not committed)
- Copy for complex fields (repeated, map, nested) — future polish
- Jump-to-field from schema tree — future
- Windows Authenticode signing — separate milestone
- Non-proto message formats — v1.x constraint

## Technical Constraints

- ProtoFormRenderer switch is FROZEN — no new cases
- setPendingReplayValues is the mandatory form-fill path for all resets/restores
- DescriptorPool is append-only — reload must rebuild atomically
- CodeMirror captures Cmd+Enter — dual registration required
- Draft restore must use shouldDirty: false and mapReplaceRegistry pattern
- One new npm dependency: react-hotkeys-hook@^5.3.2
- Two new Rust commands: reload_proto, check_paths_exist (no new crates)

## Integration Points

- react-hotkeys-hook — new dependency for keyboard shortcut registration
- CodeMirror keymap — extension prop in JsonEditor for Cmd+Enter
- tauri-plugin-store — draft persistence storage
- RabbitMQ Management API — existing, used by connection quick-switch for queue/exchange discovery

## Testing Requirements

Unit tests for: keyboard shortcut registration/inhibit logic, copy format functions, recent files list management, draft save/restore round-trip, LRU eviction, randomizer value generation for all proto types, schema tree recursive type handling.

Integration tests for: draft restore of complex field types (map, repeated, oneof), include path change triggering reload, connection switch guard during plan run.

Coverage target: 80%+ on new code.

## Acceptance Criteria

- S01: All 4 keyboard shortcuts work with correct inhibit rules; Clear button resets form and exits JSON mode; copy icon appears on hover and copies correct format
- S02: Reload re-parses current file; recent files list persists across restarts; include path changes auto-trigger reload; stale files shown disabled
- S03: Connection dropdown switches profiles; switch blocked during plan run; drafts auto-save and restore including complex fields; drafts survive restart; LRU eviction at 50
- S04: Randomize fills non-dirty fields with valid typed values; recursive messages capped at depth 5; field tooltips show proto metadata
- S05: Schema tree shows all messages/fields/enums; recursive types render safely; collapsible navigation works

## Open Questions

- Draft store key format: `draft:{encodedFilePath}:{messageFullName}` (file-scoped for multi-proto-tab) — to be confirmed in S03 planning
- `fs:allow-exists` capability: S02 plan must verify if already granted in capabilities/default.json
- JSON-mode draft shape: `{ mode: 'json', jsonString }` vs `{ mode: 'form', values }` — decide in S03 planning

---

*Milestone: M001 — v1.8 UX Polish + Proto Ergonomics*
*Context gathered: 2026-05-25*
*Migrated from: .planning/phases/27-keyboard-shortcuts-field-copy/ + .planning/REQUIREMENTS.md + .planning/ROADMAP.md*
