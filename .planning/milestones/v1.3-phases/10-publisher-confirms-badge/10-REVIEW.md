---
phase: 10-publisher-confirms-badge
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - src-tauri/src/commands/publish.rs
  - src/lib/types.ts
  - src/lib/ipc.ts
  - src/components/publish/PublishBar.tsx
  - src/components/publish/__tests__/PublishBar.test.tsx
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-05-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Summary

Phase 10 introduces publisher confirms to the Rust `publish_message` command and wires the resulting `PublishOutcome` status into a badge in `PublishBar`. The Rust implementation is structurally sound: `confirm_select` is called before `basic_publish`, the `Confirmation` enum variants from lapin 4.7.4 are correctly matched (verified against the registry source), the URI/password is properly scoped and dropped before any error is inspected, and connection cleanup is present on every error path.

The main defects are in the frontend: NACK/Returned/Timeout outcomes are silently recorded in history as "sent", fire-and-forget history writes suppress observable errors, and the `hexToBytes` helper can silently discard malformed bytes. There are also test coverage gaps for the auto-dismiss behavior on NACK/Returned badges and a duplicate import in `ipc.ts`.

## Critical Issues

No critical issues found.

## Warnings

### WR-01: NACK / Returned / Timeout outcomes recorded in history as "sent"

**File:** `src/components/publish/PublishBar.tsx:262-271`
**Issue:** After `publishMessage` resolves with status `"nack"`, `"returned"`, or `"timeout"`, the code falls into the `try` block's success branch and calls `appendEntry` with `status: "sent"`. The `HistoryEntry` type only has `"sent" | "failed"`, so these non-delivery outcomes are silently mislabeled. A developer inspecting history after a broker NACK will see the message recorded as successfully sent, which is incorrect and misleading.

```typescript
// Current (wrong): all non-exception outcomes labeled "sent"
void useHistoryStore.getState().appendEntry({
  ...
  status: "sent",   // ← also reached on nack / returned / timeout
  ...
});

// Fix: map the outcome status to the history status
const historyStatus: "sent" | "failed" =
  result.status === "ack" ? "sent" : "failed";

void useHistoryStore.getState().appendEntry({
  ...
  status: historyStatus,
  ...
});
```

### WR-02: Fire-and-forget `appendEntry` calls suppress observable errors

**File:** `src/components/publish/PublishBar.tsx:262, 281`
**Issue:** Both `appendEntry` calls — on success (line 262) and on failure (line 281) — are prefixed with `void`, which silently discards any rejection from the async history-persistence operation. Per project coding-style rules, errors must never be silently swallowed. If the `tauri-plugin-store` write fails (e.g., disk full, serialization error), the user receives no indication that history was not saved.

```typescript
// Fix: await in try/catch instead of void, or at minimum log the rejection
try {
  await useHistoryStore.getState().appendEntry({ ... });
} catch (histErr) {
  console.warn("History write failed:", histErr);
  // do not rethrow — history failure is non-critical, but must be observable
}
```

### WR-03: AMQP ShortString fields lack length validation — lapin will panic on overflow

**File:** `src/components/publish/PublishBar.tsx` (call site) / `src-tauri/src/commands/publish.rs:110-125`
**Issue:** The AMQP specification limits ShortString fields (`content_type`, `correlation_id`, `reply_to`) to 255 bytes. The `AmqpPropertiesSheet` component has no `maxLength` attribute on its text inputs, and `publish.rs` applies no length check before calling `props.with_content_type(...)` etc. Lapin will attempt to encode a string longer than 255 bytes into a ShortString field, which causes a panic or protocol-level encoding error at runtime. A user entering a 300-character `correlation_id` will crash the publish operation with a non-user-friendly error.

```typescript
// Fix in AmqpPropertiesSheet.tsx — add maxLength to affected inputs:
<input maxLength={255} value={draft.contentType ?? ""} ... />
<input maxLength={255} value={draft.correlationId ?? ""} ... />
<input maxLength={255} value={draft.replyTo ?? ""} ... />
```

```rust
// Additional defense in publish.rs before each props.with_* call:
if let Some(ref ct) = content_type {
    if ct.len() > 255 {
        return Err(AppError::InvalidInput(
            "content_type exceeds AMQP ShortString limit of 255 bytes".to_string(),
        ));
    }
}
// repeat for correlation_id and reply_to
```

## Info

### IN-01: `hexToBytes` silently discards malformed hex tokens

**File:** `src/components/publish/PublishBar.tsx:52-60`
**Issue:** `parseInt(h, 16)` returns `NaN` for invalid tokens; the subsequent `.filter((b) => Number.isInteger(b) && b >= 0 && b <= 255)` drops them silently. Because `hexPreview` is always produced by the Rust encoder this is unlikely to contain bad tokens in production, but if any code path allows user-edited hex the payload will be silently truncated without any error surfacing to the user.

**Fix:** Consider adding an assertion or `console.warn` if filtered-out count is non-zero, to make debugging easier during development:
```typescript
const bytes = hex.trim().split(/\s+/).filter(Boolean).map((h) => parseInt(h, 16));
const valid = bytes.filter((b) => Number.isInteger(b) && b >= 0 && b <= 255);
if (valid.length !== bytes.length) {
  console.warn(`hexToBytes: dropped ${bytes.length - valid.length} invalid token(s)`);
}
return valid;
```

### IN-02: Duplicate import from `./types` in `ipc.ts`

**File:** `src/lib/ipc.ts:2, 18`
**Issue:** `ConnectionProfile` is imported from `"./types"` on line 18, but a separate named import block from `"./types"` already exists on line 2. These two import statements from the same module should be merged into one to avoid linter warnings and confusion.

```typescript
// Fix: merge into one import at the top of the file
import type {
  ProtoSchema,
  ConsumeResult,
  ExchangeSummary,
  PublishOutcome,
  ConnectionProfile,
} from "./types";
```

### IN-03: Missing test coverage for auto-dismiss on NACK and Returned badges, and unmount cleanup

**File:** `src/components/publish/__tests__/PublishBar.test.tsx`
**Issue:** Three behaviors introduced in Phase 10 lack test coverage:

1. **NACK auto-dismiss (5s):** There is a test verifying ACK auto-dismisses after 3s (`PUBL-05: ACK badge auto-dismisses after 3 seconds`), but no equivalent test for NACK or Returned which are specified to auto-dismiss after 5s in `handleSend` (lines 249-253 of PublishBar.tsx).
2. **Returned auto-dismiss (5s):** Same gap.
3. **Unmount cleanup:** The `useEffect` at line 183 that calls `clearTimeout` on unmount is untested. If a timer is active when the component unmounts, the behavior is only guarded by the cleanup but no test verifies `setOutcome` is not called on an unmounted component.

**Fix:** Add timer-advance tests analogous to the existing ACK test:
```typescript
it("PUBL-06: Returned badge auto-dismisses after 5 seconds", async () => {
  // ... setup with status "returned"
  act(() => vi.advanceTimersByTime(5000));
  await waitFor(() => expect(screen.queryByText("Returned")).not.toBeInTheDocument());
});

it("PUBL-07: NACK badge auto-dismisses after 5 seconds", async () => {
  // ... setup with status "nack"
  act(() => vi.advanceTimersByTime(5000));
  await waitFor(() => expect(screen.queryByText("NACK")).not.toBeInTheDocument());
});
```

---

_Reviewed: 2026-05-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
