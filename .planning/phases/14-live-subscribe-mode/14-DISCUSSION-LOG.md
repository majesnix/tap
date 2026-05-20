# Phase 14: Live Subscribe Mode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 14-live-subscribe-mode
**Areas discussed:** Streaming delivery, Subscribe/Drain UI, Consumer stop signal, Auto-stop behavior

---

## Streaming Delivery

| Option | Description | Selected |
|--------|-------------|----------|
| Tauri Channel<T> | Pass a Channel from JS; Rust pushes each delivery through it in real time | ✓ |
| Tauri events (app_handle.emit) | Global event bus push; less structured, no typed channel | |
| Frontend polling loop | Frontend calls drain_messages(N=1) every ~500ms; not truly real-time | |

**User's choice:** Tauri Channel<T>
**Notes:** Recommended option selected for all three sub-questions in this area.

| Sub-question: Command signature | Option | Selected |
|---------------------------------|--------|----------|
| start_subscribe(...) → () | Returns immediately; consumer runs in spawned task | ✓ |
| start_subscribe(...) → Result<SubscribeHandle> | Returns handle ID for correlation | |

| Sub-question: Payload type | Option | Selected |
|---------------------------|--------|----------|
| Reuse DrainResult | All needed fields present; appendMessages() unchanged | ✓ |
| New SubscribeResult type | Cleaner separation, flexibility for subscribe-only fields | |

---

## Subscribe/Drain UI

| Option | Description | Selected |
|--------|-------------|----------|
| Mode toggle — segmented control | Toolbar swaps controls (Drain mode / Subscribe mode) via a segmented control | ✓ |
| Tabs — separate panels | Full-panel tab switch between Drain and Subscribe | |
| Side-by-side in one toolbar row | All controls visible at once; potentially cramped | |

**User's choice:** Mode toggle — segmented control
**Notes:** User confirmed the preview: `[ Drain | Subscribe ]` toggle, Drain mode shows count input + Drain button, Subscribe mode shows Start/Stop button.

| Sub-question: Status badge placement | Option | Selected |
|--------------------------------------|--------|----------|
| Inline next to Start/Stop button | Visible in Subscribe mode toolbar row | ✓ |
| Feed header bar | Always visible next to message count and Clear | |

| Sub-question: Mode switch while running | Option | Selected |
|-----------------------------------------|--------|----------|
| Block — disable toggle while Running/Stopping | User must stop first | ✓ |
| Allow — auto-stop on mode switch | Transparent stop, more fluid | |

---

## Consumer Stop Signal

| Option | Description | Selected |
|--------|-------------|----------|
| CancellationToken in app state | tokio_util::CancellationToken; select! in consumer loop; stop_subscribe cancels it | ✓ |
| AtomicBool cancel flag | Simpler; cancellation depends on next message arriving | |

**User's choice:** CancellationToken
**Notes:** User confirmed the app state shape: `Arc<Mutex<Option<CancellationToken>>>`.

| Sub-question: Double-start | Option | Selected |
|---------------------------|--------|----------|
| Return error if already running | Safety net; frontend disables Start when Running | ✓ |
| Auto-cancel previous session | Transparent; status goes Running→Running | |

| Sub-question: Stop mechanism | Option | Selected |
|------------------------------|--------|----------|
| Separate stop_subscribe command | Dedicated command; channel closes naturally on task exit | ✓ |
| Sentinel message through channel | Special {type: "stopped"} event; more complex protocol | |

---

## Auto-Stop Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Stop and keep feed messages | Consistent with Drain; user inspects messages after switch | ✓ |
| Stop and clear feed | Clean slate but loses messages | |

**User's choice:** Stop and keep feed messages

| Sub-question: Feed on Start | Option | Selected |
|-----------------------------|--------|----------|
| Append — never auto-clear | Consistent with Drain D-05 from Phase 13 | ✓ |
| Clear on Start | Clean session view but wipes existing messages | |

| Sub-question: Auto-stop triggers | Option | Selected |
|----------------------------------|--------|----------|
| Profile change + disconnection | Both activeProfileName changes and connectionStatus → disconnected/error | ✓ |
| Profile change only | Disconnection leaves subscribe Running until consumer errors | |

---

## Claude's Discretion

- Exact segmented control component (shadcn ToggleGroup vs hand-rolled radio group vs Tabs)
- Start/Stop button label and icon choices
- Status badge color per state (green=Running, amber=Stopping, red=Error, muted=Idle)
- Whether SubscribeStatus is a type alias in types.ts or inline union
- Error toast wording for consumer errors
- Whether to show "Stopped — X messages received" toast on clean exit
- Consumer task timeout branch for liveness (e.g., 30s of no messages)

## Deferred Ideas

None — discussion stayed within phase scope.
