# Phase 1: Proto Parsing + Form - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 1-Proto Parsing + Form
**Areas discussed:** App shell layout, Encode preview UX, Include path UX, Message type selection

---

## App Shell Layout

### Q1: Window structure approach

| Option | Description | Selected |
|--------|-------------|----------|
| Establish final structure now | Phase 1 creates sidebar + main area layout that Phases 2 and 3 extend | ✓ |
| Start minimal, evolve layout later | Phase 1 is a single form page; layout refactored when Phase 2 adds connection panel | |

**User's choice:** Establish final structure now
**Notes:** Avoids rework in later phases; sidebar placeholder for Phase 2 connection panel is acceptable.

### Q2: Sidebar width

| Option | Description | Selected |
|--------|-------------|----------|
| Narrow sidebar (~240px fixed) | Tight utility column; main panel gets most of screen | ✓ |
| Resizable split pane | User can drag divider | |
| You decide | — | |

**User's choice:** Narrow sidebar (~240px fixed)

### Q3: Sidebar content in Phase 1

| Option | Description | Selected |
|--------|-------------|----------|
| Proto file name + message type picker only | Sidebar shows file name, message type dropdown, Open file button | ✓ |
| Proto file name + message picker + include path config | Also shows include path list inline in sidebar | |
| You decide | — | |

**User's choice:** Proto file name + message type picker only
**Notes:** Include paths handled via dialog at file-open time, not in sidebar.

### Q4: Encode preview placement

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom strip below the form | Collapsible panel at bottom of main area; form scrolls above | ✓ |
| Right sub-panel (form left, preview right) | Split main area horizontally | |
| You decide | — | |

**User's choice:** Bottom strip below the form

---

## Encode Preview UX

### Q1: Live vs on-demand encoding

| Option | Description | Selected |
|--------|-------------|----------|
| Live / reactive | Every form change triggers re-encoding with debounce | ✓ |
| On-demand — Encode button | User clicks button to see result | |
| You decide | — | |

**User's choice:** Live / reactive

### Q2: Preview format

| Option | Description | Selected |
|--------|-------------|----------|
| Hex string only | e.g. `0a 05 68 65 6c 6c 6f …` | ✓ |
| Hex + byte count | Hex plus byte-count badge | |
| You decide | — | |

**User's choice:** Hex string only

### Q3: Default panel state

| Option | Description | Selected |
|--------|-------------|----------|
| Expanded by default | Users see hex bytes immediately on file load | ✓ |
| Collapsed by default | User expands when they want to inspect | |
| You decide | — | |

**User's choice:** Expanded by default

---

## Include Path UX

### Q1: Configuration mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Inline prompt at file-open time | Dialog after file picker; pre-populated with proto file's parent dir | ✓ |
| Dedicated settings area | Persistent settings panel configured separately before loading | |
| Secondary picker only when imports fail | Lazy prompt triggered by resolution failure | |

**User's choice:** Inline prompt at file-open time
**Notes:** Pre-populating with parent directory covers the common same-directory-imports case.

### Q2: Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — persist per proto file path | tauri-plugin-store keyed by absolute file path | ✓ |
| No — always start fresh | User re-enters paths each session | |

**User's choice:** Yes — persist per proto file path

---

## Message Type Selection

### Q1: Selector UI

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown in the left sidebar | Sidebar shows file name + dropdown of all top-level message types | ✓ |
| Auto-select first message, switch via sidebar list | App picks first message; sidebar shows list as clickable items | |
| You decide | — | |

**User's choice:** Dropdown in the left sidebar

### Q2: Which types are shown

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level messages only | Nested messages only accessible as sub-forms within parent | ✓ |
| All messages including nested | Any message type can be selected as root | |

**User's choice:** Top-level messages only

### Q3: Behavior on switch

| Option | Description | Selected |
|--------|-------------|----------|
| Discard and reset to defaults | Switching clears form and pre-populates zero-value defaults | ✓ |
| Warn before discarding | Confirmation dialog if form has non-default values | |
| You decide | — | |

**User's choice:** Discard and reset to defaults

---

## Claude's Discretion

None — all areas had explicit user choices.

## Deferred Ideas

None — discussion stayed within phase scope.
