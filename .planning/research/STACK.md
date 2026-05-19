# Stack Research: Proto Sender v1.3 Publishing UX + Message Blocks

**Researched:** 2026-05-19
**Milestone:** v1.3 — Routing Key Autocomplete, Publisher Confirms Badge, Message Block Library
**Overall confidence:** HIGH — all findings verified against source code, npm registry, GitHub issues, and official RabbitMQ API docs

---

## Context: What is Already Shipped

The stack below is already in place and working. Do NOT re-add or re-research it.

| Layer | Libraries |
|-------|-----------|
| Rust backend | `protox 0.9`, `prost-reflect 0.16` (with `serde` feature), `base64 0.22`, `lapin 4.x` (with `tokio` feature), `reqwest 0.13` (with `json`, `rustls` features), `percent-encoding 2`, `serde 1.x`, `serde_json 1.x` |
| Frontend form | `react-hook-form 7.76`, `@hookform/resolvers 5.x`, `zod 3.25`, `zustand 5.x` |
| Frontend UI | `shadcn/ui` nova preset, `Tailwind 4.x`, `radix-ui 1.x`, `lucide-react 1.x`, `sonner 2.x` |
| Frontend editor | `@uiw/react-codemirror 4.25.9`, `@codemirror/lang-json 6.x` |
| Tauri | `@tauri-apps/api 2.x`, `tauri-plugin-store 2.x`, `tauri-plugin-dialog 2.x`, `tauri-plugin-fs 2.x` |

---

## Summary

Three new capabilities are needed for v1.3. The research findings below are ordered by feature.

**Routing key autocomplete (PUBL-01):** No new Rust crates. One new Rust command (`fetch_binding_keys`) following the exact `fetch_queues` pattern with reqwest. One new shadcn/ui Combobox component installed via `pnpm dlx shadcn@latest add combobox command popover`. The shadcn Combobox is a recipe (Command + Popover composition, cmdk-based in the current shadcn releases). Async data is handled by managing the items list in local state and disabling client-side filtering.

**Publisher confirms badge (PUBL-02):** Zero new dependencies — Rust or npm. `publish.rs` already implements `confirm_select` + the confirm future pattern fully (verified in source). The Tauri command already returns `Ok(())` on ACK and `Err(AppError::AmqpError)` on NACK or timeout. The frontend only needs to display a success/failure badge in `PublishBar.tsx` using the existing `Badge` component and a 3-second `setTimeout` dismiss — both already in the installed stack.

**Message block library (BLK-01–04):** One new npm package: `@dnd-kit/core`. The PointerSensor (not HTML5 DnD) works reliably across Tauri's WebKit on macOS and Linux. Block persistence uses the already-installed `tauri-plugin-store`. Block editing uses the already-installed `@uiw/react-codemirror` + `@codemirror/lang-json`. No new Rust crates required.

---

## New Dependencies

### npm (Frontend)

| Library | Version | Purpose | Why this, not alternatives |
|---------|---------|---------|---------------------------|
| `@dnd-kit/core` | `^6.3.1` | Drag-and-drop for block-to-form merge | PointerSensor uses Pointer Events (not HTML5 DnD), which works in all Tauri WebKit targets. HTML5 DnD has open webkit2gtk Linux bugs in Tauri (#6695). react-dnd is in maintenance mode since 2023. |
| shadcn `Combobox` + `Command` + `Popover` | (source-copied, no version pin) | Routing key autocomplete input | shadcn Combobox is a recipe built on Command (cmdk) + Popover; consistent with shadcn patterns; async data handled via controlled state + `shouldFilter={false}` to disable client-side filtering. |

Install commands:

```bash
pnpm add @dnd-kit/core
pnpm dlx shadcn@latest add combobox command popover
```

Note: `command` and `popover` may already be pulled in as transitive shadcn components — run the add command and let shadcn skip any already-installed components.

### Rust (Backend)

No new crates. All three features are served by the existing `lapin 4.x` and `reqwest 0.13` already in `Cargo.toml`.

---

## Integration Notes

### PUBL-01: Routing Key Autocomplete

**Rust side:** Add a new `fetch_binding_keys` Tauri command to `connection.rs`. The endpoint is:

```
GET /api/exchanges/{vhost}/{exchange}/bindings/source
```

Response is an array of binding objects, each containing a `routing_key` string field. The pattern follows `fetch_queues` exactly: build URL with `percent_encoding::utf8_percent_encode` on both vhost and exchange name, call `reqwest` with `basic_auth`, deserialize with a minimal struct, return `Vec<String>`.

```rust
#[derive(Deserialize)]
struct BindingApiInfo {
    routing_key: String,
}
```

Deduplicate the returned keys (topic exchanges may have multiple bindings with the same routing key to different queues) before returning to the frontend. The default exchange (`""`) has no bindings — return `Vec::new()` immediately without calling the API.

Error handling: follow the existing 401 / is_connect discrimination pattern from `fetch_queues`. Management API unavailability is a non-fatal fallback — if the call fails, the routing key input falls back to plain `<Input>` (same fallback pattern already used for queue/exchange dropdowns in `PublishBar.tsx`).

**Frontend side:** The existing routing key `<Input>` in `PublishBar.tsx` (exchange mode only) becomes a shadcn `Combobox` when Management API is live and `selectedExchange` is non-empty. Fetch binding keys on exchange selection change via `useEffect`. Set `shouldFilter={false}` on the `Command` component inside the Combobox recipe to disable cmdk's client-side filtering — the full list from the API is always shown. The user can still type a free-form routing key not in the suggestions list (use a controlled open/close pattern with a plain `Input` value).

**No new Zustand store needed** — binding keys are local state in `PublishBar.tsx` alongside `selectedExchange`. They are ephemeral (not persisted) and only needed in this component.

---

### PUBL-02: Publisher Confirms Badge

**Rust side: already done.** `publish.rs` already calls `channel.confirm_select(ConfirmSelectOptions::default())` before publish, then awaits the confirm future. The command returns `Ok(())` on broker ACK and `Err(AppError::AmqpError(...))` on NACK. No changes needed in Rust.

**Frontend side only.** After `publishMessage(...)` resolves, show a `<Badge>` in `PublishBar.tsx`:
- `Ok(())` path → green "ACK" badge using `variant="outline"` + emerald dot (matches the existing Live badge style)
- `Err(...)` path → already handled by the existing `toast.error(...)` call; optionally also show a red "NACK" badge inline

Badge state: local `useState` in `PublishBar.tsx` (not Zustand — this is session-only, single-component ephemeral state). Auto-dismiss: `useEffect` + `setTimeout(3000)` clearing the badge state. Clear on dismiss, on next send start, and on mode change.

The `Badge` component (`src/components/ui/badge.tsx`) is already installed. No new component or library needed.

**The existing `sonner` toast for send success can coexist with the inline badge** — they serve different UX purposes (toast confirms the action happened; inline badge confirms broker acknowledgment specifically).

---

### BLK-01–04: Message Block Library

**Block data model:** A block is `{ id: string; name: string; fields: Record<string, unknown> }`. The `fields` object is free-form JSON (the user edits it in the block editor). Stored as an array in `tauri-plugin-store` under a new key (e.g., `"message_blocks"`).

**Persistence:** `tauri-plugin-store` is already installed and used for theme and connection profiles. Add a new `useBlockStore` (Zustand) that reads/writes from the store on the `"message_blocks"` key. No new Rust command needed — the store plugin is JS-accessible directly from `@tauri-apps/plugin-store`.

**Block JSON editor:** Reuse `@uiw/react-codemirror` + `@codemirror/lang-json` (already installed). Same pattern as `JsonOverlay.tsx` from v1.2. No new library needed.

**Block panel layout:** A collapsible panel beside the form. The `Collapsible` component (`src/components/ui/collapsible.tsx`) is already installed.

**Drag-and-drop with @dnd-kit/core:**

Use `DndContext` + `useDraggable` (block item) + `useDroppable` (form drop zone). The PointerSensor is the correct sensor for Tauri WebView:

```tsx
import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";

// In the parent layout component wrapping both BlockPanel and FormPanel:
const sensors = useSensors(useSensor(PointerSensor));

<DndContext sensors={sensors} onDragEnd={handleDragEnd}>
  <BlockPanel />   {/* contains useDraggable items */}
  <FormPanel />    {/* contains useDroppable zone */}
</DndContext>
```

The `handleDragEnd` callback receives `active.data.current` (block data) and `over.id` (drop zone id). Merge logic: iterate the dropped block's `fields`, and for each key, call `rhf.setValue(key, value)` only if the current form value for that key is empty/null/undefined (merge fills empty fields only, per BLK-04).

**Critical Tauri integration note:** Do NOT set `"dragDropEnabled": false` in `tauri.conf.json`. That flag controls Tauri's own native file-drop system and is only relevant for HTML5 DnD (`dragstart`/`drop` events). @dnd-kit's PointerSensor uses Pointer Events (`pointerdown`/`pointermove`/`pointerup`), which are independent of the HTML5 DnD API and work in all WebKit targets including webkit2gtk on Linux.

**@dnd-kit/sortable is NOT needed** — BLK-04 specifies drag onto form only, not reordering the block list.

---

## What NOT to Add

| Rejected | Reason |
|----------|--------|
| `react-dnd` | In maintenance mode since 2023. No new features. HTML5 backend has the same Linux webkit2gtk bugs. |
| Native HTML5 DnD (`dragstart`/`dragover`) | Two Tauri bugs (#6695, #12052) confirm HTML5 DnD does not work in webkit2gtk on Linux. Issue #6695 is still open with "status: upstream" label — no fix timeline. @dnd-kit's PointerSensor is the correct escape hatch. |
| `@dnd-kit/sortable` | Block list reordering is not in scope for BLK-01–04. Adds ~5KB for no benefit. |
| `downshift` | An alternative combobox primitive with async data support. Unnecessary — shadcn's Command + Popover recipe handles the use case with fewer lines and is consistent with existing shadcn components. |
| `react-select` | Heavy (50KB+), hard to theme with Tailwind, not shadcn-consistent. Binding keys are a small list (tens of items), not a paginated async search. |
| Any new Rust crate for binding fetch | `reqwest 0.13` + existing percent-encoding pattern is sufficient for the bindings endpoint. |
| `rabbitmq-management-client` crate | Already rejected in v1.0 for same reason — thin wrapper over two endpoints; `reqwest` is simpler. |
| `immer` | No new mutation patterns introduced. RHF + Zustand already manage state. Speculative addition. |
| Additional CodeMirror packages | Block editor reuses already-installed `@uiw/react-codemirror` + `@codemirror/lang-json`. No new language extensions or themes needed. |

---

## Version Constraints

| Constraint | Detail |
|------------|--------|
| `@dnd-kit/core` | Use `^6.3.1` (latest as of May 2026). Do NOT use `@dnd-kit/sortable` unless block list reordering is added in a future milestone. |
| shadcn Combobox | Installed via `pnpm dlx shadcn@latest add combobox command popover` — source-copied into `src/components/ui/`. The recipe is Command (cmdk) + Popover. Use `shouldFilter={false}` on `<Command>` when displaying async data from the bindings API. |
| `lapin 4.x` confirm-select | `ConfirmSelectOptions::default()` is the correct call. The confirm future returned by `basic_publish` MUST be awaited BEFORE closing the connection — closing first causes "invalid connection state: Closed" panic. This is already correctly implemented in `publish.rs`. |
| Tauri `dragDropEnabled` | Do NOT set to `false` unless native file-drop is needed elsewhere. @dnd-kit uses PointerSensor (Pointer Events), not HTML5 DnD events. |
| Block store key | Use a distinct store key (e.g., `"message_blocks"`) in `tauri-plugin-store` — separate from `"proto-sender-profiles"` and `"theme"`. Do not merge into existing store keys. |

---

## Sources

- `publish.rs` source (already shipped): `/Users/majesnix/gits/proto-sender/src-tauri/src/commands/publish.rs`
- `connection.rs` `fetch_queues` pattern: `/Users/majesnix/gits/proto-sender/src-tauri/src/commands/connection.rs`
- `PublishBar.tsx` routing key input: `/Users/majesnix/gits/proto-sender/src/components/publish/PublishBar.tsx`
- Tauri HTML5 DnD Linux bug (open, status: upstream): https://github.com/tauri-apps/tauri/issues/6695
- Tauri HTML5 DnD Linux bug duplicate (closed as dupe of above): https://github.com/tauri-apps/tauri/issues/12052
- @dnd-kit PointerSensor docs: https://dndkit.com/api-documentation/sensors/pointer
- @dnd-kit/core 6.3.1 on npm: https://www.npmjs.com/package/@dnd-kit/core
- RabbitMQ HTTP API bindings/source endpoint: https://www.rabbitmq.com/docs/http-api-reference
- shadcn Combobox: https://ui.shadcn.com/docs/components/combobox
- shadcn Combobox async pattern issue: https://github.com/shadcn-ui/ui/issues/1391
