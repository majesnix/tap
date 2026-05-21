# Phase 10: Publisher Confirms Badge - Research

**Researched:** 2026-05-19
**Domain:** lapin 4.x publisher confirms + React ephemeral badge state
**Confidence:** HIGH

## Summary

Phase 10 modifies the existing `publish_message` Rust command to return a structured delivery outcome (`PublishOutcome`) instead of `()`, and adds an ephemeral badge to `PublishBar.tsx` that reflects the broker's response. All nine context decisions are locked. The primary research question (D-05) — how lapin 4.x surfaces `basic.return` frames when `mandatory=true` — is now resolved with HIGH confidence.

The critical finding: awaiting a `PublisherConfirm` (the return value of `basic_publish`) yields `Result<Confirmation>`. The `Confirmation` enum has three variants: `Ack(Option<Box<BasicReturnMessage>>)`, `Nack(Option<Box<BasicReturnMessage>>)`, and `NotRequested`. An unroutable message (mandatory=true, no binding match) comes back as `Confirmation::Ack(Some(BasicReturnMessage))` — the broker still ACKs but includes the return frame. Detection requires checking `take_message()` after confirming `is_ack()` is true. There is **no** `on_return()` callback; the returned message is embedded in the confirm future itself.

**Primary recommendation:** Replace the current `confirm_result.map_err(...)?` discard with a `match` on `Confirmation` that produces a `PublishOutcome`. D-04 (`mandatory=true`) and D-05 (returned detection) are tightly coupled — they must be implemented together in the same task.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `publish_message` returns `Result<PublishOutcome, AppError>` instead of `Result<(), AppError>`. `AppError` is still used for connection/channel/encoding failures — not for delivery outcomes.
- **D-02:** `PublishOutcome` is a flat serializable struct with a `status` string field: `"ack"` | `"nack"` | `"returned"` | `"timeout"`. Flat struct (not a Rust tagged enum) — easy to serialize with serde, easy to switch on in TypeScript.
- **D-03:** The 5-second confirm timeout is enforced in Rust (`tokio::time::timeout` around `confirm_future.await`). Timeout returns `Ok(PublishOutcome { status: "timeout" })` — not an `Err`.
- **D-04:** Always set `mandatory=true` in `BasicPublishOptions` for every publish. Unrouted messages surface as a Returned badge instead of being silently dropped.
- **D-05:** Returned detection requires intercepting `basic.return` frames from the broker before the confirm ACK. **Resolved by this research** — see `## Architecture Patterns`.
- **D-06:** Badge appears inline beside the Send button in the same row (to its left).
- **D-07:** Badge shows color + short text label: green "ACK" / amber "Returned" / red "NACK" / gray "Timeout". Reuses the existing `Badge` component.
- **D-08:** Auto-dismiss timers: ACK → 3 seconds, Returned → 5 seconds, NACK → 5 seconds. Timeout badge stays until manually dismissed.
- **D-09:** When the user clicks Send while a badge is showing, the badge is replaced immediately with the new send's loading state. No queuing, no blocking re-send. Previous outcome is lost.

### Claude's Discretion

None noted — all implementation details were locked in discussion.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PUBL-05 | User sees a green ACK badge after broker confirms delivery; auto-dismisses after 3 seconds | `Confirmation::Ack(None)` → `PublishOutcome { status: "ack" }` → 3s timer |
| PUBL-06 | User sees an amber Returned badge when published message has no route (mandatory=true); auto-dismisses after 5 seconds | `Confirmation::Ack(Some(BasicReturnMessage))` → `PublishOutcome { status: "returned" }` → 5s timer |
| PUBL-07 | User sees a red NACK badge when broker negatively acknowledges; auto-dismisses after 5 seconds | `Confirmation::Nack(_)` → `PublishOutcome { status: "nack" }` → 5s timer |
| PUBL-08 | User sees a gray Timeout badge when broker confirmation does not arrive within 5 seconds; badge requires manual dismiss | `tokio::time::timeout` wraps `confirm_future`; `Err(_)` → `PublishOutcome { status: "timeout" }` → no auto-dismiss |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Publisher confirms timeout | API / Backend (Rust) | — | `tokio::time::timeout` wraps async future; enforced in Rust before IPC returns |
| basic.return detection | API / Backend (Rust) | — | `Confirmation` enum from `PublisherConfirm.await` — Rust only |
| `PublishOutcome` struct + serialization | API / Backend (Rust) | — | Serde `Serialize` for IPC boundary; lives near publish.rs |
| Delivery outcome routing (ACK/NACK/Returned/Timeout) | API / Backend (Rust) | — | `match confirmation { ... }` in publish.rs |
| Badge state management | Browser / Client (React) | — | `useState<PublishOutcome \| null>` in PublishBar.tsx |
| Auto-dismiss timers | Browser / Client (React) | — | `useRef<ReturnType<typeof setTimeout>>` in PublishBar.tsx |
| Badge rendering | Browser / Client (React) | — | Reuses `Badge` from `src/components/ui/badge.tsx` |
| IPC type alignment | Frontend (ipc.ts + types.ts) | — | `publishMessage` return type changes; `PublishOutcome` TypeScript type added |

## Standard Stack

### Core (unchanged — no new dependencies)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `lapin` | 4.x (4.7.4) | AMQP publisher confirms | Already in Cargo.toml; `Confirmation` enum and `PublisherConfirm` used directly |
| `tokio` | 1.x | Async timeout | `tokio::time::timeout` already imported |
| `serde` | 1.x | Serialize `PublishOutcome` | Already in Cargo.toml |
| `react-hook-form` | 7.x | (existing form) | Not changed by this phase |
| `shadcn/ui Badge` | in-tree | Badge component | `src/components/ui/badge.tsx` — add className overrides for new colors |

No new npm or Cargo packages are required. [VERIFIED: Cargo.toml and package.json examined]

## Architecture Patterns

### System Architecture Diagram

```
User clicks Send
      │
      ▼
PublishBar.tsx (handleSend)
  ├─ setIsSending(true)
  ├─ clearTimeout(dismissTimerRef.current)   ← D-09: cancel prior badge timer
  ├─ setOutcome(null)                        ← D-09: clear prior badge immediately
  └─ await publishMessage(...)               ← ipc.ts: invoke("publish_message", ...)
            │
            ▼
      Rust: publish.rs
        ├─ validate delivery_mode
        ├─ load profile + password
        ├─ Connection::connect (10s timeout)
        ├─ create_channel()
        ├─ confirm_select()
        ├─ basic_publish(mandatory=true) → confirm_future
        ├─ tokio::time::timeout(5s, confirm_future)
        │     ├─ Err (elapsed) → Ok(PublishOutcome { status: "timeout" })
        │     └─ Ok(Confirmation)
        │           ├─ Ack(None)      → Ok(PublishOutcome { status: "ack" })
        │           ├─ Ack(Some(_))   → Ok(PublishOutcome { status: "returned" })
        │           ├─ Nack(_)        → Ok(PublishOutcome { status: "nack" })
        │           └─ NotRequested   → (unreachable — confirm_select enabled)
        └─ conn.close()
            │
            ▼
      IPC returns Ok(PublishOutcome)
            │
            ▼
PublishBar.tsx (handleSend continued)
  ├─ setIsSending(false)
  ├─ setOutcome(outcome)
  └─ if outcome.status !== "timeout":
       dismissTimerRef.current = setTimeout(() => setOutcome(null), delay)
```

### D-05 Resolution: lapin 4.x Return Frame API

**There is no `on_return()` callback in lapin 4.x.** Return frame interception is built into the `PublisherConfirm` future directly.

The `Confirmation` enum (from `lapin::publisher_confirm`):
```rust
// Source: github.com/amqp-rs/lapin/blob/main/src/publisher_confirm.rs
pub enum Confirmation {
    Ack(Option<Box<BasicReturnMessage>>),
    Nack(Option<Box<BasicReturnMessage>>),
    NotRequested,
}
```

**Key behavior (VERIFIED):**
- When `mandatory=true` and the message is unroutable, the broker emits `basic.return` THEN `basic.ack`.
- The `PublisherConfirm` future captures this sequence internally.
- Awaiting yields `Ok(Confirmation::Ack(Some(BasicReturnMessage)))`.
- `confirm.is_ack()` returns `true` even for returned messages.
- The returned message is detected by `confirm.take_message().is_some()`.

This is verified by the official lapin test suite (`tests/publisher_confirms.rs`) which explicitly asserts `confirm.is_ack()` is true for unroutable mandatory messages and then calls `confirm.take_message().unwrap()`. [VERIFIED: docs.rs source + GitHub examples/publisher_confirms.rs + tests/publisher_confirms.rs]

### Pattern: Confirmation Match in publish.rs

```rust
// Source: VERIFIED from lapin examples/publisher_confirms.rs + tests/publisher_confirms.rs
use lapin::publisher_confirm::Confirmation;

let confirm_result = tokio::time::timeout(
    Duration::from_secs(5),
    confirm_future,
).await;

let outcome = match confirm_result {
    Err(_elapsed) => {
        // Timeout — close connection and return timeout outcome
        let _ = conn.close(0, "".into()).await;
        return Ok(PublishOutcome { status: "timeout".to_string() });
    }
    Ok(Err(e)) => {
        // lapin internal error resolving the confirm future
        let _ = conn.close(0, "".into()).await;
        return Err(AppError::AmqpError(e.to_string()));
    }
    Ok(Ok(Confirmation::Ack(None))) => PublishOutcome { status: "ack".to_string() },
    Ok(Ok(Confirmation::Ack(Some(_returned)))) => PublishOutcome { status: "returned".to_string() },
    Ok(Ok(Confirmation::Nack(_))) => PublishOutcome { status: "nack".to_string() },
    Ok(Ok(Confirmation::NotRequested)) => {
        // Unreachable: confirm_select() is called before every publish (CR-01)
        PublishOutcome { status: "ack".to_string() }
    }
};

let _ = conn.close(0, "".into()).await;
Ok(outcome)
```

**Why this replaces the current code:** The current line `confirm_result.map_err(|e| AppError::AmqpError(e.to_string()))?` discards the `Confirmation` variant entirely. With `mandatory=false` (current) the broker never emits `basic.return`, so the variant is always `Ack(None)`. Once D-04 sets `mandatory=true`, unroutable messages would still silently succeed without this match.

### Pattern: PublishOutcome Struct in Rust

```rust
// Place in src-tauri/src/commands/publish.rs alongside publish_message
// Source: D-02 + serde pattern from existing codebase

#[derive(Debug, serde::Serialize)]
pub struct PublishOutcome {
    pub status: String, // "ack" | "nack" | "returned" | "timeout"
}
```

### Pattern: IPC Type in TypeScript

```typescript
// Add to src/lib/types.ts
// Source: D-02

export interface PublishOutcome {
  status: "ack" | "nack" | "returned" | "timeout";
}
```

```typescript
// Update in src/lib/ipc.ts
// Change return type from Promise<void> to Promise<PublishOutcome>
import type { PublishOutcome } from "./types";

export async function publishMessage(
  profileName: string,
  exchange: string,
  routingKey: string,
  payload: number[],
  amqpProps?: AmqpPropsIpc
): Promise<PublishOutcome> {
  return invoke<PublishOutcome>("publish_message", { ... });
}
```

### Pattern: Badge State in PublishBar.tsx

```typescript
// New state additions — D-06, D-07, D-08, D-09
import type { PublishOutcome } from "@/lib/types";

const [outcome, setOutcome] = useState<PublishOutcome | null>(null);
const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

// In handleSend, before await:
if (dismissTimerRef.current !== null) {
  clearTimeout(dismissTimerRef.current);  // D-09: cancel prior timer
  dismissTimerRef.current = null;
}
setOutcome(null);  // D-09: clear prior badge immediately on new send

// After await (in try block):
const result = await publishMessage(...);
setOutcome(result);

// Auto-dismiss (ACK=3s, Returned=5s, NACK=5s; Timeout=no timer)
const delay =
  result.status === "ack" ? 3000 :
  result.status === "returned" ? 5000 :
  result.status === "nack" ? 5000 :
  null; // timeout: no auto-dismiss

if (delay !== null) {
  dismissTimerRef.current = setTimeout(() => setOutcome(null), delay);
}
```

```typescript
// Cleanup on unmount
useEffect(() => {
  return () => {
    if (dismissTimerRef.current !== null) {
      clearTimeout(dismissTimerRef.current);
    }
  };
}, []);
```

### Pattern: Badge Rendering

The existing `Badge` component has variants: `default | secondary | destructive | outline | ghost | link`. No green/amber/gray variant exists. Per D-07 the decision is to reuse Badge with `className` overrides (consistent with how the existing management status dot uses colored spans inside `variant="outline"` badges).

```tsx
// Source: D-07, consistent with existing Badge usage pattern in PublishBar.tsx (lines ~326, ~357)
{outcome && (
  <div className="flex items-center gap-1">
    <Badge
      className={
        outcome.status === "ack"      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" :
        outcome.status === "returned" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" :
        outcome.status === "nack"     ? "bg-destructive/10 text-destructive border-destructive/20" :
        /* timeout */                   "bg-muted text-muted-foreground border-border"
      }
    >
      {outcome.status === "ack"      ? "ACK" :
       outcome.status === "returned" ? "Returned" :
       outcome.status === "nack"     ? "NACK" :
       /* timeout */                   "Timeout"}
    </Badge>
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

**Note:** The `variant` prop is intentionally not used for outcome badges (className overrides instead) to avoid modifying the shared `badge.tsx` cva definition. This follows the existing pattern already in use in `PublishBar.tsx`.

### Recommended Project Structure (no new files except types)

```
src-tauri/src/commands/
  publish.rs          ← PublishOutcome struct added; confirm match added; mandatory=true
src/
  lib/
    types.ts          ← PublishOutcome TypeScript interface added
    ipc.ts            ← publishMessage return type: Promise<void> → Promise<PublishOutcome>
  components/publish/
    PublishBar.tsx     ← outcome state, dismissTimerRef, badge JSX, handleSend updates
    __tests__/
      PublishBar.test.tsx  ← new test cases for each outcome.status value
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| basic.return detection | Custom frame parser or channel event listener | `Confirmation::Ack(Some(_))` from `confirm_future.await` | lapin 4.x embeds the returned message in the confirm future; no external hook needed |
| Async timeout | Manual timer + channel | `tokio::time::timeout` | Already imported; handles cancellation and drop cleanup |
| Badge auto-dismiss | External animation library | `setTimeout` + `clearTimeout` | 2–3 lines of state; no library justified |

**Key insight:** The lapin `PublisherConfirm` future is the complete interface for both ACK/NACK and returned-message detection. No channel-level callback registration is needed.

## Common Pitfalls

### Pitfall 1: D-04 and D-05 Must Land Together
**What goes wrong:** Setting `mandatory=true` without the new match logic means unroutable messages come back as `Confirmation::Ack(Some(_))` — the current code discards the `Confirmation` entirely with `.map_err(...)`, so a returned message is silently treated as a successful send.
**Why it happens:** Current code only cares whether the `Result` is `Ok` or `Err`, never inspects the `Confirmation` variant.
**How to avoid:** Implement D-04 (mandatory=true) and D-05 (Confirmation match) in the same task.

### Pitfall 2: Timeout Path Must Still Close the Connection
**What goes wrong:** On timeout, `tokio::time::timeout` returns `Err(Elapsed)` — at that point `confirm_future` is dropped but the TCP connection is still open. Failing to call `conn.close()` leaks a connection.
**Why it happens:** Current code calls `conn.close()` after `confirm_result`. On timeout, the current code would not reach that line.
**How to avoid:** Close the connection in the `Err(_elapsed)` branch BEFORE returning `PublishOutcome { status: "timeout" }`.

### Pitfall 3: D-09 Timer Leak on Fast Double-Click
**What goes wrong:** User clicks Send → badge shows → user clicks Send again before dismiss timer fires → second send completes → now two timers exist, and the first fires and clears the second send's badge prematurely.
**Why it happens:** New send doesn't cancel the prior `setTimeout`.
**How to avoid:** At the START of `handleSend`, before any await: `clearTimeout(dismissTimerRef.current); dismissTimerRef.current = null; setOutcome(null)`.

### Pitfall 4: setOutcome Called on Unmounted Component
**What goes wrong:** User navigates away (or closes the panel) while a publish is in flight. The delayed `setTimeout` fires and calls `setOutcome(null)` on an unmounted component — React warning, potential memory leak.
**Why it happens:** `setTimeout` holds a closure that captures `setOutcome`.
**How to avoid:** Return `clearTimeout(dismissTimerRef.current)` in a `useEffect` cleanup (triggered on unmount).

### Pitfall 5: confirm_future Double-Await Warning
**What goes wrong:** Confusion about the double `.await` pattern from lapin.
**Why it happens:** `channel.basic_publish(...).await` gives `Result<PublisherConfirm>`. The inner `.await` on `PublisherConfirm` gives `Result<Confirmation>`. The current code already does this correctly (`confirm_future.await`). The `tokio::time::timeout` wraps only the second await.
**How to avoid:** Pass `confirm_future` (the Future itself) as the second argument to `tokio::time::timeout`. Do NOT write `confirm_future.await` as the argument — that resolves the Future before the timeout can wrap it, producing a type error.

### Pitfall 6: Timeout Badge Has No Auto-Dismiss — Manual Dismiss Required
**What goes wrong:** Developer adds auto-dismiss for all four statuses for simplicity.
**Why it happens:** Uniformity instinct.
**How to avoid:** PUBL-08 explicitly requires Timeout to remain until manually dismissed. The dismiss button (X) must appear only for the Timeout badge.

### Anti-Patterns to Avoid
- **Using `wait_for_confirms()`:** This batch API collects all pending confirms together — it does not give per-publish outcomes. The phase requires per-publish outcome, so `confirm_future.await` is the correct pattern.
- **Adding a new `AppError` variant for delivery outcomes:** D-01 is explicit — delivery outcomes are NOT errors. `AppError` remains for connection/channel/encoding failures only.
- **Setting `mandatory=false` as a flag:** D-04 mandates `mandatory=true` always. Per REQUIREMENTS.md Out-of-Scope, per-send toggle is deferred.

## Code Examples

### NACK in Practice
NACK from the broker (`Confirmation::Nack`) occurs on internal broker error (disk/memory pressure, cluster replication failure). In normal developer use against a local RabbitMQ instance, NACK almost never fires. The handler must exist for correctness, but test effort for NACK is proportional to its rarity — a single unit test with a mocked `publishMessage` returning `{ status: "nack" }` is sufficient.

### lapin Confirmation Enum (VERIFIED source)
```rust
// Source: github.com/amqp-rs/lapin/blob/main/src/publisher_confirm.rs
// Verified: Confirmation::Ack(Some(_)) is emitted for mandatory=true + unroutable
// Assertion in tests/publisher_confirms.rs: confirm.is_ack() == true + take_message().is_some()
pub enum Confirmation {
    Ack(Option<Box<BasicReturnMessage>>),
    Nack(Option<Box<BasicReturnMessage>>),
    NotRequested,
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Discard `Confirmation` variant after `?` | Match on `Confirmation::Ack(None/Some)` and `Nack` | Phase 10 (this phase) | Enables returned-message detection without any new lapin API |
| `BasicPublishOptions::default()` (mandatory=false) | `BasicPublishOptions { mandatory: true, ..default() }` | Phase 10 (this phase) | Unroutable messages now surface; previously silently dropped |
| Return `Result<(), AppError>` from publish_message | Return `Result<PublishOutcome, AppError>` | Phase 10 (this phase) | IPC now carries delivery outcome |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| (none) | All D-05 claims verified from official lapin source + examples + tests | — | — |

**All claims in this research were verified or cited — no user confirmation needed.**

## Open Questions (RESOLVED)

(none — all D-05 open questions resolved by research)

## Environment Availability

Step 2.6: SKIPPED — this phase is purely code/config changes. No new external dependencies. lapin 4.x and tokio are already in Cargo.toml. No new npm packages required.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | no | Outcome status is broker-generated; no user input |
| V6 Cryptography | no | — |

No new attack surface is introduced. The `PublishOutcome.status` field is set entirely by Rust based on the broker's AMQP response — it is never derived from user input and never written back to a store. The existing security boundary (password URI scope, WR-01) is unchanged.

## Sources

### Primary (HIGH confidence)
- `github.com/amqp-rs/lapin/blob/main/src/publisher_confirm.rs` — `Confirmation` enum definition, `PublisherConfirm` Future impl, `take_message()` method
- `github.com/amqp-rs/lapin/blob/main/examples/publisher_confirms.rs` — official example: mandatory=true, `confirm.is_ack()`, `confirm.take_message()`
- `docs.rs/crate/lapin/latest/source/tests/publisher_confirms.rs` — official test: asserts `confirm.is_ack() == true` for unroutable mandatory messages
- `docs.rs/lapin/4.7.4/lapin/struct.Channel.html` — `basic_publish` return type: `Result<PublisherConfirm>`
- `/Users/majesnix/gits/tap/src-tauri/src/commands/publish.rs` — current implementation; existing confirm_select, confirm_future.await pattern
- `/Users/majesnix/gits/tap/src-tauri/Cargo.toml` — confirmed lapin 4.x, tokio 1.x, serde 1.x in use

### Secondary (MEDIUM confidence)
- `media-cloud-ai.gitlab.io/sdks/py_mcai_worker_sdk/lapin/publisher_confirm/enum.Confirmation.html` — Confirmation enum variant signatures (cross-reference)

## Metadata

**Confidence breakdown:**
- D-05 lapin return frame API: HIGH — verified from official source + official example + official test
- Standard stack (no new deps): HIGH — Cargo.toml and package.json examined directly
- Badge rendering pattern: HIGH — badge.tsx examined directly; className override approach consistent with existing code
- Pitfalls: HIGH — derived directly from code reading existing publish.rs and known React timer patterns

**Research date:** 2026-05-19
**Valid until:** 2026-11-19 (lapin 4.x API is stable; Confirmation enum is unlikely to change in a patch)
