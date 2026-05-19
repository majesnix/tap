# Research Summary: Proto Sender v1.3 — Publishing UX + Message Blocks

**Project:** Proto Sender
**Milestone:** v1.3
**Researched:** 2026-05-19
**Confidence:** HIGH

---

## Stack Additions

New dependencies only — all other libraries are already installed.

| Library | Version | Purpose |
|---------|---------|---------|
| `@dnd-kit/core` | `^6.3.1` | Drag-and-drop for block-to-form merge. PointerSensor (not HTML5 DnD) — required for webkit2gtk Linux compatibility. |
| shadcn `Combobox` + `Command` + `Popover` | source-copied | Routing key autocomplete input. `pnpm dlx shadcn@latest add combobox command popover` — components copied into `src/components/ui/`. |

Zero new Rust crates. All three features use already-installed `lapin 4.x` and `reqwest 0.13`.

---

## Feature Table Stakes

### PUBL-01: Routing Key Autocomplete

- Selecting an exchange fetches `GET /api/exchanges/{vhost}/{name}/bindings/source` and displays unique non-empty `routing_key` values as suggestions
- Autocomplete suppressed for `headers` and `fanout` exchanges (routing key is always empty for these types — would mislead users)
- Topic exchange wildcard patterns (`orders.*.created`) shown labeled as patterns; user must edit before sending
- Input remains free-text; suggestions are non-binding
- When Management API is unavailable, plain text input with no suggestions, no error shown
- `fetch_exchanges` Rust command must return `Vec<{name, exchange_type}>` — prerequisite for per-type suppression logic

### PUBL-02: Publisher Confirms Badge

- `publish_message` returns `PublishOutcome { acked: bool, returned: bool }` instead of `()`
- `Confirmation::Nack` explicitly matched and returned as `acked: false` (currently silently passes as `Ok(())` — pre-existing correctness bug that PUBL-02 must fix)
- `confirm_future.await` wrapped in 5s `tokio::time::timeout`; timeout is a distinct badge state
- `BasicPublishOptions::mandatory = true` so unroutable messages produce `Ack(Some(BasicReturnMessage))` (amber "Returned") instead of silent ACK
- Badge states: green ACK (auto-dismiss 3s), amber Returned (5s), red NACK (5s), gray Timeout (manual dismiss)
- Badge state lives in local `useState` in `PublishBar.tsx` — not in any Zustand store

### BLK-01–04: Message Block Library

- Block data model: `{ id: string, name: string, values: Record<string, unknown>, updatedAt: string }` persisted in `blocks.json` (separate store file, not mixed with `proto-sender.json`)
- CRUD: create, edit, delete with confirmation; persists across restarts via `tauri-plugin-store`
- `useBlocksStore` has a `blocksLoaded` guard; write operations reject until hydration completes
- Block editor reuses existing `@uiw/react-codemirror` + `@codemirror/lang-json` (already installed)
- Block library panel is collapsible; inside center `main` column as a flex sibling of `FormPanel` — no fourth column added to `AppLayout`
- DnD uses `PointerSensor` only; single `DndContext` at `AppLayout` level; entire `FormPanel` registered as one `useDroppable` zone (not per-field)
- Merge uses `getFieldState(path).isDirty === false` to detect "empty" — proto3 defaults pre-populate all fields; value comparison would overwrite user inputs that match defaults
- Merge: `setValue(path, coercedValue, { shouldDirty: false })` for scalars; `useFieldArray.replace()` for repeated/map fields; never calls `reset()`
- Type coercion before each `setValue`: int64 family → string, enum → number, bytes → base64 string, bool → Boolean
- Unmatched block keys produce a warning toast listing skipped fields

---

## Critical Pitfalls (Top 5)

1. **NACK silently passes as success:** `confirm_result.map_err(...)` only catches `Err(lapin::Error)` — `Confirmation::Nack` is `Ok(Confirmation::Nack(...))` and currently produces a false green badge. Fix: match the full `Confirmation` enum after awaiting the confirm future.

2. **Unroutable messages ACK with `mandatory: false`:** No binding match → broker discards silently → green badge for a dropped message. Fix: set `mandatory: true` and handle `Ack(Some(BasicReturnMessage))` as amber "Returned" badge state.

3. **`DndContext` scope error produces `over: null` on every drop:** Both `useDraggable` and `useDroppable` must be inside the same `DndContext`. Placing context inside either panel only will cause all drops to report `over: null`. Fix: single `DndContext` at `AppLayout` level, above both panels.

4. **Value comparison for "empty" overwrites user input:** Proto3 pre-populates every field with type defaults — comparing values would treat unmodified defaults as empty and overwrite fields the user filled in with a default value. Fix: use `getFieldState(path).isDirty === false`.

5. **`fetch_exchanges` must return exchange type before Phase 1 starts:** Currently returns `Vec<String>`. PUBL-01 needs `exchange_type` to suppress misleading suggestions for headers/fanout exchanges. Miss this and the autocomplete shows `x-match` binding keys for headers exchanges. Fix: update `fetch_exchanges` to `Vec<{name, exchange_type}>` as the first task in Phase 1.

---

## Build Order

| Phase | Feature | Rationale |
|-------|---------|-----------|
| Phase 9 | PUBL-01 Routing Key Autocomplete | Smallest scope; validates Management API bindings endpoint; `fetch_exchanges` signature change lands here first |
| Phase 10 | PUBL-02 Publisher Confirms Badge | Fixes pre-existing NACK bug; stabilizes `publish_message` IPC contract before block library builds on top |
| Phase 11 | BLK-01/02/03 Block Library (no DnD) | Store + persistence + editor + click-to-apply button; validates merge algorithm before DnD complexity added |
| Phase 12 | BLK-04 Drag-and-Drop Layer | `@dnd-kit/core` + `DndContext` at `AppLayout` level; wires `onDragEnd` to already-tested merge function from Phase 11 |

---

## Open Questions

1. **`fetch_exchanges` signature change strategy:** Breaking IPC change (`Vec<String>` → `Vec<{name, exchange_type}>`). Update all call sites in one step at Phase 9 start, or introduce a parallel `fetch_exchange_details` command to avoid touching existing call sites?

2. **`mandatory: true` as v1.3 default:** Flips existing behavior — teams now see amber "Returned" where they previously saw silent green ACK for unroutable messages. New default for all sends, or opt-in toggle in the AMQP properties sheet?

3. **`BlockLibraryPanel` toggle location:** Panel is hidden by default. Toggle button placement (FormPanel header button, Sidebar icon, or keyboard shortcut) not yet decided. Must resolve before Phase 11 UI work.

4. **Topic exchange wildcard annotation UX:** Exact label text and post-selection behavior (editable template or copy-as-is?) unspecified. Decide in Phase 9 plan.

---
*Generated: 2026-05-19*
