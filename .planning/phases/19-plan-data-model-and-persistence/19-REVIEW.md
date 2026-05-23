---
phase: 19-plan-data-model-and-persistence
reviewed: 2026-05-23T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src/lib/types.ts
  - src/stores/usePlanStore.ts
  - src/stores/usePlanStore.test.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 19: Code Review Report

**Reviewed:** 2026-05-23
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Three source files were reviewed: the shared type definitions (`src/lib/types.ts`), the Zustand store (`src/stores/usePlanStore.ts`), and its test suite (`src/stores/usePlanStore.test.ts`). The overall structure is sound — the hydration gate, optimistic rollback, and discriminated union types are correctly implemented. Two findings warrant attention before Phase 22 depends on this foundation: the `isPlanStep` type guard does not validate the discriminated union sub-fields, which will let malformed data through to Phase 22's exhaustive switches; and the D-14 condition 3 test for `field_values` round-tripping never exercises the store path it is intended to prove.

## Warnings

### WR-01: `isPlanStep` does not validate `target` or `response_mode` discriminators

**File:** `src/stores/usePlanStore.ts:33-35`

**Issue:** The type guard checks only `typeof v.target === "object" && v.target !== null` and `typeof v.response_mode === "object" && v.response_mode !== null`. It accepts any non-null object as a valid `PublishTarget` or `ResponseMode`. This means values like `{target:{}}`, `{target:{kind:"invalid"}}`, or `{response_mode:{mode:"typo"}}` will pass the guard, load into the Zustand store, and then crash Phase 22's exhaustive switch on `kind` / `mode` — the very switch the comments in `types.ts` say will rely on this type contract. The plan's threat register (T-19-01) explicitly says "isPlan + isPlanStep type guards filter malformed entries at loadPlans()" — that disposition is false for these two fields.

**Fix:**
```typescript
function isPlanStep(value: unknown): value is PlanStep {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (
    typeof v.id !== "string" ||
    typeof v.name !== "string" ||
    typeof v.proto_path !== "string" ||
    typeof v.message_type !== "string" ||
    typeof v.field_values !== "string"  // D-12
  ) return false;

  // Validate PublishTarget discriminated union
  const t = v.target;
  if (typeof t !== "object" || t === null) return false;
  const target = t as Record<string, unknown>;
  const validTarget =
    (target.kind === "queue" && typeof target.queue === "string") ||
    (target.kind === "exchange" &&
      typeof target.exchange === "string" &&
      typeof target.routing_key === "string");
  if (!validTarget) return false;

  // Validate ResponseMode discriminated union
  const r = v.response_mode;
  if (typeof r !== "object" || r === null) return false;
  const rm = r as Record<string, unknown>;
  const validMode =
    (rm.mode === "no-wait" && typeof rm.delay_ms === "number") ||
    ((rm.mode === "correlation-id" || rm.mode === "first-arrival") &&
      typeof rm.reply_queue === "string" &&
      typeof rm.timeout_ms === "number");
  if (!validMode) return false;

  return true;
}
```

---

### WR-02: D-14 condition 3 test never exercises the store — it only tests JSON itself

**File:** `src/stores/usePlanStore.test.ts:264-290`

**Issue:** Both tests in the `field_values JSON round-trip (D-14 condition 3)` describe block call `JSON.stringify([plan])` and `JSON.parse(serialized)` directly, without invoking any store method. They never call `createPlan`, `loadPlans`, or `persistPlans`. The D-14 condition 3 requirement is that field_values survives the store's persist/reload cycle — not that `JSON.stringify` is idempotent on strings (which is trivially and always true). A regression where field_values was changed from `string` to `Record<string, unknown>` inside the store would not be caught by these tests. The tests are not wrong, but they do not verify what the comment says they verify.

**Fix:** Add a test that creates a plan with a specific `field_values` string, then calls `loadPlans` against the mocked store to confirm the string is preserved across the isPlanStep guard:

```typescript
test("field_values string survives persist + loadPlans round-trip via the store", async () => {
  const rawFieldValues = '{"name":"Alice","nested":{"key":"value"}}';
  const step = makeStep({ field_values: rawFieldValues });
  const plan = makePlan({ steps: [step] });

  // Simulate what tauri-plugin-store returns on the reload:
  // JSON.stringify + parse is what the Tauri store plugin does internally.
  const reloaded = JSON.parse(JSON.stringify([plan]));
  mockGet.mockResolvedValueOnce(reloaded);

  usePlanStore.setState({ plans: [], plansLoaded: false });
  await usePlanStore.getState().loadPlans();

  const stored = usePlanStore.getState().plans;
  expect(stored).toHaveLength(1);
  expect(stored[0].steps[0].field_values).toBe(rawFieldValues);
  expect(typeof stored[0].steps[0].field_values).toBe("string");
});
```

---

### WR-03: Concurrent write operations can produce silent in-memory/disk divergence on rollback

**File:** `src/stores/usePlanStore.ts:81-93` (and same pattern at lines 99-112, 116-129, 148-161)

**Issue:** Each write operation captures `previous` in the synchronous `set()` callback and uses it to roll back on persist failure. If two write operations are in-flight concurrently — e.g., `renamePlan` fires while a `createPlan` persist is still awaited — op-A's captured `previous` snapshot may predate op-B's successful state change. When op-A fails and rolls back to its `previous`, it erases op-B's change from memory even though op-B succeeded on disk. This leaves memory and disk permanently out of sync for the session. This pattern is inherited verbatim from `useBlockStore` so it is codebase-consistent, but it is worth documenting since it is a real bug risk in Phase 22 (the plan runner fires writes in rapid succession).

**Fix:** Document the assumption explicitly, or serialize writes through a queue/mutex. Minimal approach — add a comment to the guard section so Phase 22 authors know single-flight is assumed:

```typescript
// NOTE: Write operations are not serialized. Concurrent in-flight writes
// (e.g., from the Phase 22 runner) can cause rollback of a successful op
// if another write fails simultaneously. Phase 22 must not issue concurrent
// writes to usePlanStore.
createPlan: async (name: string): Promise<Plan | null> => {
  if (!get().plansLoaded) return null;
  // ...
```

## Info

### IN-01: Dead initial values for `previous` and `updated` variables

**File:** `src/stores/usePlanStore.ts:81-82, 99-100, 116-117, 148-149`

**Issue:** In each write operation, `let previous: Plan[] = []` and `let updated: Plan[] = []` are initialized to empty arrays, but both are unconditionally overwritten inside the immediately-following `set()` callback before they are read. The `[]` initial values are never observed. This is a minor mislead — a reader might think there's a code path where `previous` stays as `[]` before the catch block executes, but `set()` is synchronous in Zustand and runs before the `try` block. Same pattern in `useBlockStore`.

**Fix:** Declare with `let previous!: Plan[]` (definite assignment assertion) to make the guarantee explicit, or restructure to capture inside a helper. Since this is consistent with `useBlockStore`, the minimal fix is a comment:

```typescript
// set() is synchronous; previous/updated are always assigned before the try block.
let previous: Plan[];
let updated: Plan[];
set((state) => { ... });
```

---

### IN-02: Quote style inconsistency in `src/lib/types.ts` Phase 19 section

**File:** `src/lib/types.ts:170-188`

**Issue:** The Phase 19 additions use single-quoted string literals (`'queue'`, `'exchange'`, `'no-wait'`, `'correlation-id'`, `'first-arrival'`, `'pending'`, etc.). All pre-existing type union literals in the same file use double quotes (`"connected"`, `"error"`, `"Idle"`, `"Running"`, etc.). The inconsistency is harmless at runtime but will produce an ESLint/Prettier inconsistency warning if the project enforces a quote style rule.

**Fix:** Change the Phase 19 literals to use double quotes:

```typescript
export type PublishTarget =
  | { kind: "queue"; queue: string }
  | { kind: "exchange"; exchange: string; routing_key: string };

export type ResponseMode =
  | { mode: "no-wait"; delay_ms: number }
  | { mode: "correlation-id"; reply_queue: string; timeout_ms: number }
  | { mode: "first-arrival"; reply_queue: string; timeout_ms: number };

export type StepStatus = "pending" | "sending" | "waiting-response" | "done" | "error";
```

---

_Reviewed: 2026-05-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
