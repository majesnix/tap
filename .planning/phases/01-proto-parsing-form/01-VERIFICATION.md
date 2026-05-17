---
phase: 01-proto-parsing-form
verified: 2026-05-17T00:00:00Z
status: gaps_found
score: 10/11 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Changing a form field triggers a debounced encode call and displays hex bytes in the bottom strip"
    status: failed
    reason: "debouncedValues is computed in FormPanel.tsx but never used; encodeMessage is called directly on every form change via handleValuesChange; the debounce gate is dead code"
    artifacts:
      - path: "src/components/form/FormPanel.tsx"
        issue: "useDebounce(latestValues.current, 200) reads a ref value that never triggers re-renders because mutating ref.current does not cause the hook to observe a new value; encodeMessage is called with raw values directly inside handleValuesChange; debouncedValues is suppressed with 'void debouncedValues' confirming it is a dead variable"
    missing:
      - "Wire debouncedValues to the encodeMessage call, OR use a useEffect that watches debouncedValues to trigger encoding, rather than calling encodeMessage directly in handleValuesChange"
---

# Phase 01: Proto Parsing & Dynamic Form — Verification Report

**Phase Goal:** Deliver a working local desktop app that lets a developer open a .proto file, select a message type, fill in a dynamic form covering ALL proto field kinds (scalar, nested, repeated, enum, oneof, well-known types), and see live binary-encoded hex output. No RabbitMQ connection yet.
**Verified:** 2026-05-17T00:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                               | Status      | Evidence                                                                                                                                  |
|----|-----------------------------------------------------------------------------------------------------|-------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| 1  | User can open a .proto file via native file picker                                                  | VERIFIED    | FileSection.tsx calls `open()` from `@tauri-apps/plugin-dialog`; triggers `parseProto` IPC; schema lands in useProtoStore                |
| 2  | Selecting a message type renders a dynamic form covering all 6 field kinds                          | VERIFIED    | ProtoFormRenderer.tsx dispatches on FieldKind: scalar, nested, repeated, enum, oneof, well_known — all 6 branches implemented             |
| 3  | Changing a form field triggers a debounced encode call and displays hex bytes in the bottom strip   | FAILED      | `debouncedValues` is computed but dead; `encodeMessage` called directly with `values` every change; debounce gate does not function       |
| 4  | ScalarField renders correct controls for all 16 proto scalar kinds with zod validation              | VERIFIED    | ScalarField.tsx: getInputType + getZodSchema helpers cover all 16 kinds; int64/uint64 as text; bytes shows badge; int32 range enforced    |
| 5  | NestedMessageField renders a collapsible sub-form and caps recursion at depth 5                     | VERIFIED    | NestedMessageField.tsx: Collapsible wrapper; `depth >= 5` returns DepthCapPlaceholder; tests confirm                                      |
| 6  | RepeatedField renders a list with Add and Remove controls using react-hook-form useFieldArray        | VERIFIED    | RepeatedField.tsx: useFieldArray; `key={rhfField.id}`; Add button appends default item; Remove is destructive with correct button         |
| 7  | EnumField shows value names to the user and stores the numeric value in form state                  | VERIFIED    | EnumField.tsx: displays `v.name`; `value={String(v.number)}`; `onValueChange={(s) => onChange(Number(s))}`                               |
| 8  | OneofField renders a RadioGroup to pick branch, unmounts other branches on change                   | VERIFIED    | OneofField.tsx: `useWatch` on `${path}._selected`; `unregister` called on branch change; flat path `${path}.${branchField.name}`         |
| 9  | WellKnownTypeField renders datetime-local for Timestamp and a regex-validated input for Duration    | VERIFIED    | WellKnownTypeField.tsx: `type="datetime-local"` for Timestamp; DURATION_PATTERN + placeholder for Duration; plain text fallback for others |
| 10 | Include paths are persisted per file and shown in IncludePathDialog                                 | VERIFIED    | FileSection.tsx loads key `include_paths:${filePath}` from tauri-plugin-store; IncludePathDialog title "Configure include paths" confirmed |
| 11 | Rust backend parses .proto files and encodes protobuf messages to binary bytes                      | VERIFIED    | 5/5 cargo tests pass; protox 0.9 + prost-reflect 0.16 in Cargo.toml; parse_proto and encode_message commands registered                   |

**Score:** 10/11 truths verified

---

## Required Artifacts

| Artifact                                                     | Expected                                      | Status      | Details                                                                                  |
|--------------------------------------------------------------|-----------------------------------------------|-------------|------------------------------------------------------------------------------------------|
| `src-tauri/src/commands/proto.rs`                            | parse_proto Tauri command                     | VERIFIED    | Exists; registers `parse_proto` command with protox Compiler + DescriptorPool            |
| `src-tauri/src/commands/encode.rs`                           | encode_message Tauri command                  | VERIFIED    | Exists; takes message type name + JSON values; returns bytes via prost-reflect            |
| `src-tauri/src/schema/extractor.rs`                          | ProtoSchema extraction from DescriptorPool    | VERIFIED    | Exists; extracts all field kinds; note: default_value always None (TS fallback handles it)|
| `src/components/form/ProtoFormRenderer.tsx`                  | Dispatch layer for all 6 field kinds          | VERIFIED    | Exists; MAX_DEPTH=5; dispatches scalar/nested/repeated/enum/oneof/well_known              |
| `src/components/form/FormPanel.tsx`                          | Form container with encode orchestration      | VERIFIED    | Exists and wires form to encode; debounce gate broken (see gap)                           |
| `src/components/form/fields/ScalarField.tsx`                 | All 16 scalar kinds, zod validation           | VERIFIED    | Exists; getInputType + getZodSchema cover all 16 kinds                                   |
| `src/components/form/fields/NestedMessageField.tsx`          | Collapsible sub-form, depth cap               | VERIFIED    | Exists; depth >= 5 check; DepthCapPlaceholder                                             |
| `src/components/form/fields/RepeatedField.tsx`               | useFieldArray list with add/remove            | VERIFIED    | Exists; useFieldArray; field.id key; Add + Remove buttons                                 |
| `src/components/form/fields/EnumField.tsx`                   | Name display, numeric storage                 | VERIFIED    | Exists; correct name/number bridge                                                        |
| `src/components/form/fields/OneofField.tsx`                  | RadioGroup branch selector with unregister    | VERIFIED    | Exists; useWatch + unregister; useMemo for branchNames                                    |
| `src/components/form/fields/WellKnownTypeField.tsx`          | Timestamp/Duration/fallback                   | VERIFIED    | Exists; datetime-local + DURATION_PATTERN + text fallback                                 |
| `src/components/sidebar/FileSection.tsx`                     | File picker + include path management         | VERIFIED    | Exists; tauri-plugin-dialog open(); tauri-plugin-store load/save                         |
| `src/components/include-paths/IncludePathDialog.tsx`         | Include path configuration dialog             | VERIFIED    | Exists; correct copywriting confirmed                                                     |
| `src/stores/useProtoStore.ts`                                | Zustand store with schema/messageType/hex     | VERIFIED    | Exists; filePath, schema, messageType, hexPreview, isEncoding, encodeError                |
| `src/lib/types.ts`                                           | FieldKind union, ProtoSchema, RenderFieldFn   | VERIFIED    | Exists; all types present and correct                                                     |
| `src/lib/ipc.ts`                                             | parseProto + encodeMessage invoke wrappers    | VERIFIED    | Exists; both wrappers present                                                             |
| `src/hooks/useDebounce.ts`                                   | Generic debounce hook                         | VERIFIED    | Exists; correct implementation; broken at callsite in FormPanel.tsx                      |

---

## Key Link Verification

| From                                  | To                                         | Via                                        | Status      | Details                                                                               |
|---------------------------------------|--------------------------------------------|--------------------------------------------|-------------|---------------------------------------------------------------------------------------|
| FileSection.tsx                       | parse_proto (Rust)                         | ipc.ts parseProto invoke                   | WIRED       | open() → parseProto → setSchema in useProtoStore                                      |
| FileSection.tsx                       | tauri-plugin-store                         | load()/save() on include_paths:${filePath} | WIRED       | Per-file key; load before parseProto; save on dialog confirm                          |
| FormPanel.tsx                         | encode_message (Rust)                      | ipc.ts encodeMessage invoke                | WIRED       | handleValuesChange → encodeMessage → setHexPreview (direct, not debounced)            |
| FormPanel.tsx                         | useDebounce hook                           | useDebounce(latestValues.current, 200)     | PARTIAL     | Hook called but debouncedValues never used; dead variable suppressed with void         |
| ProtoFormRenderer.tsx                 | ScalarField/NestedMessageField/etc.        | renderField RenderFieldFn prop             | WIRED       | renderField passed down; all 6 field kinds dispatched correctly                        |
| NestedMessageField.tsx                | useProtoStore                              | schema lookup by typeName                  | WIRED       | Reads schema directly from store (no schema prop — ProtoFormRenderer frozen without it)|
| EnumField.tsx                         | react-hook-form Controller                 | name={path}, value={String(v.number)}      | WIRED       | Name/number bridge correct                                                             |
| OneofField.tsx                        | react-hook-form unregister                 | unregister(${path}.${prev})                | WIRED       | Branch change triggers unregister of previous branch fields                           |

---

## Data-Flow Trace (Level 4)

| Artifact              | Data Variable  | Source                            | Produces Real Data | Status    |
|-----------------------|----------------|-----------------------------------|--------------------|-----------|
| FormPanel.tsx         | hexPreview     | encodeMessage IPC → Rust backend  | Yes (binary bytes) | FLOWING   |
| FormPanel.tsx         | debouncedValues| useDebounce(latestValues.current) | No — dead ref      | HOLLOW    |
| FileSection.tsx       | schema         | parseProto IPC → Rust backend     | Yes                | FLOWING   |
| ProtoFormRenderer.tsx | fields         | schema.messages[messageType]      | Yes                | FLOWING   |

---

## Behavioral Spot-Checks

| Behavior                                  | Command                                                                                           | Result | Status |
|-------------------------------------------|---------------------------------------------------------------------------------------------------|--------|--------|
| Rust cargo tests pass                     | `cargo test --manifest-path src-tauri/Cargo.toml 2>&1 \| grep -E "test result"`                  | 5/5 ok | PASS   |
| Frontend vitest tests pass                | `npm run test -- --run 2>&1 \| grep -E "Tests \|passed\|failed"`                                  | 39/39  | PASS   |
| Frontend build succeeds                   | `npm run build 2>&1 \| tail -3`                                                                   | exit 0 | PASS   |
| useDebounce.ts exists and is substantive  | Read src/hooks/useDebounce.ts                                                                     | 18 lines, full impl | PASS |
| debouncedValues is dead in FormPanel.tsx  | grep `void debouncedValues` src/components/form/FormPanel.tsx                                    | found  | FAIL   |

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
| FORM-07     | 01-01-PLAN  | Default values pre-populated on message type selection                | SATISFIED   | buildDefaultValues in ProtoFormRenderer.tsx provides type-correct zero defaults; Rust extractor always returns None for default_value but TS fallback satisfies observable behavior |
| FORM-08     | 01-03-PLAN  | Depth cap on nested messages (max 5 levels)                           | SATISFIED   | NestedMessageField.tsx: depth >= 5 → DepthCapPlaceholder; ProtoFormRenderer depth > MAX_DEPTH (5) → text |
| FORM-09     | 01-05-PLAN  | Well-known types: Timestamp and Duration have specialized controls    | SATISFIED   | WellKnownTypeField.tsx: datetime-local for Timestamp; DURATION_PATTERN for Duration; fallback for rest |

---

## Anti-Patterns Found

| File                                     | Line  | Pattern                                        | Severity | Impact                                                                                      |
|------------------------------------------|-------|------------------------------------------------|----------|---------------------------------------------------------------------------------------------|
| src/components/form/FormPanel.tsx        | 20-21 | `useDebounce(latestValues.current, 200)`       | BLOCKER  | Reads ref.current at render time; ref mutations do not trigger re-renders; hook sees stale value |
| src/components/form/FormPanel.tsx        | 44    | `void debouncedValues;`                        | BLOCKER  | Explicit dead-variable suppression; debounce gate acknowledged as non-functional in code    |
| src/components/form/FormPanel.tsx        | 32    | `encodeMessage(selectedMessageType, values)`   | WARNING  | Calls encode directly on every form change with no throttling; may cause excessive IPC calls |
| src-tauri/src/schema/extractor.rs        | 87,115| `default_value: None` (hardcoded)              | INFO     | Never reads FieldDescriptor.default_value() from prost-reflect; TS fallback compensates, but Rust side is incomplete |

---

## Human Verification Required

### 1. Full App Smoke Test

**Test:** Run `npm run tauri dev`, open the app, select a `.proto` file with nested/oneof/repeated/enum fields, fill in the form, and observe the hex preview panel at the bottom.
**Expected:** Hex bytes appear after interacting with form fields; all field kinds render correctly with proper controls; IncludePathDialog opens with "Configure include paths" title; selecting enum shows names, not numbers; datetime-local input appears for Timestamp fields.
**Why human:** Tauri desktop app cannot be smoke-tested headlessly in this environment; end-to-end rendering, IPC roundtrip, and visual correctness require a running app.

### 2. Debounce Behavior Observation

**Test:** With the app running, type rapidly into a scalar text field and watch the hex panel and network/IPC activity.
**Expected:** Hex updates should be gated behind a 200ms pause (debounce). Currently the code fires on every keystroke with no throttle.
**Why human:** Timing behavior (debounce vs. immediate) cannot be verified by static analysis alone; requires runtime observation.

---

## Gaps Summary

**1 blocker gap** was found against the 11 observable truths derived from the phase goal and plan frontmatter must-haves.

**Debounce gate is dead code (BLOCKER)**

`FormPanel.tsx` attempts to debounce encode calls via `useDebounce`, but the implementation is structurally broken. The hook receives `latestValues.current` — the snapshot of a ref's `.current` at render time. Mutating a ref via `latestValues.current = values` does NOT trigger a re-render, so `useDebounce` never observes value changes. The `debouncedValues` variable is never referenced in the encoding path; `encodeMessage` is called directly with `values` on every form change. The dead variable is explicitly suppressed with `void debouncedValues` and a comment acknowledging it "drives future optimization."

The effect: every keystroke fires an IPC call to the Rust backend with no throttling. The debounce success criterion in plan 01-01 ("hex preview strip shows encoded bytes after 200ms debounce") is not met.

**Root cause options to fix:**
- Option A: Replace `useDebounce(latestValues.current, 200)` with `useDebounce(watchedValues, 200)` where `watchedValues` comes from `useWatch(...)` (triggers re-renders), then use `debouncedValues` inside a `useEffect` to call `encodeMessage`.
- Option B: Remove the ref pattern entirely; use `useWatch` for the form values, feed directly into `useDebounce`, and call `encodeMessage` inside `useEffect([debouncedValues])`.

**No other blockers.** All 10 remaining truths are verified with substantive implementations, correct wiring, and confirmed test coverage (39 frontend tests, 5 Rust tests, successful build).

---

## Deferred Items

None. All items were either verified or flagged as gaps requiring closure in this phase.

---

_Verified: 2026-05-17T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
