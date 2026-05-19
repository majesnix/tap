# Phase 10: Publisher Confirms Badge - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

After each Send click in the publish bar, an ephemeral badge appears inline beside the Send button showing the broker's delivery outcome: ACK (green), Returned (amber), NACK (red), or Timeout (gray). ACK/Returned/NACK auto-dismiss on a timer; Timeout requires manual dismiss. The badge replaces immediately on a new send — no queuing, no blocking.

**Requirements in scope:** PUBL-05, PUBL-06, PUBL-07, PUBL-08

</domain>

<decisions>
## Implementation Decisions

### IPC Return Contract
- **D-01:** Change `publish_message` to return `Result<PublishOutcome, AppError>` instead of `Result<(), AppError>`. `AppError` is still used for connection failures, channel errors, and encoding errors — not for delivery outcomes.
- **D-02:** `PublishOutcome` is a flat serializable struct with a `status` string field: `"ack"` | `"nack"` | `"returned"` | `"timeout"`. Flat struct (not a Rust tagged enum) — easy to serialize with serde, easy to switch on in TypeScript.
- **D-03:** The 5-second confirm timeout is enforced in Rust (`tokio::time::timeout` around `confirm_future.await`). Timeout returns `Ok(PublishOutcome { status: "timeout" })` — not an `Err`. The broker not responding is a delivery outcome, not a command error.

### mandatory=true Behavior Change
- **D-04:** Always set `mandatory=true` in `BasicPublishOptions` for every publish. Unrouted messages now surface as a Returned badge instead of being silently dropped. This is a deliberate behavior change — silent drops are unhelpful in a dev tool.
- **D-05:** Returned detection requires intercepting `basic.return` frames from the broker before the confirm ACK. The researcher must verify the lapin 4.x API for channel-level return callbacks (e.g., `channel.on_return()` or equivalent) and how the returned frame interacts with the confirm future.

### Badge Placement and Style
- **D-06:** Badge appears inline beside the Send button in the same row (to its left). It does not replace the Send button or the isSending spinner — the spinner stays inside the button during send, the badge appears next to it after.
- **D-07:** Badge shows color + short text label: green "ACK" / amber "Returned" / red "NACK" / gray "Timeout". Reuses the existing `Badge` component from `src/components/ui/badge.tsx` — consistent with the Management API status badge pattern already in PublishBar.
- **D-08:** Auto-dismiss timers: ACK → 3 seconds, Returned → 5 seconds, NACK → 5 seconds. Timeout badge stays until manually dismissed (no auto-dismiss). Matches PUBL-05/06/07/08 exactly.

### Send-over-send
- **D-09:** When the user clicks Send while a badge is showing (or before confirmation arrives for a prior send), the badge is replaced immediately with the new send's loading state. No queuing, no blocking re-send. Previous outcome is lost — acceptable for a dev tool.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §v1.3 — PUBL-05, PUBL-06, PUBL-07, PUBL-08 definitions and acceptance criteria

### Rust Backend (primary change point)
- `src-tauri/src/commands/publish.rs` — `publish_message` command; confirm_select already enabled (CR-01); confirm_future.await has no timeout yet; `BasicPublishOptions::default()` currently uses mandatory=false
- `src-tauri/src/error.rs` — `AppError` enum; `PublishOutcome` struct goes in a new schema module or alongside publish.rs
- `src-tauri/src/lib.rs` — Tauri command registration; `publish_message` return type change propagates here

### Frontend (primary change point)
- `src/components/publish/PublishBar.tsx` — `handleSend` (line ~180); `isSending` state; Send button row (line ~414); Badge component usage already present (line ~326 and ~357); `publishMessage` IPC import (line ~25)
- `src/lib/ipc.ts` — `publishMessage` IPC wrapper; return type must change from `Promise<void>` to `Promise<PublishOutcome>`

### Design System
- `src/components/ui/badge.tsx` — Badge component; existing variant usage in PublishBar for management API status badges (variant="outline", variant="destructive") — use same pattern; add "success" / "warning" variants if not present, or use className overrides

### lapin API (researcher must verify)
- lapin 4.x return frame handling: how to intercept `basic.return` when `mandatory=true` and a message is unroutable — likely `channel.on_return()` callback or similar. Critical for D-05.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Badge` component (`src/components/ui/badge.tsx`) — already used in PublishBar for Management API status; reuse for outcome badge with new color variants or className overrides
- `isSending` state (`PublishBar.tsx` line ~66) — existing loading guard; the badge state is additional, not a replacement
- `handleSend` (`PublishBar.tsx` line ~180) — the function that calls `publishMessage` and handles errors; this is where badge state is set after await

### Established Patterns
- **toast for send errors** — `PublishBar.tsx` currently shows a toast on send failure; the badge replaces the need for a success toast; error toasts (connection failure, encode error) remain unchanged
- **isSending guard** — `disabled={!canSend || isSending}` on the Send button; badge does not affect canSend or isSending; it's purely a post-send display state
- **ephemeral connection per publish** — confirmed pattern; `publish_message` opens and closes its own AMQP connection every time; timeout and return detection must be scoped within this single call

### Integration Points
- `publishMessage` in `src/lib/ipc.ts` — return type changes from `Promise<void>` to `Promise<PublishOutcome>`; callers in `handleSend` await this and set badge state based on `outcome.status`
- `PublishOutcome` TypeScript type must be defined (e.g., in `src/lib/types.ts` or co-located with `ipc.ts`)
- Badge state in `PublishBar.tsx`: new `useState<PublishOutcome | null>` + `useRef<ReturnType<typeof setTimeout>>` for auto-dismiss timer
- Timer cleanup: on unmount and on new send, clear the pending dismiss timer to avoid setting state on unmounted component

</code_context>

<specifics>
## Specific Ideas

- Badge text exactly as specified in requirements: "ACK" (green), "Returned" (amber), "NACK" (red), "Timeout" (gray). Short, uppercase, clear.
- Timeout badge has no X/close button shown for auto-dismiss badges — only the Timeout badge needs a dismiss action (per PUBL-08: "remains until manually dismissed").

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-publisher-confirms-badge*
*Context gathered: 2026-05-19*
