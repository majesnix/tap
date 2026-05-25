# Research Summary — Tap v1.8 UX Polish + Proto Ergonomics

**Project:** Tap (proto-sender)
**Milestone:** v1.8 UX Polish + Proto Ergonomics
**Researched:** 2026-05-25
**Confidence:** HIGH

## Executive Summary

Tap v1.8 adds 10 UX ergonomic and proto ergonomic features to a stable, fully-shipped v1.7 app. The entire milestone requires exactly **one new npm dependency** (`react-hotkeys-hook@^5.3.2`). No new Rust crates, no new Tauri plugins, no capability JSON changes. One new Rust command (`reload_proto`) uses only stdlib. All 10 features compose over existing infrastructure: `tauri-plugin-store`, `useProtoStore`, `cmdk`, recursive `Collapsible`, and the `setPendingReplayValues` replay signal.

Primary technical risk concentrates in two features: proto file reload (requires atomically rebuilding the `DescriptorPool`, which has no `remove_file` method) and draft persistence (requires restoring map/repeated fields via `replace()`, not `reset()`, flowing through `setPendingReplayValues`). Both risks are well-characterized with known mitigations.

---

## Key Findings

### Stack

**Install command for v1.8:** `pnpm add react-hotkeys-hook`

| Dependency | Version | Purpose | Why |
|------------|---------|---------|-----|
| `react-hotkeys-hook` | ^5.3.2 | Declarative keyboard shortcuts | Handles macOS/Windows normalization, `enableOnFormTags`, `HotkeysProvider` scope; verified React 19.1 compatible and WKWebView safe |

**Rejected libraries:**
- `@tauri-apps/plugin-global-shortcut` — wrong scope (OS-level, fires when app unfocused); in-app shortcuts only
- `@faker-js/faker` — 4.16 MB, no proto type awareness; hand-rolled `randomValueForField` (~70 lines) is correct
- `react-arborist` — 364 KB virtualization overkill for 5–50 node trees; recursive `Collapsible` (installed) is sufficient
- `@tauri-apps/plugin-clipboard-manager` — `navigator.clipboard.writeText()` already established since Phase 04

**New Rust commands (no new crates):**
- `reload_proto` — atomically rebuilds `DescriptorPool` from all open files; replaces Tauri State pool under `Mutex<Option<DescriptorPool>>`
- `check_paths_exist(paths: Vec<String>) -> Vec<bool>` — validates arbitrary proto paths via `std::path::Path::exists()`, bypassing narrowed `fs:scope`

### Features

**Table stakes (users expect these — absence = friction):**
- `Cmd+Enter` Send shortcut — universal across Postman, Insomnia, Bruno
- Proto reload button — #1 BloomRPC user complaint; re-opening via file dialog on every edit is unacceptable
- Recent files list (FIFO-10) — developers work with same 3–5 proto files daily
- Connection quick-switch dropdown in toolbar — Postman/Insomnia/Bruno/TablePlus universal top-right pattern
- Import path manager UI — GUI gap all CLI tools leave behind; Bruno's per-collection UI is the reference
- Inline field-type tooltips — expected in any schema-surfacing tool
- Form draft auto-save — Insomnia/Postman's dominant pattern; no manual "save draft" button needed

**Differentiators:**
- `Cmd+Shift+R` clear form, `Cmd+1/2/3` tab navigation, `Cmd+O` open proto
- Field-level copy-to-clipboard (hover-reveal) — not present in any surveyed proto tool
- Randomizer (single button, non-dirty fields only, enum-aware) — no direct prior art in any proto/gRPC/API tool
- Schema tree panel (collapsible Sheet) — no API tool has this separate from the form

### Architecture

**6 new files:** `useKeyboardShortcuts.ts`, `randomize.ts`, `FieldCopyButton.tsx`, `ConnectionQuickSwitch.tsx`, `SchemaExplorer.tsx`, `useDraftPersistence.ts`

**Extension points (all non-invasive):**

| Component | Change |
|-----------|--------|
| `AppLayout.tsx` | Mount `useKeyboardShortcuts` hook; wrap in `HotkeysProvider` |
| `FormPanel.tsx` | Add Clear + Randomize buttons; mount `useDraftPersistence` |
| `FileSection.tsx` | Add recent files dropdown, reload button per tab, import manager trigger |
| `PublishBar.tsx` | Embed `ConnectionQuickSwitch` component |
| `Sidebar.tsx` | Add schema explorer trigger button |
| Field components | Add `FieldCopyButton` shared component |
| `proto.rs` | Add `reload_proto` command; extend `lib.rs` registration |
| `useProtoStore.ts` | Extend with `recentFiles[]`, `addRecentFile()`, `setRecentFiles()` |

**`setPendingReplayValues` is the mandatory form-population path** for form reset, randomizer, and draft restore. Do not call `resetRef.current()` directly.

---

## Critical Pitfalls

**Pitfall 1 — DescriptorPool append-only blocks proto reload (CRITICAL)**
`prost-reflect`'s `DescriptorPool` has no `remove_file()` method. The existing `parse_proto` skip-if-exists guard makes re-calling it a silent no-op for changed files. The new `reload_proto` command must reconstruct the entire pool from scratch from all currently-open file+include-path pairs and replace the Tauri State `Mutex<Option<DescriptorPool>>` atomically.

**Pitfall 2 — Draft persistence breaks on complex field types**
`form.reset(JSON.parse(draft))` silently corrupts map, repeated, and oneof fields. `useFieldArray`-backed fields require `replace()` after `reset()` (the `mapReplaceRegistry` ref pattern from Phase 25). All restore `setValue` calls must use `shouldDirty: false` to avoid false conflict dialogs in block apply. Route all restore through `setPendingReplayValues`.

**Pitfall 3 — CodeMirror captures Cmd+Enter before global listener**
CodeMirror intercepts keyboard events before they bubble to `document`. A window-level handler will not fire when focus is inside `JsonEditor`. Solution: check `event.target.closest('.cm-editor')` in the global handler AND register `Cmd+Enter` as a CodeMirror keymap extension in `JsonEditor` separately.

**Pitfall 4 — ProtoFormRenderer switch is FROZEN**
Randomizer, schema explorer, and import manager must not add cases to the switch. Randomizer generates values in `src/lib/randomize.ts` and injects via `setPendingReplayValues`. Schema explorer reads `ProtoSchema` directly from `useProtoStore`.

**Pitfall 5 — Randomizer infinite loop on recursive messages**
Enforce `MAX_DEPTH = 5` (matching `ProtoFormRenderer`) and emit `{}` at depth limit to prevent stack overflow on self-referential schemas.

**Pitfall 6 — Profile switch corrupts mid-plan-run execution**
Connection quick-switch must check `usePlanExecutionStore.isRunning` before allowing switch. Replicate the SubscribePanel auto-stop guard.

**Randomizer type constraints:** enum from `EnumValue[].number`, bytes as standard-alphabet base64, int64/uint64 as strings, WKTs as shaped `{seconds, nanos}` objects, oneof sets `_selected` before branch fill with `shouldDirty: false`.

---

## Roadmap Implications

**Suggested phases: 5**

| Phase | Name | Scope | Research-phase needed? |
|-------|------|-------|------------------------|
| A | Keyboard Shortcuts + Field Copy | Pure frontend, no backend, no store mutations | No |
| B | Proto File Management | `reload_proto` Rust command, recent files, import manager | **Yes** — atomic Tauri State pool replacement |
| C | Connection Quick-Switch + Draft Persistence | Stateful cross-feature group | **Yes** — RHF `useFieldArray.replace()` restore path, JSON-mode draft shape |
| D | Randomizer + Field Type Tooltips | Pure read-path form features over `MessageDescriptor` | No |
| E | Schema Explorer Tree | Highest-complexity committed feature, ships last | No |

**Phase ordering rationale:**
- Phase A ships first: purely additive, zero risk, validates `setPendingReplayValues` path before Phase C builds on it
- `reload_proto` (Phase B) gates import manager
- Connection-switch event flow (Phase C) must be proven before draft write condition is correct
- Schema explorer (Phase E) ships last to isolate scope-creep risk

**Open gaps for planning:**
- `draft:` store key: file-scoped `draft:{encodedFilePath}:{messageFullName}` required for multi-proto-tab sessions
- `fs:allow-exists` capability: Phase B must verify if already granted in `capabilities/default.json`
- JSON-mode draft shape: `{ mode: 'json', jsonString }` vs `{ mode: 'form', values }` — decide in Phase C planning

---

## Sources

- Direct codebase reads: `proto.rs`, `FormPanel.tsx`, `useProtoStore.ts`, `AppLayout.tsx`, `FileSection.tsx`, `lib.rs`, `types.ts`
- Context7: `react-hotkeys-hook` v5.3.2, `tauri-plugin-global-shortcut`, `tauri-plugin-clipboard-manager`
- prost-reflect docs.rs: `DescriptorPool` API (no `remove_file`)
- Insomnia keyboard shortcuts, Postman shortcuts docs, Bruno proto import docs
- Tauri GitHub issues #8676 (WKWebView keyboard conflicts)
- BloomRPC archived repo issues (#1 complaint: import path UX)

*Research completed: 2026-05-25 | Ready for roadmap: yes*
