# Phase 10: Publisher Confirms Badge - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 10-publisher-confirms-badge
**Areas discussed:** IPC return contract, mandatory=true behavior, badge placement, send-over-send

---

## IPC Return Contract

| Option | Description | Selected |
|--------|-------------|----------|
| New return type: PublishOutcome | Change publish_message to return Result<PublishOutcome, AppError> with a flat struct — clean contract, frontend switches on status string | ✓ |
| Keep () return, map to error variants | Return Ok(()) for ACK, Err for NACK/Returned/Timeout — conflates delivery outcomes with errors | |
| New separate command | Keep publish_message as-is, add publish_message_with_confirms — redundant logic | |

**User's choice:** New return type: PublishOutcome (flat struct with `status` string)

---

### IPC return contract — follow-up: struct shape

| Option | Description | Selected |
|--------|-------------|----------|
| Flat struct with status string | `{ status: "ack" \| "nack" \| "returned" \| "timeout" }` — simple serde, easy TypeScript switch | ✓ |
| Tagged Rust enum via serde | `#[serde(tag = "type")]` enum — more idiomatic Rust but requires frontend to handle tag shape | |

**User's choice:** Flat struct with status string

---

## mandatory=true Behavior Change

| Option | Description | Selected |
|--------|-------------|----------|
| Always true | Every publish uses mandatory=true — unrouted messages surface as Returned instead of silently dropping | ✓ |
| User-toggleable in AmqpPropertiesSheet | Add mandatory checkbox to AMQP properties sheet — more control but adds UI surface | |
| Keep false, skip PUBL-06 | Don't change mandatory, drop Returned detection from scope | |

**User's choice:** Always true

---

## Badge Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inline beside Send button | Badge slides in to the left of the Send button in the same row | ✓ |
| Replaces isSending spinner location | Badge appears where spinner was, after send completes | |
| Small floating toast-like above the bar | Badge floats above the bar, more visible but may overlap | |

**User's choice:** Inline beside Send button

---

### Badge placement — follow-up: content style

| Option | Description | Selected |
|--------|-------------|----------|
| Color + short text label | Green "ACK" / Amber "Returned" / Red "NACK" / Gray "Timeout" | ✓ |
| Color + icon only | Checkmark / warning / X / clock icons — compact but requires learning | |

**User's choice:** Color + short text label

---

## Send-over-send

| Option | Description | Selected |
|--------|-------------|----------|
| Replace immediately | New send clears previous badge, shows spinner, then new outcome — no queuing | ✓ |
| Block re-send until badge dismisses | Disable Send button while badge is showing — adds friction | |
| Queue and show in sequence | Badge queue state machine — overkill for a dev tool | |

**User's choice:** Replace immediately

---

## Claude's Discretion

None — all areas had clear user preferences.

## Deferred Ideas

None — discussion stayed within phase scope.
