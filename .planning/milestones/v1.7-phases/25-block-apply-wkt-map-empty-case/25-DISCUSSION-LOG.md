# Phase 25: Block Apply — WKT + Map Empty Case - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 25-Block Apply — WKT + Map Empty Case
**Areas discussed:** Plan/commit ref shape, buildApplyPlan location, Map replace access

---

## Plan/commit ref shape

| Option | Description | Selected |
|--------|-------------|----------|
| Object ref | `applyBlockRef.current = { buildPlan, commitApply }` — single ref, two methods | ✓ |
| Two separate refs | `buildPlanRef` + `commitApplyRef` as separate MutableRefObjects | |
| Keep one function | Defer plan/commit split to Phase 26; violates BLK-EXT-07 | |

**User's choice:** Object ref  
**Notes:** None — clear preference for keeping one ref, changing its payload type.

---

### ApplyPlan shape

| Option | Description | Selected |
|--------|-------------|----------|
| Future-proofed now | `{ toApply: ApplyItem[], conflicts: ConflictItem[] }` — Phase 25 returns `conflicts: []` | ✓ |
| Minimal for Phase 25 | `{ toApply: ApplyItem[] }` — evolve type in Phase 26 | |

**User's choice:** Future-proofed now  
**Notes:** `FormPanel` checks `plan.conflicts.length > 0` as the gate for the Phase 26 dialog.

---

### ApplyItem fields

| Option | Description | Selected |
|--------|-------------|----------|
| `{ fieldName, value, kind }` | `kind` tells `commitApply` which write method to use without re-lookup | ✓ |
| `{ fieldName, value }` only | `commitApply` re-looks up field kind from `message.fields` | |

**User's choice:** `{ fieldName, value, kind }`

---

## buildApplyPlan location

| Option | Description | Selected |
|--------|-------------|----------|
| `src/lib/blockApply.ts` | Standalone pure function, unit-testable, aligns with existing `src/lib/` pattern | ✓ |
| Inside ProtoFormRenderer | Closure over `methods` + `message`, simpler, no new file | |

**User's choice:** `src/lib/blockApply.ts`  
**Notes:** New file in `src/lib/` alongside `ipc.ts`, `types.ts`, `utils.ts`.

---

### Unit tests in Phase 25

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, test now | `blockApply.test.ts` in Phase 25 | ✓ |
| Defer to Phase 26 | Add tests when conflict logic is added | |

**User's choice:** Yes, test in Phase 25  
**Notes:** Covers WKT empty fill, WKT dirty skip, map empty fill, scalar fill, unknown key skip.

---

## Map replace access

| Option | Description | Selected |
|--------|-------------|----------|
| Registry in ProtoFormRenderer | `mapReplaceRegistry` ref; each `MapField` registers its `replace()` via `onRegisterReplace` callback | ✓ |
| `replaceRef` prop on MapField | One `MutableRefObject` per map field — awkward for N map fields | |
| Use `setValue` for empty case | Simpler but violates BLK-EXT-02 explicit constraint | |

**User's choice:** Registry pattern  
**Notes:** Registry key is full path (not fieldName) for future nested map compatibility.

---

### Registry key format

| Option | Description | Selected |
|--------|-------------|----------|
| Full path | Key is `path` string (e.g., `"myMapField"`); nested paths work without interface change | ✓ |
| fieldName only | Simpler today; Phase N would need interface change for nested maps | |

**User's choice:** Full path

---

## Claude's Discretion

- WKT emptiness detection: dirty-field guard is sufficient, no separate `null` check needed. Default WKT form value is `null`; non-dirty `null` WKT is always eligible.
- `onRegisterReplace` unmount cleanup: pass `null` or a no-op to clear the registry entry.

## Deferred Ideas

- Conflict dialog + non-empty map handling → Phase 26 (BLK-EXT-03/04/05/06)
- Recursive nested-message merge → future (BLK-EXT-FUTURE-02)
- Block apply in JSON mode → future (BLK-EXT-FUTURE-01)
