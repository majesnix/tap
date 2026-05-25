# Technology Stack — v1.8 Additions

**Project:** Tap (proto-sender)
**Milestone:** v1.8 — UX Polish + Proto Ergonomics
**Researched:** 2026-05-25
**Confidence:** HIGH
**Scope:** Net-new dependencies only. Existing stack (Tauri 2.x, React 19.1, react-hook-form 7.76, zod 4.4.3, zustand 5.x, shadcn/ui nova, Tailwind 4.x, dnd-kit 6.x, @uiw/react-codemirror 4.25, next-themes 0.x, tauri-plugin-store 2.4.3, tauri-plugin-fs 2.5.1, tauri-plugin-dialog 2.7.1, lapin 4.x, protox 0.9, prost-reflect 0.16) is validated and ships in production.

---

## Net-New Dependencies

### Frontend: One New Library

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `react-hotkeys-hook` | `^5.3.2` | Declarative keyboard shortcut hooks for all 10 v1.8 shortcuts | Handles modifier key normalization (meta=Cmd on macOS), `enableOnFormTags` control so shortcuts don't mis-fire in inputs, scoped shortcut groups via `HotkeysProvider`, automatic cleanup — eliminates ~150 lines of manual `useEffect`/`addEventListener` boilerplate; verified compatible with React 19.1 and Tauri WKWebView |

### Rust: No New Crates

All 10 features are served by existing crates. One new Tauri command (`check_paths_exist`) uses `std::path::Path::exists()` from stdlib — no `Cargo.toml` entry needed.

### Tauri Plugins: No New Plugins

`tauri-plugin-fs` (already installed at `^2.5.1`) provides the `stat()` and path-check primitives needed for recent-files validation. `tauri-plugin-store` (already installed at `^2.4.3`) handles draft persistence and the recent-file list.

### shadcn/ui Components: No New Components

All needed primitives are already installed: `Collapsible` (used in `NestedMessageField`, `ResponseDecodedView`), `Tooltip` (used in form fields), `Dialog` and `AlertDialog` (used in block library), `command.tsx` (wraps `cmdk` 1.1.1 for command palette).

---

## Feature-by-Feature Stack Decisions

### Feature 1: Keyboard Shortcuts

**Verdict:** Add `react-hotkeys-hook` v5.3.2. Do NOT use `@tauri-apps/plugin-global-shortcut`.

**Why the plugin is wrong here:** `@tauri-apps/plugin-global-shortcut` registers OS-level shortcuts that fire even when the app window is unfocused — correct for system-tray apps, wrong for in-app UX shortcuts. Context7-verified: the plugin's `register('CommandOrControl+Shift+C', callback)` emits events system-wide. All four v1.8 shortcuts (Cmd+Enter send, Cmd+O open, Cmd+Shift+R clear, Cmd+1/2/3 tab nav) must be in-app only.

**Why `react-hotkeys-hook` over hand-rolled `useEffect`:** Raw `addEventListener('keydown')` on `document` works in Tauri WKWebView, but across 4+ shortcuts you accumulate: cleanup boilerplate, modifier-key normalization (macOS Cmd vs Windows Ctrl), logic to suppress shortcuts when a dialog is open, and guard logic to prevent firing inside `<input>` fields. `react-hotkeys-hook` packages all of this. At 5.3.2 (latest verified via npm), it is the de-facto standard for React keyboard shortcuts.

**macOS native menu conflict:** The app has a macOS native menu bar (Phase 18). Menu accelerators (`"accelerator": "CmdOrCtrl+O"`) are an alternative for Cmd+O. Both can coexist, but Cmd+O registered in both paths creates a double-trigger risk: the native menu click emits a Tauri event, and `useHotkeys` fires a JS event in the same keystroke. Recommended: register Cmd+O in `react-hotkeys-hook` only; keep the menu bar item without an accelerator (the menu item label serves as discoverability, not the shortcut itself).

**Usage pattern:**
```typescript
import { useHotkeys } from 'react-hotkeys-hook'

// In PublishBar or top-level layout:
useHotkeys('meta+enter', handleSend, {
  enableOnFormTags: ['INPUT', 'SELECT', 'TEXTAREA'],
  preventDefault: true
})
useHotkeys('meta+shift+r', handleReset, { preventDefault: true })
useHotkeys('meta+1', () => switchTab('form'), { preventDefault: true })
useHotkeys('meta+2', () => switchTab('history'), { preventDefault: true })
useHotkeys('meta+3', () => switchTab('response'), { preventDefault: true })
```

Wrap `AppLayout` in `HotkeysProvider` from `react-hotkeys-hook` to enable scope-based disabling (e.g., disable Cmd+Enter when a conflict dialog is open).

---

### Feature 2: Form Reset / Clear

**Verdict:** No new dependency. Use `react-hook-form` `reset(defaultValues)`.

`reset()` is already used in the codebase (replay from history, step-switch in StepFieldEditor). Extract `buildDefaultValues(schema: MessageSchema): Record<string, unknown>` into a shared utility (it likely already exists inline in ProtoFormRenderer). The Cmd+Shift+R handler calls `reset(buildDefaultValues(activeMessageSchema))`.

---

### Feature 3: Field-Level Copy to Clipboard

**Verdict:** No new dependency. Use `navigator.clipboard.writeText()`.

This is the established pattern: `ResponseHexSection.tsx` uses `navigator.clipboard.writeText(hexString)` and `writeText(JSON.stringify(decoded))` since Phase 04. The Tauri WebView qualifies as a Secure Context; `navigator.clipboard` requires no additional capability entry. `@tauri-apps/plugin-clipboard-manager` adds value only for clipboard READ or binary/image write — neither is needed here.

---

### Feature 4: Randomizer (type-appropriate random field values)

**Verdict:** No library. Hand-roll `randomValueForField(field: FieldSchema): unknown` (~60–80 lines).

**Why not `@faker-js/faker`:** 4.16 MB unpacked (verified via npm). Faker is oriented toward human-plausible data (names, addresses) rather than proto scalar semantics. It has no concept of proto `int64` as a string, enum values from a descriptor, or Timestamp epoch structure.

**Why not `chance.js`:** Same problem — generic random without proto type awareness. Adds a dependency for functionality a `switch` statement handles.

**Generator structure:** The existing `ScalarKind` TypeScript union (`'bool' | 'int32' | 'int64' | 'float' | ...`) already enumerates every case. A `randomValueForField` function switches over `field.kind.type` and `field.kind.scalar`:

```typescript
// src/lib/randomValueForField.ts
import type { FieldSchema, ScalarKind, FieldKind } from '@/lib/types'

export function randomValueForField(field: FieldSchema): unknown {
  const value = randomForKind(field.kind)
  return field.repeated ? [value, randomForKind(field.kind)] : value
}

function randomForKind(kind: FieldKind): unknown {
  switch (kind.type) {
    case 'scalar':    return randomScalar(kind.scalar)
    case 'enum':      return kind.values[Math.floor(Math.random() * kind.values.length)].name
    case 'well_known': return randomWKT(kind.wkt)
    case 'message':   return {} // shallow stub; deep random deferred
    case 'oneof':     return {} // pick first branch or skip
    case 'map':       return [{ key: randomScalar(kind.key_type), value: randomForKind(kind.value_kind) }]
  }
}

function randomScalar(scalar: ScalarKind): unknown {
  switch (scalar) {
    case 'bool':    return Math.random() > 0.5
    case 'string':  return crypto.randomUUID()
    case 'bytes':   return btoa(crypto.randomUUID())
    case 'int32':   return Math.floor(Math.random() * 2_147_483_647)
    case 'int64':   return String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
    case 'uint32':  return Math.floor(Math.random() * 4_294_967_295)
    case 'uint64':  return String(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER))
    case 'float':   return parseFloat((Math.random() * 1000).toFixed(4))
    case 'double':  return Math.random() * 1e9
    default:        return 0
  }
}

function randomWKT(wkt: string): unknown {
  if (wkt === 'Timestamp') return { seconds: String(Math.floor(Date.now() / 1000)), nanos: 0 }
  if (wkt === 'Duration')  return { seconds: String(Math.floor(Math.random() * 3600)), nanos: 0 }
  return {}
}
```

**int64/uint64/sint64** must serialize as strings — this matches the existing IPC convention (prost-reflect encodes 64-bit integers as JSON strings on the Rust side).

**Recursive message randomization:** Cap recursion depth at 2 levels with a `depth` parameter to avoid infinite loops on self-referential schemas (e.g., `message Node { Node child = 1; }`). At depth > 1, return `{}` (empty message).

---

### Feature 5: Proto File Reload

**Verdict:** No new dependency. Reuse existing `parse_proto` Tauri command.

The active file path is already stored in `useProtoStore` (each tab entry has a `filePath`). A "Reload" button invokes `parse_proto({ path: activeFilePath, includePaths: activeIncludePaths })` with the same arguments as the original load. No new IPC command is required unless a dedicated `reload_proto` alias is desired for clarity — but it would be a thin wrapper with no new crate.

---

### Feature 6: Recent Files Nav

**Verdict:** No new dependency. `tauri-plugin-store` for list storage + new Rust command for path validation.

**Store key:** `recent_proto_files` — array of `{ path: string, lastOpenedAt: number }`, FIFO capped at 10 entries.

**Path validation constraint:** The frontend `fs:scope` in `capabilities/default.json` is narrowed to `$DOWNLOAD/**`, `$DESKTOP/**`, `$DOCUMENT/**` — a deliberate v1.4 security hardening. Proto files commonly live outside these directories (e.g., `~/projects/`). The `@tauri-apps/plugin-fs` `stat()` respects `fs:scope`, so it cannot validate arbitrary proto paths from the frontend.

**Solution:** A new Rust command using stdlib only:

```rust
// src-tauri/src/commands/fs_utils.rs (new file, no Cargo.toml change)
#[tauri::command]
pub async fn check_paths_exist(paths: Vec<String>) -> Vec<bool> {
    paths.iter()
        .map(|p| std::path::Path::new(p).exists())
        .collect()
}
```

This bypasses the `fs:scope` restriction because it runs in the Rust process, not the WebView. No new crate. Register it in `lib.rs` like any other command.

**Do NOT** expand `fs:scope` to `$HOME/**` to allow frontend stat — that undoes v1.4 hardening.

---

### Feature 7: Proto Import Manager

**Verdict:** No new dependency. Surface existing include path data in a new UI panel.

The Rust `parse_proto` command already accepts `include_paths: Vec<String>`. Include paths are already persisted per proto tab since Phase 23 (used for plan proto auto-load). A UI to view/edit them is a React form with an array of string inputs — an `Input` per path, add/remove buttons with `lucide-react` icons (already installed). No new IPC, no new crate, no new store.

---

### Feature 8: Schema Explorer (collapsible tree + field type tooltips)

**Verdict:** No new dependency. Use existing `Collapsible` + `Tooltip` from shadcn/ui.

**Data source:** `useProtoStore().activeFile.schema` (type `ProtoSchema`) — already live in React state. No new IPC command. The `ProtoSchema` with `MessageSchema[]` and `FieldSchema[]` (including `FieldKind` discriminated union) is already serialized from Rust via `serde` and stored in zustand.

**Why not `react-arborist`:** At 364 KB unpacked, react-arborist is justified for trees with 1,000+ nodes (file explorer, org chart). A proto schema tree is bounded: typically 5–50 messages with 3–20 fields each. Recursive `Collapsible` nesting achieves identical visual output at zero dependency cost and follows the pattern already established in `NestedMessageField.tsx` and `ResponseDecodedView.tsx`.

**Field type tooltips:** Wrap each field's type label in the existing `Tooltip` / `TooltipContent` / `TooltipProvider` from shadcn/ui. Content shows the `FieldKind` discriminant, scalar type, enum values, or nested message full name.

**Component structure:**
```
SchemaExplorer
  ProtoSchemaContext (existing) or direct useProtoStore()
  MessageTreeNode (recursive)
    Collapsible (open by default for top-level, closed for nested)
      CollapsibleTrigger → message name + field count badge
      CollapsibleContent
        FieldRow (for each field)
          Tooltip → FieldKind details
```

---

### Feature 9: Connection Quick-Switch

**Verdict:** No new dependency. Use existing `cmdk` + `Command`/`CommandDialog` from shadcn/ui.

`cmdk` is already installed at `^1.1.1`, and `command.tsx` / `CommandDialog` are already in `src/components/ui/`. A connection quick-switch is exactly the command palette pattern `cmdk` is designed for: open with a keyboard shortcut, fuzzy-filter saved profiles by name, select to switch. Hook into `react-hotkeys-hook` for the trigger shortcut (e.g., Cmd+K or Cmd+Shift+P — team preference).

---

### Feature 10: Message Draft Persistence

**Verdict:** No new dependency. `tauri-plugin-store` + existing `useDebounce` hook.

**Store key scheme:** `draft:{encodedFilePath}:{messageFullName}` — scoped per proto file + message type. Use `encodeURIComponent` on the file path to avoid special characters in store keys.

**Write path:** On `watch()` in `react-hook-form`, debounce writes to the store using the existing `useDebounce` hook at `src/hooks/useDebounce.ts`.

**Read path:** On message type switch or file open, read the draft from store and call `reset(draft)`. Treat draft as lower-priority than explicit user replay (replay from history overrides draft).

**Eviction:** Cap at 50 draft keys (FIFO by `lastSavedAt`). At typical proto form sizes (~20 fields, scalar values), 50 drafts is well within `tauri-plugin-store` limits.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@tauri-apps/plugin-global-shortcut` | Fires when app is unfocused (OS-level); wrong scope for in-app UX shortcuts; requires Rust init + capability entry | `react-hotkeys-hook` in React component tree |
| `@tauri-apps/plugin-clipboard-manager` | Only needed for clipboard READ or binary/image write; all v1.8 clipboard ops are write-text-only | `navigator.clipboard.writeText()` (established pattern since Phase 04) |
| `@faker-js/faker` | 4.16 MB unpacked; human-plausible strings not proto scalar semantics; no knowledge of enum values from descriptor | Hand-rolled `randomValueForField()` (~60–80 lines over `ScalarKind` switch) |
| `chance.js` | Generic randomness without proto type awareness; adds a dependency for a `switch` statement | Same hand-rolled utility |
| `react-arborist` | 364 KB unpacked; virtualization overkill for bounded proto trees (5–50 messages); own keyboard model conflicts with `react-hotkeys-hook` scopes | Recursive `Collapsible` (already installed, established pattern in `NestedMessageField`) |
| Expanding `fs:scope` to `$HOME/**` | Undoes v1.4 security hardening | `check_paths_exist` Rust command using `std::path::Path::exists()` |
| New Rust crate for path existence | `std::path::Path::exists()` is Rust stdlib | Use stdlib directly |
| New IPC command for schema explorer | `ProtoSchema` already live in zustand from existing `parse_proto` command | Consume `useProtoStore().activeFile.schema` directly |
| New shadcn/ui tree component | `Collapsible` is already installed and used for nested proto fields | Extend the established recursive Collapsible pattern |

---

## Installation

```bash
# Only one new npm package
pnpm add react-hotkeys-hook
```

No changes to `Cargo.toml`. No new Tauri plugins. No new capability JSON entries (the new `check_paths_exist` command uses Rust stdlib, not a plugin — no permission entry required).

---

## Version Compatibility

| Package | Version | Compatible With | Notes |
|---------|---------|-----------------|-------|
| `react-hotkeys-hook` | `^5.3.2` | React 19.1.0 | v5.x requires React 16.8+; confirmed compatible with React 19 |
| `react-hotkeys-hook` | `^5.3.2` | Tauri 2.x WKWebView | WKWebView propagates `KeyboardEvent` to `document`; `meta` key maps to macOS Cmd; verified via Context7 |
| `react-hotkeys-hook` | `^5.3.2` | react-hook-form 7.76 | `enableOnFormTags: false` (default) prevents shortcuts firing while user types; use allowlist for intentional form-active shortcuts like Cmd+Enter |
| `zod` | `^4.4.3` (current) | `@hookform/resolvers` `^5.2.2` | Resolvers v5.x supports zod 4. Note: CLAUDE.md Project Skills section still references "zod pinned to ^3.24.2" — this is a documentation drift from v1.2; actual installed version is 4.4.3 and resolvers are compatible. |

---

## Capability Constraints (Security)

The hardened `capabilities/default.json` (v1.4) must not be loosened. v1.8 additive changes:

- `check_paths_exist` command: no capability entry needed — Rust stdlib, not a plugin.
- No new plugin means no new `plugin-name:default` or `plugin-name:allow-*` entries.
- `navigator.clipboard.writeText()` requires no Tauri capability entry — it operates under the WebView's standard permissions model.
- `react-hotkeys-hook` is pure JS — no IPC, no capability implications.

---

## Existing Stack Reference (v1.7 validated — do not re-research)

| Technology | Version | Status |
|------------|---------|--------|
| Tauri | 2.x | Validated |
| React | 19.1.0 | Validated |
| react-hook-form | 7.76.0 | Validated |
| zod | 4.4.3 | Validated |
| zustand | 5.0.13 | Validated |
| shadcn/ui (nova) + radix-ui | 1.4.3 | Validated |
| Tailwind CSS | 4.x | Validated |
| dnd-kit | 6.3.1 / sortable 10.0.0 | Validated |
| @uiw/react-codemirror | 4.25.10 | Validated |
| tauri-plugin-store | 2.4.3 | Validated |
| tauri-plugin-fs | 2.5.1 | Validated (stat for path checks) |
| tauri-plugin-dialog | 2.7.1 | Validated |
| cmdk | 1.1.1 | Validated (used for quick-switch) |
| sonner | 2.0.7 | Validated |
| lucide-react | 1.16.0 | Validated |
| protox | 0.9 | Validated |
| prost-reflect | 0.16 (with serde feature) | Validated |
| lapin | 4.x | Validated |

---

## Summary for Roadmap Planner

Only **one new npm dependency** for all 10 v1.8 features: `react-hotkeys-hook@^5.3.2`.

| Feature | New libraries | New shadcn components | New Rust | Application code scope |
|---------|--------------|----------------------|----------|------------------------|
| 1. Keyboard shortcuts | `react-hotkeys-hook` | None | None | `useHotkeys` in PublishBar + AppLayout wrapped in `HotkeysProvider` |
| 2. Form reset / clear | None | None | None | `reset(buildDefaultValues(schema))` in existing `react-hook-form` |
| 3. Field-level copy | None | None | None | `navigator.clipboard.writeText(value)` per field |
| 4. Randomizer | None | None | None | `randomValueForField()` utility (~70 lines) |
| 5. Proto reload | None | None | None | Re-invoke `parse_proto` with stored path + includePaths |
| 6. Recent files nav | None | None | `check_paths_exist` (stdlib) | `tauri-plugin-store` list + Rust path validation |
| 7. Import manager | None | None | None | React form over existing include path state |
| 8. Schema explorer | None | None | None | Recursive `Collapsible` over existing `ProtoSchema` in zustand |
| 9. Quick-switch | None | None | None | `CommandDialog` + `cmdk` (already installed) |
| 10. Draft persistence | None | None | None | `tauri-plugin-store` + `useDebounce` (already installed) |

Install command: `pnpm add react-hotkeys-hook`

---

## Sources

- Context7 `/tauri-apps/tauri-plugin-global-shortcut` — system-wide scope confirmed; fires when unfocused; `global-shortcut:allow-register` capability required — HIGH confidence
- Context7 `/tauri-apps/plugins-workspace` (clipboard-manager) — `writeText`/`readText`/`writeHtml` API confirmed; "no features enabled by default"; `navigator.clipboard` is the simpler path for write-text — HIGH confidence
- Context7 `/johannesklauss/react-hotkeys-hook` — v5.3.2 confirmed; `useHotkeys`, `HotkeysProvider`, `enableOnFormTags`, scopes API verified; React 16.8+ compatibility — HIGH confidence
- npm registry: `react-hotkeys-hook@5.3.2`, `react-arborist@3.7.0` (364 KB unpacked), `@faker-js/faker@10.4.0` (4.16 MB unpacked) — HIGH confidence
- `package.json` — existing dependency versions verified; `cmdk@1.1.1`, `@tauri-apps/plugin-fs@2.5.1`, `@tauri-apps/plugin-store@2.4.3` confirmed installed
- `src-tauri/Cargo.toml` — no new crates needed; stdlib `std::path::Path::exists()` confirmed
- `src-tauri/capabilities/default.json` — hardened scope confirmed; additive-only constraint documented
- `src/components/response/ResponseHexSection.tsx` — `navigator.clipboard.writeText()` established pattern since Phase 04
- `src-tauri/src/schema/types.rs` — `ProtoSchema` with `serde::Serialize` confirmed; already serialized to frontend via `parse_proto` command
- `src/stores/useProtoStore.ts` — `ProtoSchema` already in zustand; schema explorer needs no new IPC
- `src/components/ui/collapsible.tsx` + usage in `NestedMessageField.tsx`, `ResponseDecodedView.tsx` — recursive Collapsible pattern established

---
*Stack research for: Tap v1.8 UX Polish + Proto Ergonomics — net-new dependencies only*
*Researched: 2026-05-25*
