# Architecture Research: Proto Sender v1.3

**Researched:** 2026-05-19
**Milestone:** v1.3 — Routing key autocomplete, Publisher confirms badge, Message block library
**Overall Confidence:** HIGH (all integration points verified against existing codebase and official docs)

---

## Integration Overview

Three features land on an already-proven Tauri 2.x + React architecture. The v1.0–v1.2 patterns are stable:

- Rust commands handle all credentials and broker communication; React never holds passwords or makes direct AMQP/HTTP calls.
- `useConnectionStore` holds Management API state (queues, exchanges, status).
- `PublishBar` is the single component that orchestrates publish-mode UI.
- `FormPanel` owns the react-hook-form context via `ProtoFormRenderer`; `resetRef` is the only safe way to push values into the form.
- `useHistoryStore` is the established pattern for persisted in-memory data via `tauri-plugin-store` + zustand.

Each v1.3 feature integrates at a clearly-scoped contact surface. None requires a change to the core form rendering pipeline or `ProtoFormRenderer`.

---

## Feature Integration

### Feature 1: Routing Key Autocomplete (PUBL-01)

#### Decision: New Tauri command required

Credentials live in the OS keychain. The existing Management API pattern (`fetch_queues`, `fetch_exchanges` in `connection.rs`) never exposes passwords to the React side — the Rust command builds the Authorization header. Routing key autocomplete requires the same Management API credentials. Making reqwest calls from React is not an option here: it would require shipping plaintext credentials over IPC to the frontend, re-implementing the 401 vs port-unreachable error discrimination in JS, and bypassing the security boundary that the existing pattern deliberately enforces.

**New command: `get_exchange_bindings(profile_name: String, exchange: String) -> Result<Vec<String>, AppError>`**

- Endpoint: `GET /api/exchanges/{vhost}/{exchange}/bindings/source`
- Response: array of binding objects; extract `routing_key` field, deduplicate, return `Vec<String>`
- Error handling: same pattern as `fetch_exchanges` — `is_connect()` → `ManagementApiUnavailable(0)`, HTTP 401 → `ManagementApiAuthFailed`, 404 → `ManagementApiUnavailable(404)`
- Filters: exclude blank routing keys (topic exchange wildcard-only bindings may have empty routing_key); deduplicate (multiple queues can be bound with the same key)
- File: `src-tauri/src/commands/connection.rs` (extend existing file, same pattern as `fetch_exchanges`)

#### State: local component state, NOT a new zustand store

Binding keys are per-exchange-selection. They are UI-local autocomplete data, not cross-component shared state. Adding them to `useConnectionStore` would couple unrelated components to a cache that only `PublishBar` ever reads.

**Pattern in `PublishBar.tsx`:**

```typescript
// Local state keyed by exchange name
const [bindingKeys, setBindingKeys] = useState<string[]>([]);
const [bindingsLoading, setBindingsLoading] = useState(false);

useEffect(() => {
  if (mode !== "exchange" || !selectedExchange || !activeProfileName) {
    setBindingKeys([]);
    return;
  }
  setBindingsLoading(true);
  getExchangeBindings(activeProfileName, selectedExchange)
    .then(setBindingKeys)
    .catch(() => setBindingKeys([]))  // silent fallback: no suggestions
    .finally(() => setBindingsLoading(false));
}, [mode, selectedExchange, activeProfileName]);
```

Binding fetch is fire-and-forget on exchange selection change. Empty result or error → no suggestions shown, routing key input remains fully editable (no blocking). This matches the Management API unavailability graceful degradation pattern already in place.

#### Component change: `PublishBar.tsx`

The current routing key field is a plain `<Input>`. Replace with a combobox that shows `bindingKeys` as suggestions while remaining freely editable (not a constrained select — routing keys for topic exchanges are patterns, not exhaustive lists).

**Combobox implementation:** Use a `<Popover>` + `<Input>` combination (shadcn/ui `Popover` is already installed). Do NOT use `<Select>` — that forces a choice from the list and blocks free-text entry. The popover opens when the input is focused and `bindingKeys.length > 0`, filters suggestions as the user types, closes on blur or selection.

**IPC wrapper in `ipc.ts`:**

```typescript
export async function getExchangeBindings(
  profileName: string,
  exchange: string
): Promise<string[]> {
  return invoke<string[]>("get_exchange_bindings", { profileName, exchange });
}
```

#### Capability file update required

`src-tauri/capabilities/` must list `get_exchange_bindings` (Pitfall 7 from PITFALLS.md — every new command must be added immediately or `invoke()` silently returns null).

---

### Feature 2: Publisher Confirms Badge (PUBL-02)

#### Current state: confirm-select is already wired; NACK is silently swallowed

`publish.rs` already calls `channel.confirm_select(ConfirmSelectOptions::default())` before publish and awaits the confirmation future. This is correct.

**The existing bug:** `confirm_result.map_err(|e| AppError::AmqpError(e.to_string()))?` handles only the transport-level `Err` case. In lapin, `confirm_future.await` returns `Result<Confirmation, lapin::Error>`. The `Confirmation` enum has three variants: `Ack(Option<Box<BasicReturnMessage>>)`, `Nack(Option<Box<BasicReturnMessage>>)`, and `NotRequested`. The current code unwraps `Ok(Confirmation::Nack(...))` without inspecting it — a broker NACK silently becomes `Ok(())` and the frontend shows a success toast. This is a correctness bug that PUBL-02 must fix as part of implementing the badge.

#### Required Rust change: new return type

Change `publish_message` from `Result<(), AppError>` to `Result<PublishOutcome, AppError>`.

```rust
// src-tauri/src/commands/publish.rs — add new type

#[derive(serde::Serialize)]
pub struct PublishOutcome {
    pub acked: bool,
    pub nack_reason: Option<String>,
}
```

The command returns:
- `Ok(PublishOutcome { acked: true, nack_reason: None })` on broker ACK
- `Ok(PublishOutcome { acked: false, nack_reason: Some(...) })` on broker NACK (the reason is extracted from `BasicReturnMessage` if present, otherwise a generic "broker rejected message")
- `Err(AppError::AmqpError(...))` on transport/protocol failure (existing behavior preserved)

**Replace the existing confirm handling in `publish.rs`:**

```rust
// Replace:
confirm_result.map_err(|e| AppError::AmqpError(e.to_string()))?;
Ok(())

// With:
match confirm_result {
    Ok(confirmation) => {
        if confirmation.is_ack() {
            Ok(PublishOutcome { acked: true, nack_reason: None })
        } else {
            let reason = confirmation
                .take_message()
                .map(|m| format!("broker returned message: reply_text={}", m.reply_text))
                .unwrap_or_else(|| "broker NACKed message (no return message)".to_string());
            Ok(PublishOutcome { acked: false, nack_reason: Some(reason) })
        }
    }
    Err(e) => Err(AppError::AmqpError(e.to_string())),
}
```

#### Ephemeral connection: no change needed

`confirm_select` is a per-channel flag called at channel-open time before any publish. The ephemeral connection pattern (new connection per `publish_message` call) supports this cleanly — no persistent channel state is needed. This is confirmed by the existing code structure.

#### IPC wrapper change: `ipc.ts`

```typescript
export interface PublishOutcome {
  acked: boolean;
  nackReason?: string | null;
}

export async function publishMessage(
  profileName: string,
  exchange: string,
  routingKey: string,
  payload: number[],
  amqpProps?: AmqpPropsIpc
): Promise<PublishOutcome> {  // return type changes from Promise<void>
  return invoke<PublishOutcome>("publish_message", { ... });
}
```

#### Frontend: PublishBar.tsx — badge state

```typescript
type ConfirmState = { status: "ack" | "nack" | "none"; reason?: string };
const [confirmState, setConfirmState] = useState<ConfirmState>({ status: "none" });
```

In `handleSend`, after `await publishMessage(...)`:
- `outcome.acked === true` → `setConfirmState({ status: "ack" })` + existing success toast
- `outcome.acked === false` → `setConfirmState({ status: "nack", reason: outcome.nackReason })` + `toast.error(...)` replacing the success toast

Auto-dismiss via `useEffect`:

```typescript
useEffect(() => {
  if (confirmState.status === "none") return;
  const id = setTimeout(() => setConfirmState({ status: "none" }), 3000);
  return () => clearTimeout(id);
}, [confirmState.status]);
```

Badge renders inline in `PublishBar` beside the Send button:

```tsx
{confirmState.status !== "none" && (
  <Badge variant={confirmState.status === "ack" ? "outline" : "destructive"}>
    {confirmState.status === "ack" ? "ACK" : `NACK${confirmState.reason ? `: ${confirmState.reason}` : ""}`}
  </Badge>
)}
```

#### HistoryStore impact

The `HistoryEntry.status` field is already `"sent" | "failed"`. NACK does not map cleanly to either. Options:
1. Add `"nacked"` as a third status value — requires `HistoryEntry` type change.
2. Record NACK as `"failed"` with `errorMessage: "Broker NACKed: ..."` — no type change.

Recommendation: option 2 for v1.3 (simplest, backward-compatible with existing history display). A NACK is effectively a delivery failure from the developer's perspective.

---

### Feature 3: Message Block Library (BLK-01 through BLK-04)

#### State: useBlocksStore (zustand) + tauri-plugin-store (persistence)

This mirrors the `useHistoryStore` pattern exactly. `tauri-plugin-store` is persistence, not state. The in-memory list for UI rendering lives in zustand.

**Store file: `src/stores/useBlocksStore.ts`** (new file)

**Block data model:**

```typescript
export interface MessageBlock {
  id: string;                          // crypto.randomUUID()
  name: string;                        // user-defined label
  values: Record<string, unknown>;     // form getValues() snapshot — schema-agnostic
  updatedAt: string;                   // new Date().toISOString()
}
```

`values` is the same shape as `latestValues` in `useProtoStore` and `fieldValues` in `HistoryEntry` — a flat-ish `Record<string, unknown>` from react-hook-form's `getValues()`. It is schema-agnostic per PROJECT.md ("global/type-agnostic" BLK-04 requirement).

**Store shape:**

```typescript
interface BlocksStore {
  blocks: MessageBlock[];
  blocksLoaded: boolean;
  loadBlocks: () => Promise<void>;
  addBlock: (name: string, values: Record<string, unknown>) => Promise<void>;
  updateBlock: (id: string, name: string, values: Record<string, unknown>) => Promise<void>;
  deleteBlock: (id: string) => Promise<void>;
}
```

Persistence path: `blocks.json` (separate from `history.json` and `proto-sender.json` — follows existing pattern of one concern per store file).

Hydration: `loadBlocks()` called in `App.tsx` at startup alongside `loadHistory()` (existing startup sequence).

#### Block JSON editor component

**New component: `src/components/blocks/BlockEditor.tsx`**

Reuses the existing `JsonEditor` component (`src/components/form/JsonEditor.tsx`) — the CodeMirror wrapper is already generic enough. `BlockEditor` wraps `JsonEditor` with:
- A `name` text input (block label)
- Save / Cancel buttons
- Validation: name must be non-empty; JSON must be valid object

This is a distinct component from `JsonEditor` in the form because its lifecycle (create/edit named block) is different from the form's JSON override toggle (ephemeral per-session).

#### Collapsible block library panel: layout decision

`AppLayout.tsx` currently is three columns: `aside(sidebar) | main(PublishBar + FormPanel) | aside(RightPanel)`.

The block library is most analogous to the right panel (persistent content beside the form) but adding a fourth column makes the layout too wide on typical developer screens (1440px).

**Recommended approach: collapsible sub-panel inside `main`, to the left of `FormPanel`.**

`main` becomes a horizontal split:
```
main
  ├── [optional] BlockLibraryPanel (collapsible, ~240px, left side)
  └── FormPanel (fills remaining space)
```

This keeps the layout at 3 logical columns. `BlockLibraryPanel` is hidden by default and shown when the user activates it (toggle button in `PublishBar` or `FormPanel` header). Its open/closed state is local React state in `AppLayout` or `main`'s component.

**No change to AppLayout's outer structure** — the sidebar and RightPanel stay unchanged. Only the center `main` column gains an internal split.

**New file: `src/components/blocks/BlockLibraryPanel.tsx`**

Renders inside `main` as a flex sibling of `FormPanel`. Contains:
- Block list (name + "Apply" button + edit/delete controls)
- "New block" button that opens `BlockEditor`
- Collapsible (uses existing `Collapsible` component from shadcn/ui, already installed)

#### Drag-and-drop integration

DnD requires a library decision. The HTML5 native drag-and-drop API is hostile in React + Tailwind (flickering, poor touch support, no accessible keyboard). **`@dnd-kit/core`** (~10KB gzip) is the modern standard: composable, accessible, no peer dependency conflicts, works in Tauri's WebView.

**Stack addition required in STACK.md:** `@dnd-kit/core` + `@dnd-kit/utilities`. This is flagged as a needed addition.

DnD interaction:
1. Each block row in `BlockLibraryPanel` is a drag source (`useDraggable`).
2. `ProtoFormRenderer`'s scroll container becomes a drop target (`useDroppable`).
3. On drop, a `handleBlockApply` callback is called in `FormPanel`.

#### Block merge logic in FormPanel

The "merge fills empty fields only" rule requires a decision on what "empty" means. Recommendation for each field type:
- `string`: `""` or `undefined`
- `number`/`int32` etc.: `0` or `undefined`
- `bool`: `false` or `undefined`
- `repeated`: empty array `[]` or `undefined`
- `map rows`: empty array `[]` or `undefined`
- `oneof._selected`: `""` or `undefined`

"Empty" = proto3 default value or `undefined`. A field already set to a non-default value by the user is preserved.

**Merge implementation in `FormPanel.tsx`:**

```typescript
function mergeBlockIntoForm(
  currentValues: Record<string, unknown>,
  blockValues: Record<string, unknown>,
  defaultValues: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...currentValues };
  for (const [key, blockVal] of Object.entries(blockValues)) {
    const current = currentValues[key];
    const defaultVal = defaultValues[key];
    // Only overwrite if current === default (field is "empty")
    if (JSON.stringify(current) === JSON.stringify(defaultVal)) {
      merged[key] = blockVal;
    }
  }
  return merged;
}
```

After merge: call `setPendingReplayValues(merged)` — the existing `useEffect` in `FormPanel.tsx` (line 85–95) handles `resetRef.current(mergedValues)` correctly. Do NOT call `resetRef.current()` directly (the null-before-mount pitfall is documented in PITFALLS.md #21 and in `FormPanel.tsx` line 165).

#### Block creation from current form values

"Save as block" can be triggered from `FormPanel`'s header (a "Save block" button). This reads `useFormContext().getValues()` at click time (not `watch()` — same reason as JSON mode entry). Opens `BlockEditor` in create mode pre-populated with the current values.

---

## New Components

| Component | File | Purpose |
|-----------|------|---------|
| `BlockLibraryPanel` | `src/components/blocks/BlockLibraryPanel.tsx` | Collapsible panel listing named blocks with apply/edit/delete |
| `BlockEditor` | `src/components/blocks/BlockEditor.tsx` | Create/edit a named block — name input + CodeMirror JSON editor |

## New Commands (Rust)

| Command | File | Purpose |
|---------|------|---------|
| `get_exchange_bindings` | `src-tauri/src/commands/connection.rs` | Fetch routing keys for a selected exchange via Management API |

## New Stores

| Store | File | Purpose |
|-------|------|---------|
| `useBlocksStore` | `src/stores/useBlocksStore.ts` | In-memory block list + CRUD + persistence via `blocks.json` |

## New IPC wrappers

| Function | File | Purpose |
|----------|------|---------|
| `getExchangeBindings` | `src/lib/ipc.ts` | Wrapper for `get_exchange_bindings` Tauri command |

---

## Modified Components/Commands

### `src-tauri/src/commands/publish.rs`

- Add `PublishOutcome` struct (`#[derive(serde::Serialize)]`)
- Change return type from `Result<(), AppError>` to `Result<PublishOutcome, AppError>`
- Replace confirm result handling: inspect `Confirmation::is_ack()` / `is_nack()` instead of map_err-only

### `src/lib/ipc.ts`

- Add `getExchangeBindings` function
- Add `PublishOutcome` interface
- Change `publishMessage` return type from `Promise<void>` to `Promise<PublishOutcome>`

### `src/components/publish/PublishBar.tsx`

- Add `bindingKeys: string[]` and `bindingsLoading: boolean` local state
- Add `useEffect` to call `getExchangeBindings` when `selectedExchange` changes in exchange mode
- Replace plain `<Input>` routing key field with a combobox (Popover + Input + suggestion list)
- Add `confirmState: ConfirmState` local state
- Add `useEffect` for auto-dismiss (3s timeout)
- Add ACK/NACK ephemeral badge beside Send button
- Update `handleSend` to use `PublishOutcome` return value

### `src/components/layout/AppLayout.tsx`

- Wrap the center `main` content area to accommodate the optional `BlockLibraryPanel`
- Add a flex row container inside `main`: `[BlockLibraryPanel?] + FormPanel`
- `BlockLibraryPanel` is hidden by default; toggled by a button (location TBD in plan phase — candidate: FormPanel header, or a dedicated "Blocks" icon in Sidebar)

### `src/App.tsx` (or startup bootstrap)

- Add `useBlocksStore.getState().loadBlocks()` call at startup alongside existing `loadHistory()`

### `src-tauri/capabilities/` (capability file)

- Add `get_exchange_bindings` to allowed commands

---

## Suggested Build Order

### 1. Routing Key Autocomplete (PUBL-01) — first

**Why first:** Single new Rust command + single component change scoped to `PublishBar`. No type changes to existing IPC contracts. No new stores. Validates the `GET /api/exchanges/{vhost}/{exchange}/bindings/source` endpoint is reachable on the team's RabbitMQ instances before depending on it for other features. Small blast radius: if this phase has issues, nothing else is broken.

**What it touches:** `connection.rs` (new command), `ipc.ts` (new function), `PublishBar.tsx` (combobox), capability file.

### 2. Publisher Confirms Badge (PUBL-02) — second

**Why second:** Modifies the `publish_message` return type — a cross-cutting change that affects `publish.rs`, `ipc.ts`, and `PublishBar.tsx`. Doing this after PUBL-01 means both `PublishBar.tsx` changes land in sequence (avoid editing the same component in two concurrent phases). The return type change is backward-compatible in spirit but is an API break: any code reading `void` from `publishMessage` must be updated. Doing this early (before BLK-03/04) means the block library's "apply and send" flow (if added later) inherits the correct ACK/NACK feedback.

**Also fixes the existing NACK-silently-passes bug** — this is a correctness improvement bundled with the visual feature.

**What it touches:** `publish.rs` (PublishOutcome type + confirm handling), `ipc.ts` (return type + interface), `PublishBar.tsx` (badge + handleSend update).

### 3. Message Block Library (BLK-01 through BLK-04) — last

**Why last:** The largest feature by surface area. New store, new persistence, new components, DnD library, layout change, FormPanel integration. The DnD library (`@dnd-kit/core`) is a new npm dependency that needs vetting. The block merge logic interacts with `FormPanel.tsx`'s `setPendingReplayValues` / `resetRef` machinery, which is complex (see PITFALLS.md #21). Building this last keeps the PUBL-01/02 phases clean and avoids DnD library setup contaminating a simpler feature's plan.

**Internal order within BLK:**
1. BLK-01 + BLK-02 + BLK-03: Store + persistence + JSON editor UI (no DnD yet — blocks can be applied via an "Apply" button)
2. BLK-04: DnD layer on top of a working apply mechanism

This allows early validation of the merge logic before adding DnD complexity.

---

## Architecture Constraints for Implementation Plans

### Constraint 1: FormPanel reset pathway

All "push values into form" operations must go through `setPendingReplayValues(values)`, never `resetRef.current(values)` directly. `resetRef.current` is `null` until `ProtoFormRenderer` mounts. The `useEffect` in `FormPanel.tsx` (lines 85–95) is the safe sequenced pathway.

### Constraint 2: "Empty" field definition for block merge

The block merge implementation must decide what constitutes "empty" per field type before the plan phase. The recommended definition is: a field is empty if and only if its current value deep-equals the `buildDefaultValues()` output for that field. This is safe because `buildDefaultValues` already exists in `ProtoFormRenderer.tsx` and is used for JSON mode and replay.

### Constraint 3: DnD library dependency

`@dnd-kit/core` is not yet installed. The BLK phase plan must include an npm install step. Version: `@dnd-kit/core ^6.x` (latest stable; compatible with React 18 and Tauri WebView). Also install `@dnd-kit/utilities` for coordinate utilities used in drop detection.

### Constraint 4: Confirm-select is per-channel, not per-connection

`confirm_select` is called on the lapin `Channel` object, not the `Connection`. The ephemeral connection pattern creates a new connection AND a new channel per `publish_message` call. `confirm_select` is called on the new channel — this is correct and is already what the existing code does. No architectural change to the connection pattern is needed.

### Constraint 5: Management API bindings endpoint graceful degradation

The binding keys endpoint (`/api/exchanges/{vhost}/{exchange}/bindings/source`) uses the same Management API base URL and credentials as `fetch_exchanges`. If the Management API is unavailable (i.e., `managementStatus === "manual"`), the binding fetch will also fail. In that case, `bindingKeys` stays empty and the routing key input is a plain text field with no suggestions. This is correct behavior — degrade to manual entry, same as the existing queue/exchange picker degradation.

---

## Sources

- `src/components/publish/PublishBar.tsx` — existing state model, IPC call pattern, Management API error discrimination (HIGH confidence — primary source)
- `src-tauri/src/commands/publish.rs` — existing confirm_select + confirm_future.await; confirmed NACK-swallowing bug (HIGH confidence — primary source)
- `src-tauri/src/commands/connection.rs` — existing fetch_exchanges pattern; template for get_exchange_bindings (HIGH confidence — primary source)
- `src/components/form/FormPanel.tsx` — resetRef pattern, setPendingReplayValues pathway, layout structure (HIGH confidence — primary source)
- `src/stores/useHistoryStore.ts` — pattern for zustand + tauri-plugin-store persistence (HIGH confidence — primary source)
- `src/stores/useConnectionStore.ts` — confirms binding keys should NOT go here (HIGH confidence — primary source)
- lapin `Confirmation` enum: `Ack(Option<Box<BasicReturnMessage>>)`, `Nack(...)`, `NotRequested`; `is_ack()` / `is_nack()` methods (HIGH confidence — docs.rs 1.4.3 and lapin examples verified)
- RabbitMQ Management API: `GET /api/exchanges/{vhost}/{exchange}/bindings/source` returns binding list with `routing_key` field (HIGH confidence — official RabbitMQ API reference)
- `@dnd-kit/core` v6.x — modern accessible React DnD (MEDIUM confidence — ecosystem consensus; verify version compatibility with Tauri WebView during install)
