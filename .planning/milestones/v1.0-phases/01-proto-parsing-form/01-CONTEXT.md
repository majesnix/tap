# Phase 1: Proto Parsing + Form - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers: load a `.proto` file → render a fully type-aware dynamic form → fill in values → inspect the binary-encoded protobuf payload. Entirely offline — no RabbitMQ, no network required.

Phase 1 also establishes the persistent Tauri window structure (sidebar + main area) that Phases 2 and 3 extend. Layout is locked here; later phases add panels without reworking the shell.

</domain>

<decisions>
## Implementation Decisions

### App Shell Layout
- **D-01:** Phase 1 establishes the final persistent window structure — left sidebar + main content area. Phases 2 and 3 extend this structure; no layout rework needed.
- **D-02:** Left sidebar is narrow (~240px fixed). No resizable split pane.
- **D-03:** Sidebar content in Phase 1: proto file name display, message type dropdown, and an "Open file" button. Connection panel area is a placeholder (grayed out / empty) until Phase 2.
- **D-04:** Binary encode preview lives in a collapsible bottom strip below the form in the main panel.

### Encode Preview UX
- **D-05:** Preview updates live/reactively as field values change. Add debounce (e.g., 150–300ms) to avoid re-encoding on every keystroke.
- **D-06:** Preview format: hex string only (e.g., `0a 05 68 65 6c 6c 6f …`). No byte count badge in Phase 1.
- **D-07:** Preview panel is expanded by default when a proto file is loaded.

### Include Path UX
- **D-08:** Include paths are configured via an inline dialog at file-open time. The dialog appears after the file picker closes, pre-populated with the proto file's parent directory. User can add/remove additional paths before loading.
- **D-09:** Include paths are persisted per proto file path (keyed by absolute file path) using `tauri-plugin-store`. Reopening the same file pre-fills the previously used paths.

### Message Type Selection
- **D-10:** Message type selector is a dropdown in the left sidebar, rendered immediately below the proto file name.
- **D-11:** Dropdown shows only top-level message types. Nested message types are only accessible as inline sub-forms within their parent — not as selectable root types.
- **D-12:** Switching message type discards all current form values and resets to zero-value defaults. No confirmation dialog.

### Carried Forward (locked in prior planning)
- **D-13:** Stack: `protox` + `prost-reflect` (Rust proto parsing + dynamic encoding), `react-hook-form` + `zod` + `shadcn/ui` (form), Zustand (global state), Tailwind 4, `tauri-plugin-store`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`.
- **D-14:** oneof fields: radio group with conditional branch visibility (selecting a branch clears sibling branches per proto wire semantics).
- **D-15:** Recursive message depth: hard cap at 5 levels with a collapse placeholder below that. No infinite expansion.
- **D-16:** Include path resolution: explicit list only — never auto-detect from the proto file's location (beyond pre-populating the dialog with the parent dir).
- **D-17:** Binary protobuf wire format only. No JSON encoding in Phase 1.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements and Scope
- `.planning/PROJECT.md` — Project overview, core value, constraints, and key decisions log
- `.planning/REQUIREMENTS.md` — Full v1 requirement list; Phase 1 covers PROT-01, PROT-02, FORM-01–FORM-09
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria (SC-1 through SC-4), and requirement mapping

### Technology Decisions
- `CLAUDE.md` — Complete tech stack with crate versions, alternatives considered, confidence levels, and version constraints (read the full "Recommended Stack" section — it contains critical Tauri integration notes such as `tauri::async_runtime::spawn` requirement and `#[tokio::main]` conflict)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. No existing components, hooks, or utilities.

### Established Patterns
- None established yet. Phase 1 sets the patterns that subsequent phases follow.

### Integration Points
- None yet. Phase 1 bootstraps the Tauri app from scratch.

</code_context>

<specifics>
## Specific Ideas

- The include path dialog should pre-populate with the proto file's parent directory as the default include path — this covers the common case where `.proto` files import siblings from the same directory, reducing friction to zero for standard layouts.
- The sidebar placeholder for the connection panel (Phase 2) should be visible but inactive in Phase 1 — gives users a mental model of what comes next without requiring interaction.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Proto Parsing + Form*
*Context gathered: 2026-05-17*
