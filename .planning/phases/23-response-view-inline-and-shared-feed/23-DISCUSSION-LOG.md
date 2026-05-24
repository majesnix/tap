# Phase 23: Response View — Inline and Shared Feed - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-24
**Phase:** 23-Response View — Inline and Shared Feed
**Areas discussed:** Inline reply location, Shared feed surface, Feed scope

---

## Inline Reply Location

**Q1: Where does the decoded step reply appear?**

| Option | Description | Selected |
|--------|-------------|----------|
| StepFieldEditor right pane | Clicking a completed step loads the editor pane in read-only mode — form fields above (disabled), then a 'Reply' section below | ✓ |
| StepListPanel row expansion | Each step row with a reply has a disclosure chevron — clicking expands the row inline (240px column) | |
| Both — collapsed preview in list, full view in editor | Step list shows 1-2 line summary; full view in editor pane | |

**User's choice:** StepFieldEditor right pane

---

**Q2: How do form fields and reply relate in the editor pane?**

| Option | Description | Selected |
|--------|-------------|----------|
| Reply replaces the form | When a step has a reply, right pane shows only the decoded response | ✓ |
| Reply appended below the form | Disabled form fields above, 'Reply received' section appended below | |
| You decide | Let Claude determine the right layout | |

**User's choice:** Reply replaces the form

---

**Q3: How does the user navigate back to the form?**

| Option | Description | Selected |
|--------|-------------|----------|
| Clicking the step again toggles back | Second click on same step row switches pane back to editor mode | ✓ |
| A back arrow or 'View form' button in reply pane header | Small button at top of reply view | |
| You decide | Let Claude pick the cleanest approach | |

**User's choice:** Clicking the step again toggles back

---

**Q4: Does the pane auto-switch to reply view during a live run?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — auto-switch when reply arrives | Pane tracks active step; switches to reply view when execute_step resolves with a reply | ✓ |
| No — reply view is manual only | User clicks the step after the run | |
| Auto-switch only after run completes | During run stays on active step's form; after finishRun() first reply-step is auto-selected | |

**User's choice:** Yes — auto-switch when reply arrives

---

## Shared Feed Surface

**Q1: Where does the shared reply feed live?**

| Option | Description | Selected |
|--------|-------------|----------|
| Tab strip in the right pane | [Step Editor \| Reply Feed] tabs in StepFieldEditor pane header | ✓ |
| Auto-swap the right pane during a run | Right pane switches to feed view when run starts | |
| Sheet/drawer from PlanRunBar | 'View feed' button opens a side sheet | |

**User's choice:** Tab strip in the right pane

---

**Q2: When does the tab strip appear?**

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible once a plan has been run | Tab bar appears after first run, persists for session lifetime | ✓ |
| Only while a run is active | Disappears when finishRun() is called | |
| Only when at least one reply has arrived | Appears first time a step reply is stored | |

**User's choice:** Always visible once a plan has been run

---

**Q3: How are entries displayed in the Feed tab?**

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse MessageFeedRow accordion | Reuse existing MessageFeedRow + ResponseDecodedView pattern; zero new display component | ✓ |
| Flat chronological list with step name prefix | Simple list without accordion/hex viewer | |
| You decide | Let Claude pick the display format | |

**User's choice:** Reuse MessageFeedRow accordion

---

**Q4: Does the Feed tab auto-activate when a run starts?**

| Option | Description | Selected |
|--------|-------------|----------|
| No — user switches manually | Active tab preserved; no surprise layout jumps | ✓ |
| Yes — auto-switch to Feed when run starts | Run start triggers tab switch | |
| You decide | Let Claude decide | |

**User's choice:** No — user switches manually

---

## Feed Scope

**Q1: What appears in the shared Reply Feed tab?**

| Option | Description | Selected |
|--------|-------------|----------|
| Reply messages only | Only messages from correlation-id and first-arrival steps | ✓ |
| Full run timeline | Every step gets an entry including no-wait synthetic entries | |
| You decide | Let Claude interpret the requirement | |

**User's choice:** Reply messages only

---

**Q2: What FIFO cap should the feed use?**

| Option | Description | Selected |
|--------|-------------|----------|
| 500 entries (same as drain/subscribe feed) | Consistent with existing FIFO-500 pattern | ✓ |
| 100 entries | Tighter cap | |
| You decide | Let Claude pick | |

**User's choice:** 500 entries

---

**Q3: Where does the feed store accumulate?**

| Option | Description | Selected |
|--------|-------------|----------|
| Add planReplyFeed to usePlanExecutionStore | New field in existing ephemeral store; cleared by clearRun() | ✓ |
| Separate usePlanFeedStore | New ephemeral Zustand store | |
| You decide | Let Claude decide | |

**User's choice:** Add planReplyFeed to usePlanExecutionStore

---

## Claude's Discretion

- Specific tab component — shadcn `Tabs` with `TabsList` / `TabsTrigger` / `TabsContent`
- Whether tab strip renders inside `StepFieldEditor.tsx` or lifted to `PlanDetailPanel.tsx`
- Empty state text for Reply Feed tab when no replies have arrived
- Step list reply indicator visual (dot, color, size)
- Handling of `exchange: ""` in MessageFeedRow (filter empty segments vs accept the artifact)

## Deferred Ideas

- Step-level reply count in PlanRunBar summary — post-v1.6
- Persist reply feed across session — defer to v2
- JSON export of reply feed — backlog
- Filter/search in Reply Feed tab — same as Phase 15 for drain/subscribe, defer
