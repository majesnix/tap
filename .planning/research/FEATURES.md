# Feature Landscape: v1.8 UX Polish + Proto Ergonomics

**Domain:** Developer tool UX ergonomics for a proto/RabbitMQ messaging desktop app (analogous to Postman for gRPC/protobuf dev tools)
**Researched:** 2026-05-25
**Confidence:** MEDIUM-HIGH (keyboard conventions and environment-switcher patterns: HIGH from official docs; randomizer UX for protobuf: LOW, no direct prior art)

---

## Context: What Already Exists (Do Not Re-Research)

All of the following are shipped in v1.7 and are dependency surfaces for v1.8:

| Existing capability | Relevant surface |
|---|---|
| Multi-file proto tabs — open multiple .proto files, switch between tabs | `useProtoStore`, `ProtoTabBar` |
| Proto auto-load — plans remember proto paths, silently re-open on plan select | `usePlanStore`, `ProtoTabBar.loadProtoFromPath` |
| Message history — FIFO-100, filter, full-text search, replay, resend | `useHistoryStore`, `MessageHistoryPanel`, `historyHelpers.ts` |
| Block library with DnD apply | `useBlockStore`, `BlockLibraryPanel`, `applyBlockRef` |
| JSON override toggle — CodeMirror editor with two-way sync | `FormPanel.isJsonMode`, `jsonOverridePending` |
| Connection profiles — OS keychain, Management API credentials | `useConnectionStore`, `ConnectionSidebar` |
| Live subscribe — auto-stops on connection/profile change | `useLiveSubscribeStore`, `LiveSubscribeTab` |
| tauri-plugin-store — persistence layer for all stores | All stores via `useConnectionStore`, etc. |
| ProtoFormRenderer switch — FROZEN (no new cases) | `ProtoFormRenderer.tsx` |
| `applyBlockRef` two-phase contract | `FormPanel`, `applyBlockRef.ts` |
| dnd-kit PointerSensor (WKWebView requires pointer events, not HTML5 DnD) | `AppLayout.tsx` |
| tauri::async_runtime::spawn pattern | All Rust commands |

---

## Section 1 — Keyboard Shortcuts

### Ecosystem Findings

**Postman:** `Cmd+Enter` = Send (macOS standard). `Cmd+P` / `Cmd+K` = quick request switcher. `Cmd+N` = new tab. `Cmd+S` = save. No native shortcut for open file or clear/reset.

**Insomnia:** `Cmd+Enter` or `Cmd+R` = Send. `Cmd+P` = quick switcher. `Shift+Cmd+E` = switch environment. `Cmd+N` = new request. No clear/reset shortcut.

**Kreya:** `Cmd+Shift+E` = open environments settings.

**Bruno:** Keyboard shortcut support added in v3.3+; customizable via Preferences → Keybindings. `Cmd+/` = comment-out in body editors.

**VSCode:** `Cmd+P` = quick open. `Ctrl+Tab` = cycle recent editors. `Cmd+Shift+P` = command palette.

**macOS WKWebView shortcut conflict risks (HIGH confidence — confirmed Tauri GitHub issues #8676, #9385):**
- `Cmd+R` — browser reload: **do not use as "Send"**. This is the single biggest pitfall. Insomnia uses it but Tap runs in WKWebView where Cmd+R triggers a native reload unless disabled via `tauri-plugin-prevent-default`.
- `Cmd+O` — browser open: reserved in WKWebView on some platforms; use `tauri-plugin-prevent-default` or override via Rust `MenuBuilder` to intercept cleanly.
- `Cmd+W` — close tab: intercepted by native OS on macOS (closes the window). Avoid for any in-app action.
- `Cmd+Enter` — safe: not a browser shortcut; used universally as "send" in API tools. Safe to implement via JavaScript `keydown` listener in the focused window.
- `Cmd+Shift+R` — safe for clear/reset (two-key combo avoids accidental trigger; not a browser default).
- `Cmd+1/2/3` — safe for tab navigation (not browser defaults).

**tauri-plugin-prevent-default** (confirmed, Tauri 2 compatible, crates.io `tauri-plugin-prevent-default` v4.0.3) is the correct mechanism to disable browser shortcuts like Cmd+R before registering in-app handlers.

### Table Stakes

| ID | Feature | Why Expected | Complexity | Notes |
|---|---|---|---|---|
| KB-01 | **Send: `Cmd+Enter`** | Universal in Postman, Insomnia, every API tool. Developers muscle-memory this shortcut immediately. Missing it = constant friction. | LOW | Safe in WKWebView. Implement via `keydown` listener in `PublishBar` or at `AppLayout` level. Guard: disabled when form is invalid or no connection active. |
| KB-02 | **Open proto file: `Cmd+O`** | Standard "open file" across all desktop apps. Developer expects to open without reaching for the mouse. | LOW-MEDIUM | `Cmd+O` may be intercepted in WKWebView on some platforms. Safest approach: register via Tauri `MenuBuilder` (File → Open Proto) which routes the OS menu item; also add JS `keydown` fallback. |
| KB-03 | **Visible shortcut hints** | Menus and tooltips show the shortcut key. Users discover shortcuts through the UI, not docs. Postman, Insomnia, and all desktop tools show shortcuts in menu items and button tooltips. | LOW | Show `⌘↩` in the Send button tooltip. Show `⌘O` in the Open file button. |

### Differentiators

| ID | Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|---|
| KB-04 | **Clear form: `Cmd+Shift+R`** | Saves a round-trip click sequence (clear → confirm). Especially useful in rapid test-send loops. | LOW | Shift modifier prevents accidental trigger. Safe in WKWebView. |
| KB-05 | **Tab navigation: `Cmd+1/2/3`** | Multi-proto-tab users switch tabs without mouse. Standard in browser-tab convention. | LOW | Map to tab indices. Guard: if fewer than N tabs are open, `Cmd+N` is a no-op (not an error). |
| KB-06 | **Customizable shortcuts** | Bruno added this in v3.3; it's becoming standard. Developers on non-US keyboards hit layout conflicts. | HIGH | Defer to v1.9. Store as `keyBindings` in tauri-plugin-store. Complex UX (settings pane, conflict detection). |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| **`Cmd+R` for Send** | WKWebView will reload the page unless you install `tauri-plugin-prevent-default`. Even with prevention, it violates macOS muscle memory. | Use `Cmd+Enter` (universal API tool convention). |
| **`Cmd+W` for any in-app action** | macOS closes the window. Non-overridable. | Do not assign. |
| **`Cmd+D` for clear** | macOS "Add to Dock" or browser bookmark. Too many platform conflicts. | Use `Cmd+Shift+R`. |
| **Global shortcuts (tauri-plugin-global-shortcut)** | System-wide shortcuts conflict with other apps. Registration silently fails if another app owns the combo. Requires accessibility permissions on corporate Macs. | Use window-scoped `keydown` listeners + Tauri menu items. In-app only. |

### Dependencies on Existing Features

- KB-01 (Send) touches `PublishBar` and must respect `formState.isValid` and connection state.
- KB-02 (Open) reuses the same Tauri `dialog:open` flow as the existing file picker in `ProtoTabBar`.
- KB-04 (Clear) calls the same `reset()` on `react-hook-form` that the existing clear button uses.
- KB-05 (Tab nav) manipulates `useProtoStore.activeTabId`.

---

## Section 2 — Form Reset / Field-Level Copy

### Ecosystem Findings

**Postman:** Has a "Reset" button per request that clears to blank. No field-level copy in form inputs — users copy by selecting text manually.

**Insomnia:** Auto-saves state; has a "Reset to Default" option on individual variables. No per-field copy button in request forms.

**grpcui:** "Clear" button on the entire form. No per-field copy controls — form fields are plain HTML inputs; browser copy (Cmd+C after text selection) is the expected pattern.

**Pattern:** API tools treat form reset as a top-level action (button in the header/toolbar), not inline in each field. Per-field copy is non-standard in form UIs; it exists in response viewers (copy the decoded value to clipboard) not in input forms. The exception is read-only values like correlation IDs where a copy-icon is conventional.

### Table Stakes

| ID | Feature | Why Expected | Complexity | Notes |
|---|---|---|---|---|
| RST-01 | **Clear form button** (visual, in toolbar or form header) | Users expect a visible "start over" action, not just a keyboard shortcut. Blind forms feel broken without it. | LOW | Already exists per v1.7 — confirm it is discoverable (tooltip, icon). The v1.8 work is KB-04 (shortcut). |
| RST-02 | **Copy field value to clipboard for scalar fields** | Developers paste field values into logs, tickets, other tools. Expected in any form with IDs, enum values, string fields. Hover-reveal copy icon (like GitHub's copy-to-clipboard pattern) is the standard. | LOW | Copy icon appears on hover next to the field value. `navigator.clipboard.writeText(value)`. For bytes fields: copy as base64 string. |

### Differentiators

| ID | Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|---|
| RST-03 | **Copy nested message subtree as JSON** | Power user action: copy a sub-message's entire value as JSON for pasting into another tool or block library entry. | MEDIUM | Show copy icon on message-type section headers (e.g., `Address {}`). Serialize the sub-message's current form values via `getValues(path)` to JSON string. |
| RST-04 | **Field-level reset to type default** | Right-click or secondary action to reset a single field to its proto default (`""`, `0`, `false`, empty list). | MEDIUM | Requires context menu per field — adds UX complexity. Defer unless user feedback requests it. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| **Confirm dialog on clear** | Interrupts rapid test-send loops. Dev tools should be fast; data is not precious. | Clear immediately. History panel already captures the last sent state. |
| **Copy button on every field by default (always visible)** | Visual clutter in a dense form. 20+ copy icons in view simultaneously is noise. | Hover-reveal only. |

### Dependencies on Existing Features

- RST-02 (copy bytes): the bytes field already has base64 + byte-count UI (Phase 06). Copy should output the current base64 string.
- RST-03 (copy subtree): `getValues(path)` uses `react-hook-form`; must strip RHF internal fields (`_selected`, map `{key,value}` arrays → convert to `Record<K,V>` for output).

---

## Section 3 — Randomizer

### Ecosystem Findings

**No direct proto/structured-message randomizer prior art exists in any of the surveyed tools.** This is a genuine gap:

- **grpcui:** No randomizer. Manual form fill only.
- **BloomRPC / Kreya:** No randomizer feature documented.
- **Postman / Insomnia:** Have `{{$randomXxx}}` dynamic variables (random string, UUID, integer) insertable into request bodies — but these are template variables, not form-fill automation. They require the user to manually place variables in the correct fields.
- **Faker.js / Mockaroo:** Web-based data generators — not integrated into any form UI.

**Closest prior art:** Browser form-fill extensions (e.g., "Fake Data" Chrome extension) that fill `<input>` fields by type attribute. These iterate form fields and assign plausible values by `input[type]` or `name` heuristic.

**Confidence: LOW** for UX convention. This is a differentiator with no established pattern. Must define convention from first principles.

**Recommended UX pattern (derived from Faker.js field-type mapping + proto type system):**
- Single "Randomize" button in the form toolbar (not per-field — avoids clutter).
- Fills **all unfilled (non-dirty) fields only** by default. A "Randomize All" mode (overwriting dirty fields) is a dangerous variant — defer or put behind Shift-click.
- Type mapping: `string` → random UUID or lorem word (configurable?), `int32/64` → random integer in 0–1000, `float/double` → random 0.0–100.0, `bool` → `true`, `bytes` → random 8-byte base64, `enum` → random valid enum value (must use schema), `repeated` → 1–3 items each randomized, `oneof` → pick one branch randomly and fill it, `map` → 1 key-value pair, WKT `Timestamp` → current time, `Duration` → "10s".
- **Does not randomize message-type fields recursively by default** — nested messages require schema traversal of arbitrary depth; keep to top-level only in v1.8, recurse opt-in.

### Table Stakes

| ID | Feature | Why Expected | Complexity | Notes |
|---|---|---|---|---|
| RND-01 | **"Randomize" toolbar button** | Core value: fill fields without thinking to enable quick test sends. One-click workflow. | MEDIUM | Proto type → random value mapping required. Must handle: scalar types, enum (needs descriptor access via existing `prost-reflect` `MessageDescriptor`), bytes, WKT Timestamp/Duration. |
| RND-02 | **Non-dirty fields only** | Respects user-entered values. Aligns with block-apply behavior (dirtyFields guard from Phase 12). Users who manually entered a specific value should not have it overwritten by randomize. | LOW | Use `formState.dirtyFields` as the guard — same pattern as `applyBlockRef`. |
| RND-03 | **Enum randomization uses schema** | Random enum values must be valid proto enum values, not arbitrary integers. | LOW-MEDIUM | `MessageDescriptor` → `FieldDescriptor` → `EnumDescriptor` → `EnumValueDescriptor[]`. Pick random index. Already available via `prost-reflect` (used in `ProtoFormRenderer`). |

### Differentiators

| ID | Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|---|
| RND-04 | **Randomize All (Shift+click)** | Power-user override to also fill dirty fields. Useful when re-testing from scratch. | LOW | Shift+click modifier or secondary button. Show tooltip "Randomize all fields including edited ones". |
| RND-05 | **Recursive nested message randomization** | Fill entire nested message trees for complex schemas. | HIGH | Requires recursive schema walk; oneof at nested level needs branch selection. Risk: could generate invalid combinations (e.g., mutually constraining oneofs). Defer to v1.9. |
| RND-06 | **Seed / reproducible random** | Same seed = same values = reproducible test case. Useful for sharing test scenarios. | HIGH | Requires seeded PRNG (e.g., `seedrandom`). Defer. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| **Per-field randomize buttons** | A proto message with 20 fields would have 20 dice icons. Visual clutter. | Single toolbar button (RND-01). |
| **Silent overwrite of dirty fields by default** | Destroys user work. Same mistake as block apply Pitfall D (`shouldDirty: false` invariant). | Non-dirty only by default (RND-02). |
| **Random bytes as raw array** | prost-reflect encodes bytes from base64. Random bytes must be a valid base64 string. | Generate random bytes → base64-encode → write as base64 string. |
| **Randomizing oneof without selecting a branch** | Leaving `_selected = ""` while filling branch fields is an invalid form state. | Always set `_selected` to a random valid branch name first, then fill that branch's fields. |

### Dependencies on Existing Features

- RND-01/03 (enum randomization): depends on `MessageDescriptor` already loaded in `useProtoStore`. Rust IPC may be needed to expose enum values if not already returned in the parsed schema response.
- RND-02 (dirty guard): uses `formState.dirtyFields` — same pattern as `applyBlockRef`.
- Must not interact with JSON override mode (`isJsonMode === true` → disable Randomize button, same as block apply guard).
- Oneof branch selection (`_selected`) must be set before filling branch fields — same constraint as BLK-CT-06 (oneof branch switch, Phase 26).

---

## Section 4 — Proto File Reload

### Ecosystem Findings

**BloomRPC:** Had a known issue (GitHub issue #119) where users could not reload modified proto files without re-picking. The archived codebase never resolved this cleanly — it was a common complaint. No dedicated reload shortcut existed.

**Kreya:** Watches OpenAPI specs, GraphQL schemas, and protobufs with auto-import on file change. This is the gold standard: filesystem watcher + automatic reload with no user action.

**Insomnia/Postman:** No proto file concept (REST/HTTP only). Not applicable.

**Pattern for native desktop tools:** "Reload" or "Refresh" button tied to the currently active file, plus auto-reload on file system change if a watcher is active.

**Tauri note:** `tauri-plugin-fs` `watch()` API is available in Tauri 2 for filesystem watching. This would enable Kreya-style auto-reload.

### Table Stakes

| ID | Feature | Why Expected | Complexity | Notes |
|---|---|---|---|---|
| REL-01 | **Reload current proto button** (in tab/toolbar) | Developer edits the `.proto` file in their editor, switches back to Tap, clicks Reload. Picking the file again via the OS dialog is friction. This is the #1 BloomRPC complaint. | LOW-MEDIUM | Re-run the existing proto parse pipeline (`load_proto_file` Rust command) using the saved file path for the active tab. Show parse errors inline if the schema changed. |
| REL-02 | **Preserve form state after reload if schema is compatible** | If the reloaded schema has the same fields as before, the user's entered values should survive. Clearing the form on every reload is frustrating. | MEDIUM | Compare old vs new `MessageDescriptor` fields. If field names and types match, call `reset(currentValues)`. If schema changed (fields added/removed), clear only changed fields. |

### Differentiators

| ID | Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|---|
| REL-03 | **Auto-reload on file change** | Zero friction: Tap detects the `.proto` file changed on disk and reloads automatically. Kreya does this. | HIGH | Requires `tauri-plugin-fs` `watch()` per open file path. Debounce (500ms) to avoid partial-write reloads during saves. Show a toast "Schema reloaded" with undo option (restore previous descriptor). Possible edge case: saves that temporarily make the proto invalid mid-edit. |
| REL-04 | **Keyboard shortcut for reload (`Cmd+Shift+L`)** | Power user: cursor never leaves keyboard in a tight edit-reload-send loop. | LOW | Once REL-01 exists, the shortcut is trivial. `L` for "load" or "reload" — not a browser reserved key. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| **Clear entire form on reload by default** | Destroys manually entered test data on every proto change, even when the schema is compatible. | Schema-diff approach (REL-02): clear only changed fields. |
| **Auto-reload without debounce** | File editors write in multiple operations; reloading mid-write produces parse errors. | 500ms debounce minimum (REL-03). |
| **Reload all tabs when one file changes** | A tab watching `payment.proto` should not trigger reload for a tab on `order.proto` even if they share imports. | Per-tab reload only, scoped to the file path that changed. |

### Dependencies on Existing Features

- REL-01 reuses `load_proto_file` Rust command and `useProtoStore.loadProto()`.
- REL-02 requires access to both old and new `MessageDescriptor` — store the previous descriptor in `useProtoStore` per tab.
- REL-03 would use `tauri-plugin-fs` `watch()` which requires `fs:allow-watch` capability (new capability entry).
- Plan auto-load (Phase 23 bonus) already calls `loadProtoFromPath` — REL-01 is the same operation; reuse the same function.

---

## Section 5 — Recent Files Navigation

### Ecosystem Findings

**VSCode:** `Cmd+P` (Quick Open) shows recently opened files first, filterable by name. `File > Open Recent` submenu. `Ctrl+Tab` cycles recent editors. This is the benchmark pattern.

**Postman:** No "recent files" concept (collections are persisted, not files).

**Bruno:** Restores last workspace and open tabs on reopen. No separate "recent files" panel.

**Insomnia:** `Cmd+P` quick switcher shows recently used requests.

**TablePlus:** Connection history in the connection picker — recently used connections appear at the top.

**Pattern consensus:** Recent files appear in one of three places:
1. **Dropdown/popup at the proto tab area** (closest to context) — most relevant for Tap.
2. **File menu submenu** — conventional macOS native menu (`File > Open Recent`).
3. **Command palette** (VSCode Cmd+P style) — most powerful but high implementation cost.

For Tap: a **dropdown list in the proto tab bar** (right of the "+" new tab button) is the right pattern. Shows the last 10 recently opened file paths, sorted most-recent-first. Persisted via `tauri-plugin-store`.

### Table Stakes

| ID | Feature | Why Expected | Complexity | Notes |
|---|---|---|---|---|
| RFC-01 | **Recent files list persisted across restarts** | Developers work with the same 3–5 proto files daily. Re-picking via OS dialog every session is friction. All comparable tools persist session state. | LOW | Store ordered list (max 10) of `{ path, label }` objects in `tauri-plugin-store` key `recentProtos`. Update on every successful `load_proto_file`. |
| RFC-02 | **Recent files accessible from the proto tab area** | Contextually correct placement — developer is already looking at the tab bar when switching protos. | LOW | Dropdown button ("↓ Recent") right of the "+" tab button. Renders a popover list. Click an entry → call existing `loadProtoFromPath`. |
| RFC-03 | **Remove stale paths** | If a file no longer exists at the saved path, the entry should show as unavailable (greyed out, not clickable) or auto-removed on click attempt. | LOW | On click, check file existence via `tauri-plugin-fs` `exists()` before loading. Show error toast if not found; remove from list. |

### Differentiators

| ID | Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|---|
| RFC-04 | **`File > Open Recent` native macOS menu submenu** | Standard macOS UX. Users expect recent files in the File menu, not just in the app. | MEDIUM | Add submenu to Tauri `MenuBuilder`. Each item calls `loadProtoFromPath`. Requires menu rebuilding when the list changes — listen for store updates. |
| RFC-05 | **Pin recent files** | Developer always uses `payment.proto` — pins it to top of the list. | HIGH | Adds "pinned" state to each recent entry. Separate pinned vs recent sections in the dropdown. Defer. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| **Sidebar section for recent files** | The sidebar is connection-focused. Mixing recent file navigation into the connection sidebar creates two unrelated concerns in one panel. | Dropdown in the proto tab bar area (RFC-02). |
| **Full command palette (Cmd+P)** | High implementation cost, no other command palette in Tap. Over-engineered for a list of 10 files. | Simple dropdown popover (RFC-02) + optional native menu (RFC-04). |
| **More than 10 recent entries** | Long lists require scroll management and become search problems. | Cap at 10. |

### Dependencies on Existing Features

- RFC-01/02 use `loadProtoFromPath` from Phase 23 proto auto-load.
- RFC-02 dropdown lives in the proto tab bar — same component as `ProtoTabBar`.
- `tauri-plugin-fs` `exists()` requires `fs:allow-exists` capability (check if already granted).

---

## Section 6 — Proto Import Manager

### Ecosystem Findings

**Bruno:** Collection Settings → Protobuf tab → Import Paths section with an "Add Import Path" UI (confirmed from official docs). Auto-adds the proto file's directory on load. This is the best-in-class reference implementation.

**BloomRPC:** Import paths were a persistent pain point — issues #11, #102, #316 all report failed imports. The tool had an import path field but it was poorly documented and confusing. UX identified as a problem in issue #165 ("path configuration UX").

**Postman gRPC:** Has an import path UI but it is per-collection, not per-file. Reported as confusing (GitHub issue #10547).

**grpcui:** CLI flags for import paths (`-import-path`). No GUI manager — developer must restart the tool with different flags.

**Pattern:** The GUI import path manager is the clear gap that all CLI tools (grpcui) leave behind. Bruno's per-collection approach is the right model for Tap (per-file is impractical; per-workspace/global list is the correct scope for a single-user tool).

### Table Stakes

| ID | Feature | Why Expected | Complexity | Notes |
|---|---|---|---|---|
| IMP-01 | **View current include paths for the loaded file** | Developers need to understand why an import is failing. "What paths am I currently searching?" is the first debugging question. | LOW | Read-only list of current include paths from `useProtoStore`. Already stored per-proto-tab (saved include paths from Phase 23). |
| IMP-02 | **Add/remove include paths via UI** | Adding a path via OS dialog, removing a path by clicking an X. Bruno-style. | LOW-MEDIUM | Uses existing `tauri-plugin-dialog` file picker (directory mode). Updates `useProtoStore` include paths and triggers a reload. |
| IMP-03 | **Persist include paths across restarts** | Developers should not re-enter paths every session. | LOW | Already persisted per-proto-tab since Phase 23 proto auto-load. Verify the include paths are included in the persisted tab state. |

### Differentiators

| ID | Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|---|
| IMP-04 | **Show import dependency tree** | For a proto with complex imports, show which files it imports and which include paths resolve each import. Debugging aid when an import fails. | HIGH | Requires traversing the `FileDescriptorSet` to enumerate file-level dependencies. The information exists in `prost_types::FileDescriptorProto.dependency[]`. | 
| IMP-05 | **Auto-detect include paths from failed imports** | When a proto fails to load due to an unresolved import, suggest probable include paths based on the import name and nearby filesystem paths. | HIGH | Complex heuristic. Defer. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| **Global include paths (shared across all tabs)** | Proto A's include paths interfere with proto B's resolution. Each proto may need different include roots. | Per-tab include paths (already the current model from Phase 23). |
| **Requiring app restart after changing include paths** | grpcui's pattern — unacceptable for a GUI tool. | Changing include paths triggers an immediate reload of the current proto. |

### Dependencies on Existing Features

- IMP-01/02 are read/write on `useProtoStore` include paths already stored per tab since Phase 23.
- IMP-02 uses `tauri-plugin-dialog` (directory picker — `open({ directory: true })`).
- After adding/removing include paths, call `REL-01` (proto reload) automatically.

---

## Section 7 — Schema Explorer

### Ecosystem Findings

**grpcui:** Two listboxes (service selector, method selector) at the top. Below: a generated HTML form. Fields show name + type, nested messages shown as nested tables, oneof as radio-button-grouped sub-tables, repeated as +/- button arrays. **No separate tree panel** — the form IS the schema explorer. Timestamp shows a date picker. UX is functional but form-centric, not schema-centric.

**BloomRPC:** Left sidebar shows a tree of proto services → methods. Clicking a method opens the request form. A schema panel is not exposed — the service/method tree is the navigation; field details are implicit in the form.

**Kreya:** Project/operation tree in a left panel. Methods listed under services. Schema details are visible in the form but no dedicated schema explorer panel exists.

**VSCode / IntelliJ proto plugins:** Show a tree of messages → fields with type annotations in the outline view. Field-level hover tooltips showing full type name, cardinality (optional/required/repeated), and comment from the .proto file.

**Pattern consensus:** No API tool has a true dedicated schema explorer panel separate from the form. The form IS the schema view. Dedicated schema panels exist in database tools (TablePlus left panel) and IDE language plugins (VSCode outline). For a developer tool at Tap's scope, the right balance is:
- **Collapsible tree panel** showing parsed message hierarchy (messages, enums, nested messages) — read-only, no form interaction.
- **Hover tooltips on form fields** showing proto field number, wire type, cardinality — inline with the existing form.

The tree panel is a **power-user feature** (schema-browsing before choosing a message type to send). The inline tooltips are **table stakes** (field type understanding while filling the form).

### Table Stakes

| ID | Feature | Why Expected | Complexity | Notes |
|---|---|---|---|---|
| SCH-01 | **Inline field-type tooltip on hover** | Developers ask "what is this field's proto type and field number?" when filling forms. Expected in any tool that surfaces a schema (database tools, IDEs). | LOW | Show a tooltip on each form field label showing: proto type name, field number, cardinality (`optional` / `repeated` / `required`), proto comment if present in descriptor. `FieldDescriptor.number()`, `.kind()`, `.cardinality()` available from `prost-reflect`. |
| SCH-02 | **Enum value list visible in form** | When a field is an enum, the developer needs to know all valid values. Currently shadcn Select shows the values — confirm this is already in place and visible. | LOW | Verify: `EnumField` already shows enum values in a `<Select>` dropdown. If values are truncated or unclear, add tooltip with full enum names + numbers. |

### Differentiators

| ID | Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|---|
| SCH-03 | **Collapsible schema tree panel** | A read-only panel (collapsible sidebar or modal) showing the full message hierarchy: top-level message → nested messages → fields with type labels → enums with values. Useful for orientation before filling the form, especially with large schemas. | MEDIUM-HIGH | Parse the `FileDescriptorSet` on the frontend (already available in `useProtoStore`) and render a tree. Use shadcn/ui `Collapsible` or a simple indented list. Read-only — no form interaction (clicking a field does NOT jump to the form field; that interaction is complex and deferred). |
| SCH-04 | **Search/filter within schema tree** | For schemas with 20+ messages and 50+ fields, a filter input narrows the tree to matching names. | MEDIUM | Client-side substring filter on the flat list of descriptor names. Depends on SCH-03. |
| SCH-05 | **Jump-to-field from schema tree** | Click a field in the tree panel → scroll the form to that field. | HIGH | Requires DOM refs or React scroll APIs tied to field names. Complex interaction. Defer to v1.9. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| **Editable schema panel (click to modify proto definition)** | Tap is a send tool, not a proto editor. In-app proto editing is out of scope. | Read-only display only. Developer edits in their code editor and reloads (REL-01). |
| **Schema tree replacing the form as the primary UI** | Form-first is what developers need for sending. The tree is supplementary. | Collapsible panel or modal, not a primary view. |
| **Always-visible full-height schema panel** | Wastes screen space for users who know their schema well. | Collapsible; closed by default or hidden behind a toggle button. |

### Dependencies on Existing Features

- SCH-01 tooltips use `FieldDescriptor` from `prost-reflect` — must be accessible from React via IPC or the existing parsed schema in `useProtoStore`.
- SCH-03 tree panel parses `FileDescriptorSet` from `useProtoStore` — same data already available for form generation.
- Proto auto-load (Phase 23) means the descriptor is available without user action when a plan is selected.

---

## Section 8 — Connection Quick-Switch

### Ecosystem Findings

**Postman:** Environment selector in the **top-right corner** of the workbench toolbar — a dropdown showing "No Environment" or the active environment name. One click → dropdown list of all environments. Click one → active immediately. The quickest connection-switch pattern in any API tool.

**Insomnia:** `Shift+Cmd+E` keyboard shortcut opens an environment switcher dialog. Also a dropdown in the top toolbar. Same position as Postman.

**Bruno:** Dropdown in the **top-right of the toolbar** per collection. One click → list of environments. Users report it as "somewhat awkward" that it's only in that one location — but the top-right position is universally understood.

**TablePlus:** `Cmd+Shift+K` opens connection list. A dedicated "Connections" button on the top-left panel. Switch = new workspace tab. Different model (full reconnect).

**Kreya:** Project-level environments; keyboard shortcut `Cmd+Shift+E`. Settings tab rather than inline dropdown.

**Pattern consensus:** **Dropdown in the top toolbar** (top-right or top-left near the connection label) is the universal convention. It shows the current connection name, clicking opens a list, selecting one switches immediately. This is faster than opening the full sidebar.

**Critical existing behavior:** Live subscribe auto-stops on connection/profile change (shipped in v1.4). The connection quick-switch must trigger this same stop signal.

### Table Stakes

| ID | Feature | Why Expected | Complexity | Notes |
|---|---|---|---|---|
| CQS-01 | **Connection name displayed compactly in toolbar** | Developers need to know which connection is active at a glance. All API tools show this. | LOW | A compact label/button in the header area showing the active connection profile name (e.g., "dev-rabbit"). Clicking opens the quick-switch dropdown. |
| CQS-02 | **Quick-switch dropdown lists all saved profiles** | Click the connection name → dropdown shows all profiles → click one → switch. No sidebar opening required. | LOW-MEDIUM | Uses data from `useConnectionStore.profiles`. Connects via existing `connect_to_rabbitmq` Rust command. |
| CQS-03 | **Live subscribe stops on switch** | Already shipped behavior (v1.4). Quick-switch must trigger the same stop signal as the sidebar switch. | LOW | Reuse the same `useLiveSubscribeStore.stop()` call that fires on connection change. |

### Differentiators

| ID | Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|---|
| CQS-04 | **Keyboard shortcut for quick-switch (`Cmd+Shift+K`)** | TablePlus convention. Fast for keyboard-centric developers. | LOW | Once CQS-01/02 exist, the shortcut focuses/opens the dropdown. `Cmd+Shift+K` safe in WKWebView (not a browser default). |
| CQS-05 | **Connection status indicator** (green/red dot in the compact label) | Shows connected vs disconnected state inline with the profile name. Developer sees at a glance if the active connection is healthy. | LOW-MEDIUM | Reuse existing connection state from `useConnectionStore.status`. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| **Replacing the full connection sidebar with the quick-switch** | Sidebar has profile management (add, edit, delete). Quick-switch is navigation-only. | Quick-switch for navigation; sidebar opens from quick-switch "Manage..." footer option. |
| **Auto-connect on switch** | If the new connection fails (wrong password, server down), auto-connect leaves the user in an error state without clarity. | Show a "Connect" button in the dropdown; connect explicitly. Or: attempt connect with a loading state + error toast. Match the existing sidebar behavior. |

### Dependencies on Existing Features

- CQS-02 uses `useConnectionStore.profiles` and `connect_to_rabbitmq` Rust command.
- CQS-03 requires `useLiveSubscribeStore.stop()` — same signal as existing sidebar profile change.
- CQS-05 status dot uses `useConnectionStore.status` (already tracked).

---

## Section 9 — Message Draft Persistence

### Ecosystem Findings

**Insomnia:** Auto-saves all request state immediately on change. No explicit "draft" concept — everything is always saved. Users have complained this prevents experimentation without permanent changes.

**Postman:** Configurable auto-save (Settings → General → Autosave). When disabled, shows unsaved-changes dot on the tab. Default: auto-save on. Users frequently request per-request "don't save this experiment" mode.

**Bruno:** File-based (each request is a `.bru` file on disk). Changes written immediately to disk. No explicit draft layer — working copy IS the saved copy.

**Pattern consensus:** Auto-save without user friction is the dominant pattern. Separate "draft" vs "saved" is an anti-pattern in dev tools (it's a form-filling tool, not a document editor). The right model for Tap: **silent auto-save of form state per message type**, surfaced as "restore last state" on load — no "save draft" button required.

**Persistence scope debate:** The advisor flagged a key decision: does draft persist per message type globally, or per proto-tab? Given multi-file proto tabs, the right key is `{ protoFilePath, messageTypeName }` — unique per file + type combination.

**Interaction with JSON override mode:** When JSON mode is active, the draft should persist the JSON string, not the form field values. On restore, if JSON mode was active, restore into JSON mode.

**Auto-save timing:** The standard pattern from UI-patterns.com and multiple frameworks: save on blur or 2–3 seconds after last keystroke (debounced). Not on every keystroke.

### Table Stakes

| ID | Feature | Why Expected | Complexity | Notes |
|---|---|---|---|---|
| DFT-01 | **Auto-save form state on field change (debounced)** | Developers lose work when they accidentally clear a form or switch message types. Every API tool that deals with request bodies auto-saves. | MEDIUM | Watch `react-hook-form` `watch()` (subscribe to all field changes). 1.5s debounce. Serialize `getValues()` to JSON. Store in `tauri-plugin-store` keyed by `draft:${filePath}:${messageTypeName}`. |
| DFT-02 | **Restore draft on message type selection** | When the developer selects a message type (or returns to one), the form restores the last values they entered for that type. | MEDIUM | On message type change in `useProtoStore`, check for a stored draft for that `(filePath, messageTypeName)` key. If found, call `reset(draftValues)` after the form mounts. Guard: only restore if the schema is still compatible (same field names — simple key intersection check). |
| DFT-03 | **Draft survives app restart** | Forms are filled with real test data that takes effort to construct. Losing it on quit is frustrating. | LOW | `tauri-plugin-store` already persists across restarts for all other stores. Draft uses the same mechanism. |

### Differentiators

| ID | Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|---|
| DFT-04 | **"Clear draft" action** | Deliberately discard the saved draft for the current type and start fresh. | LOW | A "×" or "Clear" button in the form toolbar next to Randomize and Clear form. Removes the `draft:*` key from store. |
| DFT-05 | **Draft indicator** | Show a subtle visual cue when a draft is loaded (e.g., "Draft restored" toast or a small badge on the form header). | LOW | Sonner toast on restore, auto-dismiss after 2s: "Draft restored for PaymentRequest". |
| DFT-06 | **JSON mode draft** | When JSON override mode is active, persist the JSON string and restore into JSON mode. | MEDIUM | Store `{ mode: 'json', jsonString: '...' }` or `{ mode: 'form', values: {...} }`. On restore: if mode is json, activate JSON mode and set the CodeMirror value. Touches `isJsonMode` state in `FormPanel`. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|---|---|---|
| **"Save Draft" button (explicit save)** | Adds cognitive overhead. Postman's explicit save is the thing users complain about most. | Silent auto-save (DFT-01). |
| **Draft scoped globally (not per message type)** | Switching between `PaymentRequest` and `OrderRequest` types should maintain independent drafts. One global draft would be overwritten constantly. | Key by `(filePath, messageTypeName)` (DFT-01). |
| **Draft persisting RHF internal fields** | `_selected`, `__proto__`, map row internal fields must be stripped before serialization — same issue as history serialization. | Use `getValues()` which returns the user-visible form state; strip known internal keys before serializing. |
| **Restoring draft for a changed schema (incompatible fields)** | If the `.proto` file changed since the draft was saved, unknown fields in the draft could cause form errors. | Key-intersection compatibility check (DFT-02): only restore fields that exist in both the draft and the current schema. Silently drop unknown fields. |
| **Unbounded draft storage** | 100 message types × 50 fields × 10 proto files = potentially large store. | Cap total draft keys at 50. LRU eviction (remove least-recently-accessed draft when limit exceeded). |

### Dependencies on Existing Features

- DFT-01 uses `react-hook-form` `watch()` — already used in various form components. Use `useWatch` at the `FormPanel` level.
- DFT-02 triggers on message type change — same event as the existing form `reset()` on type select in `useProtoStore`.
- DFT-06 intersects with `isJsonMode` state in `FormPanel` — must be accessible when saving/restoring draft.
- JSON mode state is local React state (per decision log) — DFT-06 would need it surfaced to the draft persistence layer (e.g., a `draftStore` observer in `FormPanel`).
- Live subscribe auto-stop signal (CQS-03) must NOT trigger draft save — draft saves form state, not connection state.

---

## Feature Dependencies

```
KB-02 (Open proto shortcut)
    └──reuses──> Existing file picker (tauri-plugin-dialog)

KB-04 (Clear shortcut)
    └──calls──> Existing form reset() in react-hook-form

RFC-02 (Recent files dropdown)
    └──reuses──> loadProtoFromPath (Phase 23 proto auto-load)

IMP-02 (Add include paths)
    └──triggers──> REL-01 (Proto reload)
        └──reuses──> load_proto_file Rust command

DFT-01 (Auto-save draft)
    └──reads──> formState (react-hook-form watch())
    └──conflicts with──> DFT-03 (incompatible schema restore)

RND-01 (Randomizer)
    └──reads──> MessageDescriptor (useProtoStore)
    └──uses──> dirtyFields guard (same as applyBlockRef)
    └──blocked by──> isJsonMode (must disable in JSON mode)

SCH-03 (Schema tree)
    └──reads──> FileDescriptorSet (useProtoStore)

CQS-02 (Quick-switch dropdown)
    └──triggers──> useLiveSubscribeStore.stop() (v1.4 live subscribe)

REL-02 (Preserve form on reload)
    └──reads──> Old MessageDescriptor (must be stored in useProtoStore)
```

### Key Dependency Notes

- **REL-01 is a prerequisite for IMP-02** — changing include paths should always trigger a reload, so the reload mechanism must exist first.
- **DFT-02 requires a schema compatibility check** — restoring a draft without checking field compatibility can cause form errors when the proto has changed since the draft was saved.
- **RND-01 and applyBlockRef share the same dirtyFields guard** — implement as a shared utility to avoid duplication.
- **CQS-02 and live subscribe**: the connection switch must trigger the same stop path that the sidebar already triggers — do not duplicate the stop logic.
- **SCH-01 (field type tooltips) is independent** of SCH-03 (tree panel) — tooltips can ship in an earlier phase without the full tree panel.

---

## Prioritization Matrix

All items below are committed v1.8 scope unless explicitly marked "Defer to v1.9+".
P1 = ship in an early phase, P2 = ship in a mid phase, P3 = ship in a late phase (all within v1.8).

| Feature | User Value | Implementation Cost | Phase in v1.8 |
|---|---|---|---|
| KB-01 (`Cmd+Enter` Send) | HIGH | LOW | P1 |
| KB-02 (`Cmd+O` Open) | HIGH | LOW | P1 |
| KB-03 (Visible shortcut hints) | MEDIUM | LOW | P1 |
| RST-01 (Clear form button — confirm discoverable) | HIGH | LOW | P1 |
| RST-02 (Copy field value) | MEDIUM | LOW | P1 |
| REL-01 (Proto reload button) | HIGH | LOW | P1 |
| RFC-01/02 (Recent files) | HIGH | LOW | P1 |
| IMP-01/02 (Import path manager) | HIGH | LOW-MEDIUM | P1 |
| SCH-01 (Field type tooltips) | MEDIUM | LOW | P1 |
| CQS-01/02 (Connection quick-switch) | HIGH | LOW-MEDIUM | P1 |
| DFT-01/02/03 (Draft persistence core) | HIGH | MEDIUM | P2 |
| KB-04 (`Cmd+Shift+R` Clear shortcut) | MEDIUM | LOW | P2 |
| KB-05 (`Cmd+1/2/3` Tab nav shortcut) | MEDIUM | LOW | P2 |
| RND-01/02/03 (Randomizer basic) | HIGH | MEDIUM | P2 |
| REL-02 (Preserve form state on reload) | MEDIUM | MEDIUM | P2 |
| SCH-02 (Enum values in form — verify) | MEDIUM | LOW | P2 |
| CQS-04/05 (Shortcut + status dot) | LOW | LOW | P2 |
| DFT-04/05/06 (Draft extras: clear, indicator, JSON mode) | MEDIUM | LOW-MEDIUM | P2 |
| RFC-03 (Stale path handling) | MEDIUM | LOW | P2 |
| SCH-03 (Schema tree panel) | MEDIUM | MEDIUM-HIGH | P3 |
| SCH-04 (Schema tree filter) | LOW | MEDIUM | P3 |
| RST-03 (Copy subtree as JSON) | MEDIUM | MEDIUM | P3 |
| REL-04 (Reload keyboard shortcut) | LOW | LOW | P3 |

**Priority key (all within v1.8):**
- P1: Ship in early phases — no dependencies on other v1.8 work; high value, low cost; foundation for later phases
- P2: Ship in mid phases — may depend on P1 items; moderate complexity
- P3: Ship in late phases — depends on P1+P2; higher complexity or lower urgency within v1.8

### Deferred to v1.9+

These items are out of scope for v1.8. Documented here so they are not re-proposed mid-milestone.

| Feature | Reason for Deferral |
|---|---|
| REL-03 (Auto-reload on file change) | Requires `tauri-plugin-fs` `watch()` + debounce + undo — high complexity, not committed in PROJECT.md v1.8 target |
| KB-06 (Customizable shortcuts) | Full settings pane, conflict detection — high implementation cost, low urgency |
| RND-05 (Recursive nested randomization) | Arbitrary schema depth + invalid combination risk — defer |
| RND-06 (Seeded PRNG) | Requires `seedrandom` library, settings UI — defer |
| IMP-04 (Import dependency tree) | FileDescriptorSet traversal — useful but not core ergonomics |
| IMP-05 (Auto-detect include paths) | Complex heuristic — defer |
| RFC-05 (Pin recent files) | Pinned + unpinned sections — high UX complexity |
| RST-04 (Field-level reset to default) | Context menu per field — UX complexity without clear demand |
| SCH-05 (Jump-to-field from schema tree) | DOM ref wiring to form fields — complex interaction |

---

## Phase Ordering Recommendation

**Phase A — Keyboard shortcuts + form copy (low-risk, independent, immediate user value)**
- KB-01, KB-02, KB-03 (Send/Open/hints)
- KB-04, KB-05 (Clear/Tab shortcuts)
- RST-02 (copy field value hover-reveal)
- Install `tauri-plugin-prevent-default` as part of KB-02 (Cmd+O safe intercept)
- Rationale: purely additive UI changes; no store or IPC changes; can be validated in isolation; removes the most friction on day 1

**Phase B — Proto file management (reload + recent files + import manager)**
- REL-01, REL-02 (reload button + state preservation)
- RFC-01/02/03 (recent files dropdown + stale path handling)
- IMP-01/02/03 (import path manager UI)
- Rationale: REL-01 is a prerequisite for IMP-02 (changing include paths triggers reload); all three form a cohesive "proto file ergonomics" surface; touches `useProtoStore` and `ProtoTabBar` in one focused pass

**Phase C — Connection quick-switch + draft persistence (stateful, cross-feature)**
- CQS-01/02/03/04/05 (connection quick-switch dropdown + status dot + shortcut)
- DFT-01/02/03/04/05 (draft auto-save core + extras)
- DFT-06 (JSON mode draft — if DFT-01–05 ship clean)
- Rationale: CQS touches `useConnectionStore` and the live subscribe stop signal — must be validated before draft persistence ships, because connection-switch must NOT trigger a draft save. Grouping them ensures the interaction is tested together.

**Phase D — Randomizer + schema tooltips (form-layer features)**
- RND-01/02/03 (randomizer basic — non-dirty fill, enum-aware)
- SCH-01, SCH-02 (field type tooltips + enum value verification)
- REL-04 (reload keyboard shortcut — trivial add-on once REL-01 exists)
- Rationale: randomizer and tooltips both read from `MessageDescriptor`/`useProtoStore` — same data surface; no store mutations; isolated risk

**Phase E — Schema tree panel (highest complexity, latest)**
- SCH-03 (collapsible schema tree panel)
- SCH-04 (schema tree filter — if SCH-03 ships clean)
- RST-03 (copy subtree as JSON — if time allows)
- Rationale: SCH-03 is the highest complexity committed feature; ship last so earlier phases are not blocked if the tree panel scope creeps; it reads `FileDescriptorSet` from `useProtoStore` which is stable after Phase B

---

## Competitor Feature Analysis

| Feature | Postman/Insomnia | grpcui / BloomRPC / Kreya | Bruno | Tap v1.8 Plan |
|---|---|---|---|---|
| Send shortcut | `Cmd+Enter` (universal) | None (browser-based or no KB) | `Cmd+Enter` | `Cmd+Enter` |
| Recent files | No (collection-based) | No (file-based, no history) | Restores last workspace | Dropdown in tab bar (RFC-02) |
| Schema explorer | No (REST-only or listboxes) | Listbox (grpcui) / sidebar tree (BloomRPC) | No proto explorer | Inline tooltips (SCH-01) + collapsible tree (SCH-03) |
| Import path manager | Poor UX (Postman, BloomRPC) | CLI flags only (grpcui) | Collection settings UI | Per-tab manager (IMP-02) |
| Draft persistence | Auto-save (Insomnia) / configurable (Postman) | None | File-based, always saved | Auto-save per `(filePath, messageType)` (DFT-01) |
| Connection switcher | Top-right dropdown (Postman/Insomnia) | N/A | Top-right dropdown | Top-bar compact dropdown (CQS-01) |
| Proto reload | N/A | Manual re-pick (BloomRPC) / auto-watch (Kreya) | Not applicable | Button (REL-01); auto-watch deferred to v1.9 |
| Randomizer | Template variables only | None | None | Single-button fill non-dirty fields (RND-01) |
| Field copy button | None (text selection only) | None | None | Hover-reveal copy icon (RST-02) |

---

## Sources

- Insomnia keyboard shortcuts (official Kong docs): https://developer.konghq.com/insomnia/keyboard-shortcuts/ — HIGH confidence
- Postman keyboard shortcuts (official Postman blog + docs): https://blog.postman.com/boost-your-productivity-in-postman-with-these-4-keyboard-shortcuts/ — HIGH confidence
- Bruno keyboard shortcuts (GitHub discussion #1079, issue #6855): https://github.com/usebruno/bruno/discussions/1079 — HIGH confidence
- Bruno gRPC proto import path management (official Bruno docs): https://docs.usebruno.com/send-requests/grpc/grpc-proto — HIGH confidence
- grpcui schema display UX (GitHub fullstorydev/grpcui README): https://github.com/fullstorydev/grpcui — HIGH confidence
- BloomRPC proto reload issue (GitHub issue #119): https://github.com/uw-labs/bloomrpc/issues/119 — HIGH confidence (archived repo, documented issue)
- Kreya features vs BloomRPC (Kreya official comparison): https://kreya.app/comparisons/bloomrpc/ — MEDIUM confidence
- Kreya 1.16 release notes: https://kreya.app/blog/kreya-1.16-whats-new/ — HIGH confidence
- Tauri WKWebView keyboard shortcut conflicts (GitHub issues #8676, #9385): https://github.com/tauri-apps/tauri/issues/8676 — HIGH confidence
- tauri-plugin-prevent-default (crates.io, v4.0.3): https://crates.io/crates/tauri-plugin-prevent-default — HIGH confidence
- Tauri v2 global shortcut pitfalls (DEV Community): https://dev.to/hiyoyok/global-keyboard-shortcuts-in-tauri-v2-the-right-way-and-the-wrong-way-2h6d — MEDIUM confidence
- Postman environment switcher UX (Postman official docs): https://learning.postman.com/docs/sending-requests/variables/managing-environments — HIGH confidence
- Bruno environment switcher position (Bruno docs + discussion #828): https://github.com/usebruno/bruno/discussions/828 — HIGH confidence
- TablePlus connection switcher (Cmd+Shift+K, official docs): https://docs.tableplus.com/gui-tools/the-interface/toolbar — HIGH confidence
- VSCode recent files navigation (Cmd+P, official tips): https://code.visualstudio.com/docs/getstarted/tips-and-tricks — HIGH confidence
- Auto-save UX patterns (ui-patterns.com): https://ui-patterns.com/patterns/autosave — MEDIUM confidence
- Insomnia auto-save complaints (GitHub issue #1003, #4663): https://github.com/Kong/insomnia/issues/1003 — HIGH confidence (primary source)
- Randomizer: no direct prior art found in proto/messaging tools — LOW confidence for UX convention; derived from first principles and Faker.js field-type mapping patterns.

---

*Feature research for: Tap v1.8 UX Polish + Proto Ergonomics*
*Researched: 2026-05-25*
