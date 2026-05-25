# Requirements: Tap v1.7 — Block Apply Completeness + History Search

**Milestone:** v1.7
**Goal:** Close the remaining gap in block apply for complex field types (oneof / WellKnownType / map), and add full-text search to the history panel.

---

## v1.7 Requirements

### Block Apply — Complex Field Types

- [ ] **BLK-EXT-01**: User can apply a block to a WellKnownType field (Timestamp, Duration) when that field is empty; existing dirty-field guard is respected (dirty WKT fields are skipped, not overwritten)
- [ ] **BLK-EXT-02**: User can apply a block to a map field when the form map is currently empty — block rows replace the empty map via `useFieldArray.replace()` (not `setValue`)
- [ ] **BLK-EXT-03**: When a block targets a map field that already has rows, user sees a batched conflict dialog listing key collisions; user can overwrite or skip each conflicting key
- [ ] **BLK-EXT-04**: User can apply a block to a oneof field when the block targets the same branch that is currently active; non-dirty branch sub-fields are filled; dirty sub-fields are skipped
- [ ] **BLK-EXT-05**: When a block targets a oneof field on a different branch than the active one, user sees a confirmation prompt; if confirmed, the branch is switched and block values are applied after mount
- [ ] **BLK-EXT-06**: All conflicts from a single block apply are batched into one dialog (not per-field modal chain); dialog lists each conflict with overwrite / skip choice; Apply and Cancel actions
- [ ] **BLK-EXT-07**: `applyBlockRef` is refactored to a two-phase plan/commit model: `buildApplyPlan()` (pure, returns what would be applied and what conflicts exist) + `commitApply()` (writes to form after user decision); `BlockApplyConflictDialog` lives in `FormPanel`, not `ProtoFormRenderer`

### History — Full-Text Search

- [ ] **HIST-FT-01**: User sees a search input in the history panel as a third filter control, alongside the existing message type and target filter inputs
- [ ] **HIST-FT-02**: Typing in the search input filters history entries whose message type name contains the query string (case-insensitive substring)
- [ ] **HIST-FT-03**: Typing in the search input filters history entries whose queue/exchange target contains the query string (case-insensitive substring)
- [ ] **HIST-FT-04**: Typing in the search input filters history entries whose `fieldValues` contain a field name (key) matching the query string (schema-guided traversal; `_selected` discriminator and RHF internals excluded)
- [ ] **HIST-FT-05**: Search filter applies with AND logic alongside the existing type and target filters; all three are independent controls
- [ ] **HIST-FT-06**: An empty search query shows the full (unfiltered) entry list; a "X of Y messages" count label reflects the current filtered count
- [ ] **HIST-FT-07**: `filterHistoryEntries` is extended with an optional `searchQuery` parameter (empty string default); all existing callers and tests continue to pass unchanged

---

## Future Requirements

- [ ] **BLK-EXT-FUTURE-01**: Block apply in JSON mode (currently guarded off; complex field type support deferred)
- [ ] **BLK-EXT-FUTURE-02**: Recursive nested-message merge from a block (deferred — requires schema-aware deep merge)
- [ ] **HIST-FT-FUTURE-01**: Search field *values* (decoded scalar data) — requires stripping RHF internals (`_selected`, `useFieldArray` ids) before indexing; deferred from v1.7

---

## Out of Scope

| Item | Reason |
|------|--------|
| Searching `payloadBytes` / hex string | Byte patterns have no semantic search value; causes false positives |
| Fuzzy/ranked search (Fuse.js, MiniSearch) | N=100 history entries makes ranking unnecessary; substring is sufficient |
| Replacing existing type/target filter controls | Search is additive; existing filters remain |
| Persisting search query across restarts | Session-only state; no persistence value for a search field |
| Per-field conflict modal chain | Unusable UX; batched dialog is the correct shape |
| Silent overwrite of dirty complex fields | Would regress the existing dirty-field protection that already exists for scalar fields |
| Export history to CSV | Separate backlog item; not in v1.7 scope |
| Windows distribution | Requires EV/OV certificate strategy; separate effort |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BLK-EXT-01 | Phase 25 | Pending |
| BLK-EXT-02 | Phase 25 | Pending |
| BLK-EXT-03 | Phase 26 | Pending |
| BLK-EXT-04 | Phase 26 | Pending |
| BLK-EXT-05 | Phase 26 | Pending |
| BLK-EXT-06 | Phase 26 | Pending |
| BLK-EXT-07 | Phase 25 | Pending |
| HIST-FT-01 | Phase 24 | Pending |
| HIST-FT-02 | Phase 24 | Pending |
| HIST-FT-03 | Phase 24 | Pending |
| HIST-FT-04 | Phase 24 | Pending |
| HIST-FT-05 | Phase 24 | Pending |
| HIST-FT-06 | Phase 24 | Pending |
| HIST-FT-07 | Phase 24 | Pending |
