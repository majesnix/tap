---
phase: 07-mapfield
verified: 2026-05-19T10:00:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Send a message containing a map<string, EnumType> field with at least one entry where the value is a non-zero enum variant. Confirm the binary message received in RabbitMQ decodes to the correct enum number."
    expected: "Enum-valued map entries encode to the correct wire-format EnumNumber — non-zero enum variants are not silently coerced to 0."
    why_human: "The Kind::Enum branch in scalar_or_message_value (encode.rs:271) has no unit test. scalar_or_message_value_for_map_entry delegates to it in one line (line 214), so the path is reachable, but no test (unit or integration) and no documented live-app step in Plan 07-04 covers map<K, EnumType>. The 07-04 SUMMARY Step 6 references 'sub-renderers per value type' (frontend rendering) not Rust encoder enum-value correctness."
  - test: "Send a message containing a map<string, MessageType> field with at least one entry where the value message has a non-empty nested field. Confirm the binary message received in RabbitMQ decodes to the correct nested message."
    expected: "Message-valued map entries encode correctly as nested DynamicMessages — the entry's value field is not silently dropped or encoded as an empty message."
    why_human: "test_nested_message_encoding (encode.rs:470) exercises Kind::Message through populate_message, but not through the scalar_or_message_value_for_map_entry -> scalar_or_message_value -> Kind::Message path with a map entry descriptor. The 07-04 human verification log states Step 6 passed but does not document which value types (enum, message, scalar) were specifically exercised."
---

# Phase 7: MapField Verification Report

**Phase Goal:** Users can add, edit, and remove entries for `map<K, V>` proto fields, which render as typed key-value rows and encode as binary protobuf wire format
**Verified:** 2026-05-19
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | User can add and remove rows for a `map<K, V>` field via Add/Remove buttons — the field does not render as a nested message sub-form | VERIFIED | `MapField.tsx` uses `useFieldArray` with `append`/`remove`. `ProtoFormRenderer.tsx:155` pre-dispatch branch routes `kind.type === "map"` to `MapField` before the switch. `extractor.rs:110` `is_map()` guard prevents map fields from falling through to `Kind::Message`. `extract_field_schema` sets `repeated: false` (line 126) so `ProtoFormRenderer:217` does NOT wrap in `RepeatedField`. Tests 2 and 3 in `MapField.test.tsx` confirm add/remove row behavior (7/7 passing). |
| 2 | User sees the key input constrained to the declared key type (numeric input for int32/int64/etc., text for string, checkbox/select for bool) | VERIFIED | `MapField.tsx:204–243`: key input dispatched by `key_type` — `is32BitInt()` → `type="number"`, `is64BitInt()` → `type="text"` with regex pattern, `"bool"` → shadcn `Select` with "true"/"false" options. Test 5 (`renders bool key as Select`) passes. Human verification Step 4 confirmed in live app. |
| 3 | User sees an inline duplicate-key error and the send button is blocked until all keys in the map are unique | VERIFIED | `MapField.tsx:104–131`: `useWatch + useMemo` detects duplicate keys; `setError/clearErrors` on `${path}.__mapDuplicateGuard`; hidden `Controller` with `hasDuplicatesRef.current` validate rule keeps `formState.isValid` false. Tests 4, 6, 7 all pass. Human verification Step 5 confirmed. |
| 4 | User can fill in map values using the same renderers as the rest of the form — scalar, enum, and nested message value types all work | ? UNCERTAIN | `MapField.tsx:248`: `renderValue(valueFieldSchema, valuePath, depth + 1)` delegates value rendering to `ProtoFormRenderer.renderField` — the same dispatcher used for all other fields. `scalar_or_message_value_for_map_entry` (encode.rs:205-215) delegates to `scalar_or_message_value` (line 214), which handles `Kind::Enum` (line 271) and `Kind::Message` (line 289). The scalar path is unit-tested (test_encode_map_string_key_scalar_value). The message path through `scalar_or_message_value` is indirectly covered by `test_nested_message_encoding`. The **enum** path in the map encoder has no unit test. The 07-04 SUMMARY Step 6 documents "Correct sub-renderers per value type" as passed but does not specify which value types (scalar, enum, or message) were exercised in the live-app run — "sub-renderers" refers to the React rendering layer, not the Rust encoder. Cannot confirm from codebase evidence alone that enum-valued or message-valued map entries encode correctly end-to-end. |
| 5 | A `map<K, V>` field with entries encodes correctly as binary protobuf wire format when sent (Value::Map path in encode.rs, not Value::List) | VERIFIED | `encode.rs:111–130`: `is_map()` guard precedes `is_list()` (confirmed by line numbers 111 vs 132); `Value::Map(HashMap<MapKey, Value>)` used. `json_to_map_key` covers all proto3 scalar key types. 4 Rust unit tests pass: `test_encode_map_string_key_scalar_value`, `test_encode_map_int32_key`, `test_encode_map_bool_key_as_string`, `test_encode_map_empty_array`. Human verification Step 7 confirmed binary message received in RabbitMQ. |

**Score:** 4/5 truths verified (Truth 4 is UNCERTAIN — requires human verification)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/schema/types.rs` | `FieldKind::Map { key_type: ScalarKind, value_kind: Box<FieldKind> }` variant | VERIFIED | Line 35: `Map { key_type: ScalarKind, value_kind: Box<FieldKind> }` present with correct serde tagging |
| `src-tauri/src/schema/extractor.rs` | `is_map()` guard before `is_list()` in `extract_field_schema` | VERIFIED | Line 110: `if field.is_map()` guard; line 132: `let repeated = field.is_list()` — ordering confirmed. Line 31: `is_map_entry()` filter in `extract_schema`. |
| `src-tauri/src/commands/encode.rs` | `Value::Map(HashMap<MapKey, Value>)` path + `json_to_map_key` + 4 unit tests | VERIFIED | Line 111: `if field.is_map()` guard; line 127: `Value::Map(map)`; lines 161–201: `json_to_map_key`; lines 523–583: 4 unit tests. `MapKey` imported at line 3. `scalar_or_message_value_for_map_entry` (lines 205-215) delegates to `scalar_or_message_value` for all value kinds including enum and message. |
| `src/lib/types.ts` | `{ type: "map"; key_type: ScalarKind; value_kind: FieldKind }` union member | VERIFIED | Line 26: `\| { type: "map"; key_type: ScalarKind; value_kind: FieldKind }` — recursive self-reference correct. |
| `src/components/form/ProtoFormRenderer.tsx` | Pre-dispatch `if (field.kind.type === "map")` branch + `case "map"` in buildDefaultValues | VERIFIED | Line 155: `if (field.kind.type === "map")` branch; line 11: `MapField` import; line 79: `case "map": defaults[field.name] = [];` |
| `src/components/form/fields/MapField.tsx` | Full component — useFieldArray rows, key dispatch, duplicate detection, hidden guard, renderValue prop | VERIFIED | Full 293-line implementation. All 7 TDD tests pass. No stub patterns — implementation is complete. |
| `src/components/form/__tests__/MapField.test.tsx` | 7 test cases covering all MFLD requirements | VERIFIED | 7 tests present, all passing (confirmed by `npx vitest run` output: PASS 7, FAIL 0). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `extractor.rs` | `types.rs` | `FieldKind::Map { key_type, value_kind: Box::new(value_kind) }` | WIRED | Line 125 constructs the Map variant correctly |
| `ProtoFormRenderer.tsx` | `MapField.tsx` | `if (field.kind.type === "map") return <MapField ...>` | WIRED | Line 155–165; import at line 11; `renderValue={renderField}` prop passed |
| `encode.rs` | `prost_reflect::Value::Map` | `dyn_msg.set_field(field, Value::Map(map))` | WIRED | Line 127; `MapKey` imported; `HashMap<MapKey, Value>` used |
| `extractor.rs` field guard | Prevents double-wrap | `repeated: false` set explicitly on map FieldSchema | WIRED | Line 126 sets `repeated: false`; ProtoFormRenderer line 217 `field.repeated` check does NOT route map fields to RepeatedField |
| `MapField.tsx` | `renderField` dispatcher | `renderValue(valueFieldSchema, valuePath, depth + 1)` | WIRED | Line 248; synthetic `FieldSchema` with correct `value_kind` passed |
| `types.ts` | `src-tauri/src/schema/types.rs` | serde discriminant `type: "map"` matches TypeScript `type: "map"` | WIRED | Rust: `#[serde(tag = "type", rename_all = "snake_case")]` on `FieldKind` → `map`; TypeScript line 26: `type: "map"` |
| `encode.rs` `scalar_or_message_value_for_map_entry` | `scalar_or_message_value` | Single delegation at line 214 | WIRED | `scalar_or_message_value_for_map_entry` does no branching of its own — it retrieves the `map_entry_value_field` and calls `scalar_or_message_value` directly. Enum and message paths are reachable. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `MapField.tsx` | `rows` (via `useWatch`) | `useFieldArray` state, driven by user Add/Remove and `ProtoFormRenderer.renderField` form values | Yes — rows flow from form state initialized to `[]` (buildDefaultValues line 79), populated by `append` on user action | FLOWING |
| `encode.rs` `set_field_value` map branch | `map` (HashMap) | `json_val` from IPC form values; populated from `json_to_map_key` + `scalar_or_message_value_for_map_entry` | Yes for scalar values — Rust unit tests confirm non-empty `Vec<u8>` for string and int32 keyed map fields. Enum/message value paths reachable but not directly tested. | FLOWING (scalar confirmed; enum/message: UNCERTAIN) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 7 MapField tests pass | `npx vitest run src/components/form/__tests__/MapField.test.tsx` | PASS (7) FAIL (0) | PASS |
| 20 Rust tests pass (including 4 map tests) | `cargo test` in src-tauri | 20 passed (3 suites, 0.00s) | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | No errors found | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|------------|------------|-------------|--------|---------|
| MFLD-01 | 07-01, 07-02, 07-03 | User can add and remove key-value row entries for a `map<K, V>` field | SATISFIED | `MapField.tsx` useFieldArray; Add/Remove buttons; tests 2 and 3 pass; human Step 3 approved |
| MFLD-02 | 07-01, 07-02, 07-03 | User sees key input constrained to declared proto key type | SATISFIED | `MapField.tsx` key type dispatch (32-bit int → number, 64-bit → text+regex, bool → Select); test 5 passes; human Step 4 approved |
| MFLD-03 | 07-03 | User sees inline duplicate-key error and cannot send until all keys are unique | SATISFIED | Hidden `__mapDuplicateGuard` Controller; `setError/clearErrors` in useEffect; tests 4, 6, 7 pass; human Step 5 approved |
| MFLD-04 | 07-01, 07-02, 07-03 | User can fill in map values using the same field renderers as the rest of the form | NEEDS HUMAN | React rendering layer is confirmed (renderValue delegates to renderField). Rust encoder's enum-value and message-value paths in map context are structurally reachable but not confirmed by test or documented live-app exercise. |
| MFLD-05 | 07-01 | User's map field encodes correctly as binary protobuf wire format when sent | SATISFIED | `encode.rs` `Value::Map(HashMap<MapKey, Value>)` path; 4 Rust unit tests pass; `is_map()` guard precedes `is_list()` guard; human Step 7 confirmed binary receipt in RabbitMQ |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|---------|--------|
| `MapField.tsx` | 247 | `renderValue` called with `depth + 1` | INFO | Correct recursion guard — no issue, noting for completeness |

### Human Verification Required

#### 1. Enum-valued map field encoding

**Test:** Load a `.proto` file that defines a message with a `map<string, EnumType>` field (where `EnumType` has at least 2 values). Fill in one map entry selecting a non-zero enum variant as the value. Click Send.

**Expected:** The binary message received in RabbitMQ decodes to the correct enum number — the non-zero variant is not coerced to 0.

**Why human:** The `Kind::Enum` branch in `scalar_or_message_value` (encode.rs:271) is the code path executed for map enum values via `scalar_or_message_value_for_map_entry`. This branch has no unit test. No documented live-app exercise in Plan 07-04 SUMMARY covers a map with an enum value type.

#### 2. Message-valued map field encoding

**Test:** Load a `.proto` file that defines a message with a `map<string, MessageType>` field (where `MessageType` has at least one non-empty string field). Fill in one map entry with a non-empty nested message as the value. Click Send.

**Expected:** The binary message received in RabbitMQ decodes to the correct nested message — the nested fields are not dropped or encoded as an empty message.

**Why human:** `scalar_or_message_value_for_map_entry` (encode.rs:205-215) retrieves the entry's value field descriptor via `map_entry_value_field()` and delegates to `scalar_or_message_value`. `test_nested_message_encoding` covers `Kind::Message` through `populate_message` but not through the map entry descriptor path. The 07-04 SUMMARY documents Step 6 as "Correct sub-renderers per value type" but does not specify that a message-valued map was exercised.

### Gaps Summary

No hard gaps (no FAILED truths, no missing or stub artifacts). One truth is UNCERTAIN (Truth 4), blocked by missing test and documentation evidence for enum-valued and message-valued map entries in the Rust encoder.

**Root cause:** The 07-04 human verification plan covered MFLD-04 at the React rendering layer ("correct sub-renderers per value type") without explicitly exercising the Rust encoder's enum/message value paths through the map entry descriptor.

**Resolution path:** Run the two human verification checks above. If both pass, update Truth 4 to VERIFIED, requirements MFLD-04 to SATISFIED, and status to `passed`.

---

_Verified: 2026-05-19T10:00:00Z_
_Verifier: Claude (gsd-verifier)_
