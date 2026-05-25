# Pitfalls Research

**Domain:** Tauri 2.x + React + react-hook-form + prost-reflect — v1.8 UX Polish + Proto Ergonomics
**Researched:** 2026-05-25
**Confidence:** HIGH (all critical pitfalls grounded in primary-source codebase evidence)

---

## Critical Pitfalls

### Pitfall 1: DescriptorPool Merge Prevents Proto File Reload

**What goes wrong:**
The current `parse_proto` Rust command (src-tauri/src/commands/proto.rs) skips adding a file to the global `DescriptorPool` if it is already present by name: `if existing.get_file_by_name(&name).is_none()`. A proto reload after the user edits the file will appear to succeed — the frontend gets the updated `ProtoSchema` from the fresh compile — but the global pool used for `encode_message` still carries the **old** type definitions. Messages encoded after a "reload" silently use stale field descriptors until the app is restarted. This is documented in the existing code comment: "Re-loading a changed .proto won't update pool types; restart the app if you change a .proto during a session."

**Why it happens:**
The pool was designed as append-only to support multiple open files sharing common imports (e.g., `google/protobuf/timestamp.proto`). An idempotency guard was added to avoid duplicate-file errors, which makes the pool immutable for existing files by design.

**How to avoid:**
When implementing proto reload, the command must rebuild the pool for all currently-open files — not just the changed file. Strategy: before re-parsing, remove the changed file's name from the pool or reconstruct a fresh `DescriptorPool` from the union of all currently-open file paths. Do not attempt to update a single file inside an existing pool; `prost-reflect` `DescriptorPool` has no `remove_file` operation. The correct approach is: compile all open files into a new pool, replace `pool_state` atomically.

**Warning signs:**
- Encoding a field that was renamed in the `.proto` file after reload produces the old field name in the binary output.
- The frontend's `ProtoSchema` shows the new field but `encode_message` returns a protobuf binary that decodes to the old structure.
- Hex preview changes shape correctly but an external consumer sees the wrong wire format.

**Phase to address:** Phase covering Proto file reload (Feature #3 in v1.8).

---

### Pitfall 2: Randomizer Infinite Loop on Recursive Message Types

**What goes wrong:**
`ProtoFormRenderer` already guards against unbounded recursion with `MAX_DEPTH = 5`. A randomizer that generates type-appropriate values for all fields will need the same guard — or it will loop infinitely on any schema that has a self-referential message (e.g., `message Node { Node child = 1; }`). Without the guard, the randomizer recurses into nested `message` fields indefinitely. The stack overflow is a hard crash in the Rust backend if the recursion is server-side, or a React render freeze if client-side.

**Why it happens:**
Protobuf schemas legally allow recursive message references. The render tree handles this with a depth counter, but a new randomizer function typically starts fresh without inheriting the depth awareness of the renderer.

**How to avoid:**
Pass a `depth` parameter through the recursive value-generation function, mirroring `MAX_DEPTH = 5` from `ProtoFormRenderer.tsx`. At `depth >= MAX_DEPTH`, emit `null` / skip nested message fields rather than recursing. For `message` kind fields in the randomizer: generate a value only for depth 0 and 1; at depth 2+, emit `{}` (empty nested object) to avoid runaway recursion.

**Warning signs:**
- App hangs or tab freezes when the randomizer runs on a proto file that imports another file with the same message type as a field.
- `Maximum call stack size exceeded` error in the dev console.
- React DevTools shows an infinitely deep component tree.

**Phase to address:** Phase covering Randomizer (Feature #2 in v1.8).

---

### Pitfall 3: Draft Persistence Round-Tripping Breaks RHF Internal State

**What goes wrong:**
react-hook-form's internal form values for complex field types do not JSON-serialize correctly:

- **oneof fields** store the selected branch in `_selected` (a RHF meta field, not a proto field). A naïve `JSON.stringify(getValues())` will capture `_selected` — but `form.reset(parsed)` does not restore it correctly because `_selected` is written directly into the `values` object, not as a separate control signal.
- **map fields** are stored as `Array<{key, value}>` via `useFieldArray` (decision row in CLAUDE.md). Restoring from `JSON.parse` produces a plain JS array, but `useFieldArray` requires `replace()` — not a `reset()` value — to repopulate correctly.
- **repeated fields** (`useFieldArray`) have the same `replace()` requirement as map fields.
- **bytes fields** store base64 strings in RHF but the input label also shows a byte count. Restoring the base64 string is correct, but if saved as a buffer (a mistaken optimization) it corrupts silently.

A draft persistence implementation that calls `JSON.stringify(getValues())` and `form.reset(JSON.parse(draft))` will appear to work for scalar-only messages and fail silently for messages with oneof, map, or repeated fields.

**Why it happens:**
RHF's `getValues()` does return a plain JS object, but complex field types rely on `useFieldArray`'s internal array tracker (not just `values`) for correct rendering. Restoring via `reset()` repopulates `values` but does not trigger `useFieldArray`'s internal reconciliation.

**How to avoid:**
Reuse the existing `pendingReplayValues` signal path (already in `useProtoStore`) and the `buildDefaultValues` + `form.reset()` pattern from the history replay flow. For map and repeated fields, implement restore through `useFieldArray.replace()` — the same mechanism as block apply. Do not invent a second restore path. Consider treating map and repeated fields as JSON blobs in draft storage (serialize the `Array<{key,value}>` as-is) and restore via the `mapReplaceRegistry` ref pattern already in place from Phase 25.

**Warning signs:**
- After app restart, oneof fields show the default branch even though the user had selected a different branch before closing.
- Map field rows are empty after draft restore even though the stored JSON contains the correct array.
- Repeated field arrays are empty or show duplicate entries.
- Zod validation errors appear on page load for fields that were valid before the app closed.

**Phase to address:** Phase covering Message draft persistence (Feature #5 in v1.8).

---

### Pitfall 4: Global Keyboard Handler Fights CodeMirror's Keymap

**What goes wrong:**
`JsonEditor` uses `@uiw/react-codemirror` which installs its own keymap as a CodeMirror extension. CodeMirror captures keydown events before they bubble to the window. If you install a global `window.addEventListener('keydown', handler)` for Cmd+Enter (Send), the handler will not fire when focus is inside the CodeMirror editor — CodeMirror consumes the event. However, if you add `event.preventDefault()` at the window level and CodeMirror has not captured it (focus is outside the editor), you suppress the default browser behavior for that key combination across the entire app. The failure modes are:

1. Cmd+Enter does nothing when JSON mode is active and the user expects to Send.
2. Adding `event.preventDefault()` breaks normal text editing if the handler is too broad.
3. CodeMirror historically rebinds Cmd+R (refresh) — a global Cmd+Shift+R (Clear form) handler could conflict.

**Why it happens:**
CodeMirror operates in a web worker / shadow DOM context with its own event dispatch. Global `keydown` listeners at the `window` level are not aware of CodeMirror's event interception.

**How to avoid:**
- Register keyboard shortcuts at the `document` level with `useEffect` and check `event.target` before acting: if `(event.target as Element).closest('.cm-editor')`, skip the handler.
- For Cmd+Enter specifically, also add it as a CodeMirror keymap extension passed to the `JsonEditor`: `keymap.of([{ key: 'Mod-Enter', run: () => { triggerSend(); return true; } }])`. This ensures it fires regardless of editor focus state.
- Use `event.metaKey` (macOS) + `event.ctrlKey` (Windows/Linux) rather than only `event.metaKey`.

**Warning signs:**
- Pressing Cmd+Enter in the JSON editor triggers no send.
- The Clear form shortcut fires when the user is typing in the CodeMirror editor.
- The global shortcut stops working when any input field is focused.

**Phase to address:** Phase covering Keyboard shortcuts (Feature #1 in v1.8).

---

### Pitfall 5: fs:scope Restriction Silently Blocks Recent Files Outside $HOME

**What goes wrong:**
Tauri's `fs:scope` was narrowed to `$HOME/**` during v1.4 security hardening. Any `.proto` file stored outside `$HOME` — for example `/opt/company/protos/`, `/tmp/test.proto`, or on Windows a network drive like `\\server\share\file.proto` — will be accessible via the native file picker dialog (which uses OS-level access, not `plugin-fs`) but will fail when `tauri-plugin-fs` tries to read the file path string during recent files restore. The error is silent by default: `plugin-fs` returns a permission denied error that the frontend may swallow.

**Why it happens:**
The file picker dialog bypasses `fs:scope` — users can navigate to any folder. But subsequent `plugin-fs` API calls (to read a recently used path from storage and verify it still exists) are subject to scope restrictions. The paths appear valid in `tauri-plugin-store` but fail at access time.

**How to avoid:**
- For recent files, validate stored paths before displaying them: use `@tauri-apps/plugin-fs` `exists()` call with error handling (not just checking whether the path string is non-empty).
- Accept that some users will see "file not accessible" warnings for paths outside `$HOME` — surface this as a graceful error (grayed-out entry with tooltip) rather than a hard failure.
- Document in the phase spec that the recent files list cannot include files outside the user's home directory due to the existing security scope.
- Path separators: replicate the `WR-04` pattern from `FileSection.tsx` (detect `\\` vs `/` separator) for all path operations in the recent files manager.

**Warning signs:**
- Recent files list shows an entry but clicking it produces no action or a console error.
- On Linux/macOS, `/tmp/test.proto` appears in recent files but fails to load.
- Windows network paths (`\\server\share`) are in the list but fail silently.

**Phase to address:** Phase covering Recent files nav (Feature #4 in v1.8).

---

### Pitfall 6: Frozen ProtoFormRenderer Switch Requires Pre-Dispatch Pattern for All New Field Features

**What goes wrong:**
The `ProtoFormRenderer` switch over `FieldKind` variants is FROZEN (decision in CLAUDE.md: "ProtoFormRenderer switch FROZEN; new field types as pre-dispatch branches"). Adding Randomizer values directly into the switch, or adding Schema explorer tree rendering inside the switch, violates this architectural constraint and creates high-risk modification surface. Previous features (BytesField, MapField) were added as pre-dispatch branches without touching the switch body.

**Why it happens:**
Developers reaching for the most direct path to render new behavior will look at the switch and add a case. This works technically but creates fragility: the switch already has 10+ cases and each new one increases the risk of breaking existing field type rendering.

**How to avoid:**
- Randomizer: implement as a separate function `buildRandomValues(message: MessageSchema, depth: number): Record<string, unknown>` in a new utility file, using the same `FieldKind` type. Call it from `FormPanel` (not from inside `ProtoFormRenderer`) and inject values via the existing `pendingReplayValues` → `resetRef.current()` path.
- Schema explorer: implement as a standalone tree component that takes `ProtoSchema` directly — it does not need to go through `ProtoFormRenderer` at all.
- Import manager: same pattern — separate UI component operating on stored include paths from `tauri-plugin-store`, not on the form renderer.
- For any feature that needs to interact with form values, use the `applyBlockRef` / `mapReplaceRegistry` ref pattern already established.

**Warning signs:**
- Any PR diff that touches the `switch (field.kind.type)` block in `ProtoFormRenderer.tsx`.
- New code that calls `renderField()` or imports `ProtoFormRenderer` for a non-form-rendering purpose.

**Phase to address:** All v1.8 phases — this is a cross-cutting constraint.

---

### Pitfall 7: Connection Quick-Switch Mid-Plan-Run Corrupts Step Execution

**What goes wrong:**
The plan runner uses `execute_step` Rust commands that reference the currently active AMQP connection credentials (resolved at command invocation time). If the user switches profiles while a plan is running, the next `execute_step` call uses the new profile's credentials but the plan runner's JS loop has no awareness of the switch. Mixed results: steps 1-3 ran against profile A; steps 4-N run against profile B. The live subscribe feature already guards against this by auto-stopping on profile change (`SubscribePanel`, v1.4). The plan runner has no equivalent guard.

**Why it happens:**
Profile switching updates `useConnectionStore.activeProfileName` synchronously in the frontend. The Rust backend resolves credentials at each `execute_step` invocation rather than holding a connection open for the run. There is no "plan run in progress" guard in the connection store.

**How to avoid:**
- In `usePlanExecutionStore`, add a `runningProfileName` field that is set when the plan starts.
- In `ConnectionSection` or wherever quick-switch is implemented, check if a plan is currently running (`usePlanExecutionStore.isRunning`) before allowing the switch — either block it with a toast warning or auto-stop the plan first.
- Alternatively, show a confirmation dialog: "Switching profiles will stop the running plan. Continue?"
- This is analogous to the existing `SubscribePanel` guard — look at how subscribe auto-stops on profile change for the pattern to replicate.

**Warning signs:**
- Plan run completes without error but the messages arrived in the wrong RabbitMQ vhost.
- Step results show mixed queue targets from two different profiles.
- Live subscribe stops when profile changes (existing guard works) but plan runner continues uninterrupted.

**Phase to address:** Phase covering Connection quick-switch (Feature #8 in v1.8).

---

### Pitfall 8: Randomizer for Non-Scalar Field Types Produces Invalid Proto Values

**What goes wrong:**
A randomizer that generates field values must respect proto type constraints beyond just the scalar kind:

- **Enum fields**: The randomizer must pick from the enum's defined values (by number, not by random integer). An arbitrary integer that is not in `EnumValue[]` will either fail zod validation or produce a proto encoding error at the Rust layer.
- **Bytes fields**: Must produce valid base64 (RFC 4648 standard alphabet, no URL-safe chars). The existing `BytesField` validation already rejects URL-safe base64 — the randomizer must use standard alphabet `A-Z a-z 0-9 + /` with padding.
- **WellKnownType Timestamp**: Must produce `{ seconds: number, nanos: number }` shape. Generating a random int for a `well_known` field of type `Timestamp` will fail encoding.
- **WellKnownType Duration**: Must produce `{ seconds: number, nanos: number }` shape with nanos in `[0, 999_999_999]`.
- **oneof fields**: Must set exactly one branch — the `_selected` RHF internal. A randomizer that fills all branches of a oneof produces undefined behavior at encoding time.
- **Map fields**: Keys must be unique (no duplicate keys in the generated set). The existing duplicate-key guard in `MapField` blocks sends when duplicates exist — the randomizer must generate unique keys.
- **int64/uint64 fields**: Stored as strings in RHF (decision in `buildDefaultValues` in `ProtoFormRenderer.tsx`). The randomizer must produce a string like `"12345678901234"`, not a JS number (which loses precision for large int64).

**Why it happens:**
A randomizer written without reading the existing field type constraints will generate values by scalar type alone (random string, random int, random bool) and miss the proto-semantic constraints on top of the scalar wire type.

**How to avoid:**
Build the randomizer as a type-safe visitor over `FieldKind` that mirrors `buildDefaultValues` in `ProtoFormRenderer.tsx` but generates random values instead of zero values. Test each `FieldKind` variant explicitly in unit tests before implementing the UI.

**Warning signs:**
- Send fails with a Rust encoding error after randomizer fill.
- Zod validation errors on the form after randomizer runs.
- oneof field shows multiple branches selected simultaneously.

**Phase to address:** Phase covering Randomizer (Feature #2 in v1.8).

---

### Pitfall 9: Import Manager — Removing an Include Path Silently Breaks Open Tabs

**What goes wrong:**
The import manager lets users view and edit the include paths for the currently active proto file. If a user removes an include path that is a dependency of another currently-open tab (e.g., tab A's proto imports a type from a directory listed in tab B's include paths), removing it only affects the include paths stored for the current file in `tauri-plugin-store`. The other tab's open `ProtoSchema` in memory is unaffected — until the user closes and reopens it, at which point `parse_proto` will fail because the include path is gone.

Worse: if the user reloads (via Feature #3) a tab whose include path was removed via the import manager, the reload fails with a cryptic import resolution error, not an explanation of why the path was removed.

**Why it happens:**
Include paths are stored per-file (`include_paths:{absoluteFilePath}` key pattern in `tap.json`). The import manager UI naturally shows only the current file's paths. The dependency between files' include paths is invisible.

**How to avoid:**
- The import manager should be scoped to the active file only and clearly labeled as such.
- When an include path is removed, run a validation step: attempt to re-parse the active file with the new path set and only commit if parse succeeds.
- Do NOT automatically reload other open tabs when an include path changes — this is too aggressive and may cause unexpected state loss.
- Show a warning if the removed path is a parent directory of any imported file in the current schema (detectable from the `file_descriptor_set` by inspecting import paths).

**Warning signs:**
- Removing an include path shows success, but a different tab's reload fails later with an import resolution error.
- `IncludePathDialog` confirms a path change but the underlying proto schema becomes invalid for the next encode.

**Phase to address:** Phase covering Proto import manager (Feature #7 in v1.8).

---

### Pitfall 10: Schema Explorer Circular Import Causes Infinite Recursion in Tree Rendering

**What goes wrong:**
Proto files legally import each other in a chain (A imports B, B imports C, C imports A is illegal in proto3 — the compiler rejects it). However, the schema explorer rendering a message tree can still hit cycles through recursive message references: `message Tree { Tree left = 1; Tree right = 2; }`. A tree renderer that follows `message` field references into sub-tree nodes without a depth or visited-set guard will loop indefinitely.

Additionally, if the schema explorer shows imported types (from other `.proto` files in the include paths), it must distinguish between "types from this file" and "imported types" to avoid rendering the entire transitive closure of imports as an infinitely deep tree.

**Why it happens:**
Schema explorer trees are typically written as recursive React components. Without a `visited: Set<string>` of already-rendered `full_name` values or a depth cap, recursive message references produce infinite renders.

**How to avoid:**
- Use a `depth` cap matching `MAX_DEPTH = 5` from `ProtoFormRenderer`.
- Maintain a `visited = new Set<string>()` of `full_name` values already expanded in the current branch. If a message type appears in its own sub-tree, render it as a leaf node with a "(recursive)" label rather than expanding it.
- Scope the tree root to the current file's messages only (the `ProtoSchema.messages` array, which already excludes `google.protobuf.*` types). Do not render the entire `message_map` transitive closure.

**Warning signs:**
- Schema explorer tab causes the app to freeze when a schema with nested or recursive messages is loaded.
- React DevTools shows a component stack with thousands of levels.
- Memory usage climbs linearly after opening the schema explorer.

**Phase to address:** Phase covering Schema explorer (Feature #6 in v1.8).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Draft saves on every `onValuesChange` call | Simplest implementation — reuse existing callback | tauri-plugin-store write on every keystroke; disk I/O spikes; may cause write contention with history writes | Never — use debounce at minimum 500ms (mirror useDebounce hook already in `src/hooks/useDebounce.ts`) |
| Recent files stored as raw path strings without validation | Trivial to implement | Stale paths accumulate; cross-platform separator issues; paths outside fs:scope silently fail | Acceptable only if validation runs at display time (not just at storage time) |
| Randomizer as a one-off button handler in FormPanel | Fast to ship | Duplicates FieldKind dispatch logic; diverges from buildDefaultValues pattern; no unit test surface | Never — extract as a tested utility function separate from the component |
| Global `tauri-plugin-global-shortcut` for keyboard shortcuts | Single registration point | Intercepts from other apps even when Tap is in background; Tauri 2.x global shortcut requires explicit permission | Never — use window-level `keydown` handler scoped to document focus instead |
| Skipping `shouldDirty: false` on draft restore setValue calls | Simplest reset call | All draft-restored fields appear as "dirty" to the block apply system; triggers false conflict dialogs on first block drag after draft restore | Never — Pitfall D from Phase 26 proved the invariant must be enforced |
| Rebuilding DescriptorPool for reload by creating a second pool | Fast to implement | Encoding command still references the old global pool via Tauri State; two pools in memory; next encode uses stale pool | Never — must replace global pool atomically |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| CodeMirror + global keydown | Listening at window level and calling `preventDefault` broadly | Check `event.target.closest('.cm-editor')` before acting; also register the shortcut as a CodeMirror keymap extension for JSON mode |
| tauri-plugin-store + draft persistence | Multiple concurrent `store.set()` calls without awaiting the prior `store.save()` | Queue writes or use debounce (500ms+); `store.save()` is async and must be awaited before the next write |
| tauri-plugin-store key namespace | Accidentally overwriting an existing key (`include_paths:`, `theme-mode`, `history`, `plans`, `blocks`) | Use a distinct key prefix for new features: `draft:` for drafts, `recent_files` for the recent list |
| prost-reflect DescriptorPool + proto reload | Calling `add_file_descriptor_proto` for an already-present file | Reconstruct the pool from all currently open file paths rather than appending to the existing pool |
| react-hook-form + useFieldArray + draft restore | Calling `form.reset(values)` and expecting map/repeated arrays to repopulate | Call `replace()` on each `useFieldArray` controller after `form.reset()` — use the mapReplaceRegistry ref pattern from Phase 25 |
| Tauri fs:scope + recent files | Assuming all paths returned by the file picker are readable by plugin-fs | Wrap all `plugin-fs` read attempts in try/catch; surface permission errors as grayed-out entries |
| Connection quick-switch + plan runner | Assuming plan runner is idle when profile switch is allowed | Check `usePlanExecutionStore` running state before allowing switch; replicate SubscribePanel's auto-stop guard |
| Randomizer + enum fields | Generating a random integer for enum fields | Pick from `EnumValue[].number` values only; validate against the field's `values` array |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Draft persistence on every onChange | tauri-plugin-store write per keystroke; noticeable input lag in large forms | Debounce at 500ms minimum; use existing `useDebounce` hook | Any form with more than 5 fields and fast typing |
| Schema explorer renders full transitive import tree | Freezes on proto files with 10+ imported messages | Scope tree to current file's messages only; use depth cap + visited set | Any proto file that imports google protobuf types (always present) |
| Recent files list with path validation on every render | Disk stat on every render cycle | Validate paths only when list is opened; cache result for the session | Any list with more than 10 entries |
| Randomizer generating deeply nested message values | Browser tab freeze for recursive schemas | Enforce MAX_DEPTH = 5; emit empty object at depth limit | Any schema with message field referencing itself |
| Rebuilding ProtoSchema on include path edit (no debounce) | Multiple rapid re-parses on fast typing in include path input | Debounce include path input changes; only re-parse on confirm/blur | Include path dialog with user who types quickly |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Storing draft field values that contain connection credentials (e.g., user typed a password into a string field) | Plaintext credential in tap.json on disk | No change needed — draft values are proto field values, not connection credentials; the risk is user awareness, not code change |
| Exposing the Tauri IPC draft save endpoint without input size limits | Malformed large draft causes disk fill or store corruption | Cap draft JSON size in the Rust command or validate at the JS boundary before invoking store.set |
| Recent files list path traversal via crafted path in tap.json | Path outside fs:scope read via recent files restore | tauri-plugin-fs scope restriction already prevents this; do not relax the scope to fix recent files usability issues |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Randomizer replaces in-progress hand-typed values without confirmation | Data loss; user loses carefully typed values | Require the form to be empty (no dirty fields) or show a confirmation toast; use the existing `formState.isDirty` check |
| Schema explorer opens in a tab/panel that hides the send form | Developer loses context when exploring schema | Open as a right-side collapsible panel (same pattern as BlockLibraryPanel) or as an overlay sheet, not a full view switch |
| Recent files list shows deleted/moved files without explanation | User clicks, nothing happens — silent failure | Mark stale entries visually (strikethrough, muted color) with tooltip "File not found — click to remove" |
| Clear form shortcut (Cmd+Shift+R) fires when user means browser refresh (in dev mode) | Confusing UX in dev mode; harmless in prod | No change needed in prod Tauri builds; add a warning in dev mode via `import.meta.env.DEV` guard |
| Connection quick-switch closes the queue/exchange dropdowns mid-selection | User loses their selection | Disable quick-switch while any AMQP picker dropdown is open; or refresh the list immediately after switch |
| Proto reload loses the current message type selection | User had scrolled down to a specific message; reloads resets to first | After reload, attempt to restore `selectedMessageType` if the type still exists in the reloaded schema |

---

## "Looks Done But Isn't" Checklist

- [ ] **Proto reload:** Pool rebuilt atomically for all open files — verify by changing a field name and checking encode uses the new name without restart.
- [ ] **Randomizer:** Enum fields pick from defined values, not arbitrary ints — verify with an enum field that has gap numbers (e.g., 0, 5, 10).
- [ ] **Randomizer:** oneof fields set exactly one branch — verify the `_selected` key is set in form values after randomize.
- [ ] **Randomizer:** int64/uint64 fields produce strings, not JS numbers — verify with a field that would lose precision as a float64.
- [ ] **Randomizer:** bytes fields produce standard-alphabet base64 (no `-` or `_`) — run through the existing BytesField validation.
- [ ] **Draft persistence:** oneof branch is correctly restored after app restart — verify with a non-first branch.
- [ ] **Draft persistence:** map rows are restored via `replace()` not `reset()` — verify by checking that `formState.dirtyFields` does NOT show map fields as dirty after draft restore.
- [ ] **Draft persistence:** `shouldDirty: false` on all draft restore `setValue` calls — verify block apply does not show false conflicts after draft restore.
- [ ] **Keyboard shortcuts:** Cmd+Enter fires Send when focus is in CodeMirror JSON editor.
- [ ] **Keyboard shortcuts:** Shortcuts use `event.metaKey || event.ctrlKey` for cross-platform support.
- [ ] **Keyboard shortcuts:** Handler skips when focus is in `.cm-editor` for shortcuts that should not fire in JSON mode.
- [ ] **Recent files:** Stale paths (file deleted) show a graceful error, not silent nothing.
- [ ] **Recent files:** Paths with spaces and special characters work correctly.
- [ ] **Recent files:** Uses `WR-04` path separator detection (`\\` vs `/`).
- [ ] **Schema explorer:** Does not freeze on recursive message types.
- [ ] **Schema explorer:** Scoped to current file's messages only, not the full transitive import graph.
- [ ] **Import manager:** Removing an include path validates the parse succeeds before committing.
- [ ] **Connection quick-switch:** Plan runner is stopped or warned when active profile changes.
- [ ] **Connection quick-switch:** Queue/exchange list is refreshed after switch completes.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| DescriptorPool stale after reload | MEDIUM | Add a `reload_proto` Rust command that tears down and rebuilds the global pool from all open file paths; requires Tauri State to be a `Mutex<Option<DescriptorPool>>` (already is) — replace the `Option` with a new pool |
| Draft restore corrupts form state | LOW | Clear the draft key from `tap.json` and fall back to empty defaults; surface as "Draft restore failed, starting fresh" toast |
| Randomizer produces invalid proto | LOW | Catch the Rust encode error on Send and show the existing `encodeError` banner; user can manually fix or randomize again |
| Schema explorer freeze on recursive schema | MEDIUM | Add visited-set guard; if freeze has already occurred, app restart clears state; visited-set is a pure frontend fix with no data migration |
| Import manager removes critical path | LOW | Re-open the IncludePathDialog from FileSection and add the path back; no data lost, only the in-memory schema is stale until re-parse |
| Draft key collision in tap.json | LOW | Use namespaced keys from the start (`draft:{messageType}:{filePath}`); if collision occurs, clear the affected key and start fresh |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| DescriptorPool stale after reload | Proto file reload phase | Change a field name, reload, encode — verify new name in hex output without restart |
| Randomizer recursion on self-referential messages | Randomizer phase | Run randomizer on a proto with `message Node { Node child = 1; }` — must complete without freeze |
| Randomizer invalid proto values (enum, bytes, WKT, oneof) | Randomizer phase | Unit tests for each FieldKind variant in the randomizer utility; end-to-end Send with randomized values |
| Draft persistence RHF state shape | Draft persistence phase | Restart app after filling oneof, map, repeated fields — all should restore correctly |
| Global keydown vs CodeMirror | Keyboard shortcuts phase | Focus inside JSON editor, press Cmd+Enter — send must fire |
| fs:scope blocks recent files outside $HOME | Recent files phase | Add a file from `/tmp/` (macOS/Linux) or a network path; verify graceful error, not silent failure |
| Frozen ProtoFormRenderer switch | All v1.8 phases | Diff review gate: no changes to `switch (field.kind.type)` block |
| Profile switch mid-plan-run | Connection quick-switch phase | Start a long plan run, switch profile mid-run — verify plan stops or warns, does not silently mix profiles |
| Import manager removes needed path | Import manager phase | Remove an include path for a file that imports another type; verify parse fails before commit |
| Schema explorer circular refs | Schema explorer phase | Load a schema with recursive message type; verify tree renders with depth cap |

---

## Sources

- `src-tauri/src/commands/proto.rs` — DescriptorPool merge guard and comment (primary source for Pitfall 1)
- `src/components/form/ProtoFormRenderer.tsx` — `MAX_DEPTH = 5`, `buildDefaultValues`, frozen switch (Pitfall 2, 3, 6, 8)
- `src/stores/useProtoStore.ts` — `pendingReplayValues`, `resetRef` pattern (Pitfall 3)
- `src/components/form/FormPanel.tsx` — `mapReplaceRegistry`, block apply ref wiring, `isJsonMode` state (Pitfall 3, 4, 6)
- `CLAUDE.md` decisions table — "ProtoFormRenderer switch FROZEN", `shouldDirty: false` invariant (Pitfall 6, Technical Debt table)
- `src/components/sidebar/FileSection.tsx` — `WR-04` path separator pattern, `include_paths:` key prefix (Pitfall 5, 9)
- `src/stores/useConnectionStore.ts` — profile switching model (Pitfall 7)
- `src/lib/types.ts` — `FieldKind`, `ScalarKind`, `EnumValue` type definitions (Pitfall 8)
- `src-tauri/src/schema/extractor.rs` — WellKnownTypes list, map field extraction (Pitfall 8)
- `src/lib/blockApply.ts` — `ConflictItem` discriminated union, `ApplyBlockRef` contract (Pitfall 3, 6)
- PROJECT.md v1.4 context — "auto-stop on profile/connection change" for SubscribePanel (Pitfall 7)
- PROJECT.md v1.7 known issues — `shouldDirty: false` invariant, `mapReplaceRegistry` pattern (Pitfall 3, Technical Debt)

---
*Pitfalls research for: Tap v1.8 UX Polish + Proto Ergonomics*
*Researched: 2026-05-25*
