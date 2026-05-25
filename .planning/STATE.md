---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: Block Apply Completeness + History Search
status: executing
last_updated: "2026-05-25T09:03:45.141Z"
last_activity: 2026-05-25 — Milestone v1.7 roadmap created
progress:
  total_phases: 11
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State: Tap

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-25)

**Core value:** Send a real protobuf message to RabbitMQ in under 30 seconds from a raw `.proto` file — no code, no curl, no manual encoding.
**Current focus:** Phase 24 — History Full-Text Search

## Current Position

Phase: 24 — History Full-Text Search
Plan: —
Status: In progress — defining plan
Last activity: 2026-05-25 — Milestone v1.7 roadmap created

## Progress

```
v1.7 milestone: [░░░░░░░░░░░░░░░░░░░░] 0% (0/3 phases)
```

## Performance Metrics

- Phases complete: 0/3
- Plans complete: 0/TBD

## Accumulated Context

### Decisions

None yet for v1.7.

### Active Pitfalls (from research)

- **Pitfall A — Oneof branch registration race (CRITICAL for Phase 26):** Setting `_selected` then the branch field separately triggers OneofField's unregister effect mid-write. Prevention: set the entire oneof atomically — `setValue(key, { _selected: branchName, [branchName]: branchValue }, { shouldDirty: false })`.
- **Pitfall B — Map useFieldArray: setValue vs replace() (VERIFY in Phase 25):** ARCHITECTURE.md section 1.4 claims `setValue(mapKey, arrayOfPairs)` refreshes useFieldArray rows; Pitfall #21 documents the opposite. Empirically verify at Phase 25 implementation start before finalizing the commit implementation.
- **Pitfall C — `_selected` in field names search (Phase 24):** Per REQUIREMENTS.md HIST-FT-04, `_selected` discriminator keys are excluded from field name matching.
- **Pitfall D — shouldDirty: false on all block apply setValue calls (Phases 25–26):** Omitting this can register block-filled fields as user-touched, causing false conflicts on the next drag.
- **Pitfall E — Conflict dialog default state (Phase 26):** Each conflict row must default to skip (not overwrite) to prevent accidental data loss.

### Todos

- [ ] Plan Phase 24: History Full-Text Search
- [ ] Plan Phase 25: Block Apply — WKT + Map Empty Case
- [ ] Plan Phase 26: Block Apply — Conflict Prompt + Oneof

### Blockers

None.

## Session Continuity

- v1.7 roadmap created 2026-05-25
- 3 phases defined: 24 (history search), 25 (WKT + empty map), 26 (conflict dialog + oneof)
- 14/14 requirements mapped
- Next action: `/gsd-plan-phase 24`
