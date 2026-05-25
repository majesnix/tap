---
gsd_state_version: 1.0
milestone: v1.8
milestone_name: UX Polish + Proto Ergonomics
status: planning
last_updated: "2026-05-25T18:32:12.467Z"
last_activity: 2026-05-25 — v1.8 roadmap created; 5 phases defined (27–31)
progress:
  total_phases: 16
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State: Tap

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-25 after v1.7 milestone)

**Core value:** Send a real protobuf message to RabbitMQ in under 30 seconds from a raw `.proto` file — no code, no curl, no manual encoding.
**Current focus:** v1.8 — Phase 27: Keyboard Shortcuts + Field Copy

## Current Position

Phase: 27 of 31 (Keyboard Shortcuts + Field Copy)
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-05-25 — v1.8 roadmap created; 5 phases defined (27–31)

```
v1.8 milestone: [░░░░░░░░░░░░░░░░░░░░] 0% (0/5 phases)
```

## Performance Metrics

- Phases complete: 0/5
- Plans complete: 0/TBD

## Accumulated Context

### Key Architectural Constraints (from research)

- **ProtoFormRenderer switch is FROZEN** — Randomizer, tooltips, and schema explorer must not add switch cases; use pre-dispatch branches and read-only store access instead
- **`setPendingReplayValues` is the mandatory form-fill path** — form reset (Clear), randomizer, and draft restore must all flow through this signal; never call `resetRef.current()` directly
- **`DescriptorPool` is append-only** — `reload_proto` Rust command must rebuild the entire pool from scratch and atomically replace Tauri State `Mutex<Option<DescriptorPool>>`; re-calling `parse_proto` is a silent no-op
- **CodeMirror captures Cmd+Enter** — global handler misses events when focus is inside JsonEditor; dual registration required (window handler + CodeMirror keymap extension)
- **Draft restore via `setPendingReplayValues`** — map/repeated fields require `replace()` after `reset()` (mapReplaceRegistry pattern from Phase 25); all restore `setValue` calls use `shouldDirty: false`
- **Connection switch guard** — CQS must check `usePlanExecutionStore.isRunning` before allowing switch (replicates SubscribePanel auto-stop guard)

### Active Pitfalls (from research)

- **Pitfall 1 (CRITICAL) — Reload must rebuild pool atomically:** `DescriptorPool` has no `remove_file()`; skip-if-exists guard in `parse_proto` makes re-calling it a no-op. `reload_proto` must construct a fresh pool from all open file+include-path pairs.
- **Pitfall 2 — Draft breaks on complex field types:** `form.reset(JSON.parse(draft))` corrupts map/repeated/oneof. Route all restore through `setPendingReplayValues`; use `shouldDirty: false` on all restores.
- **Pitfall 3 — CodeMirror swallows Cmd+Enter:** Register the shortcut both as a window-level handler (check `event.target.closest('.cm-editor')`) and as a CodeMirror keymap extension in `JsonEditor`.
- **Pitfall 5 — Randomizer infinite loop on recursive messages:** Enforce `MAX_DEPTH = 5`; emit `{}` at depth limit. Matches `ProtoFormRenderer` depth cap.
- **Pitfall 6 — Profile switch corrupts mid-plan-run:** `ConnectionQuickSwitch` must check `usePlanExecutionStore.isRunning` before allowing profile change.

### New Dependencies

- **One new npm dep:** `react-hotkeys-hook@^5.3.2` (install with `pnpm add react-hotkeys-hook`)
- **No new Rust crates** — two new Rust stdlib commands: `reload_proto`, `check_paths_exist`

### Open Questions for Planning

- `draft:` store key format: `draft:{encodedFilePath}:{messageFullName}` (file-scoped for multi-proto-tab)
- `fs:allow-exists` capability: Phase 28 plan must verify if already granted in `capabilities/default.json`
- JSON-mode draft shape: `{ mode: 'json', jsonString }` vs `{ mode: 'form', values }` — decide in Phase 29 planning

### Todos

- [ ] Plan Phase 27: Keyboard Shortcuts + Field Copy
- [ ] Plan Phase 28: Proto File Management
- [ ] Plan Phase 29: Connection Quick-Switch + Draft Persistence
- [ ] Plan Phase 30: Randomizer + Field Type Tooltips
- [ ] Plan Phase 31: Schema Explorer Tree

### Blockers

None.

## Session Continuity

Last session: 2026-05-25T18:32:12.463Z
Stopped at: Phase 27 UI-SPEC approved
Resume file: .planning/phases/27-keyboard-shortcuts-field-copy/27-UI-SPEC.md
