# Phase 19: Plan Data Model and Persistence - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Define the `Plan`, `PlanStep`, and `StepStatus` TypeScript types, implement `usePlanStore` with full CRUD (create, rename, delete, duplicate), and wire persistence to `plans.json` via `tauri-plugin-store`. No UI. Every subsequent v1.6 phase builds on this type contract and store.

</domain>

<decisions>
## Implementation Decisions

### PlanStep Type Shape
- **D-01:** Define the **full** `PlanStep` shape in Phase 19 — do not defer fields to Phase 21. All fields that Phase 21 (Step Editor) and Phase 22 (Runner) will need must be present from the start to avoid a schema_version bump mid-milestone.
- **D-02:** Required `PlanStep` fields: `id` (string, UUID), `name` (string), `proto_path` (string), `message_type` (string), `field_values` (string — serialized JSON, not `Record<string, unknown>`), `target` (discriminated union), `response_mode` (discriminated union).

### Discriminated Unions
- **D-03:** Publish target modeled as a discriminated union:
  ```ts
  type PublishTarget =
    | { kind: 'queue'; queue: string }
    | { kind: 'exchange'; exchange: string; routing_key: string }
  ```
  Mirrors the existing PublishBar target model. Phase 22 exhaustive-switches on `kind`.

- **D-04:** Response mode modeled as a discriminated union:
  ```ts
  type ResponseMode =
    | { mode: 'no-wait'; delay_ms: number }
    | { mode: 'correlation-id'; reply_queue: string; timeout_ms: number }
    | { mode: 'first-arrival'; reply_queue: string; timeout_ms: number }
  ```
  Default values: `delay_ms: 200`, `timeout_ms: 10000`. Phase 22 exhaustive-switches on `mode`.

### Plan Type Shape
- **D-05:** `Plan` fields: `id` (string, UUID), `name` (string), `schema_version` (number — starts at 1), `steps` (PlanStep[]).
- **D-06:** `schema_version` lives on `Plan` only (not on `PlanStep`). Steps are versioned through their parent plan. Number type (not semver string) — simpler to compare in future migration logic.
- **D-07:** No migration stubs in Phase 19 — just the `schema_version: 1` constant declaration. Migration logic is written when the first schema change actually happens.

### StepStatus Type
- **D-08:** `StepStatus` is defined as a full enum-style union in Phase 19, even though it is only used in Phase 22:
  ```ts
  type StepStatus = 'pending' | 'sending' | 'waiting-response' | 'done' | 'error'
  ```
  Defined here so the type contract is stable when Phase 22 plans against it.

### usePlanStore Scope
- **D-09:** `usePlanStore` is **CRUD + persistence only** — no `selectedPlanId`, no UI selection state. Mirrors the `useBlockStore` pattern (no "selected block" state). Phase 20 manages active plan selection as local React state.
- **D-10:** `usePlanExecutionStore` is **NOT** implemented in Phase 19 — it is ephemeral and belongs to Phase 22. Phase 19 only implements `usePlanStore`.

### Persistence Pattern
- **D-11:** Mirrors `useBlockStore` exactly:
  - Store path: `"plans.json"`, key: `"plans"`
  - `plansLoaded: boolean` hydration gate — write operations are no-ops until `loadPlans()` has resolved (prevents pre-hydration race, identical to `useHistoryStore` line 47 and `useBlockStore` line 52)
  - Optimistic rollback on `persistPlans()` failure — set state optimistically, catch error, restore previous, rethrow
  - `load()` without options (no `autoSave: false`) — requires no `defaults` field

### field_values Encoding
- **D-12:** `field_values` in `PlanStep` is a `string` (serialized JSON), never `Record<string, unknown>`. Reason: `undefined` to `null` coercion in JSON serialization can corrupt saved plans silently. Mirrors `Block.content: string` in `useBlockStore`. Consumers parse on use, never store the parsed object.

### Duplicate Semantics
- **D-13:** Duplicating a plan creates a new plan named `"Copy of [original name]"` with a new UUID and all steps deep-copied (new UUIDs per step). Steps retain their original names.

### Test Coverage
- **D-14:** Phase 19 includes `usePlanStore.test.ts` — not deferred to Phase 20. Tests validate:
  - CRUD round-trips through the mock store
  - `plansLoaded` hydration gate (write ops before load() are no-ops)
  - `field_values` survives JSON serialize/deserialize without coercion corruption
  - Duplicate produces a new UUID, retains step content

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Analog store implementations (copy these patterns exactly)
- `src/stores/useBlockStore.ts` — Direct structural analog: same load/persist/hydration gate/optimistic rollback pattern. Copy and adapt.
- `src/stores/useHistoryStore.ts` — Reference for `historyLoaded` hydration gate pattern (line 47). `plansLoaded` is identical.

### Phase requirements
- `.planning/REQUIREMENTS.md` §Plan Library (PLAN-01 through PLAN-05) — All 5 requirements are in scope for Phase 19
- `.planning/ROADMAP.md` §Phase 19 — Goal, success criteria, and dependency notes

### Downstream phases that depend on Phase 19 types
- `.planning/ROADMAP.md` §Phase 20 — consumes `usePlanStore` CRUD
- `.planning/ROADMAP.md` §Phase 21 — uses `PlanStep` shape for step authoring
- `.planning/ROADMAP.md` §Phase 22 — uses `StepStatus`, `ResponseMode`, `PublishTarget` unions for runner

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/stores/useBlockStore.ts` — Copy the `persistBlocks` helper pattern verbatim as `persistPlans`. The `isBlock` type guard pattern should be mirrored as `isPlan` for safe deserialization.
- `src/stores/useHistoryStore.ts` — Reference for the `historyLoaded` gate in `appendEntry`; `plansLoaded` works identically.

### Established Patterns
- `tauri-plugin-store` `load()` call: always use `await load(STORE_PATH)` without options object. Passing `{ autoSave: false }` without `defaults` breaks (Pitfall 2 in existing code comments).
- All stores use `crypto.randomUUID()` for IDs at creation time (see `useBlockStore` `addBlock`).
- `tauri-plugin-store` `store.set(key, value)` + `store.save()` is the mandatory two-step persist (not just `set`).

### Integration Points
- `src/stores/` — New file `usePlanStore.ts` lives here alongside the 4 existing stores.
- `src/types/` or inline in the store file — `Plan`, `PlanStep`, `StepStatus`, `PublishTarget`, `ResponseMode` types. Check whether existing types are co-located with stores or in a separate `types/` directory and follow the established convention.
- Phase 20 will `import { usePlanStore } from './usePlanStore'` and subscribe to `plans` array + call `createPlan`, `renamePlan`, `deletePlan`, `duplicatePlan`.

</code_context>

<specifics>
## Specific Ideas

- The `field_values: string` pattern is explicitly modeled on `Block.content: string` from `useBlockStore` — make this explicit in the type definition comment so Phase 21 authors understand the contract.
- `StepStatus` defined in Phase 19 so it's available when Phase 22 adds `usePlanExecutionStore` — avoids a cross-phase type import refactor.

</specifics>

<deferred>
## Deferred Ideas

- `usePlanExecutionStore` (ephemeral, never persisted) — Phase 22 implements this when the runner is built. Phase 19 does NOT scaffold it.
- `selectedPlanId` / active plan selection state — Phase 20 local React state; not in any store.
- Migration logic (e.g., `migrateFromV0`) — written when the first schema change actually happens, not now.
- Duplicate step within a plan — Phase 21 CRUD (step-level operations are Phase 21 scope).

</deferred>

---

*Phase: 19-Plan Data Model and Persistence*
*Context gathered: 2026-05-23*
