# Phase 15: Filter + Export - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Add client-side filtering and JSON export to the existing `MessageFeedTab`. Users can narrow the message feed by routing key (text substring) and content-type (dropdown), and export the currently visible (filtered) messages to a JSON file via a native Tauri save dialog.

Requirements covered: FILT-01, FILT-02, XPRT-01.

No new Rust commands are needed for filtering (purely frontend derived state). Export uses the already-in-stack `@tauri-apps/plugin-dialog` + `@tauri-apps/plugin-fs`.

</domain>

<decisions>
## Implementation Decisions

### Filter Bar Placement

- **D-01:** A **separate filter row** sits between the subscribe panel row and the feed header (`bg-muted` bar). Always visible; no toggle needed. This avoids crowding the existing feed header (count + Clear button).
- **D-02:** Filter row layout: `[routing key input — flex-1] [content-type dropdown] [Export button]`. Export lives on the right side of the filter row — logically grouped with filters since it exports what's visible.
- **D-03:** Filter state lives in **local `useState` inside `MessageFeedTab`** — not in `useResponseStore`. No persistence across restarts needed; no other component reads filter state.
- **D-04:** Content-type dropdown values are **dynamically derived from the distinct content-types in the current `messages[]`**. "All" is always the first option. The list updates reactively as messages arrive or are cleared. Null/empty content-type appears as `"(none)"` in the dropdown but filters by `null` internally.
- **D-05:** When both filters are active, they combine with **AND** — the visible set requires routing key substring match AND content-type match simultaneously.

### Export Mechanism

- **D-06:** Export uses the **native Tauri save dialog** (`@tauri-apps/plugin-dialog` `save()`) followed by a file write via `@tauri-apps/plugin-fs`. Both plugins are already in the stack.
- **D-07:** Default filename in the save dialog: `feed-export-{ISO-timestamp}.json` — e.g., `feed-export-2026-05-21T14-32.json`. Timestamp is generated at click time (local ISO string, colons replaced with dashes for filesystem compatibility).
- **D-08:** If the user cancels the dialog: **silent** — no toast, no state change.
- **D-09:** Export operates on the **currently visible (filtered) messages**, matching XPRT-01. If filters are active, only matching messages are exported. The full `messages[]` array is never exported without respect to filters.

### Export JSON Shape

- **D-10:** Per-message object is a **curated human-readable subset** — omit `id` (internal UUID, not meaningful outside the session) and `hexString` (raw bytes, noise in a JSON export). Include: `routingKey`, `exchange`, `contentType`, `timestamp`, `decodedAs`, `decoded`, `error`.
- **D-11:** `timestamp` is serialized as an **ISO 8601 string** (`new Date(ts * 1000).toISOString()` from epoch seconds). If timestamp is `null` (publisher did not set it), serialize as `null`.
- **D-12:** Top-level JSON structure is a **wrapped object**: `{ "exportedAt": "<ISO string>", "messageCount": N, "messages": [...] }`. Self-describing — consumer knows when it was exported and how many messages to expect.
- **D-13:** On successful export: a brief **Sonner success toast** confirms the action — e.g., `"Exported 42 messages"`. (Already wired in App.tsx.)

### Claude's Discretion

- Routing key filter uses case-insensitive `includes()` substring match
- Export button is disabled when visible messages count is 0
- Export button icon (suggest Download from lucide-react, already in the project)
- Filter row border, padding, and background (follow existing `border-b border-border` pattern)
- Whether to show the active filter count in the feed header count label (e.g., "12 of 42 messages")
- Whether content-type `null` values are shown as `"(none)"` or `"application/octet-stream"` in the dropdown label
- `@tauri-apps/plugin-fs` write uses `writeTextFile` with the path returned by the dialog

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Filter — FILT-01, FILT-02 (authoritative acceptance criteria for routing key and content-type filtering)
- `.planning/REQUIREMENTS.md` §Export — XPRT-01 (authoritative acceptance criteria for JSON export)
- `.planning/ROADMAP.md` §Phase 15 — success criteria and phase goal

### Existing Feed Architecture (read before implementing)
- `src/components/response/MessageFeedTab.tsx` — component to extend: add filter row between subscribe panel and feed header; filter logic as local derived state
- `src/stores/useResponseStore.ts` — store providing `messages: FeedMessage[]`; filter state stays local, not in store (D-03)
- `src/lib/types.ts` — `FeedMessage` interface (fields available for filtering: `routingKey`, `contentType`)

### Phase 13 + 14 Context (decisions that constrain Phase 15)
- `.planning/phases/13-message-feed-foundation-drain-mode/13-CONTEXT.md` — FIFO-500 cap, `FeedMessage` shape, feed header layout, Clear button
- `.planning/phases/14-live-subscribe-mode/14-CONTEXT.md` — subscribe panel row placement; filter row goes below subscribe panel

### Stack Constraints
- `@tauri-apps/plugin-dialog` — already in stack; `save()` API used for native save dialog (D-06)
- `@tauri-apps/plugin-fs` — already in stack; `writeTextFile(path, content)` used to write the export (D-06)
- `toast` from `"sonner"` — already wired in App.tsx; use for export success toast (D-13)
- lucide-react icons — already in use across the codebase

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/stores/useResponseStore.ts::messages` — the source `FeedMessage[]`; filter derives a subset for rendering and export
- `src/components/ui/sonner.tsx` + `toast` — wired in App.tsx; use `toast.success()` for export confirmation (D-13)
- `src/components/ui/input.tsx` (shadcn Input) — use for the routing key text input in the filter row
- `src/components/ui/select.tsx` (shadcn Select) — use for the content-type dropdown in the filter row
- `src/components/ui/button.tsx` (shadcn Button) — use for the Export button; `variant="outline"` matches existing toolbar buttons

### Established Patterns
- Filter row follows the same `px-4 py-2 border-b border-border flex items-center gap-2` pattern as the subscribe panel row in `MessageFeedTab.tsx`
- Feed header (`bg-muted` bar) keeps its count + Clear button unchanged; filter row is a new sibling row above it
- Zustand selector usage: `const messages = useResponseStore((s) => s.messages)` — follow existing per-field selector pattern
- Import `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs` from their respective package names (already in `package.json`)

### Integration Points
- `MessageFeedTab.tsx` → add `filterRoutingKey: string` and `filterContentType: string | null` local state; compute `visibleMessages` as a `useMemo` derived from `messages` + both filter values; render filter row; pass `visibleMessages` to the Accordion map and to the export handler
- `src/lib/ipc.ts` or inline in component → `exportFeed(visibleMessages)` handler: calls `dialog.save()` then `fs.writeTextFile()`; no new Rust command needed
- Feed header count label: update to show `visibleMessages.length` (and optionally `of messages.length` when a filter is active)

</code_context>

<specifics>
## Specific Ideas

- Filter row layout sketch: `| [ routing key... ] [ Content-type ▾ ] [ ↓ Export ] |`
- Feed header count when filter active: `"12 of 42 messages"` vs `"42 messages"` when inactive
- Export JSON example:
  ```json
  {
    "exportedAt": "2026-05-21T14:32:05.000Z",
    "messageCount": 3,
    "messages": [
      {
        "routingKey": "order.created",
        "exchange": "orders",
        "contentType": "application/octet-stream",
        "timestamp": "2026-05-21T14:31:58.000Z",
        "decodedAs": "OrderEvent",
        "decoded": { "orderId": "abc-123", "amount": 99.99 },
        "error": null
      }
    ]
  }
  ```

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 15-Filter + Export*
*Context gathered: 2026-05-21*
