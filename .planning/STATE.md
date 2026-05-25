---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: Block Apply Completeness + History Search
status: executing
last_updated: "2026-05-25T13:57:41.228Z"
last_activity: 2026-05-25 -- Phase 26 planning complete
progress:
  total_phases: 11
  completed_phases: 2
  total_plans: 6
  completed_plans: 4
  percent: 18
---

# Project State: Tap

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-25)

**Core value:** Send a real protobuf message to RabbitMQ in under 30 seconds from a raw `.proto` file — no code, no curl, no manual encoding.
**Current focus:** Phase 26 — block apply — conflict prompt + oneof

## Current Position

Phase: 26
Plan: Not started
Status: Ready to execute
Last activity: 2026-05-25 -- Phase 26 planning complete

## Progress

```
v1.7 milestone: [██████░░░░░░░░░░░░░░] 33% (1/3 phases)
```

## Performance Metrics

- Phases complete: 1/3
- Plans complete: 2/2 (Phase 24)

## Accumulated Context

### Decisions

- Phase 25: `{ buildPlan, commitApply }` two-phase ref replaces single-function applyBlockRef — FormPanel derives `skipped` inline from plan
- Phase 25: mapReplaceRegistry useRef wires MapField.replace into commitApply without touching the frozen ProtoFormRenderer switch
- Phase 25: `replace()` marks map field dirty (RHF 7.76.1 limitation) — block-filled map is user-owned after first fill; Phase 26 conflict prompt handles re-drag

### Active Pitfalls (from research)

- **Pitfall A — Oneof branch registration race (CRITICAL for Phase 26):** Setting `_selected` then the branch field separately triggers OneofField's unregister effect mid-write. Prevention: set the entire oneof atomically — `setValue(key, { _selected: branchName, [branchName]: branchValue }, { shouldDirty: false })`.
- **Pitfall B — RESOLVED in Phase 25:** `setValue(mapKey, array)` does NOT refresh useFieldArray rows; must use `replace()` via mapReplaceRegistry.
- **Pitfall D — shouldDirty: false on all block apply setValue calls (Phase 26):** Omitting this can register block-filled fields as user-touched, causing false conflicts on the next drag. (WKT path confirmed correct in Phase 25.)
- **Pitfall E — Conflict dialog default state (Phase 26):** Each conflict row must default to skip (not overwrite) to prevent accidental data loss.

### Todos

- [x] Phase 24: History Full-Text Search — complete (4/4 UAT passed 2026-05-25)
- [x] Phase 25: Block Apply — WKT + Map Empty Case — complete (6/6 UAT passed 2026-05-25)
- [ ] Plan Phase 26: Block Apply — Conflict Prompt + Oneof

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 260525-jw3 | Fix message-kind fields appearing in not-in-form toast | 2026-05-25 | 8a9fcb8 | [260525-jw3-fix-message-kind-fields-appearing-in-not](.planning/quick/260525-jw3-fix-message-kind-fields-appearing-in-not/) |

### Blockers

None.

## Session Continuity

Last session: 2026-05-25T13:14:07.979Z
Stopped at: Phase 26 UI-SPEC approved
Resume file: .planning/phases/26-block-apply-conflict-prompt-oneof/26-UI-SPEC.md

- v1.7: 2/3 phases complete (24 history search ✓, 25 WKT+map-empty ✓)
- Phase 26 remaining: conflict prompt + oneof block apply
- Next action: `/gsd-discuss-phase 26` or `/gsd-plan-phase 26`
