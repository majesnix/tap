# Architecture Research

**Domain:** Tauri 2.x desktop app — UX ergonomics + proto ergonomics layer on top of existing v1.7 architecture
**Researched:** 2026-05-25
**Confidence:** HIGH (all findings from direct source reading of the existing codebase)

---

## Existing Architecture Snapshot (v1.7 baseline)

Understanding this baseline is required before mapping where each v1.8 feature plugs in.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  App.tsx (ThemeProvider + ThemeBootstrap + UpdateChecker)                │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ AppLayout (DndContext + DragOverlay at layout level)                │ │
│  │                                                                     │ │
│  │  ┌──────────┐   ┌──────────────────────────────┐   ┌─────────────┐ │ │
│  │  │ Sidebar  │   │ main column                  │   │ RightPanel  │ │ │
│  │  │          │   │  ┌──────────────────────────┐│   │             │ │ │
│  │  │FileSection│  │  PublishBar               ││   │ HexPreview  │ │ │
│  │  │ConnSection│  │  ┌────────────┐ ┌────────┐ ││   │ History     │ │ │
│  │  │ MsgType  │   │  │BlockLibrary│ │FormPanel│ ││   │ Subscribe   │ │ │
│  │  │ThemeToggle│  │  └────────────┘ └────────┘ ││   │             │ │ │
│  │  └──────────┘   └──────────────────────────────┘│   └─────────────┘ │ │
│  │                  └──────────────────────────────┘                   │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘

Zustand Stores (all in-memory; persistence via tauri-plugin-store to tap.json):
  useProtoStore       — open files, active tab, schema, selectedMessageType,
                        latestValues, pendingReplayValues
  useConnectionStore  — profiles, activeProfileName, connectionStatus, queues, exchanges
  useHistoryStore     — history entries (FIFO-100), search/filter state
  useBlockStore       — blocks (FIFO on delete), blocksLoaded gate
  usePlanStore        — plans, plan CRUD
  usePlanExecutionStore — run state, step statuses, reply feed
  useAmqpStore        — subscribe / drain feed state

Rust commands (src-tauri/src/commands/):
  proto.rs            — parse_proto (compile + pool merge)
  encode.rs           — encode_message (prost-reflect dynamic encoding)
  connection.rs       — save/list/delete/test/activate profile, fetch queues/exchanges/bindings
  publish.rs          — publish_message (lapin, publisher confirms)
  consume.rs          — consume_message, drain_messages
  subscribe.rs        — start_subscribe, stop_subscribe (Tauri Channel streaming)
  plan_runner.rs      — execute_step, cancel_plan_run

tauri-plugin-store keys in tap.json:
  theme-mode
  include_paths:{absoluteFilePath}
  (history, blocks, plans stored in their own store files via plugin-store)
```

### Frozen Constraint

`ProtoFormRenderer.tsx` switch body (field type dispatch) is **frozen** — no new cases. Extension pattern is pre-dispatch branch checks added before the switch in the render function, or modifications to individual field components (`ScalarField.tsx`, `EnumField.tsx`, etc.) directly. Both BytesField and MapField were added without touching the switch.

### Key Paid-For Extension Points

1. **`setPendingReplayValues` signal** (useProtoStore + FormPanel lines 154-164): Handles form population with JSON-mode to form remount timing already solved. Any "fill the form with values" operation should go through this signal, not call `resetRef.current()` directly.
2. **`useDebounce(latestValues, 200)`** (FormPanel): Already watches every form change. Draft persistence reads from this same debounced stream — no second debounce needed.
3. **`applyBlockRef.buildPlan/commitApply`** two-phase ref: Safe write path into RHF without touching the frozen switch.
4. **`setActiveIndex` on useProtoStore**: Tab navigation action exists; keyboard shortcut for tab switching wires here.

---

## Feature Integration Map

### Feature 1: Keyboard Shortcuts

**Scope:** Cmd+Enter (send), Cmd+O (open proto), Cmd+Shift+R (clear form), Cmd+1/2/3 (tab nav)

**Mount point:** `AppLayout.tsx` via a `useEffect(() => { ... }, [])` that adds a `keydown` listener to `document`. AppLayout is the correct level — it exists for both `main` and `plans` views (App.tsx renders either AppLayout or PlanView, so shortcuts in AppLayout only fire in main view; that is correct behavior).

**Conflict surface:** `src-tauri/src/lib.rs` lines 55-63 register macOS Edit menu with Cmd+C/V/X/Z/Undo/Redo — these are OS-level bindings that never reach the `keydown` listener. Cmd+1/2/3 has no current Tauri menu binding; safe to claim. Cmd+Enter must **not** be blocked when focus is on a text input — the listener must call `sendMessage()` when the active element is a form submit target (button, the overall form), or more precisely: check `e.target` is not a `textarea` or CodeMirror editor before firing.

**New component:** `useKeyboardShortcuts.ts` hook, mounted once in AppLayout. Returns nothing, registers/unregisters on mount/unmount.

```
useKeyboardShortcuts({
  onSend,          // calls publishMessage flow in PublishBar (via store signal)
  onOpenProto,     // calls handleOpenFile from FileSection (via store action or callback)
  onClearForm,     // sets pendingReplayValues to buildDefaultValues(message)
  onSwitchTab,     // calls useProtoStore.getState().setActiveIndex(n)
})
```

**IPC:** None — all actions go through existing store actions or ref callbacks.

**New files:** `src/hooks/useKeyboardShortcuts.ts`

**Modified files:** `src/components/layout/AppLayout.tsx` (mount the hook)

**Critical constraint:** Cmd+Enter shortcut send needs access to the publish action. The cleanest path is a Zustand action or a `useRef` callback passed from PublishBar up to AppLayout through a context. Use a lightweight `PublishContext` with a `triggerSend` ref that PublishBar registers. Avoid prop-drilling through AppLayout to PublishBar.

---

### Feature 2: Form Reset / Clear

**Scope:** Clear all form fields to defaults. Triggered by Cmd+Shift+R shortcut and a Clear button in the FormPanel header.

**Integration:** Uses the existing `setPendingReplayValues` signal with `buildDefaultValues(message)` as the value. FormPanel's existing `useEffect` at lines 154-164 handles the reset identically to replay. No new IPC or store changes needed.

**Where the button lives:** FormPanel header toolbar (already has Library and JSON toggle buttons). Add a `RotateCcw` icon button.

**New files:** None.

**Modified files:** `src/components/form/FormPanel.tsx` (add button, expose reset callback to AppLayout for shortcut binding).

---

### Feature 3: Field-Level Copy to Clipboard

**Scope:** Hover/click icon on each field row that copies the current field value as a string.

**Integration:** Field components (`ScalarField.tsx`, `EnumField.tsx`, `BytesField.tsx`, etc.) each add a hover-visible copy icon button. The field components use `useFormContext()` (already available via `FormProvider` in ProtoFormRenderer) to call `getValues(fieldName)` at click time, then `navigator.clipboard.writeText()`.

**Frozen switch rule:** Field components are NOT the frozen switch — modifying individual field components is safe. This is identical to how BytesField got its base64 helper added.

**Implementation pattern:** Wrapper div with `group` Tailwind class, copy icon with `opacity-0 group-hover:opacity-100` transition, `onClick` reads value via `getValues`, writes to clipboard, shows `sonner` toast confirmation.

**New files:** `src/components/form/fields/FieldCopyButton.tsx` (shared across all field components, ~30 lines).

**Modified files:** ScalarField, EnumField, BytesField — add `<FieldCopyButton fieldName={name} />` adjacent to the label.

**IPC:** None — `navigator.clipboard` API is available in the WebView.

---

### Feature 4: Randomizer

**Scope:** Fill all form fields with type-appropriate random values.

**Where logic lives:** JS utility, not a Rust command. The `ProtoSchema` / `MessageSchema` / `FieldSchema` / `ScalarKind` types are fully available in the frontend (serialized from Rust). A `randomizeValues(message: MessageSchema): Record<string, unknown>` function can generate values for every ScalarKind, enum (random pick from values array), and nested message (recursive). Proto field types are fully enumerated in `FieldKind`.

**Integration:** Output of `randomizeValues()` goes through `setPendingReplayValues(randomValues)` — same path as replay and form reset.

**Button placement:** FormPanel header toolbar, a `Shuffle` icon button.

**Random value guidance per ScalarKind:**
- `string` — random UUID substring or lorem word
- `bool` — `Math.random() > 0.5`
- int types — `Math.floor(Math.random() * 1000)`
- `float/double` — `Math.random() * 100`
- `bytes` — random base64 string
- `enum` — pick random value from `kind.values[]`
- `repeated` — generate 1-3 random elements
- `oneof` — pick one branch at random, set `_selected` accordingly

**New files:** `src/lib/randomize.ts`

**Modified files:** `src/components/form/FormPanel.tsx` (add button + call randomize)

**IPC:** None.

---

### Feature 5: Proto Reload

**Scope:** Reload the currently active `.proto` file from disk, picking up any edits. Updates pool and re-parses schema.

**Backend blocker — CRITICAL:** `src-tauri/src/commands/proto.rs` lines 24-43 explicitly skip files already present in the `DescriptorPool` (the "already open" guard). The comment reads: "Re-loading a changed .proto won't update pool types; restart the app if you change a .proto during a session."

**`prost-reflect` pool limitation confirmed:** `DescriptorPool` has no `remove_file()` method (verified against docs.rs). Files can only be added, not removed. To reload a file, the entire pool must be reconstructed from the remaining open files plus the new version of the target file.

**Recommended backend approach — new `reload_proto` Rust command:**

The frontend passes the full list of all currently open files and their include paths. Rust creates a fresh `DescriptorPool`, re-compiles all non-target files first, then compiles the target file fresh and merges everything into the new pool.

```
invoke('reload_proto', {
  targetFile: string,
  targetIncludes: string[],
  otherOpenFiles: Array<{ filePath: string, includePaths: string[] }>
})
```

The frontend already knows all open files (`useProtoStore.openFiles`) and their include paths (stored in tap.json under `include_paths:{path}`). No new Rust-side state tracking of open files is needed.

**Frontend side:** `reload_proto` IPC wrapper in `src/lib/ipc.ts`, called from a Reload button in the FileSection tab strip row. On success, call `addOrActivateFile(filePath, newSchema)` — this replaces the schema in the openFiles entry.

**New files:** None beyond IPC wrapper additions.

**Modified files:** `src-tauri/src/commands/proto.rs` (new `reload_proto` fn), `src-tauri/src/lib.rs` (register command), `src/lib/ipc.ts` (wrapper), `src/components/sidebar/FileSection.tsx` (reload button in tab header).

---

### Feature 6: Recent Files

**Scope:** Quick-access list of the last N `.proto` files opened, shown in the Sidebar FileSection below the current open tabs.

**Store location:** Extend `useProtoStore` with a `recentFiles: string[]` field and `addRecentFile(path: string)` action. The array is FIFO-capped at 10. Persist to `tap.json` under key `recent_files`.

**Why useProtoStore (not a new store):** Recent files are tightly coupled to file open/close actions already in useProtoStore. Adding them here avoids a cross-store dependency.

**Hydration:** On app init (App.tsx or FileSection mount), load `recent_files` from tauri-plugin-store and call `setRecentFiles(paths)`.

**UI:** Collapsible list or `<Accordion>` below the open tabs in FileSection. Clicking a recent file entry skips the file picker and goes directly to the IncludePathDialog with saved include paths (same flow as manual open after the file picker step).

**New files:** None.

**Modified files:** `src/stores/useProtoStore.ts` (add `recentFiles`, `addRecentFile`, `setRecentFiles`), `src/components/sidebar/FileSection.tsx` (recent files list UI + hydration).

---

### Feature 7: Import Manager

**Scope:** View and edit include paths for the currently loaded proto file without closing and re-opening it.

**Critical dependency:** Requires proto reload (Feature 5) to be useful. Changing include paths and clicking Apply must trigger a `reload_proto` call. Without reload, the user would see updated include path state but stale schema.

**Integration:** The `IncludePathDialog` component already exists and already handles include path editing with persistence to `tap.json`. The import manager is a new trigger for this same dialog, not a new dialog.

**Entry point:** An icon button in the FileSection tab strip row (recommended — closest to the file context). A `FolderInput` or `Settings` icon placed after the tab label, before the close X. Clicking it opens `IncludePathDialog` pre-populated with the current file's saved include paths. On confirm: save paths + call `reload_proto`.

**New files:** None.

**Modified files:** `src/components/sidebar/FileSection.tsx` (add per-tab import path button), `src/lib/ipc.ts` (reload_proto wrapper, from Feature 5).

---

### Feature 8: Schema Explorer

**Scope:** Collapsible tree view of all messages, fields, and enums in the loaded proto file. Field type tooltips on hover.

**Data source:** The existing `ProtoSchema` / `MessageSchema` / `FieldSchema` serialized from Rust is sufficient. `MessageSchema` has `name`, `full_name`, `fields[]`. `FieldSchema` has `name`, `kind` (the full `FieldKind` discriminated union), `repeated`, `oneof_group`, `label`. No new Rust command needed — all data already crosses IPC via `parse_proto`.

**Placement:** A `BookOpen` icon in the Sidebar that opens a Sheet overlay (consistent with AmqpPropertiesSheet pattern). The Sheet renders a full-height scrollable tree.

**Component structure:**
```
SchemaExplorer (shadcn Sheet)
  SchemaMessageTree
    MessageRow (name, full_name)
      FieldRow (name, label, kind badge, repeated badge, Tooltip with type detail)
    ...
```

**Tooltip content:** `ScalarKind` value (e.g., `int32`, `string`), or message full_name for nested messages, or enum value list summary. Shadcn `Tooltip` component already in the UI library.

**New files:** `src/components/schema/SchemaExplorer.tsx`

**Modified files:** `src/components/sidebar/Sidebar.tsx` (add explorer trigger button).

---

### Feature 9: Connection Quick-Switch

**Scope:** Switch between saved connection profiles from a compact toolbar element without opening the sidebar's ConnectionSection.

**Integration:** `useConnectionStore` already holds `profiles[]`, `activeProfileName`, and the `setActiveProfile` + `activate_profile` IPC call pattern. Connection quick-switch reads from and writes to this existing store.

**Placement:** A compact profile select dropdown (shadcn `Select` or `DropdownMenu`) mounted in the PublishBar. PublishBar is the right location — it already shows connection status context.

**Data flow:**
```
ConnectionQuickSwitch (Select)
  onValueChange(profileName)
  invoke('activate_profile', { profileName })  [existing IPC]
  useConnectionStore.setActiveProfile(profileName)
  useConnectionStore.setConnectionStatus('connected')
```

**New files:** `src/components/connection/ConnectionQuickSwitch.tsx` (~40 lines).

**Modified files:** `src/components/publish/PublishBar.tsx` (embed ConnectionQuickSwitch).

---

### Feature 10: Message Draft Persistence

**Scope:** Auto-save last form state per message type; restore it when that message type is selected again, even across app restarts.

**Store location:** `useProtoStore` — draft state is tightly coupled to the active proto file and message type, both already owned by useProtoStore. The persistence IO lives in a dedicated hook, not the store itself.

**Persistence key:** `draft:{messageTypeFullName}` in `tap.json`. For example: `draft:com.example.PaymentRequest`.

**RHF internal fields decision:** Persist values **as-is** including `_selected` and `_selected_*` keys for oneof branch tracking. This is the same shape used by `setPendingReplayValues` and the history replay path (HIST-02), which already handles `_selected` correctly. This avoids schema-walking to reconstruct branch state on hydration. The project already treats `_selected` as a known internal (tech debt note HIST-FT-FUTURE-01).

**Auto-save trigger:** `useDebounce(latestValues, 200)` is already running in FormPanel. Mount a `useEffect` on `debouncedValues` in `useDraftPersistence` that saves when `debouncedValues` is non-null and `selectedMessageType` is set. No second debounce needed — accept `debouncedValues` as a parameter.

**Hydration:** When `selectedMessageType` changes, load the saved draft for that type and call `setPendingReplayValues(savedDraft)`. The existing useEffect in FormPanel handles the remount timing. If no saved draft exists, fall through to default values (current behavior unchanged).

**Draft invalidation:** On `reload_proto` success, delete draft keys for messages in the old schema (stale schema guard). This is an edge case to note in PITFALLS.

**New files:** `src/hooks/useDraftPersistence.ts`

**Modified files:** `src/components/form/FormPanel.tsx` (mount the hook with `selectedMessageType` + `debouncedValues`).

---

## System Overview — v1.8 Additions

```
┌─────────────────────────────────────────────────────────────────────────┐
│  App.tsx                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ AppLayout                                                           │ │
│  │  + useKeyboardShortcuts hook (NEW)                                  │ │
│  │                                                                     │ │
│  │  ┌─────────────────────────┐  ┌──────────────────────┐             │ │
│  │  │ Sidebar                 │  │ PublishBar            │             │ │
│  │  │  FileSection            │  │  + ConnectionQuickSwitch (NEW)     │ │
│  │  │   + recent files list   │  └──────────────────────┘             │ │
│  │  │   + per-tab reload btn  │                                        │ │
│  │  │   + per-tab import btn  │  ┌──────────────────────┐             │ │
│  │  │  MsgType select         │  │ FormPanel             │             │ │
│  │  │  + SchemaExplorer btn   │  │  + Clear button (NEW) │             │ │
│  │  │  ConnSection            │  │  + Randomize button (NEW)          │ │
│  │  └─────────────────────────┘  │  + useDraftPersistence (NEW)      │ │
│  │                               │  ProtoFormRenderer (FROZEN)        │ │
│  │                               │   field components                  │ │
│  │                               │    + FieldCopyButton (NEW)         │ │
│  │                               └──────────────────────┘             │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  SchemaExplorer Sheet (NEW — portal, triggered from Sidebar)             │
└─────────────────────────────────────────────────────────────────────────┘

New Zustand state (extensions to existing stores):
  useProtoStore  + recentFiles[], addRecentFile(), setRecentFiles()

New tauri-plugin-store keys (tap.json):
  recent_files        — string[] FIFO-10
  draft:{fullName}    — Record<string, unknown> (RHF values as-is including _selected)

New Rust command:
  reload_proto        — rebuilds DescriptorPool from remaining files + fresh compile

New JS utilities:
  src/lib/randomize.ts
  src/hooks/useKeyboardShortcuts.ts
  src/hooks/useDraftPersistence.ts
  src/components/form/fields/FieldCopyButton.tsx
  src/components/connection/ConnectionQuickSwitch.tsx
  src/components/schema/SchemaExplorer.tsx
```

---

## Data Flow — New Features

### Form Reset / Randomizer Flow
```
User click (Clear button or Randomize button)
    |
FormPanel handler
    | buildDefaultValues(message) or randomizeValues(message)
    |
useProtoStore.setPendingReplayValues(values)
    |
FormPanel useEffect [existing line 154-164, unchanged]
    |
resetRef.current(values)   -- react-hook-form reset
    |
Form re-renders with new values
```

### Draft Persistence Flow (save)
```
User edits form field
    |
handleValuesChange --> useProtoStore.setLatestValues(values)
    |
useDebounce(latestValues, 200)   [already in FormPanel, unchanged]
    |
useDraftPersistence effect on debouncedValues
    |
tauri-plugin-store.set('draft:{fullName}', values).save()
```

### Draft Persistence Flow (hydrate)
```
User selects message type (or switches tab)
    |
useProtoStore.setSelectedType(fullName)
    |
useDraftPersistence effect on selectedMessageType change
    |
tauri-plugin-store.get('draft:{fullName}')
    | found?
useProtoStore.setPendingReplayValues(savedDraft)
    |
FormPanel useEffect [existing] --> form reset with saved values
```

### Proto Reload Flow
```
User clicks Reload button (FileSection tab row)
    |
FileSection reads activeFilePath + saved include_paths from tap.json
    | (passes all open file paths + include paths)
invoke('reload_proto', { targetFile, targetIncludes, otherOpenFiles })
    | Rust
  DescriptorPool::new()
  compile + add each non-target open file
  compile target file fresh with new include paths
  merge all into new pool
  extract ProtoSchema
    | Frontend
useProtoStore.addOrActivateFile(filePath, newSchema)  -- replaces schema
delete draft keys for old message types (stale schema guard)
```

### Keyboard Shortcut -> Send Flow
```
keydown (Cmd+Enter) on document
    |
useKeyboardShortcuts listener
    | guard: activeElement is not textarea/CodeMirror?
PublishContext.triggerSend()
    |
PublishBar.handlePublish() [existing flow unchanged]
```

---

## Recommended Build Order

Dependencies drive the order. Features with no backend changes and no cross-feature dependencies go first.

### Phase A — Pure Frontend, No Dependencies

1. **Form reset** — One-liner using existing `setPendingReplayValues` signal. Zero risk. Validates the signal is the correct pattern before building on it for draft persistence.
2. **Keyboard shortcuts infra** — `useKeyboardShortcuts.ts` hook with Cmd+Enter (send) + Cmd+Shift+R (reset) + Cmd+1/2/3 (tab switch). Establishes the shortcut mounting pattern.
3. **Field-level copy** — `FieldCopyButton.tsx` shared component, integrated into ScalarField first, then other field types. No store changes.
4. **Randomizer** — `randomize.ts` utility + Shuffle button in FormPanel header. Depends on `setPendingReplayValues` (validated in step 1).
5. **Connection quick-switch** — `ConnectionQuickSwitch.tsx` in PublishBar. Reads existing useConnectionStore. No backend changes.
6. **Schema explorer** — `SchemaExplorer.tsx` Sheet using existing ProtoSchema data. No new IPC or data; can be built any time in Phase A.

### Phase B — Persistence and Backend (sequential; B.1 blocks B.2 and B.3)

7. **Recent files** — Extend useProtoStore + FileSection UI. Pure frontend but exercises tauri-plugin-store pattern that draft persistence also uses.
8. **Proto reload** (new `reload_proto` Rust command) — CRITICAL BLOCKER for Import Manager. Must land first.
9. **Import manager** — New trigger in FileSection that reuses `IncludePathDialog`. Depends on Feature 8 (reload_proto).
10. **Draft persistence** — `useDraftPersistence.ts` hook. Plugs into existing `debouncedValues` stream. Depends on `setPendingReplayValues` (validated in Phase A step 1).

---

## Component Modification Matrix

| Component | Change Type | Features |
|-----------|------------|---------|
| `AppLayout.tsx` | Add hook mount | Keyboard shortcuts |
| `FormPanel.tsx` | Add buttons + hook mount | Reset, Randomizer, Draft persistence |
| `PublishBar.tsx` | Add child component | Connection quick-switch |
| `FileSection.tsx` | Add list + icon buttons | Recent files, Reload, Import manager entry |
| `Sidebar.tsx` | Add icon button | Schema explorer trigger |
| `ScalarField.tsx` | Add copy button | Field-level copy |
| `EnumField.tsx` | Add copy button | Field-level copy |
| `BytesField.tsx` | Add copy button | Field-level copy |
| `src-tauri/src/commands/proto.rs` | New function | Proto reload |
| `src-tauri/src/lib.rs` | Register command | Proto reload |
| `src/lib/ipc.ts` | New IPC wrapper | Proto reload |
| `src/stores/useProtoStore.ts` | New fields + actions | Recent files |

## New Files Created

| File | Purpose | Phase |
|------|---------|-------|
| `src/hooks/useKeyboardShortcuts.ts` | Global shortcut registration | A |
| `src/lib/randomize.ts` | Type-aware random value generation | A |
| `src/components/form/fields/FieldCopyButton.tsx` | Per-field clipboard copy | A |
| `src/components/connection/ConnectionQuickSwitch.tsx` | Profile dropdown in PublishBar | A |
| `src/components/schema/SchemaExplorer.tsx` | Collapsible schema tree in Sheet | A |
| `src/hooks/useDraftPersistence.ts` | Auto-save + hydrate draft per message type | B |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Calling `resetRef.current()` Directly for Value Population

**What people do:** See the `resetRef` in FormPanel and call it directly from new code to populate form values.

**Why it's wrong:** `resetRef.current` is `null` until `ProtoFormRenderer` remounts. Direct calls throw or silently no-op when called before remount (e.g., from JSON mode, from effects that fire before mount). This is documented in FormPanel comments with label "RESEARCH Pitfall 1".

**Do this instead:** Always use `useProtoStore.getState().setPendingReplayValues(values)`. The existing useEffect in FormPanel handles timing correctly.

---

### Anti-Pattern 2: Adding New Cases to ProtoFormRenderer Switch

**What people do:** Add a new field type and add a `case` to the switch in ProtoFormRenderer.

**Why it's wrong:** The switch is frozen by architectural decision in v1.2 (see PROJECT.md Key Decisions: "ProtoFormRenderer switch FROZEN; new field types as pre-dispatch branches"). Adding cases increases modification risk and breaks the extension contract.

**Do this instead:** Add pre-dispatch branch checks before the switch, or modify individual existing field component files directly.

---

### Anti-Pattern 3: Second Debounce in Draft Persistence

**What people do:** Add `useDebounce(formValues, someDelay)` inside `useDraftPersistence`.

**Why it's wrong:** FormPanel already runs `useDebounce(latestValues, 200)` and exposes `debouncedValues`. A second debounce adds unnecessary delay and a second subscription to the same data.

**Do this instead:** Accept `debouncedValues` as a prop/argument to `useDraftPersistence` and use the already-debounced value directly.

---

### Anti-Pattern 4: New Zustand Store for Draft State

**What people do:** Create a `useDraftStore.ts` because draft persistence is a "separate concern."

**Why it's wrong:** Draft state is coupled to `selectedMessageType` and `activeFilePath`, both owned by useProtoStore. A separate store creates a cross-store dependency that must be kept in sync. The project's pattern is stores organized by domain, not by persistence mechanism.

**Do this instead:** Extend `useProtoStore` with draft-related actions only if shared access is needed. Keep persistence IO in `useDraftPersistence.ts` hook.

---

### Anti-Pattern 5: Proto Reload via Pool Append (Skip-If-Exists Guard)

**What people do:** Call `parse_proto` again for a file already in the pool, expecting the updated schema.

**Why it's wrong:** `proto.rs` lines 28-43 explicitly skip files already present by name (`existing.get_file_by_name(&name).is_none()` guard). The `DescriptorPool` API has no `remove_file()` method (confirmed from docs.rs). The result is a no-op — the stale schema is returned.

**Do this instead:** Use the new `reload_proto` command which rebuilds the pool from scratch by reconstructing it from all remaining open files before adding the freshly compiled target file.

---

## Integration Points Summary

### Rust — Frontend Boundary

| Command | Direction | When Called |
|---------|-----------|------------|
| `reload_proto` (new) | Frontend -> Rust | User clicks Reload in FileSection tab row |
| `parse_proto` (existing) | Frontend -> Rust | User opens a new proto file (unchanged) |
| `activate_profile` (existing) | Frontend -> Rust | ConnectionQuickSwitch profile change |

### Store — Component Boundary

| Store | New Fields | Consumer |
|-------|-----------|---------|
| `useProtoStore` | `recentFiles[]`, `addRecentFile()`, `setRecentFiles()` | FileSection |

### tauri-plugin-store — New Keys

| Key | Value | Owner |
|-----|-------|-------|
| `recent_files` | `string[]` (FIFO-10) | `useProtoStore.addRecentFile` |
| `draft:{messageTypeFullName}` | `Record<string, unknown>` | `useDraftPersistence` |

---

## Sources

- `src/components/layout/AppLayout.tsx` — DndContext mount level, component structure (direct read)
- `src/components/form/FormPanel.tsx` — resetRef usage, pendingReplayValues signal, debouncedValues, frozen switch constraint (direct read)
- `src/stores/useProtoStore.ts` — complete store interface, extension points (direct read)
- `src/stores/useConnectionStore.ts` — profiles, activeProfileName, existing actions (direct read)
- `src/components/sidebar/FileSection.tsx` — include_paths persistence pattern (direct read)
- `src-tauri/src/commands/proto.rs` — pool merge guard (skip-if-exists), confirmed reload blocker (direct read)
- `src-tauri/src/lib.rs` — registered commands, macOS menu bindings (direct read)
- `src-tauri/src/schema/types.rs` — ProtoSchema, FieldKind, ScalarKind types — confirms no new Rust command needed for schema explorer or randomizer (direct read)
- `src/lib/ipc.ts` — complete IPC wrapper inventory (direct read)
- `.planning/PROJECT.md` — Key Decisions table, frozen switch decision, tech debt inventory (direct read)
- [prost-reflect DescriptorPool API](https://docs.rs/prost-reflect/latest/prost_reflect/struct.DescriptorPool.html) — confirmed no `remove_file()` method; pool rebuild is required for reload (WebFetch, HIGH confidence)

---
*Architecture research for: Tap v1.8 — UX Polish + Proto Ergonomics*
*Researched: 2026-05-25*
