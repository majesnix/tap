# Phase 3: Full Feature Set - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 03-full-feature-set
**Areas discussed:** History persistence, AMQP properties lifetime, Multi-proto tab memory

---

## History Persistence

**Question 1: Where should the history log live?**

| Option | Description | Selected |
|--------|-------------|----------|
| tauri-plugin-store (frontend) | Same layer as profiles. Simple, no new Rust commands. JSON-serialized entries in a dedicated store file. | ✓ |
| Rust backend file | New Rust commands to read/write a history file. More control, but adds IPC round-trips for every log write. | |
| You decide | Let Claude pick the best fit based on existing patterns. | |

**User's choice:** tauri-plugin-store (frontend)

---

**Question 2: How many entries to keep?**

| Option | Description | Selected |
|--------|-------------|----------|
| Cap at 100 entries | Oldest entries dropped when cap is hit. Bounded even with large binary payloads. | ✓ |
| Cap at 500 entries | Larger history at the cost of a potentially large store file over time. | |
| Unlimited | Never drops entries. Store grows indefinitely. | |

**User's choice:** Cap at 100 entries

---

**Question 3: What format for each history entry?**

| Option | Description | Selected |
|--------|-------------|----------|
| JSON field values object + binary bytes | Store both: react-hook-form values (for HIST-02 replay) and raw binary bytes (for HIST-03 hex view). | ✓ |
| Binary bytes only | Decode bytes back to field values via a new Rust decode command for replay. | |
| You decide | Let Claude pick based on existing encode_message patterns. | |

**User's choice:** JSON field values object + binary bytes

---

## AMQP Properties Lifetime

**Question 1: Should AMQP properties survive an app restart?**

| Option | Description | Selected |
|--------|-------------|----------|
| Session-only | Resets to defaults on restart. Simpler — no persistence code needed. | ✓ |
| Persisted via tauri-plugin-store | AMQP properties remembered across restarts. Small store entry. | |

**User's choice:** Session-only

---

**Question 2: Where should AMQP properties state live?**

| Option | Description | Selected |
|--------|-------------|----------|
| New useAmqpStore | Dedicated Zustand store following the existing store pattern. Other components can subscribe without prop-drilling. | ✓ |
| Local state in AmqpPropertiesSheet | useState inside the Sheet component. Requires prop-passing to the publish command. | |
| You decide | Claude picks based on state complexity. | |

**User's choice:** New useAmqpStore

---

## Multi-Proto Tab Memory

**Question 1: When switching back to Tab A, what happens to its Message Type selector?**

| Option | Description | Selected |
|--------|-------------|----------|
| Reset to first message type | Simpler. setFile() already resets selectedType to the first message. No per-tab state needed. | ✓ |
| Remember per-tab selection | Each tab tracks its selected message type independently. Requires per-tab state in the store. | |

**User's choice:** Reset to first message type

---

**Question 2: How should multiple open files be stored in useProtoStore?**

| Option | Description | Selected |
|--------|-------------|----------|
| Array of {filePath, schema} + activeIndex | openFiles: Array<{filePath, schema}>, activeIndex: number. Simple to iterate for tabs. | ✓ |
| Map<filePath, schema> + activeFilePath | Keyed by path — easier lookup, but iteration order is Map insertion order. | |
| You decide | Claude picks the best fit for the existing store pattern. | |

**User's choice:** Array of {filePath, schema} + activeIndex

---

## Claude's Discretion

None — all areas were decided by the user directly.

## Deferred Ideas

- **Response queue / consumer listening** — User mentioned wanting to select a response queue and listen for replies from the consumer. This is message consumption, explicitly Out of Scope for v1 per REQUIREMENTS.md. Captured for v2.
- **Dark/light mode theme switcher** — User mentioned a design-level theme switcher for light/dark mode. Not in Phase 3 scope. Captured for a future UI enhancement phase or v2.
