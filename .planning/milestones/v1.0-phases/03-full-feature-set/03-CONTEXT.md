# Phase 3: Full Feature Set - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers the complete v1 feature set on top of Phases 1 and 2:

- **HIST-01–04:** Message history log — every sent message recorded with timestamp, target, type name, status; filterable by type and target; entries re-populate the form on click; binary payload viewable as hex string.
- **PUBL-04:** AMQP message properties — content-type, delivery-mode, TTL, correlation-id, reply-to, custom headers as key-value pairs — configurable before each send.
- **PROT-03:** WellKnownType fallback controls — Any/Struct placeholders show `[wkt] (JSON)`, scalar wrapper types show `[wkt] value`; badge shows actual type name (not generic "wkt"). Timestamp and Duration controls from Phase 1 are unchanged.
- **PROT-04:** Multi-proto file tabs — up to N proto files open simultaneously, each in a sidebar tab; switching tabs reloads the schema and message type selector for that file.

All UI/interaction decisions are locked in the approved `03-UI-SPEC.md` (approved 2026-05-18). This context focuses on implementation decisions not covered by the UI spec.

</domain>

<decisions>
## Implementation Decisions

### Message History Storage

- **D-01:** History is persisted via `tauri-plugin-store` on the frontend — the same layer used for connection profiles. No new Rust commands required for history I/O.
- **D-02:** History is capped at **100 entries**. When the cap is hit, the oldest entry is dropped (FIFO). This bounds store file size even with large binary payloads from complex messages.
- **D-03:** Each history entry stores **both** the JSON field values object (for HIST-02 form replay via `reset()`) **and** the raw binary bytes (for HIST-03 hex view). Replay does not require re-encoding — the saved field values are injected directly into the form.

History entry schema (per entry in the store):
```ts
interface HistoryEntry {
  id: string;              // uuid or timestamp-based ID
  timestamp: string;       // ISO string (local)
  messageTypeName: string; // full proto type name
  exchange: string;        // "" for default exchange (queue mode)
  routingKey: string;      // queue name (queue mode) or routing key (exchange mode)
  status: "sent" | "failed";
  errorMessage?: string;   // present on failed entries
  fieldValues: Record<string, unknown>; // react-hook-form values for reset()
  payloadBytes: number[];  // binary bytes for hex view (JSON-serializable as number array)
}
```

### AMQP Properties State

- **D-04:** AMQP properties are **session-only** — they reset to defaults on app restart. No persistence via `tauri-plugin-store`. Defaults: `content-type = "application/octet-stream"`, `delivery-mode = 2` (persistent), TTL/correlation-id/reply-to/custom-headers = empty.
- **D-05:** AMQP properties state lives in a new **`useAmqpStore`** Zustand store, following the same typed interface + `INITIAL_STATE` + `create()` pattern as `useConnectionStore` and `useProtoStore`. The store is subscribed by `PublishBar` (reads properties for the `publish_message` IPC call) and `AmqpPropertiesSheet` (reads + writes via Apply/Reset).

### Multi-Proto File Tabs

- **D-06:** When the user switches from Tab A to Tab B and back to Tab A, Tab A's Message Type selector **resets to the first message type**. No per-tab message type memory. This keeps `useProtoStore` simple and matches the current `setFile()` behavior.
- **D-07:** `useProtoStore` is expanded to hold multiple open files as an **array with an active index**:
  ```ts
  openFiles: Array<{ filePath: string; schema: ProtoSchema }>;
  activeIndex: number;
  ```
  The existing `schema` and `activeFilePath` fields are derived from `openFiles[activeIndex]`. `setFile()` becomes `addOrActivateFile(filePath, schema)` — adds a new tab if the file isn't already open, or activates the existing tab if it is. The existing `selectedMessageType`, `hexPreview`, `isEncoding`, `encodeError` fields remain; they reset when `activeIndex` changes.

### Rust Backend Extension (PUBL-04)

- **D-08:** The existing `publish_message` Tauri command must be extended to accept optional AMQP properties. New parameters (all optional): `content_type: Option<String>`, `delivery_mode: Option<u8>`, `ttl: Option<u32>`, `correlation_id: Option<String>`, `reply_to: Option<String>`, `headers: Option<Vec<(String, String)>>`. These map to `lapin::BasicProperties` fields before the `basic_publish` call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### UI Design Contract (LOCKED)
- `.planning/phases/03-full-feature-set/03-UI-SPEC.md` — Complete UI design contract for Phase 3. All visual/interaction decisions are locked here: layout (3-pane with right dual-tab), component inventory, history table columns, AMQP Sheet layout, multi-proto tab behavior, copywriting, spacing, typography, color. **Read before planning any frontend work.**

### Project Requirements and Scope
- `.planning/PROJECT.md` — Project overview, core value, constraints, key decisions log
- `.planning/REQUIREMENTS.md` — Full v1 requirements; Phase 3 covers PROT-03, PROT-04, PUBL-04, HIST-01–HIST-04
- `.planning/ROADMAP.md` — Phase 3 goal, success criteria (SC-1 through SC-5), requirement mapping

### Technology Decisions
- `CLAUDE.md` — Complete tech stack with crate versions, alternatives considered, version constraints. Critical for Phase 3: `lapin::BasicProperties` (PUBL-04), `tauri-plugin-store` (history storage), `react-hook-form` `reset()` (HIST-02 replay), `useFieldArray` pattern (HIST repeated operations)

### Prior Phase Context
- `.planning/phases/02-connect-publish/02-CONTEXT.md` — Decisions D-01–D-15: publish bar layout, toast notifications pattern, profile modal pattern, store patterns
- `.planning/phases/01-proto-parsing-form/01-CONTEXT.md` — Decisions from Phase 1: component architecture, WellKnownTypeField implementation (already handles Timestamp/Duration), depth cap pattern, Zustand store pattern

### Existing Source Files (critical integration points)
- `src/stores/useProtoStore.ts` — Store to expand for multi-proto tab support (D-06, D-07)
- `src/stores/useConnectionStore.ts` — Pattern for new `useAmqpStore` (D-05)
- `src-tauri/src/commands/publish.rs` — Extend for AMQP properties (D-08)
- `src-tauri/src/lib.rs` — Register any new Tauri commands
- `src/components/layout/AppLayout.tsx` — Replace `<HexPreviewPanel />` with `<RightPanel />` (per UI-SPEC)
- `src/components/preview/HexPreviewPanel.tsx` — Moved inside RightPanel tabs
- `src/components/publish/PublishBar.tsx` — Add AMQP Properties trigger button, wire useAmqpStore
- `src/components/sidebar/FileSection.tsx` — Replace single-file display with Tabs (PROT-04)
- `src/components/form/fields/WellKnownTypeField.tsx` — Update badge text + placeholders (PROT-03)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/stores/useConnectionStore.ts` — Pattern for `useAmqpStore`: typed interface + INITIAL_STATE + create(). Exact pattern to follow.
- `src/stores/useProtoStore.ts` — Extend this store (not replace) for multi-proto support; `setFile()` → `addOrActivateFile()`, add `openFiles[]` + `activeIndex`.
- `src/components/form/fields/WellKnownTypeField.tsx` — Already handles Timestamp + Duration. PROT-03 only requires updating the fallback branch: badge text + placeholder. Minimal change.
- `src/components/include-paths/IncludePathDialog.tsx` — Modal dialog pattern (shadcn Dialog); reference for HexViewDialog structure.
- `src/components/sidebar/FileSection.tsx` — Replace the single-file UI with Tabs; the Tauri file-picker invocation is reused for the `+` tab button.
- `src-tauri/src/commands/publish.rs` — Existing `publish_message` command extends to accept `Option<BasicProperties>` fields rather than a new command.

### Established Patterns
- Zustand: typed interface + `INITIAL_STATE` + `create<Interface>((set) => ({...}))` — `useAmqpStore` follows this exactly
- `tauri-plugin-store`: `const store = await load('history.json', { autoSave: false })` → `set(KEY, entries)` → `save()` — same pattern as profile storage
- Tauri IPC: `invoke('command_name', { ...args })` with typed return — `publish_message` extension adds optional fields
- shadcn/ui Tabs: already used in Phase 3 UI-SPEC for RightPanel and FileSection; `npx shadcn add tabs` required
- Toast notifications: `sonner` via `src/components/ui/sonner.tsx` — resend success/failure toasts mirror Phase 2 send toasts

### Integration Points
- `src/components/layout/AppLayout.tsx` → `<aside className="w-80 ...">` replaces `<HexPreviewPanel />` with new `<RightPanel />` component
- `src/components/publish/PublishBar.tsx` → "Properties" button triggers `AmqpPropertiesSheet`; `useAmqpStore` provides properties to the `publish_message` IPC call
- `src-tauri/src/lib.rs` → `invoke_handler!` may need new commands if history operations require Rust (none required per D-01)
- `src-tauri/src/commands/publish.rs` → `publish_message` extends its signature; `lapin::BasicProperties` chain updated

</code_context>

<specifics>
## Specific Ideas

- History store key: `"history"` in a dedicated store file (`history.json`) separate from profiles (`profiles.json`) — avoids key collisions and keeps stores bounded.
- For HIST-02 replay: `useProtoStore.setSelectedType(entry.messageTypeName)` then `form.reset(entry.fieldValues)` — must ensure the active proto schema contains the message type before resetting; if the type is not in the current schema (user switched tabs), show an error toast.
- For PUBL-04 headers serialization: custom headers stored as `Array<{key: string; value: string}>` in `useAmqpStore`; serialized to `lapin::types::FieldTable` on the Rust side from the `Vec<(String, String)>` IPC argument.
- PROT-03 is a small delta: only `WellKnownTypeField.tsx` needs changes — badge `{wkt}` text (already done per Phase 1) and placeholder update for Any/Struct vs. wrapper types. Can be a single plan.

</specifics>

<deferred>
## Deferred Ideas

- **Response queue / consumer listening** — User wants to be able to select a response queue and listen for replies from the consumer. This is message consumption, explicitly Out of Scope for v1 per REQUIREMENTS.md ("Message consumption / reading from queues — send-only tool by design"). Strong candidate for v2.
- **Dark/light mode theme switcher** — User wants a theme toggle (light/dark). Not in Phase 3 scope; a UI enhancement that could be added as a polish phase or v2 feature. Tailwind 4 + shadcn support `prefers-color-scheme` and `.dark` class — low effort when prioritized.

</deferred>

---

*Phase: 3-Full Feature Set*
*Context gathered: 2026-05-18*
