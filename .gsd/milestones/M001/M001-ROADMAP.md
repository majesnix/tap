# M001: v1.8 UX Polish + Proto Ergonomics

**Vision:** Make Tap faster to use day-to-day with keyboard-first workflow, persistent draft state, quick proto navigation, and a schema explorer for power users.

## Success Criteria

- User can control the entire send workflow without touching the mouse (send, open, clear, tab-switch via keyboard)
- User can copy any scalar/enum/bytes field value to clipboard with hover-reveal icon
- User can reload proto files, reopen recent files, and manage include paths without the file picker
- User can switch connection profiles from the publish bar without opening the sidebar
- Form values auto-save and restore per message type across app restarts, including map/repeated/oneof fields
- User can fill all empty fields with type-appropriate random values in one click
- Field tooltips show proto type, field number, and cardinality
- Schema explorer panel shows all messages/fields/enums as a collapsible tree with recursive type safety

## Slices

- [ ] **S01: Keyboard Shortcuts + Field Copy** `risk:medium` `depends:[]`
  > After this: User sends a message via Cmd+Enter from inside CodeMirror, clears form with Cmd+Shift+R, switches tabs with Cmd+1/2/3, and copies a field value with hover-click showing checkmark feedback

- [ ] **S02: Proto File Management** `risk:medium` `depends:[S01]`
  > After this: User edits a proto file externally, clicks Reload, sees updated schema; opens a recent file from the list; adds an include path and the file re-parses automatically

- [ ] **S03: Connection Quick-Switch + Draft Persistence** `risk:high` `depends:[S02]`
  > After this: User fills a complex form with map rows and oneof, switches to a different message type, comes back and sees values restored; closes app, reopens, values still there; switches connection profile from publish bar dropdown

- [ ] **S04: Randomizer + Field Type Tooltips** `risk:medium` `depends:[S03]`
  > After this: User clicks Randomize and all empty fields populate with valid typed values; hovering over any field label shows proto type, field number, and cardinality

- [ ] **S05: Schema Explorer Tree** `risk:low` `depends:[S04]`
  > After this: User opens schema explorer, sees all messages/fields/enums as a tree, expands nested types, loads a recursive proto and the tree renders safely without freezing

## Boundary Map

### S01 → S02

Produces:
- react-hotkeys-hook integration pattern (useHotkeys in FormPanel)
- Clear button in FormPanel header (RotateCcw icon, setPendingReplayValues path)
- Copy icon pattern on scalar/enum/bytes fields (group/group-hover, icon swap)

Consumes:
- nothing (first slice)

### S02 → S03

Produces:
- reload_proto Rust command (atomic pool rebuild)
- check_paths_exist Rust command
- Recent files list in useProtoStore (10 entries, persisted)
- Include path manager UI in FileSection

Consumes:
- Keyboard shortcut patterns from S01 (may add Cmd+R for reload)

### S03 → S04

Produces:
- Connection quick-switch dropdown in PublishBar
- useDraftStore with tauri-plugin-store persistence
- Draft save/restore pipeline via setPendingReplayValues

Consumes:
- reload_proto from S02 (draft restore may trigger reload)

### S04 → S05

Produces:
- Randomizer utility with per-type generators and depth cap
- Field tooltip wrapper component with proto metadata

Consumes:
- Draft persistence from S03 (randomized values should be saveable as draft)

### S05

Produces:
- SchemaExplorer component with collapsible tree
- Recursive type guard (depth cap + visited-set)

Consumes:
- Proto schema from useProtoStore (existing)
- Field metadata pattern from S04 tooltips
