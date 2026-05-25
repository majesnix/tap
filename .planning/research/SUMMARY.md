# Research Summary — Tap v1.7

**Project:** Tap (proto-sender)
**Milestone:** v1.7 — Block Apply Completeness + History Search
**Researched:** 2026-05-25
**Confidence:** HIGH

---

## Executive Summary

v1.7 delivers two isolated feature completions: extending block apply to handle oneof, WellKnownType, and map fields (previously skipped with a BLK-08 toast), and adding full-text search across decoded field values in the history panel. Both features require zero new dependencies — every primitive needed (AlertDialog, Input, useFieldArray, dirtyFields, filterHistoryEntries) is already installed and validated in the v1.6 stack.

The recommended approach is additive and layered. History search is a pure extension of the existing filterHistoryEntries helper with a recursive value walker — no indexing, no new libraries, no store changes. Block apply extension requires splitting the current single-ref applyBlockRef contract into a two-phase plan/commit model, extracting pure helpers to a new src/lib/blockApply.ts module, and adding one new dialog component (BlockApplyConflictDialog). The conflict prompt (batched, not per-field) replaces the current silent dirty-skip for all field types.

The primary risk for v1.7 is the oneof branch-switch path: setting _selected before the branch value triggers OneofField s unregister effect mid-write. The mitigation is an atomic setValue with the full oneof object. A secondary risk is the setValue vs replace() question for map fields — ARCHITECTURE.md section 1.4 claims setValue on the top-level array path refreshes useFieldArray rows, but Pitfall #21 documents that setValue bypasses useFieldArray s internal fields ref. This must be verified during Phase B implementation before committing to the setValue path.

---

## Key Findings

### Stack

No new dependencies. The v1.6 stack covers everything:

- **react-hook-form 7.76.0** — setValue, dirtyFields, getValues for block apply; useMemo for history filtering
- **shadcn/ui AlertDialog** — already installed at src/components/ui/alert-dialog.tsx; used for batched conflict prompt
- **shadcn/ui Input + lucide-react** — already installed; search input requires no new component
- **zustand 5.x** — no store changes needed; conflict state and search query are transient useState

One doc-level inconsistency: CLAUDE.md cites zod 3.24.2 but the installed version is 4.4.3. Not blocking for v1.7.

### Features

**Block Apply — Table Stakes (all required for v1.7 completeness):**

| ID | Description |
|----|-------------|
| BLK-CT-01/02 | WKT fields (Timestamp, Duration) fill and respect dirty guard — same as scalar |
| BLK-CT-03 | Map field replace-all when empty (no collision) |
| BLK-CT-04 | Map field per-collision overwrite prompt via batched dialog |
| BLK-CT-05 | Oneof same-branch fill of non-dirty branch fields |
| BLK-CT-06 | Oneof branch-switch prompt before _selected change |
| BLK-CT-07 | Batched conflict prompt (Apply All / Skip All) — UX container for CT-04 and CT-06 |

**Block Apply — Defer to v1.8:**
- BLK-DIF-01: Decide-each wizard mode in conflict prompt
- BLK-DIF-03: Repeated field merge from block (ambiguous append vs replace semantics)

**Anti-features confirmed:** Per-field modal chains, silent dirty-field overwrite, block apply in JSON mode (guarded by existing isJsonMode guard), recursive nested-message merge.

**History Search — Table Stakes:**

| ID | Description |
|----|-------------|
| HIST-FT-01 | Search input alongside existing type/target filters |
| HIST-FT-02/03 | Match message type name and queue/exchange target |
| HIST-FT-04 | Match field names (keys) in fieldValues |
| HIST-FT-05 | Match field values: scalars, nested messages, repeated, map rows, oneof (including _selected) |
| HIST-FT-06 | Case-insensitive substring match |
| HIST-FT-07 | AND composition with existing type and target filters |
| HIST-FT-08 | Empty query = passthrough |
| HIST-FT-09 | Filtered count label updates |

**History Search — Include in v1.7:**
- HIST-DIF-02: N of M filtered count indicator (trivial, high value)
- HIST-DIF-03: 150ms debounce via existing useDebounce hook

**Anti-features confirmed:** Searching payloadBytes/hex, fuzzy/ranked search, replacing existing precision filters, persisting search query.

### Architecture

**Two-phase applyBlockRef contract** is the central architectural decision for block apply. The current single applyBlockRef becomes:
- planApplyBlockRef — pure function, no side effects; classifies each block key as cleanApply | conflict | unmatched; returns ApplyPlan
- commitApplyBlockRef — writes setValue calls based on ApplyDecision[] from the dialog

ProtoFormRenderer populates both refs. FormPanel orchestrates the two-phase flow in useDndMonitor.onDragEnd. BlockApplyConflictDialog (new stateless component) renders per-field overwrite/skip UI.

**Pure helper extraction:** Types (ApplyPlan, FieldConflict, ApplyDecision) and pure functions (buildApplyPlan, classifyBlockKey) go to src/lib/blockApply.ts — independently unit-testable, not inside the frozen ProtoFormRenderer switch.

**History search integration** is additive: extractSearchTokens(value, depth?) is a new export on historyHelpers.ts. filterHistoryEntries gains a searchQuery parameter with empty string as passthrough. Callers are backward-compatible. MessageHistoryPanel adds searchQuery state + debounce; HistoryFilterBar adds a third Input.

**Depth guard:** recursive extractSearchTokens caps at depth 10 (proto MAX_DEPTH 5 + oneof + map value layers). FEATURES.md recommends depth 8; ARCHITECTURE.md uses 10. Either is acceptable; decide at implementation time.

**Files changed (complete inventory):**

New files:
- src/lib/blockApply.ts — types + pure helpers
- src/components/blocks/BlockApplyConflictDialog.tsx — stateless conflict dialog

Modified files:
- src/components/form/ProtoFormRenderer.tsx — two-phase refs, extended eligibility
- src/components/form/FormPanel.tsx — two-phase ref wiring, dialog integration
- src/components/history/historyHelpers.ts — extractSearchTokens, filterHistoryEntries signature
- src/components/history/HistoryFilterBar.tsx — search Input
- src/components/history/MessageHistoryPanel.tsx — searchQuery state + debounce

Unchanged (confirmed): OneofField, WellKnownTypeField, MapField, useHistoryStore, AppLayout, BlockLibraryPanel, ProtoFormRenderer switch body (frozen per D-01).

### Critical Pitfalls

**Pitfall A — Oneof branch registration race (CRITICAL for Phase C):**
Setting _selected first then the branch field separately triggers OneofField s unregister effect mid-write, unregistering the branch path before the second setValue lands. Prevention: set the entire oneof atomically — setValue(key, { _selected: branchName, [branchName]: branchValue }, { shouldDirty: false }). The commit function in blockApply.ts must enforce this order.

**Pitfall B — Map useFieldArray: setValue vs replace() (VERIFY in Phase B):**
ARCHITECTURE.md section 1.4 states setValue(key, arrayOfPairs) refreshes useFieldArray rows because MapField watches the path. However, Pitfall #21 (PITFALLS.md) documents the opposite: setValue updates the form store but does NOT update useFieldArray s internal fields ref — rows render stale until the component remounts. These claims are in direct contradiction. Phase B must empirically verify which path works before finalizing the commit implementation. If setValue does not work visibly, use replace() from the useFieldArray instance, which requires MapField to expose replace upward (adds coupling) or a different approach.

**Pitfall C — _selected discriminator in field values search:**
When the history search walker recurses into an oneof { _selected: card_number, card_number: 4111... }, _selected must be treated as a searchable key (developers search by branch name). The extractSearchTokens recursive object branch must include object keys as tokens — not just values. FEATURES.md HIST-FT-05 and ARCHITECTURE.md section 2.4 both confirm this.

**Pitfall D — shouldDirty: false on all block apply setValue calls:**
All setValue calls in commitApplyBlockRef must use { shouldDirty: false }. This preserves the dirtyFields signal for subsequent block drops. Omitting it can register block-filled fields as user-touched, causing them to surface as conflicts on the next drag.

**Pitfall E — Default conflict state in dialog (conservative):**
BlockApplyConflictDialog must initialize each conflict row to skip. Defaulting to overwrite would silently destroy user-entered data on any drag where the user clicks Apply without reviewing the list. Document this as BA-D1 at component authoring.

---

## Implications for Roadmap

Suggested phase order is unambiguous from dependency analysis across all three research files.

### Phase A — History Full-Text Search

**Rationale:** Zero dependencies on block apply. Touches only three files. Lowest risk. Independently testable end-to-end. Delivers visible user value before the higher-complexity block apply work.

**Delivers:** Search input in HistoryFilterBar; recursive field value matching; AND composition with existing filters; filtered count label (HIST-DIF-02); 150ms debounce (HIST-DIF-03).

**Implements:** extractSearchTokens in historyHelpers.ts + filterHistoryEntries update + HistoryFilterBar + MessageHistoryPanel wiring.

**Avoids:** Pitfall C (_selected must be a searchable key in the recursive walker).

**Build order:** extractSearchTokens + tests → filterHistoryEntries update + tests → HistoryFilterBar + MessageHistoryPanel wiring.

**Research flag:** No deeper research needed. Pattern extends existing code with well-understood primitives.

---

### Phase B — Block Apply: WKT + Map Empty Case

**Rationale:** Lowest complexity in block apply. No conflict prompt required. Validates the buildApplyPlan helper and two-phase ref split in isolation before adding dialog complexity in Phase C.

**Delivers:** WKT fields fillable from blocks; map fields replaceable when empty; src/lib/blockApply.ts with types and pure helpers; planApplyBlockRef + commitApplyBlockRef ref split wired in ProtoFormRenderer and FormPanel.

**Implements:** BLK-CT-01, BLK-CT-02, BLK-CT-03.

**Avoids:** Pitfall D (shouldDirty: false on all setValue calls).

**Critical verification:** Empirically test whether setValue(mapKey, arrayOfPairs) visibly refreshes useFieldArray rows in MapField (Pitfall B). This is an implementation-time code experiment. Resolve before Phase C begins.

**Research flag:** No pre-phase research needed. The map setValue vs replace() question is resolved by running the code, not by research.

---

### Phase C — Block Apply: Conflict Prompt + Oneof

**Rationale:** Highest UX risk of the three phases. BlockApplyConflictDialog, oneof branch-switch, and batched prompt must ship together — the prompt is the UX container for both map collision and oneof branch-switch conflicts. Isolated in its own phase for clean risk management.

**Delivers:** BlockApplyConflictDialog; oneof same-branch fill (BLK-CT-05); oneof branch-switch prompt (BLK-CT-06); map collision prompt (BLK-CT-04); batched prompt (BLK-CT-07); applyBlockRef contract fully replaced in ProtoFormRenderer and FormPanel.

**Avoids:** Pitfall A (atomic oneof setValue — enforced in commitApplyBlockRef), Pitfall E (conflict default = skip).

**Research flag:** No pre-phase research needed. Architecture is fully specified. BA-D1 (dialog default state) is a one-line decision at component authoring.

---

### Phase Ordering Rationale

- Phase A is independent and lowest-risk; starting here validates the recursive walker pattern before block apply adds structural changes.
- Phase B establishes the two-phase ref architecture and resolves the map setValue question before Phase C adds dialog complexity.
- Phase C is highest-risk and benefits from the structural foundation laid in Phase B.
- No phase has external dependency on new libraries or config changes.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Zero new dependencies confirmed by npm registry check and full src/components/ui inventory |
| Features | HIGH | Table stakes derived from existing codebase behavior and prior phase decisions |
| Architecture | HIGH (with caveat) | Two-phase applyBlockRef and history walker are fully specified. Map setValue vs replace() is the one unverified implementation detail |
| Pitfalls | HIGH | Oneof race confirmed by RHF source behavior; _selected search confirmed by FEATURES.md + ARCHITECTURE.md; setValue/useFieldArray conflict is primary-source documented in Pitfall #21 |

**Overall confidence:** HIGH

### Gaps to Address

- **Map setValue vs replace() (Phase B):** Empirical test required at Phase B implementation start. If setValue on the map top-level array path does not cause useFieldArray in MapField to re-render rows, use replace() — requires MapField to expose replace upward.
- **Depth cap 8 vs 10:** FEATURES.md says 8; ARCHITECTURE.md says 10. Pick one at implementation. No semantic difference for real proto schemas.
- **BA-D1 (conflict dialog default state):** Recommendation is skip (conservative). Confirm at component authoring.

---

## Sources

### Primary (HIGH confidence)

- src/components/form/ProtoFormRenderer.tsx lines 149-180 — applyBlockRef current contract and eligibility gate
- src/components/blocks/BlockLibraryPanel.tsx — AlertDialog usage (confirms installed and wired)
- src/components/history/historyHelpers.ts — filterHistoryEntries existing pattern
- src/stores/useHistoryStore.ts line 6 — MAX_ENTRIES = 100
- react-hook-form docs — useFieldArray + setValue limitation (Pitfall #21 source): https://react-hook-form.com/docs/usefieldarray
- react-hook-form docs — setValue options (shouldDirty): https://react-hook-form.com/docs/useform/setvalue

### Secondary (MEDIUM confidence)

- ARCHITECTURE.md section 1.4 — setValue(key, arrayOfPairs) claim for map fields (contradicted by Pitfall #21; needs Phase B verification)

---

*Research completed: 2026-05-25*
*Ready for roadmap: yes*
