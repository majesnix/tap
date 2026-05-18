# Research Summary: Proto Sender v1.2 Form Improvements

**Synthesized:** 2026-05-19
**Milestone:** v1.2 — BytesField upgrade (FORM-V2-01), MapField (FORM-V2-02), JSON override toggle (FORM-V2-03)
**Source files:** STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md
**Overall confidence:** HIGH — all critical API contracts verified against docs.rs, protobuf.dev, and npm registry

---

## Stack Additions

| Feature | New npm packages | New Rust crates |
|---------|-----------------|-----------------|
| BytesField (FORM-V2-01) | None — native TextEncoder/btoa handles UTF-8 to base64; existing base64 0.22 handles Rust decode | None |
| MapField (FORM-V2-02) | None — useFieldArray (react-hook-form 7.76, already present) handles {key, value}[] rows; prost-reflect Value::Map and MapKey already available | None |
| JSON Override (FORM-V2-03) | @uiw/react-codemirror ^4.25.9 + @codemirror/lang-json ^6.0.x (~60 KB gzip combined) | None — prost-reflect serde feature already enabled in Cargo.toml |

Two out of three features add zero new dependencies. The single new dependency family (@uiw/react-codemirror) is justified: a plain textarea is not acceptable for a developer-tool JSON editor.

**Rejected packages:** js-base64 (two-line native helper is sufficient), Monaco (~2 MB, overkill), react-ace (older CM5 generation), @uiw/codemirror-themes (built-in light/dark strings cover the need), immer (speculative), any proto-specific validation library.

**Version constraints:**
- @uiw/react-codemirror must be v4.x (CodeMirror 6); v3.x uses CM5 and has an incompatible API
- @codemirror/lang-json must be ^6.0.x to match the wrapper
- Zod bytes regex must use standard base64 alphabet (+ /), not URL-safe (- _) — prost-reflect outputs standard base64 with padding

---

## Feature Table Stakes

### BytesField (FORM-V2-01) — Complexity: Low

| Behavior | Requirement |
|----------|-------------|
| Default input is base64 text | Proto3 JSON spec canonical mapping; every proto-aware tool uses base64 |
| Validate as legal standard base64 on blur | Reject chars outside [A-Za-z0-9+/=]; catch URL-safe input before it reaches Rust |
| Show byte count (decoded length) | "14 bytes" closes the feedback loop; confirms base64 decoded correctly |
| Empty string is valid | Proto3 default for bytes is empty — zero-length input must not be an error |
| Label field clearly as "base64 (standard)" | Users who type plain text get silent data corruption without this contract |
| UTF-8 helper is one-way only | Convert text to base64 on click; never auto-decode back (arbitrary bytes are not valid UTF-8) |

### MapField (FORM-V2-02) — Complexity: Medium

| Behavior | Requirement |
|----------|-------------|
| Dynamic key-value row list | Only UX that communicates map semantics; a flat repeated list or textarea is unusable |
| Add row / Remove row per entry | Mirror of existing RepeatedField interaction pattern |
| Key input typed by declared key type | int32/uint32/etc. get numeric input; string gets text; bool gets select |
| Value input typed by declared value type | Render correct widget recursively (scalar, enum, nested message) |
| Duplicate key warning inline | Last-key-wins per spec; user sees both rows but only last survives — must warn before submit |
| Empty map is valid | Proto3 default is empty map; zero rows must not be an error |
| Store rows as Array<{key, value}>, not Record<K,V> | JavaScript object semantics silently deduplicate identical keys in a Record |

### JSON Override Toggle (FORM-V2-03) — Complexity: High

| Behavior | Requirement |
|----------|-------------|
| Toggle switches between form view and JSON editor | One click in, one click out; form hidden while in JSON mode |
| Form to JSON on entering JSON mode | Serialize getValues() snapshot at toggle time using proto3 JSON rules |
| JSON to form uses reset(), not setValue() | setValue bypasses useFieldArray internal refs; row counts do not update |
| Invalid JSON blocks exit with inline error | Show error, offer "Fix JSON" or "Discard changes" — never silently discard |
| JSON editor has syntax highlighting | CodeMirror 6 via @uiw/react-codemirror; error markers for syntax errors |
| Schema-mismatch warning on exit | Warn about unknown field names; load recognized fields only |
| Snapshot uses getValues() not watch() | watch() subscription rewrites textarea mid-edit; read once on toggle |

**Proto3 JSON encoding rules the JSON toggle must implement:** int64/uint64 as quoted strings, bytes as standard base64, enums as named strings, map integer keys as string keys (e.g. {"42": "hello"}), omit fields at proto3 default value, lowerCamelCase field names, oneof emits only the active branch.

---

## Architecture Highlights

### New Components (net-new files)

| Component | File | Description |
|-----------|------|-------------|
| BytesField | src/components/form/fields/BytesField.tsx | Extracted from ScalarField bytes dispatch; adds base64 regex validation, UTF-8 helper button, byte count display |
| MapField | src/components/form/fields/MapField.tsx | useFieldArray over {key, value}[]; two-column layout; inline duplicate key detection |
| JsonOverlay | src/components/form/JsonOverlay.tsx | CodeMirror editor; toggle state; Apply button for JSON to form sync; last-valid-snapshot tracking |

### Modified Components (surgical changes only)

| File | Change |
|------|--------|
| src/lib/types.ts | Add { type: "map"; key_kind: MapKeyKind; value_kind: FieldKind } to FieldKind union; add MapKeyKind type (6 allowed key scalars only) |
| src/components/form/fields/ScalarField.tsx | Add case "bytes" branch that delegates to BytesField instead of the current z.string() fallthrough |
| src/components/form/ProtoFormRenderer.tsx | Add case "map" branch before the repeated check — map fields appear repeated in the descriptor but must be handled separately |
| src/components/form/FormPanel.tsx | Add toggle state (form / json mode); integrate JsonOverlay; use resetRef.current(parsed) for JSON to form sync |

### Rust Backend Impact — MapField Only

BytesField and JSON Override require zero Rust changes. MapField requires three coordinated Rust file edits:

| File | Change |
|------|--------|
| src-tauri/src/schema/types.rs | Add Map { key_kind: ScalarKind, value_kind: FieldKind } variant to FieldKind enum |
| src-tauri/src/schema/extractor.rs | Call field.is_map() before field.is_list() in extract_field_kind(); extract entry descriptor key/value field descriptors |
| src-tauri/src/encode.rs | Handle is_map() in set_field_value(): build HashMap<MapKey, Value> and set as Value::Map |

All prost-reflect 0.16.3 APIs needed are verified: FieldDescriptor::is_map(), Value::Map(HashMap<MapKey, Value>), and MapKey variants (Bool, I32, I64, U32, U64, String).

---

## Watch Out For

### 1. No Map FieldKind variant in schema/types.rs (architectural blocker for MapField)

Without a Map variant, extract_field_kind() falls through to FieldKind::Message with the synthetic entry type name (e.g. MyMessage.LabelsEntry). The form renders a confusing nested sub-form. The encode path builds Value::List instead of Value::Map, producing incorrect wire format.

**Prevention:** Add FieldKind::Map to types.rs and call field.is_map() before field.is_list() in the extractor. Treat all four touch points (Rust types, Rust extractor, Rust encoder, React renderer) as a single unit — partial changes in any one produce misleading behavior.

### 2. URL-safe base64 silently encodes as empty bytes (BytesField — data corruption, no error shown)

encode.rs currently calls base64::engine::general_purpose::STANDARD.decode(s).unwrap_or_default(). URL-safe base64 (- and _ characters, common from JWT payloads and web APIs) fails the standard decoder; unwrap_or_default() returns Vec::new() — silent zero-length bytes with no user-facing error.

**Prevention:** Add a Zod regex on the bytes field that accepts only standard base64. This catches URL-safe input before the IPC call. Also remove the silent unwrap_or_default() — surface decode failures as field errors over IPC.

### 3. Map rows stored as Record<K,V> silently deduplicates keys (MapField — data loss invisible in UI)

If MapField stores rows as a plain JavaScript object, {"a": 1, "a": 2} collapses to {"a": 2}. Both rows remain visible in the UI but only the last survives in form state. The user submits expecting two entries; the consumer receives one.

**Prevention:** Store map rows as Array<{ key: ...; value: unknown }> using useFieldArray. At submit time, serialize to a record and check explicitly for duplicate keys. Block submit with an inline error ("Duplicate key: 'foo'") rather than silently deduplicating.

### 4. setValue() breaks useFieldArray row count on JSON to form sync (JSON Override — invisible state mismatch)

useFieldArray maintains an internal fields ref with injected id values. setValue('fieldName', array) updates the underlying RHF store but does not update the internal ref. After setValue-based sync, the store has the correct array length but the rendered row count shows the pre-sync value.

**Prevention:** Use reset(parsedValues) to sync JSON to form. reset() reinitializes the entire form including all useFieldArray internal refs. The tradeoff — touched/dirty/error state is cleared — is acceptable and correct for an explicit user-initiated mode switch.

### 5. Schema-invalid JSON fields silently drop from the encoded message (JSON Override — data loss with no warning)

JSON.parse() succeeds on syntactically valid JSON containing field names absent from the proto schema. reset(parsedValues) places unknown keys in form state; encode.rs iterates msg_desc.fields() and ignores any JSON keys without a matching field descriptor. The user sees their typed value in the form but the encoded message omits it.

**Prevention:** After JSON.parse, walk the top-level keys of the parsed object against msg_desc.fields() names. Warn about any unknown key before applying ("Field 'user_name' not found — did you mean 'username'?"). Do not block apply on warnings — surface the discrepancy and let the developer proceed.

---

## Build Order

**Recommended sequence: BytesField → MapField → JSON Override**

This order is forced by two converging constraints: ascending complexity (Low → Medium → High) and explicit feature dependencies — JSON Override must correctly round-trip all form field types including bytes (base64 encoding) and map (string-quoted integer keys), so both predecessor features must be complete first.

### Phase 1 — BytesField (FORM-V2-01)

**Rationale:** Lowest complexity, zero new dependencies, zero Rust changes, self-contained to one component. Ships immediate user value. Establishes the base64 alphabet convention (standard, with padding) that the JSON Override relies on for round-trip correctness.

**Delivers:** Base64 regex validation, byte count display, UTF-8 helper button (one-way: text to base64), protection against URL-safe input silent failure.

**Pitfalls to avoid:** #14 (URL-safe silent failure), #15 (one-way UTF-8 helper — no decode-to-text), #16 (alphabet consistency between form, history replay, and JSON output).

### Phase 2 — MapField (FORM-V2-02)

**Rationale:** Medium complexity. Requires coordinated changes across three Rust files and two React files plus one new component. Must be implemented as a single cohesive phase — a Rust-only or React-only partial change produces misleading rendering (map fields shown as nested message forms) or incorrect wire encoding.

**Delivers:** Full map field support — add/remove rows, typed key input, typed value input (recursive for message values), inline duplicate key warning, correct wire encoding via Value::Map.

**Pitfalls to avoid:** #17 (add FieldKind::Map first — architectural blocker), #18 (array-not-record storage), #19 (key type restrictions — only 6 valid key scalars), #20 (show UI hint that ordering is not preserved).

### Phase 3 — JSON Override Toggle (FORM-V2-03)

**Rationale:** Highest complexity. Explicitly depends on BytesField (base64 encoding in JSON) and MapField (map to JSON object with string-quoted integer keys) being complete. The FormPanel.tsx integration points (resetRef, pendingReplayValues) and the prost-reflect serde feature are already in place.

**Delivers:** CodeMirror-based JSON editor, bidirectional form to JSON sync, full proto3 JSON encoding rule coverage, invalid JSON error handling with explicit user choices, schema-mismatch warnings on field names.

**Pitfalls to avoid:** #21 (reset() not setValue() for array fields), #22 (stale state on invalid JSON exit — store last-valid snapshot on every valid keystroke), #23 (schema-invalid JSON silent drops — validate top-level key names), #24 (getValues() not watch() for the form-to-JSON snapshot).

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack — no new deps for BytesField and MapField | HIGH | Value::Bytes, Value::Map, MapKey all in prost-reflect 0.16.3; base64 0.22 already in Cargo.toml; useFieldArray already in use |
| Stack — @uiw/react-codemirror for JSON editor | HIGH | v4.25.9 confirmed on GitHub releases March 2025; CodeMirror 6 wrapper; built-in light/dark themes |
| BytesField behavior | HIGH | Proto3 JSON spec verified; existing codebase confirms ScalarField dispatch pattern and base64::STANDARD usage |
| MapField behavior | HIGH | is_map(), is_map_entry(), Value::Map, MapKey all verified on docs.rs; key type restrictions verified against proto3 spec |
| JSON Override behavior | HIGH | Proto3 JSON canonical spec verified; react-hook-form reset() vs setValue() behavior documented in official RHF docs |
| Rust encode.rs impact for MapField | HIGH | Source code verified: unwrap_or_default() on base64 decode confirmed; is_map() call absent from extractor confirmed |
| JSON Override two-way sync edge cases | MEDIUM | Complex interaction surface; oneof _selected roundtrip, int64 string keys in maps, and WKT string representations all require careful testing |

**Gaps to validate during implementation:**
- Confirm FormPanel.tsx resetRef.current() signature accepts the parsed JSON shape from the JSON to form path
- Confirm buildDefaultValues behavior for map fields (what default does a zero-row map produce in RHF?)
- Test oneof _selected state roundtrip through the JSON serializer and parser before closing FORM-V2-03

---

## Sources (aggregated)

- prost-reflect 0.16.3 — Value::Map, MapKey, FieldDescriptor::is_map(): https://docs.rs/prost-reflect/0.16.3/prost_reflect/
- prost-reflect SerializeOptions (serde feature): https://docs.rs/prost-reflect/latest/prost_reflect/struct.SerializeOptions.html
- Proto3 JSON mapping spec (bytes, maps, int64, enums, WKT): https://protobuf.dev/programming-guides/json/
- Proto3 map key type restrictions: https://protobuf.dev/programming-guides/proto3/#maps
- RFC 4648 — Base64 standard alphabet: https://datatracker.ietf.org/doc/html/rfc4648
- @uiw/react-codemirror v4.25.9: https://github.com/uiwjs/react-codemirror/releases
- react-hook-form useFieldArray + setValue limitation: https://react-hook-form.com/docs/usefieldarray
- react-hook-form reset(): https://react-hook-form.com/docs/useform/reset
- base64 crate 0.22 STANDARD engine: https://docs.rs/base64/latest/base64/engine/general_purpose/constant.STANDARD.html
- Existing codebase: src/components/form/fields/ScalarField.tsx, RepeatedField.tsx, FormPanel.tsx, src-tauri/src/encode.rs, src-tauri/src/schema/extractor.rs, src-tauri/src/schema/types.rs
