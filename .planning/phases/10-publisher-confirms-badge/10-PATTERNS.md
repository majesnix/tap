# Phase 10: Publisher Confirms Badge - Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 5 (4 modified in-place, 1 no new file — struct added to existing file)
**Analogs found:** 5 / 5 (all are the prior version of the same file being modified)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src-tauri/src/commands/publish.rs` | command/service | request-response | Same file (current lines 134-165) | Self — in-place rewrite of confirm block |
| `src/lib/ipc.ts` | IPC wrapper | request-response | Same file (current lines 83-102) | Self — return type change only |
| `src/lib/types.ts` | type definition | — | Same file (current lines 84-89, `ConsumeResult`) | Self — add flat interface |
| `src/components/publish/PublishBar.tsx` | component | event-driven | Same file (current lines 180-259 handleSend, 326-369 Badge usages) | Self — in-place additions |
| `src/components/publish/__tests__/PublishBar.test.tsx` | test | — | Same file (existing describe blocks + mockInvoke pattern) | Self — new test cases appended |

> **Note:** Phase 10 has no new files except a new struct (`PublishOutcome`) added inline to `publish.rs`, and a new TypeScript interface (`PublishOutcome`) added to `types.ts`. All work is in-place modification of existing files.

---

## Pattern Assignments

### `src-tauri/src/commands/publish.rs` (command, request-response)

**Analog:** Same file — current confirm block (lines 134-165) is the before state.

**Existing imports to extend** (lines 1-9):
```rust
use lapin::{
    options::{BasicPublishOptions, ConfirmSelectOptions},
    BasicProperties, Connection, ConnectionProperties,
};
use std::time::Duration;
use tauri::AppHandle;

use crate::error::AppError;
use crate::profiles::build_amqp_uri;
```
Add `use lapin::publisher_confirm::Confirmation;` alongside the lapin imports.

**PublishOutcome struct — add above `publish_message`:**
```rust
#[derive(Debug, serde::Serialize)]
pub struct PublishOutcome {
    pub status: String, // "ack" | "nack" | "returned" | "timeout"
}
```

**Function signature change** (line 34):
```rust
// BEFORE:
) -> Result<(), AppError> {

// AFTER:
) -> Result<PublishOutcome, AppError> {
```

**mandatory=true — change at basic_publish call** (line 139):
```rust
// BEFORE:
BasicPublishOptions::default(),

// AFTER:
BasicPublishOptions { mandatory: true, ..Default::default() },
```

**Core pattern — replace confirm block** (lines 151-165 of the current file):
```rust
// BEFORE (lines 151-165):
let confirm_result = confirm_future.await;
let _ = conn.close(0, "".into()).await;
confirm_result.map_err(|e| AppError::AmqpError(e.to_string()))?;
tracing::debug!(...);
Ok(())

// AFTER — D-03 timeout + D-05 Confirmation match:
// NOTE: pass confirm_future (the Future itself) — do NOT write confirm_future.await here.
// Writing confirm_future.await resolves the Future before timeout() can wrap it (type error).
let confirm_result = tokio::time::timeout(
    Duration::from_secs(5),
    confirm_future,
).await;

let outcome = match confirm_result {
    Err(_elapsed) => {
        // D-03: broker did not confirm within 5s — close connection and surface as outcome
        let _ = conn.close(0, "".into()).await;
        return Ok(PublishOutcome { status: "timeout".to_string() });
    }
    Ok(Err(e)) => {
        // lapin internal error resolving the confirm future
        let _ = conn.close(0, "".into()).await;
        return Err(AppError::AmqpError(e.to_string()));
    }
    // D-05: Confirmation::Ack(None) = broker confirmed delivery
    Ok(Ok(Confirmation::Ack(None))) => PublishOutcome { status: "ack".to_string() },
    // D-05: Confirmation::Ack(Some(_)) = mandatory=true + no binding match → unrouted
    Ok(Ok(Confirmation::Ack(Some(_returned)))) => PublishOutcome { status: "returned".to_string() },
    Ok(Ok(Confirmation::Nack(_))) => PublishOutcome { status: "nack".to_string() },
    Ok(Ok(Confirmation::NotRequested)) => {
        // Unreachable: confirm_select() is called before every publish (CR-01)
        PublishOutcome { status: "ack".to_string() }
    }
};

let _ = conn.close(0, "".into()).await;

tracing::debug!(
    "Published message to exchange='{}' routing_key='{}' outcome='{}'",
    exchange,
    routing_key,
    outcome.status,
);
Ok(outcome)
```

**Error handling pattern** (unchanged — already established in lines 77-95):
```rust
// Pattern: on any channel/confirm error after conn is open, close conn before Err return
let channel = match conn.create_channel().await {
    Ok(ch) => ch,
    Err(e) => {
        let _ = conn.close(0, "".into()).await;
        return Err(AppError::AmqpError(e.to_string()));
    }
};
```

**Existing tests to keep + extend** (lines 167-194):
```rust
#[cfg(test)]
mod tests {
    #[test]
    fn default_exchange_is_empty_string() { ... }      // keep unchanged
    #[test]
    fn default_content_type_is_octet_stream() { ... }  // keep unchanged
    #[test]
    fn ttl_conversion_to_string() { ... }              // keep unchanged

    // ADD — document PublishOutcome status string values
    #[test]
    fn publish_outcome_status_values_are_lowercase() {
        assert_eq!(PublishOutcome { status: "ack".to_string() }.status, "ack");
        assert_eq!(PublishOutcome { status: "nack".to_string() }.status, "nack");
        assert_eq!(PublishOutcome { status: "returned".to_string() }.status, "returned");
        assert_eq!(PublishOutcome { status: "timeout".to_string() }.status, "timeout");
    }
}
```

---

### `src/lib/types.ts` (type definition)

**Analog:** Same file — follow the `ConsumeResult` flat interface pattern (lines 84-89).

**Existing pattern to copy** (lines 84-89):
```typescript
// ── Phase 4: Response queue reader types ─────────────────────────────────────

export interface ConsumeResult {
  empty: boolean;
  decoded: Record<string, unknown> | null;
  hexString: string;
  error: string | null;
}
```

**New interface to add** (after Phase 9 section, at end of file):
```typescript
// ── Phase 10: Publisher confirms outcome ──────────────────────────────────────

export interface PublishOutcome {
  status: "ack" | "nack" | "returned" | "timeout";
}
```

- Follow the same section-comment style (`// ── Phase N: description ─────`)
- Use `interface` (not `type`) — consistent with all other types in this file
- Use a string literal union for `status` — more precise than `string`, consistent with TypeScript coding style rule

---

### `src/lib/ipc.ts` (IPC wrapper, request-response)

**Analog:** Same file — `publishMessage` function (lines 83-102) is the before state.

**Existing import line to extend** (line 2):
```typescript
// BEFORE:
import type { ProtoSchema, ConsumeResult, ExchangeSummary } from "./types";

// AFTER (add PublishOutcome):
import type { ProtoSchema, ConsumeResult, ExchangeSummary, PublishOutcome } from "./types";
```

**Return type change** (lines 83-102):
```typescript
// BEFORE:
export async function publishMessage(
  ...
): Promise<void> {
  return invoke<void>("publish_message", { ... });
}

// AFTER — D-01: return PublishOutcome instead of void:
export async function publishMessage(
  profileName: string,
  exchange: string,
  routingKey: string,
  payload: number[],
  amqpProps?: AmqpPropsIpc
): Promise<PublishOutcome> {
  return invoke<PublishOutcome>("publish_message", {
    profileName,
    exchange,
    routingKey,
    payload,
    contentType: amqpProps?.contentType ?? null,
    deliveryMode: amqpProps?.deliveryMode ?? null,
    ttl: amqpProps?.ttl ?? null,
    correlationId: amqpProps?.correlationId ?? null,
    replyTo: amqpProps?.replyTo ?? null,
    headers: amqpProps?.headers ?? null,
  });
}
```

No other functions in `ipc.ts` change.

---

### `src/components/publish/PublishBar.tsx` (component, event-driven)

**Analog:** Same file — existing patterns at:
- `handleSend` (lines 180-259) — where badge state and timer management is added
- Badge usage (lines 326-331, 357-369) — where `variant="outline"` + className override pattern is established
- `useState` / `useEffect` hooks (lines 62-70, 97-136) — existing hook patterns to follow

**Import additions** (lines 1-2):
```typescript
// BEFORE:
import { useState, useEffect } from "react";

// AFTER — add useRef:
import { useState, useEffect, useRef } from "react";
```

Add `PublishOutcome` to the types import (currently not imported from types.ts in this component — it uses a local `Mode` type):
```typescript
import type { PublishOutcome } from "@/lib/types";
```

**New state declarations** (add after line 70, existing `useCombobox` state):
```typescript
const [outcome, setOutcome] = useState<PublishOutcome | null>(null);
const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
```

**Unmount cleanup — add as new useEffect** (add after the Phase 9 binding keys useEffect, around line 174):
```typescript
// Cleanup dismiss timer on unmount — prevents setOutcome on unmounted component (Pitfall 4)
useEffect(() => {
  return () => {
    if (dismissTimerRef.current !== null) {
      clearTimeout(dismissTimerRef.current);
    }
  };
}, []);
```

**handleSend changes** (lines 180-259 are the target):

At the START of `handleSend`, before any `await` (insert after line 197 `if (!hexPreview)` guard, before `setIsSending(true)`):
```typescript
// D-09: cancel prior dismiss timer and clear prior badge immediately on new send
if (dismissTimerRef.current !== null) {
  clearTimeout(dismissTimerRef.current);
  dismissTimerRef.current = null;
}
setOutcome(null);
```

In the `try` block, change the `await publishMessage` call and remove the success toast:
```typescript
// BEFORE (lines 220-222):
await publishMessage(activeProfileName, exchange, targetRoutingKey, payload, amqpProps);
// D-13: success toast, 3 seconds, non-blocking
toast(`Message sent to ${targetName}`, { duration: 3000 });

// AFTER — D-01/D-08: capture outcome; badge replaces success toast (CONTEXT.md code_context):
const result = await publishMessage(activeProfileName, exchange, targetRoutingKey, payload, amqpProps);
setOutcome(result);

// Auto-dismiss: ACK=3s, Returned=5s, NACK=5s; Timeout has no auto-dismiss (D-08)
const delay: number | null =
  result.status === "ack"      ? 3000 :
  result.status === "returned" ? 5000 :
  result.status === "nack"     ? 5000 :
  null; // "timeout" — no auto-dismiss per PUBL-08

if (delay !== null) {
  dismissTimerRef.current = setTimeout(() => setOutcome(null), delay);
}
```

The error toast on line 242 stays unchanged:
```typescript
// Error path — toast stays for connection/encoding errors (AppError paths)
toast.error(`Send failed: ${message}`, { duration: 5000 });
```

**Badge rendering — add to the JSX send button row** (after the Send Button / TooltipProvider block, before `<AmqpPropertiesSheet>`):
```tsx
{/* D-06: Outcome badge appears inline to the LEFT of the Send button.
    Reuses Badge component with className overrides — same pattern as
    management status badges at lines 357-369 (variant="outline" + className). */}
{outcome && (
  <div className="flex items-center gap-1">
    <Badge
      variant="outline"
      className={
        outcome.status === "ack"
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
          : outcome.status === "returned"
          ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
          : outcome.status === "nack"
          ? "bg-destructive/10 text-destructive border-destructive/20"
          : /* timeout */ "bg-muted text-muted-foreground border-border"
      }
    >
      {outcome.status === "ack"
        ? "ACK"
        : outcome.status === "returned"
        ? "Returned"
        : outcome.status === "nack"
        ? "NACK"
        : /* timeout */ "Timeout"}
    </Badge>
    {/* D-08: Only Timeout badge has a manual dismiss button */}
    {outcome.status === "timeout" && (
      <button
        onClick={() => setOutcome(null)}
        className="text-muted-foreground hover:text-foreground text-xs ml-1"
        aria-label="Dismiss timeout badge"
      >
        ✕
      </button>
    )}
  </div>
)}
```

**Existing Badge pattern to match** (lines 357-369 — management status badges):
```tsx
// Pattern already established: variant="outline" + className overrides for color
{managementStatus === "live" ? (
  <Badge variant="outline" className="text-xs gap-1">
    <span className="w-2 h-2 rounded-full bg-emerald-500" />
    Live
  </Badge>
) : (
  <Badge variant="outline" className="text-xs gap-1">
    <span className="w-2 h-2 rounded-full bg-amber-500" />
    Manual
  </Badge>
)}
```

---

### `src/components/publish/__tests__/PublishBar.test.tsx` (test)

**Analog:** Same file — append a new `describe` block following the Phase 9 pattern (lines 194-434).

**Test infrastructure to reuse** (lines 1-58):
```typescript
// All mocks remain unchanged:
// - toastMock (vi.hoisted + vi.mock sonner)
// - vi.mock @tauri-apps/api/core
// - vi.mock @/components/ui/select (native <select>)
// - vi.mock ../RoutingKeyCombobox

// mockInvoke import pattern (line 57-58):
import { invoke } from "@tauri-apps/api/core";
const mockInvoke = vi.mocked(invoke);
```

**New describe block pattern** (mirror Phase 9 block starting at line 194):
```typescript
describe("Phase 10 — Publisher Confirms Badge", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers(); // needed for setTimeout/clearTimeout assertions
    useConnectionStore.setState({
      profiles: [],
      activeProfileName: "test-profile",
      connectionStatus: "connected",
      connectionError: null,
      managementStatus: "live",
      managementAuthError: null,
      queues: ["test-queue"],
      exchanges: [],
    });
    // Default: publishMessage returns void (will be overridden per test)
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_queues") return Promise.resolve(["test-queue"]);
      return Promise.resolve(undefined);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("PUBL-05: shows green ACK badge after successful publish", async () => {
    // Arrange
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "fetch_queues") return Promise.resolve(["test-queue"]);
      if (cmd === "publish_message") return Promise.resolve({ status: "ack" });
      return Promise.resolve([]);
    });
    render(<PublishBar />);
    // Act — select queue and click Send
    // Assert — ACK badge appears
    await waitFor(() => expect(screen.getByText("ACK")).toBeInTheDocument());
    expect(screen.getByText("ACK").closest("[data-slot='badge']")).toHaveClass("bg-emerald-500/10");
  });

  it("PUBL-05: ACK badge auto-dismisses after 3 seconds", async () => {
    // ... setup and render ...
    await waitFor(() => screen.getByText("ACK"));
    act(() => vi.advanceTimersByTime(3000));
    await waitFor(() => expect(screen.queryByText("ACK")).not.toBeInTheDocument());
  });

  it("PUBL-06: shows amber Returned badge when message is unrouted", async () => {
    // ... mockInvoke returns { status: "returned" } ...
    await waitFor(() => expect(screen.getByText("Returned")).toBeInTheDocument());
  });

  it("PUBL-07: shows red NACK badge on broker negative ack", async () => {
    // ... mockInvoke returns { status: "nack" } ...
    await waitFor(() => expect(screen.getByText("NACK")).toBeInTheDocument());
  });

  it("PUBL-08: shows gray Timeout badge with dismiss button — no auto-dismiss", async () => {
    // ... mockInvoke returns { status: "timeout" } ...
    const badge = await screen.findByText("Timeout");
    expect(badge).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(10000)); // advance far past any dismiss window
    expect(screen.getByText("Timeout")).toBeInTheDocument(); // still visible
    expect(screen.getByLabelText("Dismiss timeout badge")).toBeInTheDocument();
  });

  it("PUBL-08: clicking dismiss button hides Timeout badge", async () => {
    // ...
    const dismissBtn = screen.getByLabelText("Dismiss timeout badge");
    fireEvent.click(dismissBtn);
    expect(screen.queryByText("Timeout")).not.toBeInTheDocument();
  });

  it("D-09: new send replaces badge immediately without queuing", async () => {
    // First send returns ACK (shows badge), second send returns NACK
    // Assert: ACK badge replaced by NACK badge, no queuing
  });
});
```

> **Note on vi.useFakeTimers():** No existing test in the codebase uses fake timers (grep confirms no `useRef.*setTimeout` in the frontend). This is the first timer-dependent test. Add `vi.useFakeTimers()` in `beforeEach` and `vi.useRealTimers()` in `afterEach` to prevent test bleed. See vitest docs for `act(() => vi.advanceTimersByTime(...))` pattern.

---

## Shared Patterns

### Connection cleanup on error (Rust)
**Source:** `src-tauri/src/commands/publish.rs` (lines 77-95 — `create_channel` + `confirm_select` error paths)
**Apply to:** All new error branches in `publish_message` (the timeout branch in particular)
```rust
// Close connection before returning any Err or early Ok
let _ = conn.close(0, "".into()).await;
return Err(AppError::AmqpError(e.to_string()));
// OR for timeout:
return Ok(PublishOutcome { status: "timeout".to_string() });
```

### Badge with variant="outline" + className override (React)
**Source:** `src/components/publish/PublishBar.tsx` (lines 357-369)
**Apply to:** All four outcome badge states in the new badge rendering block
```tsx
<Badge variant="outline" className="text-xs gap-1">
  {/* className carries the color semantics, variant="outline" provides base border */}
</Badge>
```

### Flat interface in types.ts
**Source:** `src/lib/types.ts` (lines 84-89, `ConsumeResult`)
**Apply to:** `PublishOutcome` interface
```typescript
export interface ConsumeResult {
  // flat — no generics, no nesting
  empty: boolean;
  decoded: Record<string, unknown> | null;
  hexString: string;
  error: string | null;
}
```

### IPC invoke with generic type parameter
**Source:** `src/lib/ipc.ts` (line 90 — `invoke<void>`)
**Apply to:** Updated `publishMessage` return
```typescript
return invoke<PublishOutcome>("publish_message", { ... });
```

---

## Modified Patterns (Explicit Changes)

### Success toast removal in PublishBar.tsx
**Current behavior** (line 222):
```typescript
toast(`Message sent to ${targetName}`, { duration: 3000 });
```
**Phase 10 change:** This line is **removed**. The outcome badge (`setOutcome(result)`) replaces the success toast. Error toasts (line 242, `toast.error(...)`) are **unchanged** — they handle `AppError` paths (connection fail, encode fail) which are separate from delivery outcomes.

---

## No Analog Found

None — all files to be modified have clear in-place analogs (their current state).

---

## Metadata

**Analog search scope:** `src-tauri/src/commands/`, `src/lib/`, `src/components/publish/`
**Files read:** 7 (publish.rs, ipc.ts, types.ts, badge.tsx, PublishBar.tsx, error.rs, lib.rs, PublishBar.test.tsx)
**Pattern extraction date:** 2026-05-19
**No new Cargo or npm packages required** — verified against Cargo.toml and package.json
