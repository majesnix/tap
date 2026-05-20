# Phase 9: Routing Key Autocomplete - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

When exchange mode is selected in the publish bar, the plain free-text routing key `<Input>` gains live suggestions drawn from RabbitMQ exchange bindings fetched via the Management API. Suggestions are suppressed for `headers` and `fanout` exchanges (with a hint explaining why). Topic exchange wildcard patterns (`*`, `#` chars) are labeled with an amber "pattern" badge. Falls back to plain free-text when the Management API is unreachable — no error state shown.

**Requirements in scope:** PUBL-01, PUBL-02, PUBL-03, PUBL-04

</domain>

<decisions>
## Implementation Decisions

### Autocomplete Widget (Routing Key Input)
- **D-01:** Replace the plain `<Input>` for routing key with a shadcn Command+Popover combobox (cmdk) when eligible suggestions are available.
- **D-02:** Free-type is always permitted — user can pick from suggestions OR type any custom key not in the list. Required for topic pattern editing (PUBL-03).
- **D-03:** When no eligible exchange is selected (or the selected exchange is `headers`/`fanout`), render the routing key as a plain `<Input>` — do not show the combobox widget.
- **D-04:** Show a small Loader2 spinner inside the routing key input while bindings are being fetched from the Management API.

### Exchange Type Visibility
- **D-05:** The exchange dropdown must show the exchange type as a muted badge beside the name — e.g., `orders` + `[topic]`, `logs` + `[fanout]`. Requires `fetch_exchanges` Rust command to return `{name, exchange_type}` instead of `Vec<String>`.
- **D-06:** When a `headers` or `fanout` exchange is selected, show a small hint text below the routing key input (e.g., "Routing key is ignored for fanout exchanges").

### Pattern Label Style
- **D-07:** Topic wildcard patterns are identified by the presence of `*` or `#` characters in the binding key (AMQP topic exchange spec — no additional exchange-type gate needed).
- **D-08:** Each wildcard pattern in the combobox suggestion list displays a small amber badge labeled "pattern" beside the key text.
- **D-09:** When the user selects a wildcard pattern, copy the full pattern string into the routing key input as-is (e.g., `orders.*.created`). User edits it before sending. No additional inline warning.

### Management API Fallback
- **D-10:** If the Management API is unreachable when bindings are requested, silently fall back to plain `<Input>` — no error state shown. Consistent with PUBL-04 and the existing fallback pattern from Phases 2–4.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §v1.3 — PUBL-01, PUBL-02, PUBL-03, PUBL-04 definitions and acceptance criteria

### Existing Publish Bar (primary integration point)
- `src/components/publish/PublishBar.tsx` — the component being extended; exchange selector, routing key `<Input>`, Management API error handling pattern, fetch-on-mode-change useEffect
- `src/lib/ipc.ts` — `fetchExchanges` IPC wrapper (returns `string[]` — must be updated to `ExchangeSummary[]`)

### Rust Backend (exchange + bindings commands)
- `src-tauri/src/commands/connection.rs` — `fetch_exchanges` command (currently returns names only; `ExchangeApiInfo` struct already captures `exchange_type`); pattern for `load_profile_with_password`, Management API URL construction, error discrimination
- `src-tauri/src/lib.rs` — Tauri command registration (new `fetch_bindings` command must be registered here)

### Design System
- `src/components/ui/popover.tsx` — Popover already installed; usable as combobox container
- `src/components/ui/badge.tsx` — Badge component for type labels and pattern labels

### v1.3 State File Notes
- `.planning/STATE.md` §Research Flags — open questions flagged at v1.3 start: `fetch_exchanges` signature change strategy (Vec<String> → Vec<{name, exchange_type}>); mandatory:true default behavior change

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PublishBar.tsx` exchange select (line 259–284) — existing `Select` + fallback `Input` pattern for the exchange picker; the routing key input (line 309–319) is the exact element to replace.
- `Badge` component — already used for Management API status badges (Live/Manual/auth error); reuse for exchange type and pattern labels.
- `Popover` component — installed; use as the combobox anchor.
- `useConnectionStore` — already holds `exchanges: string[]` and setters; needs to be extended for `exchanges: ExchangeSummary[]`.

### Established Patterns
- **Management API fetch pattern:** `useEffect([activeProfileName, mode])` calls fetch, discriminates 401 vs unavailable, updates store. New `fetch_bindings` call should follow the same pattern but triggered by `[selectedExchange]`.
- **401 discrimination:** `errMsg.includes("authentication failed")` substring match — use the same check for bindings fetch.
- **Fallback to Input:** `managementStatus === "live" ? <Select> : <Input>` — same conditional logic applies to routing key: `eligibleExchange && managementStatus === "live" ? <Combobox> : <Input>`.
- **ProtoFormRenderer switch FROZEN** — not relevant here (PublishBar is independent).

### Integration Points
- `fetch_exchanges` IPC return type changes: `string[]` → `ExchangeSummary[]` (new type with `name` and `exchange_type` fields). Both `ipc.ts` and `useConnectionStore` state shape must be updated.
- New `fetch_bindings(profileName, exchangeName)` Rust command + IPC wrapper needed — returns `BindingKey[]` (each with `routing_key: string`).
- `PublishBar.tsx` routing key section (line 309–319) is the only change point in the UI.

</code_context>

<specifics>
## Specific Ideas

- Exchange type badge style: muted small badge, e.g., `[topic]`, `[fanout]`, `[direct]` — similar to how RabbitMQ Management UI labels exchanges.
- Hint text for headers/fanout: short, factual — "Routing key is ignored for fanout exchanges" or "Headers exchanges route by message headers, not routing key."
- Wildcard pattern badge: amber/warning color to contrast with exact key suggestions, labeled "pattern".

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 9-Routing Key Autocomplete*
*Context gathered: 2026-05-19*
