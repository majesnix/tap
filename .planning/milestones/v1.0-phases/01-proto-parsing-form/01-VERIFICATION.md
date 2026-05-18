---
phase: 01-proto-parsing-form
verified: 2026-05-17T12:00:00Z
status: human_needed
score: 11/11 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 10/11
  gaps_closed:
    - "Changing a form field triggers a debounced encode call and displays hex bytes in the bottom strip"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Run `npm run tauri dev`, open the app, select a .proto file with nested/oneof/repeated/enum fields, fill in the form, and observe the hex preview panel at the bottom."
    expected: "Hex bytes appear after a ~200ms pause following form interaction; all field kinds render correctly with proper controls; IncludePathDialog opens with 'Configure include paths' title; enum fields display names; Timestamp fields show datetime-local input."
    why_human: "Tauri desktop app cannot be smoke-tested headlessly; end-to-end rendering, IPC roundtrip, and visual correctness require a running app."
  - test: "Type rapidly into a scalar text field and watch the hex preview panel."
    expected: "Hex updates are gated behind a 200ms pause (debounce). Consecutive keystrokes should not each fire an IPC call — only the final value after the pause triggers encoding."
    why_human: "Timing behavior (debounce vs. immediate) cannot be verified by static analysis; requires runtime observation."
---

# Phase 01: Proto Parsing & Dynamic Form — Verification Report

**Phase Goal:** Deliver a working local desktop app that lets a developer open a .proto file, select a message type, fill in a dynamic form covering ALL proto field kinds (scalar, nested, repeated, enum, oneof, well-known types), and see live binary-encoded hex output. No RabbitMQ connection yet.
**Verified:** 2026-05-17T12:00:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (Plan 06 closed the single debounce gap from initial verification)

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                               | Status      | Evidence                                                                                                                                  |
|----|-----------------------------------------------------------------------------------------------------|-------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | User can open a .proto file via native file picker                                                  | VERIFIED    | FileSection.tsx calls `open()` from `@tauri-apps/plugin-dialog`; triggers `parseProto` IPC; schema lands in useProtoStore                |
| 2  | Selecting a message type renders a dynamic form covering all 6 field kinds                          | VERIFIED    | ProtoFormRenderer.tsx dispatches on FieldKind: scalar, nested, repeated, enum, oneof, well_known — all 6 branches implemented             |
| 3  | Changing a form field triggers a debounced encode call and displays hex bytes in the bottom strip   | VERIFIED    | FormPanel.tsx uses `useState` + `useDebounce(latestValues, 200)` + `useEffect([debouncedValues])` pipeline; `encodeMessage` only called from within useEffect; no `void debouncedValues`; no `useRef`; FormPanel.test.tsx fake-timer tests confirm debounce gating; 41/41 vitest tests pass |
| 4  | ScalarField renders correct controls for all 16 proto scalar kinds with zod validation              | VERIFIED    | ScalarField.tsx: getInputType + getZodSchema helpers cover all 16 kinds; int64/uint64 as text; bytes shows badge; int32 range enforced    |
| 5  | NestedMessageField renders a collapsible sub-form and caps recursion at depth 5                     | VERIFIED    | NestedMessageField.tsx: Collapsible wrapper; `depth >= 5` returns DepthCapPlaceholder; tests confirm                                      |
| 6  | RepeatedField renders a list with Add and Remove controls using react-hook-form useFieldArray        | VERIFIED    | RepeatedField.tsx: useFieldArray; `key={rhfField.id}`; Add button appends default item; Remove is destructive with correct button         |
| 7  | EnumField shows value names to the user and stores the numeric value in form state                  | VERIFIED    | EnumField.tsx: displays `v.name`; `value={String(v.number)}`; `onValueChange={(s) => onChange(Number(s))}`                               |
| 8  | OneofField renders a RadioGroup to pick branch, unmounts other branches on change                   | VERIFIED    | OneofField.tsx: `useWatch` on `${path}._selected`; `unregister` called on branch change; flat path `${path}.${branchField.name}`         |
| 9  | WellKnownTypeField renders datetime-local for Timestamp and a regex-validated input for Duration    | VERIFIED    | WellKnownTypeField.tsx: `type="datetime-local"` for Timestamp; DURATION_PATTERN + placeholder for Duration; plain text fallback for others |
| 10 | Include paths are persisted per file and shown in IncludePathDialog                                 | VERIFIED    | FileSection.tsx loads key `include_paths:${filePath}` from tauri-plugin-store; IncludePathDialog title "Configure include paths" confirmed |
| 11 | Rust backend parses .proto files and encodes protobuf messages to binary bytes                      | VERIFIED    | 5/5 cargo tests pass; protox 0.9 + prost-reflect 0.16 in Cargo.toml; parse_proto and encode_message commands registered                   |

**Score:** 11/11 truths verified

---

## Required Artifacts

| Artifact                                                     | Expected                                      | Status      | Details                                                                                  |
|--------------------------------------------------------------|-----------------------------------------------|-------------|------------------------------------------------------------------------------------------|
| `src-tauri/src/commands/proto.rs`                            | parse_proto Tauri command                     | VERIFIED    | Exists; registers `parse_proto` command with protox Compiler + DescriptorPool            |
| `src-tauri/src/commands/encode.rs`                           | encode_message Tauri command                  | VERIFIED    | Exists; takes message type name + JSON values; returns bytes via prost-reflect            |
| `src-tauri/src/schema/extractor.rs`                          | ProtoSchema extraction from DescriptorPool    | VERIFIED    | Exists; extracts all field kinds; note: default_value always None (TS fallback handles it)|
| `src/components/form/ProtoFormRenderer.tsx`                  | Dispatch layer for all 6 field kinds          | VERIFIED    | Exists; MAX_DEPTH=5; dispatches scalar/nested/repeated/enum/oneof/well_known              |
| `src/components/form/FormPanel.tsx`                          | Form container with debounced encode          | VERIFIED    | useState + useDebounce + useEffect pipeline; encodeMessage only in useEffect; no dead code|
| `src/components/form/fields/ScalarField.tsx`                 | All 16 scalar kinds, zod validation           | VERIFIED    | Exists; getInputType + getZodSchema cover all 16 kinds                                   |
| `src/components/form/fields/NestedMessageField.tsx`          | Collapsible sub-form, depth cap               | VERIFIED    | Exists; depth >= 5 check; DepthCapPlaceholder                                             |
| `src/components/form/fields/RepeatedField.tsx`               | useFieldArray list with add/remove            | VERIFIED    | Exists; useFieldArray; field.id key; Add + Remove buttons                                 |
| `src/components/form/fields/EnumField.tsx`                   | Name display, numeric storage                 | VERIFIED    | Exists; correct name/number bridge                                                        |
| `src/components/form/fields/OneofField.tsx`                  | RadioGroup branch selector with unregister    | VERIFIED    | Exists; useWatch + unregister; useMemo for branchNames                                    |
| `src/components/form/fields/WellKnownTypeField.tsx`          | Timestamp/Duration/fallback                   | VERIFIED    | Exists; datetime-local + DURATION_PATTERN + text fallback                                 |
| `src/components/form/fields/DepthCapPlaceholder.tsx`         | Depth cap visual indicator                    | VERIFIED    | Exists; rendered when depth >= 5                                                          |
| `src/components/sidebar/FileSection.tsx`                     | File picker + include path management         | VERIFIED    | Exists; tauri-plugin-dialog open(); tauri-plugin-store load/save                         |
| `src/components/include-paths/IncludePathDialog.tsx`         | Include path configuration dialog             | VERIFIED    | Exists; correct copywriting confirmed                                                     |
| `src/stores/useProtoStore.ts`                                | Zustand store with schema/messageType/hex     | VERIFIED    | Exists; filePath, schema, messageType, hexPreview, isEncoding, encodeError                |
| `src/lib/types.ts`                                           | FieldKind union, ProtoSchema, RenderFieldFn   | VERIFIED    | Exists; all types present and correct                                                     |
| `src/lib/ipc.ts`                                             | parseProto + encodeMessage invoke wrappers    | VERIFIED    | Exists; both wrappers present                                                             |
| `src/hooks/useDebounce.ts`                                   | Generic debounce hook                         | VERIFIED    | Exists; correct implementation; properly consumed by FormPanel.tsx                        |
| `src/components/form/__tests__/FormPanel.test.tsx`           | Debounce behavior tests with fake timers      | VERIFIED    | Exists; vi.useFakeTimers(); tests verify encodeMessage NOT called before 200ms; called exactly once after debounce window |

---

## Key Link Verification

| From                                  | To                                         | Via                                             | Status      | Details                                                                               |
|---------------------------------------|--------------------------------------------|-------------------------------------------------|-------------|---------------------------------------------------------------------------------------|
| FileSection.tsx                       | parse_proto (Rust)                         | ipc.ts parseProto invoke                        | WIRED       | open() → parseProto → setSchema in useProtoStore                                      |
| FileSection.tsx                       | tauri-plugin-store                         | load()/save() on include_paths:${filePath}      | WIRED       | Per-file key; load before parseProto; save on dialog confirm                          |
| FormPanel.tsx                         | useDebounce hook                           | useDebounce(latestValues, 200)                  | WIRED       | useState input; hook returns debouncedValues; consumed in useEffect                   |
| FormPanel.tsx                         | encode_message (Rust)                      | ipc.ts encodeMessage invoke inside useEffect    | WIRED       | useEffect([debouncedValues]) → encodeMessage → setHexPreview                          |
| ProtoFormRenderer.tsx                 | ScalarField/NestedMessageField/etc.        | renderField RenderFieldFn prop                  | WIRED       | renderField passed down; all 6 field kinds dispatched correctly                        |
| NestedMessageField.tsx                | useProtoStore                              | schema lookup by typeName                       | WIRED       | Reads schema directly from store for recursive sub-form rendering                     |
| EnumField.tsx                         | react-hook-form Controller                 | name={path}, value={String(v.number)}           | WIRED       | Name/number bridge correct                                                             |
| OneofField.tsx                        | react-hook-form unregister                 | unregister(${path}.${prev})                     | WIRED       | Branch change triggers unregister of previous branch fields                           |

---

## Data-Flow Trace (Level 4)

| Artifact              | Data Variable   | Source                                     | Produces Real Data  | Status    |
|-----------------------|-----------------|--------------------------------------------|---------------------|-----------|
| FormPanel.tsx         | hexPreview      | useEffect([debouncedValues]) → encodeMessage IPC → Rust backend | Yes (binary bytes after 200ms debounce) | FLOWING   |
| FormPanel.tsx         | debouncedValues | useDebounce(latestValues, 200) where latestValues is useState | Yes — re-render triggered on setLatestValues | FLOWING   |
| FileSection.tsx       | schema          | parseProto IPC → Rust backend              | Yes                 | FLOWING   |
| ProtoFormRenderer.tsx | fields          | schema.messages[messageType]               | Yes                 | FLOWING   |

---

## Behavioral Spot-Checks

| Behavior                                         | Command                                                                                            | Result            | Status |
|--------------------------------------------------|----------------------------------------------------------------------------------------------------|-------------------|--------|
| Rust cargo tests pass                            | `cargo test --manifest-path src-tauri/Cargo.toml`                                                 | 5/5 ok            | PASS   |
| Frontend vitest tests pass                       | `npx vitest run`                                                                                   | 41/41 passed      | PASS   |
| Frontend build succeeds                          | `npm run build`                                                                                    | exit 0            | PASS   |
| No `void debouncedValues` in FormPanel.tsx       | `grep -c "void debouncedValues" src/components/form/FormPanel.tsx`                                 | 0                 | PASS   |
| No `useRef` for latestValues in FormPanel.tsx    | `grep "useRef" src/components/form/FormPanel.tsx`                                                  | no match          | PASS   |
| encodeMessage only in useEffect                  | `grep -n "encodeMessage" src/components/form/FormPanel.tsx`                                        | line 33 (inside useEffect only) | PASS   |
| Debounce test file exists with fake-timer tests  | Read `src/components/form/__tests__/FormPanel.test.tsx`                                            | vi.useFakeTimers(); 2 debounce tests | PASS   |
| Full app smoke test (Tauri desktop)              | `npm run tauri dev` — manual interaction required                                                  | N/A               | SKIP (human needed) |

---

## Requirements Coverage

| Requirement | Source Plan | Description                                                           | Status      | Evidence                                                                                              |
|-------------|-------------|-----------------------------------------------------------------------|-------------|-------------------------------------------------------------------------------------------------------|
| PROT-01     | 01-01-PLAN  | Load .proto file at runtime and parse to extractable schema           | SATISFIED   | FileSection.tsx → parseProto → protox Compiler → DescriptorPool → extractor.rs → ProtoSchema         |
| PROT-02     | 01-05-PLAN  | Support include paths for multi-file proto projects                   | SATISFIED   | IncludePathDialog.tsx + FileSection.tsx store/load include paths per file via tauri-plugin-store       |
| FORM-01     | 01-01-PLAN  | Dynamic form generated from parsed schema                             | SATISFIED   | ProtoFormRenderer.tsx dispatches all 6 FieldKind variants; FormPanel.tsx wraps with react-hook-form   |
| FORM-02     | 01-02-PLAN  | Scalar fields: correct control per scalar type                        | SATISFIED   | ScalarField.tsx: getInputType returns correct HTML input type for all 16 scalar kinds                 |
| FORM-03     | 01-03-PLAN  | Nested message fields: recursive sub-form via Collapsible             | SATISFIED   | NestedMessageField.tsx: Collapsible wrapper; recursive ProtoFormRenderer call; depth tracking          |
| FORM-04     | 01-03-PLAN  | Repeated fields: add/remove items via useFieldArray                   | SATISFIED   | RepeatedField.tsx: useFieldArray; key=rhfField.id; Add + Remove with correct aria labels              |
| FORM-05     | 01-04-PLAN  | Enum fields: show names, store numbers                                | SATISFIED   | EnumField.tsx: Select with value=String(v.number), onValueChange=Number(s), displays v.name           |
| FORM-06     | 01-02-PLAN  | Inline validation errors per field                                    | SATISFIED   | ScalarField.tsx: Controller with render prop; role="alert" error span; zod schema per kind             |
| FORM-07     | 01-01-PLAN  | Default values pre-populated on message type selection                | SATISFIED   | buildDefaultValues in ProtoFormRenderer.tsx provides type-correct zero defaults; Rust extractor returns None but TS fallback satisfies observable behavior |
| FORM-08     | 01-03-PLAN  | Depth cap on nested messages (max 5 levels)                           | SATISFIED   | NestedMessageField.tsx: depth >= 5 → DepthCapPlaceholder; ProtoFormRenderer depth > MAX_DEPTH (5) → text |
| FORM-09     | 01-05-PLAN  | Well-known types: Timestamp and Duration have specialized controls    | SATISFIED   | WellKnownTypeField.tsx: datetime-local for Timestamp; DURATION_PATTERN for Duration; fallback for rest |

Note: REQUIREMENTS.md checkboxes for FORM-02, FORM-03, FORM-06, FORM-07, FORM-08 remain unchecked (INFO level). All are implemented — the traceability table in REQUIREMENTS.md was not updated when these requirements were satisfied.

---

## Anti-Patterns Found

| File                                     | Line  | Pattern                                        | Severity | Impact                                                                                      |
|------------------------------------------|-------|------------------------------------------------|----------|---------------------------------------------------------------------------------------------|
| src-tauri/src/schema/extractor.rs        | 87,115| `default_value: None` (hardcoded)              | INFO     | Never reads FieldDescriptor.default_value() from prost-reflect; TS buildDefaultValues fallback compensates; observable behavior is correct |

Previously-blocking anti-patterns in FormPanel.tsx (`void debouncedValues`, `useDebounce(latestValues.current, 200)`, direct `encodeMessage` in handler) were all resolved by Plan 06. No blockers or warnings remain.

---

## Human Verification Required

### 1. Full App Smoke Test

**Test:** Run `npm run tauri dev`, open the app, select a `.proto` file with nested/oneof/repeated/enum fields, fill in the form, and observe the hex preview panel at the bottom.
**Expected:** Hex bytes appear after interacting with form fields; all field kinds render correctly with proper controls; IncludePathDialog opens with "Configure include paths" title; selecting enum shows names, not numbers; datetime-local input appears for Timestamp fields.
**Why human:** Tauri desktop app cannot be smoke-tested headlessly in this environment; end-to-end rendering, IPC roundtrip, and visual correctness require a running app.

### 2. Debounce Timing Observation

**Test:** With the app running, type rapidly into a scalar text field and watch the hex preview panel.
**Expected:** Hex updates are gated behind a ~200ms pause. Consecutive keystrokes should not each fire an IPC call — only the final value after the pause triggers encoding. The fix replaces the previous broken ref-based debounce with a `useState` pipeline that correctly triggers re-renders.
**Why human:** Timing behavior (debounce gate vs. immediate fire) cannot be verified by static analysis alone; requires runtime observation to confirm the useEffect fires once after the debounce window, not on every keystroke.

---

## Re-verification Summary

**Previous status:** gaps_found (10/11, single gap: debounce gate was dead code)

**Gap closed by Plan 06:**

Truth #3 ("Changing a form field triggers a debounced encode call") previously failed because `FormPanel.tsx` used `useRef` for `latestValues` and called `useDebounce(latestValues.current, 200)`. Mutating `ref.current` does not trigger re-renders, so `useDebounce` never observed value changes. `encodeMessage` was called directly in `handleValuesChange` on every keystroke. `debouncedValues` was suppressed with `void debouncedValues`.

Plan 06 replaced the ref with `useState`: `const [latestValues, setLatestValues] = useState<unknown>(null)`. This means `setLatestValues(values)` in `handleValuesChange` triggers a re-render, `useDebounce(latestValues, 200)` observes the new value, and the `useEffect([debouncedValues])` fires after the debounce window to call `encodeMessage`. The dead-variable suppression and direct IPC call in the handler are both gone.

FormPanel.test.tsx adds fake-timer unit tests that verify `encodeMessage` is not called before 200ms and is called exactly once after the debounce window closes.

**Regressions:** None detected. All 41 vitest tests pass, 5/5 cargo tests pass, build exits 0.

---

_Verified: 2026-05-17T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
