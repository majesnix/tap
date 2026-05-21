# Phase 13: Message Feed Foundation + Drain Mode - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-20
**Phase:** 13-message-feed-foundation-drain-mode
**Areas discussed:** Drain count UX, Single-read fate, Row layout, Empty / error states

---

## Drain count UX

### Q1: How should the user specify how many messages to drain?

| Option | Description | Selected |
|--------|-------------|----------|
| Number input with default | Small number input pre-filled with a default (e.g. 10). User adjusts freely within 1–500. | ✓ |
| Preset buttons | Buttons for fixed values: 10 / 25 / 100 / Max. No typing required, but less flexible. | |
| Fixed default, no control | Always drain a fixed N — no UI input. | |

**User's choice:** Number input with default 10
**Notes:** None

---

### Q2: What should the default N be?

| Option | Description | Selected |
|--------|-------------|----------|
| 10 | Conservative default — drains a small batch. | ✓ |
| 50 | Moderate default. | |
| 100 | Larger default. | |

**User's choice:** 10

---

### Q3: When queue has fewer messages than N?

| Option | Description | Selected |
|--------|-------------|----------|
| Drain all available, stop silently | Loop basic_get until empty or N reached — no warning. | ✓ |
| Show a notice | Display 'Queue exhausted after X messages' inline. | |

**User's choice:** Drain all available, stop silently

---

## Single-read fate

### Q1: Does single "Read once" survive or does Drain replace it?

| Option | Description | Selected |
|--------|-------------|----------|
| Drain replaces it entirely | "Read" button becomes "Drain". One unified model. | ✓ |
| Keep both side by side | Read once + Drain N both exist in the toolbar. | |

**User's choice:** Drain replaces it entirely

---

### Q2: What happens to previous messages when you drain again?

| Option | Description | Selected |
|--------|-------------|----------|
| Append to top | New messages prepend to list. Old messages stay. | ✓ |
| Clear and replace | Each drain clears the list first. | |

**User's choice:** Append to top

---

### Q3: Should the feed have a Clear button?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add a Clear button | Trash icon in feed header. | ✓ |
| No clear button | Messages only age out via the 500-cap. | |

**User's choice:** Yes, add a Clear button

---

## Row layout

### Q1: What does a collapsed message row show?

| Option | Description | Selected |
|--------|-------------|----------|
| All 4 fields on one line | Compact: routing_key • exchange • content-type • timestamp. | ✓ |
| 2-line summary | First line: routing key + timestamp. Second: exchange + content-type. | |
| You decide | Leave exact layout to Claude. | |

**User's choice:** All 4 fields on one line

---

### Q2: What does the expanded row show?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse ResponseDecodedView + ResponseHexSection | Phase 4 components composed inside expanded accordion row. | ✓ |
| Inline simplified view | Smaller inline decoded JSON and hex. | |
| You decide | Claude picks. | |

**User's choice:** Reuse ResponseDecodedView + ResponseHexSection

---

### Q3: How are rows expanded/collapsed?

| Option | Description | Selected |
|--------|-------------|----------|
| Accordion — one at a time | Clicking a row opens it and closes the previous. shadcn Accordion type="single". | ✓ |
| Independent toggles | Each row has its own toggle; multiple open simultaneously. | |

**User's choice:** Accordion — one at a time

---

## Empty / error states

### Q1: What shows before the first drain?

| Option | Description | Selected |
|--------|-------------|----------|
| Text placeholder (same as current) | Muted text: "Select a queue and click Drain". | ✓ |
| Illustrated empty state | Centered icon + label. | |
| Nothing | Feed area is blank. | |

**User's choice:** Text placeholder, same as current

---

### Q2: When a message fails to decode?

| Option | Description | Selected |
|--------|-------------|----------|
| Show error inline in expanded view | Collapsed row shows AMQP metadata normally. Expanded shows error + hex. | ✓ |
| Mark collapsed row with error badge | Red badge on collapsed row. | |

**User's choice:** Show error inline in expanded view

---

### Q3: When queue was empty (0 messages from drain)?

| Option | Description | Selected |
|--------|-------------|----------|
| Toast notification | Sonner toast: "Queue is empty". | ✓ |
| Inline banner | Temporary banner above the feed. | |
| Silent — nothing happens | No visible feedback. | |

**User's choice:** Toast notification

---

## Claude's Discretion

- Exact drain input widget style (spinbox vs plain `<input type="number">`)
- Drain button label ("Drain" vs "Fetch" vs "Get N")
- Row separator style, padding, hover highlight
- Timestamp format (relative "2s ago" vs absolute "14:32:05")
- Feed header layout (message count label, Clear button placement)
- `DrainResult` exact field naming in Rust
- Whether `DrainResult` reuses/extends `ConsumeResult` or is a new type

## Deferred Ideas

None — discussion stayed within phase scope.
