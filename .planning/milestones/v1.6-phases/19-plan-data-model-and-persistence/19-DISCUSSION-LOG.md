# Phase 19: Plan Data Model and Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 19-plan-data-model-and-persistence
**Areas discussed:** PlanStep shape completeness, selectedPlanId in store, Test coverage in Phase 19, schema_version strategy

---

## PlanStep Shape Completeness

| Option | Description | Selected |
|--------|-------------|----------|
| Full shape now | All fields Phase 21+22 need: proto_path, message_type, field_values (string), target union, response mode union. Avoids schema_version bump mid-milestone. | ✓ |
| Minimal now, Phase 21 fills in | Just id, name, field_values. Risk: Phase 22 planner makes incompatible assumptions before Phase 21 locks it. | |

**User's choice:** Full shape now
**Notes:** Define everything Phase 21 and Phase 22 will need up front.

### Response Mode Union

| Option | Description | Selected |
|--------|-------------|----------|
| Discriminated union | `{ mode: 'no-wait'; delay_ms: number } \| { mode: 'correlation-id'; ... } \| { mode: 'first-arrival'; ... }` — type-safe, exhaustive switch in Phase 22 | ✓ |
| Flat fields with mode enum | Optional flat fields `delay_ms?`, `reply_queue?`, `timeout_ms?` — simpler but less safe | |
| You decide | Claude picks | |

**User's choice:** Discriminated union

### Publish Target Union

| Option | Description | Selected |
|--------|-------------|----------|
| Discriminated union | `{ kind: 'queue'; queue: string } \| { kind: 'exchange'; exchange: string; routing_key: string }` — mirrors PublishBar model | ✓ |
| Flat optional fields | `target_queue?`, `target_exchange?`, `routing_key?` — nullable fields require defensive guarding | |
| You decide | Claude picks | |

**User's choice:** Discriminated union

---

## selectedPlanId in Store

| Option | Description | Selected |
|--------|-------------|----------|
| CRUD-only, no selection state | usePlanStore manages plans[] + CRUD + persistence only. Phase 20 holds selectedPlanId as local React state. Mirrors useBlockStore pattern. | ✓ |
| Include selectedPlanId in usePlanStore | Selection state available to any subscriber without prop drilling. But bleeds UI state into persistence store. | |
| Separate usePlanUIStore | Third non-persisted store for view state. Most correct architecturally but adds a store for a two-view feature. | |

**User's choice:** CRUD-only, no selection state
**Notes:** Keeps data store focused. Phase 20 owns selection as local state.

---

## Test Coverage in Phase 19

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, test the store in Phase 19 | `usePlanStore.test.ts` validates CRUD + hydration gate + field_values round-trip. Same pattern as `useBlockStore.test.ts`. Success criteria #1 requires round-trip evidence. | ✓ |
| Defer tests to Phase 20 | Test at integration level when store is wired to UI. Risk: data foundation untested until Phase 20. | |

**User's choice:** Yes, test the store in Phase 19

---

## schema_version Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| On Plan only, as a number | `schema_version: number` starting at 1. PlanStep versioned through Plan. Number easier to compare than semver string. | ✓ |
| On Plan and PlanStep, as a number | Each record self-describes version. More granular but step version can drift from plan version. | |
| On Plan only, as a string ('1.0') | Semver string — expressive but lexicographic comparison is error-prone. | |

**User's choice:** On Plan only, as a number

### Migration Stubs

| Option | Description | Selected |
|--------|-------------|----------|
| Field declaration only | `schema_version: 1` constant. Migration logic written when first schema change happens. No speculative code. | ✓ |
| Include migration stub | `migrateFromV0` no-op scaffold. Adds code the planner must maintain even though it does nothing yet. | |

**User's choice:** Field declaration only

---

## Claude's Discretion

- Duplicate plan naming: "Copy of [original name]" — user did not express a preference; chose the common convention.
- `StepStatus` union values: `'pending' | 'sending' | 'waiting-response' | 'done' | 'error'` — directly from ROADMAP.md success criteria language.

## Deferred Ideas

- `usePlanExecutionStore` — Phase 22 scope
- `selectedPlanId` / active plan selection — Phase 20 local React state
- Migration logic — future milestone when first schema change occurs
- Step-level duplicate within a plan — Phase 21 CRUD scope
