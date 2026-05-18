---
phase: "01"
plan: "01"
subsystem: "walking-skeleton"
tags: ["tauri2", "rust", "protox", "prost-reflect", "react", "tailwind4", "shadcn-ui", "vitest"]
dependency_graph:
  requires: []
  provides:
    - tauri-project-scaffold
    - rust-proto-backend
    - typescript-ipc-contract
    - react-form-renderer
    - hex-preview-panel
  affects:
    - "01-02 (will add full scalar/enum/oneof/repeated field implementations)"
    - "01-03 (will add RabbitMQ connection UI consuming this scaffold)"
tech_stack:
  added:
    - "protox 0.9 (runtime proto parsing, no protoc dependency)"
    - "prost-reflect 0.16.3 + prost 0.14.3 (dynamic message encoding)"
    - "thiserror 2.x (AppError with Serialize for Tauri IPC)"
    - "tauri-plugin-store 2.x"
    - "tauri-plugin-dialog 2.x"
    - "tauri-plugin-fs 2.x"
    - "react-hook-form 7.x"
    - "zod 3.24.2 (pinned, not v4)"
    - "zustand 5.x"
    - "tailwindcss 4.x (@tailwindcss/vite plugin)"
    - "shadcn/ui nova preset (Radix + Geist)"
    - "vitest + @testing-library/react"
  patterns:
    - "Tauri State<Mutex<Option<DescriptorPool>>> for pool sharing between commands"
    - "prost_reflect::prost::Message for encode (not bare prost::Message)"
    - "RenderFieldFn prop-passing to avoid circular imports in field components"
    - "Zustand store slice pattern with immutable updates"
    - "FormProvider + useWatch for 200ms debounced hex re-encoding"
key_files:
  created:
    - "src-tauri/src/main.rs"
    - "src-tauri/src/lib.rs"
    - "src-tauri/src/error.rs"
    - "src-tauri/src/commands/mod.rs"
    - "src-tauri/src/commands/proto.rs"
    - "src-tauri/src/commands/encode.rs"
    - "src-tauri/src/schema/mod.rs"
    - "src-tauri/src/schema/types.rs"
    - "src-tauri/src/schema/extractor.rs"
    - "src-tauri/Cargo.toml"
    - "src-tauri/tauri.conf.json"
    - "src-tauri/capabilities/default.json"
    - "src-tauri/Entitlements.plist"
    - "src-tauri/gen/apple/PrivacyInfo.xcprivacy"
    - "src/lib/types.ts"
    - "src/lib/ipc.ts"
    - "src/stores/useProtoStore.ts"
    - "src/hooks/useDebounce.ts"
    - "src/components/layout/AppLayout.tsx"
    - "src/components/sidebar/Sidebar.tsx"
    - "src/components/form/FormPanel.tsx"
    - "src/components/form/ProtoFormRenderer.tsx"
    - "src/components/form/fields/ScalarField.tsx"
    - "src/components/form/fields/NestedMessageField.tsx"
    - "src/components/form/fields/RepeatedField.tsx"
    - "src/components/form/fields/EnumField.tsx"
    - "src/components/form/fields/OneofField.tsx"
    - "src/components/form/fields/WellKnownTypeField.tsx"
    - "src/components/preview/HexPreviewPanel.tsx"
    - "src/test/setup.ts"
    - "src/index.css"
    - "vite.config.ts"
    - "tsconfig.json (updated with @ alias)"
    - "components.json"
  modified: []
decisions:
  - "Use prost_reflect::prost::Message (not bare prost::Message) for DynamicMessage.encode() — protox re-exports prost"
  - "DescriptorPool uses Arc internally so clone() in parse_proto is O(1)"
  - "ProtoFormRenderer is FINAL — Wave 2 replaces stub field components only, not the renderer"
  - "zod pinned to ^3.24.2 (not v4) due to @hookform/resolvers type incompatibility with zod v4"
  - "ScalarField renders full string implementation; other scalars render Badge placeholder"
  - "shadcn/ui nova preset used (instead of zinc) — CLI no longer exposes --preset=zinc directly"
  - "macOS entitlement: Entitlements.plist with absolute-path read-write, sandbox=false for dev tool"
metrics:
  duration: "~25 minutes"
  completed_date: "2026-05-17"
  tasks_completed: 3
  tasks_total: 3
  files_created: 33
  files_modified: 4
---

# Phase 1 Plan 01: Walking Skeleton Summary

Tauri 2 project scaffolded from scratch with full Rust backend (proto parsing + dynamic encoding) and React frontend (layout + all 6 field component dispatch stubs + hex preview).

## What Was Built

**Rust backend (3 Tauri commands):**
- `parse_proto(file_path, include_paths)` — compiles .proto with protox, stores DescriptorPool in Tauri State, returns ProtoSchema
- `encode_message(message_type, form_values)` — retrieves pool from State, builds DynamicMessage via prost-reflect, encodes to wire format bytes
- Schema extractor: converts prost_reflect descriptors to serializable ProtoSchema (with oneof group deduplication, WellKnownType detection, snake_case-to-Title-Case label generation)

**TypeScript frontend:**
- IPC contract (types.ts, ipc.ts) mirroring the Rust type system
- Zustand store for schema/hex/encoding state
- 3-column layout: sidebar (file picker + message selector) | form (ProtoFormRenderer) | hex preview
- ProtoFormRenderer: stable 6-case dispatch that Wave 2 does NOT modify
- All 6 field stubs in their final export shape (ScalarField shows strings; 5 others show Wave 2 Badge)
- HexPreviewPanel with encoding/error state display

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] prost::Message import path incorrect**
- **Found during:** Task 1 first cargo build
- **Issue:** `use prost::Message` failed — protox re-exports prost, and prost-reflect exposes it via `prost_reflect::prost::Message`
- **Fix:** Changed to `use prost_reflect::prost::Message`
- **Files modified:** src-tauri/src/commands/encode.rs
- **Commit:** 875defd (amended in same commit)

**2. [Rule 1 - Bug] Dead `case "repeated"` in TypeScript switch**
- **Found during:** Task 3 `npm run build`
- **Issue:** TypeScript error — "repeated" is not a valid FieldKind type discriminant; repeated is `field.repeated: boolean`, not a kind variant
- **Fix:** Removed the dead case; repeated fields are handled before the switch via `field.repeated` check
- **Files modified:** src/components/form/ProtoFormRenderer.tsx
- **Commit:** 878339e (fixed before commit)

**3. [Rule 3 - Blocking] .planning/ deleted by scaffold force flag**
- **Found during:** Task 1 post-scaffold git status
- **Issue:** `npm create tauri-app` with `-f` deleted all files in the repo root including `.planning/`
- **Fix:** `git checkout HEAD -- .planning/ CLAUDE.md` to restore from git history before committing
- **Files affected:** all .planning/ files (restored from git)
- **No additional commit needed** — files restored before Task 1 commit

**4. [Rule 2 - Missing critical] shadcn/ui init needed tsconfig path alias first**
- **Found during:** Task 2 shadcn init
- **Issue:** shadcn init failed on import alias validation without `paths: {"@/*": ["./src/*"]}` in tsconfig.json
- **Fix:** Added `baseUrl: "."` and `paths` to tsconfig.json before running init
- **Files modified:** tsconfig.json

**5. [Rule 1 - Deviation] shadcn nova preset instead of zinc**
- **Found during:** Task 2 shadcn init
- **Issue:** shadcn CLI v3+ no longer exposes `--preset=zinc`; available presets are nova/vega/maia/lyra/mira/luma/sera/custom
- **Fix:** Used `-p nova` (neutral zinc-like aesthetic) — compatible with the plan's intent
- **Impact:** CSS custom properties use oklch() color space instead of hsl(); functionally equivalent

## Known Stubs

The following stub implementations are intentional Wave 1 placeholders — Wave 2 (plan 01-02) will replace each:

| Component | File | Stub behavior | Wave 2 target |
|-----------|------|---------------|---------------|
| ScalarField (non-string) | src/components/form/fields/ScalarField.tsx | Badge placeholder for int/bool/bytes/float | Full numeric/bool/bytes inputs |
| NestedMessageField | src/components/form/fields/NestedMessageField.tsx | Badge "nested message — Wave 2" | Recursive CollapsibleSection |
| RepeatedField | src/components/form/fields/RepeatedField.tsx | Badge "repeated — Wave 2" | useFieldArray add/remove rows |
| EnumField | src/components/form/fields/EnumField.tsx | Badge "enum — Wave 2" | Select dropdown with enum values |
| OneofField | src/components/form/fields/OneofField.tsx | Badge "oneof — Wave 2" | RadioGroup + conditional branch |
| WellKnownTypeField | src/components/form/fields/WellKnownTypeField.tsx | Badge "{wkt} — Wave 2" | Date/time picker for Timestamp/Duration |

These stubs DO NOT prevent plan 01-01's goal (walking skeleton with file open → form render → hex update for string fields). They are explicitly Wave 1 scope.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: arbitrary-file-read | src-tauri/capabilities/default.json | `fs:scope allow **/*` enables reading any file on disk — appropriate for a dev tool but should be reviewed before distribution |
| threat_flag: sandbox-disabled | src-tauri/Entitlements.plist | `com.apple.security.app-sandbox: false` disables macOS sandbox — required for arbitrary file access but increases attack surface |

## Self-Check: PASSED

Files exist:
- src-tauri/src/commands/encode.rs: FOUND
- src-tauri/src/schema/extractor.rs: FOUND
- src/components/form/ProtoFormRenderer.tsx: FOUND
- src/components/form/fields/ScalarField.tsx: FOUND
- src/stores/useProtoStore.ts: FOUND
- src/lib/types.ts: FOUND

Commits exist:
- 875defd (Task 1: Tauri scaffold + Rust backend): FOUND
- 96393ae (Task 2: Tailwind + shadcn + TS contracts): FOUND
- 878339e (Task 3: React layout + field stubs): FOUND

Cargo tests: 5/5 passed
Frontend build: exit 0
prost version: 0.14.3 only (no 0.13.x)
tailwind.config.js: absent (correct for Tailwind 4)
