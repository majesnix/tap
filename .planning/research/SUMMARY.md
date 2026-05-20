# Research Summary: Proto Sender v1.4 — Advanced Response Consumer

**Project:** Proto Sender
**Milestone:** v1.4
**Researched:** 2026-05-20
**Confidence:** HIGH

---

## Executive Summary

Proto Sender v1.3 ships a working one-at-a-time `basic_get` consumer. v1.4 replaces this with a full consumer suite: batch drain (N messages, one command), live subscribe (persistent streaming consumer), client-side filtering by routing key and content type, and JSON/CSV export.

The existing stack (Tauri 2 + Rust + React + lapin + zustand + react-hook-form + shadcn/ui) is fully in place. Only two new Rust crates needed: `tokio-util 0.7` and `csv 1.4`. No new npm packages — `Channel<T>` is already in `@tauri-apps/api 2.11.0`.

The central architectural decision is a deliberate break from "ephemeral lapin connections per operation": live subscribe holds a long-lived `lapin::Connection` in a background tokio task, controlled by a `CancellationToken` in Tauri managed state. Build drain mode first to validate `ConsumedMessage` type and the list component before introducing the background task complexity.

---

## Stack Additions

| Library | Version | Purpose |
|---------|---------|---------|
| `tokio-util` | `0.7` | `CancellationToken` for subscribe stop; pulls `futures-util::StreamExt` transitively |
| `csv` | `1.4` | CSV export — `wtr.serialize(&msg)` with serde derives |
| `tokio` | existing | Add `"sync"` feature for `tokio::sync::Mutex<ConsumerState>` |

**No new npm deps** — `Channel<T>` is already exported from `@tauri-apps/api 2.11.0`.

**Already built (zero backend work):** `fetch_queue_depth` command, `useResponseStore.queueDepth` state, depth pill in `ResponseQueuePicker` — only UI refresh wiring needed.

---

## Feature Table Stakes

### Must-Have (P1)
- `ConsumedMessage` extended with AMQP metadata (routing key, exchange, content-type, timestamp)
- Scrollable FIFO-500 list — newest on top, per-row expand/collapse
- Drain mode — batch `basic_get` up to N messages, single Rust command
- Live subscribe — persistent `basic_consume` consumer, streaming via `Channel<T>`
- Stop subscribe — `CancellationToken` + `stop_consume` command
- Ack immediately on consume (D-10 extended)
- Queue depth live refresh during subscribe

### Should-Have (P2)
- Client-side filter by routing key (text match)
- Client-side filter by content-type (dropdown)
- Export to JSON
- Export to CSV (`decoded_json` string column for nested proto fields)

### Out of Scope
- Broker-side filtering (AMQP 0-9-1 architectural constraint — impossible)
- Real-time monitoring as a separate product surface
- Dead-letter queue inspector (future milestone)
- Message replay from consumed feed (use existing history replay)

---

## Critical Pitfalls (Watch Out For)

1. **No `basic_qos` prefetch before `basic_consume`** — broker dumps entire queue into memory; can OOM the app on large queues. Always call `channel.basic_qos(0, prefetch, false).await` first.

2. **`app.emit()` for message stream** — causes ghost listeners on re-mount, session crosstalk. Use `tauri::ipc::Channel<T>` exclusively for message delivery.

3. **Unbounded Zustand messages array** — UI freeze starts past ~200 messages. FIFO cap at 500 from day one (same pattern as history cap 100).

4. **Frontend loop calling `consume_message` for drain** — 1 TCP connection per message, unusably slow. Single `drain_messages` Rust command loops inside one connection.

5. **`basic_cancel` alone as stop mechanism** — buffered messages keep emitting after cancel. Use `tokio::select! biased` with `CancellationToken` to stop cleanly.

6. **`consumer.next()` returning `None` unhandled** — silent connection drop with no UI feedback. Detect `None`, emit `consume-error` event, transition state to `errored`.

7. **No `WindowEvent::Destroyed` shutdown hook** — ghost consumer left in RabbitMQ after app quit. Register Tauri window event handler to call `stop_consume` on close.

8. **`std::sync::Mutex` held across `.await`** — compile error (`MutexGuard` is `!Send`). Use `tokio::sync::Mutex` for `ConsumerState` managed state.

---

## Build Order

| Phase | Feature | Rationale |
|-------|---------|-----------|
| Phase 13 | Message Feed Foundation + Drain Mode | Validates `ConsumedMessage` type + FIFO list + Channel streaming at low complexity; no background task yet |
| Phase 14 | Live Subscribe Mode + Stop | Introduces the only architecturally novel piece: `ConsumerState` managed state, long-lived lapin connection, background task, shutdown hook |
| Phase 15 | Filter + Export | Pure frontend work on populated feed; independent of Phase 14 (can defer if scope is tight) |

---

## Open Questions (Resolved in Research)

- **Subscribe auto-stop behavior:** Auto-stop on profile disconnect/switch — follows existing "ephemeral lapin connections per operation" Key Decision.
- **CSV nested fields:** `decoded_json` string column — flattening proto oneofs/repeated is undefined; string is lossless.
- **Filter broker-side vs client-side:** Client-side only — AMQP 0-9-1 architectural constraint, not a design preference.

**Open at implementation time:**
- Exact prefetch count for subscribe (100 vs 200) — decide during Phase 14 planning
- `react-window` for list virtualization — likely deferrable at 500-row cap
- `conn.on_error()` robustness — decide during Phase 14 whether to add alongside stream-end `None` handling

---

*Generated: 2026-05-20*
