# Phase 2: Connect + Publish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 2-Connect + Publish
**Areas discussed:** Connection sidebar panel, Profile management flow, Publish controls placement, After-send feedback

---

## Connection Sidebar Panel

| Option | Description | Selected |
|--------|-------------|----------|
| Compact: profile name + status dot + Manage button | Shows active profile name, color dot, and gear button that opens modal | ✓ |
| Expanded: inline profile list | Lists all profiles in sidebar with click-to-connect | |
| Minimal: just a Connect button | Single button opening a dialog, no persistent status | |

**User's choice:** Compact layout

---

| Option | Description | Selected |
|--------|-------------|----------|
| 3 states: Connected / Error / Not connected | Green / Red / Gray dot | ✓ |
| 4 states: adds a Testing spinner | Also shows spinner during connection test | |
| 2 states: Connected / Not connected | No separate error state | |

**User's choice:** 3 states

---

| Option | Description | Selected |
|--------|-------------|----------|
| Muted 'Add connection' link/button | Ghost-style button matching existing hint style | ✓ |
| Compact placeholder card | Dashed-border card with plus icon | |
| Nothing — hidden until profiles exist | Section hidden on first launch | |

**User's choice:** Muted 'Add connection' link/button

---

| Option | Description | Selected |
|--------|-------------|----------|
| Dropdown in the sidebar | Same shadcn Select pattern as Message Type selector | ✓ |
| Profile list inside the Manage modal | Switching only possible inside the modal | |
| You decide | Leave to planner | |

**User's choice:** Dropdown in sidebar

---

## Profile Management Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Modal dialog | Consistent with IncludePathDialog pattern from Phase 1 | ✓ |
| Dedicated Connections panel | Replaces main content area | |
| Inline form in sidebar | Expands below connection section | |

**User's choice:** Modal dialog

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inline status below form fields | Spinner → checkmark/X below password field | ✓ |
| Separate 'Test Connection' button | Explicit user-triggered test before save | |
| Toast notification | Modal closes on save, toast shows result | |

**User's choice:** Inline status below form fields

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — save + test + activate | If test passes, profile becomes active immediately | ✓ |
| No — save stores, user switches manually | Save stores only, user activates via dropdown | |
| Ask user via confirmation | 'Connect now?' dialog after successful test | |

**User's choice:** Auto-activate on save (if test passes)

---

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-filled default (15672), always visible | All 6 fields shown, mgmt port pre-filled | ✓ |
| Management API port in Advanced collapsible | Basic fields always visible, mgmt port collapsed | |
| You decide | Leave layout to planner | |

**User's choice:** All 6 fields always visible, 15672 pre-filled

---

## Publish Controls Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Top strip above the proto form | Persistent publish bar at top of main panel | ✓ |
| Bottom strip extending hex preview area | Publish controls below the hex preview | |
| Separate publish panel toggled from sidebar | Dedicated panel, adds a navigation step | |

**User's choice:** Top strip above the proto form

---

| Option | Description | Selected |
|--------|-------------|----------|
| Radio toggle: Queue / Exchange | Two-option toggle; Exchange mode shows routing key input | ✓ |
| Single dropdown with sections | One dropdown with Queue/Exchange sections | |
| Separate Queue and Exchange tabs | Tab strip — heavier UI | |

**User's choice:** Radio toggle: Queue / Exchange

---

| Option | Description | Selected |
|--------|-------------|----------|
| Status badge next to the dropdown | 'Live' (green) / 'Manual' (yellow) dot | ✓ |
| Status line below the publish bar | Text explanation below controls | |
| You decide | Leave to planner | |

**User's choice:** Status badge next to dropdown

---

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled when not connected, tooltip on hover | Grayed out + tooltip: 'Connect to a RabbitMQ profile to send.' | ✓ |
| Enabled always — click triggers inline error | Click triggers error if not connected | |
| You decide | Leave to planner | |

**User's choice:** Disabled when not connected, tooltip on hover

---

## After-Send Feedback

| Option | Description | Selected |
|--------|-------------|----------|
| Toast notification | shadcn/ui Toaster — 'Message sent to [queue]' for 3 seconds | ✓ |
| Inline status in the publish bar | Send button briefly shows green checkmark then resets | |
| Both: toast + inline checkmark | Belt-and-suspenders | |

**User's choice:** Toast notification

---

| Option | Description | Selected |
|--------|-------------|----------|
| Red toast with error message | Destructive toast variant — 'Send failed: [error]' | ✓ |
| Inline error below the publish bar | Persistent red line until cleared | |
| Modal error dialog | Dialog with full error + dismiss button | |

**User's choice:** Red toast

---

| Option | Description | Selected |
|--------|-------------|----------|
| Retain values | Form keeps current values after send | ✓ |
| Reset to zero values | Form resets after every send | |

**User's choice:** Retain values

---

## Claude's Discretion

None — all areas received explicit user decisions.

## Deferred Ideas

None — discussion stayed within Phase 2 scope.
