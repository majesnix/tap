# Pitfalls Research: Proto Sender

**Domain:** Tauri 2.x desktop app — runtime proto parsing, dynamic forms, AMQP publishing
**Researched:** 2026-05-17
**Overall confidence:** HIGH (all critical pitfalls have primary-source evidence)

---

## Critical Pitfalls (will block the project)

### 1. Using prost for runtime proto parsing

**What goes wrong:**
The default Rust protobuf workflow uses `prost` + `build.rs` codegen — types are generated at compile time. The official prost README explicitly states: _"Prost does not include support for runtime reflection or message descriptors."_ Building a dynamic form renderer on top of prost codegen is architecturally impossible without a separate reflection layer.

**Why it happens:**
`prost` is the most prominent Rust protobuf crate in documentation and tutorials. Developers reach for it first without checking whether it supports the runtime-dynamic mode this project requires.

**Consequences:**
Complete rewrite of the proto layer if you start with `prost` alone. Every form field renderer and encoder has to be rebuilt around a different type model.

**Prevention:**
Use `protox` (pure-Rust compiler, replaces the `protoc` binary) combined with `prost-reflect` (reflection + `DynamicMessage`). `prost-reflect` extends prost with a `DescriptorPool` API for runtime type introspection and a `DynamicMessage` type for encoding/decoding without compile-time type definitions.

**Detection:**
If your proto parsing code returns strongly-typed Rust structs rather than a descriptor pool you can query at runtime, you are on the wrong path.

**Sources:** prost README ("Prost does not include support for runtime reflection or message descriptors"); prost-reflect docs.rs; protox GitHub.

---

### 2. Import resolution: proto files that import other proto files

**What goes wrong:**
The proto compiler resolves imports relative to a configured set of root paths (equivalent to protoc's `-I` / `--proto_path` flags). When the user loads `order.proto` which imports `common/types.proto`, the compiler needs to know the root directory to search from. If your import resolver uses the directory of the loaded file rather than a user-configured include path, imports that cross directories silently fail or produce confusing "file not found" errors.

A secondary issue documented in prost-reflect's changelog (v0.12.0): the library now validates that all referenced types are in the declared dependency files. Files using `import public` that were silently passing before will be rejected — a breaking behaviour change that surfaced as seemingly valid files being rejected.

**Why it happens:**
Developers hardcode the directory of the dropped proto file as the only search root, not anticipating that real projects have a directory hierarchy with a single root.

**Consequences:**
Users cannot load any proto file that imports another proto file (which is almost all production protos). The feature becomes unusable for real codebases.

**Prevention:**
Present the user with a separate "include paths" configuration UI (analogous to protoc's `-I` flag). Allow adding multiple include directories. Resolve imports by searching these directories in order. Well-known types (`google/protobuf/*.proto`) must be bundled with the app and always available on the include path — `protox` bundles these automatically.

**Detection:**
Test with any proto file containing an `import` statement at the top.

**Phase:** Proto parsing phase (foundational — design the include-path model before building the file picker).

---

### 3. Circular / recursive message types cause infinite recursion in form generation

**What goes wrong:**
Protobuf explicitly supports recursive message types (e.g., a tree node with optional child nodes of the same type). The wire format handles this fine because each sub-message is `optional` — a `null` terminates the recursion. But a naive form generator that walks the descriptor tree to build React components has no termination condition and will call itself infinitely.

The bug pattern: the descriptor tree represents _types_, not values. There is no depth limit implied by the schema itself — only runtime data has a natural depth. A renderer that treats "this field's type is message X" as "render an expanded form for X inline" will recurse forever. This is a well-documented class of problem with protobuf code generators (protobuf-swift issue #38 tracks an identical initialization loop; the Kafka UI project filed the same error for schema-to-form conversion — "Error converting Protobuf schema with recursive references").

**Consequences:**
Browser tab crash or JavaScript stack overflow when loading any proto file with recursive message types.

**Prevention:**
Track rendered message type names in a stack during recursive rendering. When the same type name appears in its own ancestor chain, render a collapsed "add nested [TypeName]" placeholder button instead of expanding inline. Users can expand on demand. Cap render depth at 5 levels regardless of recursion.

**Detection:**
Test with any proto containing a field whose type is the same message, or a pair of messages referencing each other (e.g., `User` with a `repeated Group groups` and `Group` with a `User owner`).

**Phase:** Dynamic form generation phase.

---

### 4. RabbitMQ Management API unavailability in production environments

**What goes wrong:**
The Management Plugin (port 15672) is not enabled by default on all RabbitMQ deployments. Many production, cloud-managed, or containerised RabbitMQ instances run without it. If queue/exchange listing is built exclusively on the HTTP management API, the feature silently breaks for a significant subset of real team environments.

The AMQP protocol itself does not provide a "list all queues" or "list all exchanges" method. The only queue-level AMQP introspection is `queue.declare-ok`, which returns `message_count` and `consumer_count` for a queue you already know the name of.

**Why it happens:**
The management API is convenient and familiar (it's what Postman-style tools use). Developers design around it without verifying it's available in the environments the tool will actually be used in.

**Consequences:**
The AMQP connection works fine but the queue/exchange dropdown is empty with no clear error. Users assume the tool is broken.

**Prevention:**
Make the Management API URL configurable and optional in the connection profile. If the management API is unavailable, degrade gracefully: show an empty dropdown with a text input for manual queue/exchange name entry, and display a clear status indicator ("Management API unavailable — enter queue name manually"). Detect management API absence by catching HTTP connection errors, not by treating an empty list as valid.

**Phase:** Connection profile + queue/exchange listing phase.

---

## Common Mistakes (waste time but recoverable)

### 5. lapin auto-recovery is experimental and does not restore channels

**What goes wrong:**
lapin's `enable_auto_recover()` is documented as experimental. It handles TCP reconnection but does not automatically recreate channels or consumers after recovery. A `Channel` object becomes invalid after a connection drop. Code that holds onto a `Channel` across a reconnect event will continue to fail silently or panic.

Additionally, `deadpool-lapin` manages connection pools but not channel pools — channels must be created per-publish. The `lapin::Connection.channels` field is private, preventing direct reuse. Creating and destroying a channel per message is the only safe pattern with a small per-publish overhead.

**Prevention:**
For a send-only tool (no long-lived consumers), the simplest model is: establish one connection, create a channel per publish call, close the channel after publish. Wrap the connection in `Arc<Mutex<Option<Connection>>>`. On any publish failure, check if the connection is alive via `connection.status().connected()`. If not, reconnect before retrying. Do not hold channels across command invocations.

**Warning signs:**
`lapin::Error::InvalidChannel` or silent message drops after a broker restart during a session.

**Phase:** AMQP layer.

---

### 6. Tauri 2 IPC serialises everything as JSON by default

**What goes wrong:**
Tauri 2's default IPC serialises return values from Rust commands to JSON via serde. Developers who naively return a `Vec<u8>` (proto-encoded bytes) as a Tauri command return value will see it arrive in the frontend as a JSON array of integers (`[72, 101, 108, 108, ...]`), not a `Uint8Array`. This breaks any binary preview or size display feature.

**Prevention:**
Return binary data from Tauri commands using `tauri::ipc::Response` with a raw binary body, or use the `ArrayBuffer` return path available since Tauri 2.0. Do not return `Vec<u8>` as a JSON-serialised value when the frontend needs binary.

**Warning signs:**
Frontend receives `[72, 101, 108, 108, ...]` instead of a `Uint8Array`. Proto byte count looks correct but the value is not binary-usable.

**Phase:** Proto encode + send preview feature.

---

### 7. Tauri 2 capability/permissions model — commands silently blocked

**What goes wrong:**
In Tauri 2, every `#[command]` must be listed in a capability file under `src-tauri/capabilities/`. If a new command is added to Rust but the capability file is not updated, the `invoke()` call from the frontend appears to succeed (no JS error) but the Rust handler is never called — the response is `null` or an opaque "not allowed" error with no useful diagnostic.

The v1 allowlist in `tauri.conf.json` is gone. Developers using pre-2.0 tutorials or examples will try to enable features in `tauri.conf.json` and nothing will work.

**Prevention:**
After adding any new `#[command]`, immediately add it to the capability file. Use `tauri dev` in verbose mode — it logs permission denials. The permission format is `${plugin-name}:${permission-name}` for plugins and `${permission-name}` for app-defined commands. For the filesystem plugin (`tauri-plugin-fs`), each allowed path scope must also be declared.

**Warning signs:**
`invoke('my_command')` returns `null` or an error referencing "not allowed" without identifying which capability is missing.

**Phase:** Tauri project setup + every subsequent command added.

---

### 8. Manual proto wire encoding: packed repeated fields and field number discipline

**What goes wrong:**
Two common manual encoding bugs:

1. **Packed vs unpacked repeated fields:** In proto3, repeated scalar fields are packed by default. A manual encoder that writes each element as a separate tagged value instead of a single length-delimited record produces parseable but incompatible output — production consumers using proto3 may reject or misparse it.

2. **Field number reuse:** If a `.proto` file is edited to remove a field and a new field is added with the same field number, the wire format becomes ambiguous. Production consumers will misparse messages with no error — values are silently assigned to the wrong fields. The protobuf spec states: "Reusing a field number makes wire-format messages ambiguous."

**Prevention:**
For (1): use `prost-reflect`'s `DynamicMessage.encode()` rather than hand-rolling wire format. It handles packed encoding correctly.
For (2): treat field numbers as immutable once a proto file has been used in production. Document the `reserved` keyword when showing field numbers in the UI.

**Warning signs:**
(1) Consumer logs show parse errors after the tool sends. (2) No error at encoding time, but field values arrive in wrong positions at the consumer.

**Phase:** Proto encoding layer.

---

### 9. Large repeated fields block the UI

**What goes wrong:**
A `repeated` field of a complex message type renders one form row per element. If a user pastes JSON with 500+ elements into a repeated field (bulk import scenario), the form generator eagerly renders 500 sub-trees of React components. This will freeze the browser for seconds or cause a tab crash on low-memory machines.

**Why it happens:**
Naive form generation treats "render all rows" as the correct behaviour for arrays, which works fine for small lists but not for unbounded repeated fields.

**Prevention:**
Virtualize repeated field lists past a threshold (e.g., 50 rows). Use a windowed list renderer (`react-window` or `react-virtual`) or implement lazy row expansion. Show a count badge ("150 items") with collapse/expand controls rather than auto-expanding everything. Allow adding/removing individual rows explicitly.

**Warning signs:**
UI freezes when loading a proto file with a `repeated SubMessage` field and more than ~100 items in the form state.

**Phase:** Dynamic form generation phase.

---

### 10. oneof UX: form state vs wire semantics mismatch

**What goes wrong:**
The protobuf spec is explicit: "Setting a value to any field in the OneOf automatically clears all other fields in that group. Only the last-written field is included in the serialized wire format." A naive form that renders all branches of a `oneof` as visible input fields lets the user type into multiple branches. At submit time, only one branch is encoded — the others are silently dropped. Users who filled in branch A, switched to branch B, then switched back expect branch A's draft to be restored. If the form purges it, the send feels unpredictable.

A secondary edge case: nested `oneof` (a `oneof` containing a message that itself has a `oneof`) is easy to mishandle in the React state shape, producing stale "ghost" values in the unselected branch that differ from what will actually be encoded.

**Prevention:**
Use an explicit branch-selector UI: a radio group or tab strip for the `oneof`, with only the selected branch's fields visible. Preserve all branches' draft state in React state but only pass the selected branch's value to the encoder. Show a clear visual indicator that the unselected branches "will not be sent." Test encoding output to verify the inactive branch produces no bytes on the wire.

**Sources:** proto3 language guide — "Setting any member of the oneof automatically clears all other members." Verified in official protobuf documentation.

**Warning signs:**
Encoding a message with a `oneof` field produces output that the consumer decodes with a different field populated than expected.

**Phase:** Dynamic form generation phase.

---

### 11. macOS notarization and Windows SmartScreen block distribution

**What goes wrong:**
macOS Gatekeeper blocks any app not notarised by Apple on first launch with a non-dismissible error. Notarisation requires:
- A paid Apple Developer account ($99/year)
- A Developer ID Application certificate
- An `Entitlements.plist` with JIT entitlement (required for Tauri's WebView)
- App Store Connect API credentials for the notarisation service

Windows SmartScreen shows a warning for newly-signed binaries until the certificate builds reputation. An EV certificate accelerates this but costs more.

If this is discovered at distribution time, the fix requires account setup, certificate procurement, and CI pipeline changes — days of work.

**Prevention:**
Address code signing in the first distribution milestone, not the last. Set up CI signing scripts early using Tauri's official signing docs. For internal team distribution on macOS, ad hoc signing avoids notarisation for developer machines but cannot be distributed to non-developers publicly.

**Warning signs:**
"App is damaged and can't be opened" on macOS = unsigned/un-notarised. "Windows protected your PC" on Windows = unsigned or low-reputation certificate.

**Phase:** Distribution / packaging phase. Set up signing infrastructure before the first team-wide binary distribution.

---

### 12. Tauri 2 on Linux requires webkit2gtk 4.1 — not available on all distros

**What goes wrong:**
Tauri 2 requires `webkit2gtk-4.1` (API version 4.1). Ubuntu 22.04 LTS ships `webkit2gtk-4.0` only. Ubuntu 24.04 dropped `webkit2gtk-4.0` entirely and only ships `4.1`. This creates a fork: apps built against the 4.0 API do not work on Ubuntu 24+; apps built against 4.1 do not have packages available on Ubuntu 22.

Additionally, the system WebKit on each Linux distribution may have different JavaScript capability levels. A React app built with Vite's defaults may use ES2020+ features not available in older system WebKits.

**Prevention:**
Target `webkit2gtk-4.1` (Tauri 2's stated requirement). Test on Ubuntu 24.04 LTS (current stable). Document the system dependency requirement clearly in distribution notes. Configure the Vite build target conservatively (`["es2019", "chrome87"]`) to avoid syntax not supported in older system WebKits encountered on enterprise Linux.

**Warning signs:**
Blank window on Linux with no console error. Missing `libwebkit2gtk-4.1-dev` build error during CI on older Ubuntu runners.

**Sources:** Tauri 2 prerequisites page lists `libwebkit2gtk-4.1-dev` as the Linux requirement. Tauri GitHub issue #9662 documents `libwebkit2gtk-4.0` removal from Ubuntu 24.

**Phase:** Cross-platform testing pass + CI setup.

---

### 13. Tauri State Mutex deadlock with async commands

**What goes wrong:**
Tauri 2's async commands run on a multi-threaded tokio runtime. All async futures must be `Send`. If AMQP connection state is stored behind a `std::sync::Mutex<T>` and the guard is held across an `.await` point (e.g., while waiting for a publish confirmation), the code either fails to compile ("future is not `Send`") or deadlocks at runtime — `std::sync::MutexGuard` is not `Send`.

**Prevention:**
Use `tokio::sync::Mutex` for state accessed across `.await` points. Alternatively, acquire the lock, extract/clone what is needed, release the lock, then run the async operation with no lock held. The second approach avoids holding a mutex across IO and is generally safer.

**Warning signs:**
Compile error: "future is not `Send`" pointing to a `MutexGuard`. Or: the send command hangs indefinitely when called.

**Phase:** AMQP state management in Tauri commands.

---

## v1.2 Form Improvements Pitfalls

The following pitfalls are specific to the v1.2 milestone: BytesField (FORM-V2-01), MapField (FORM-V2-02), and JSON override toggle (FORM-V2-03). All findings are derived from reading the actual codebase (`encode.rs`, `consume.rs`, `schema/extractor.rs`, `ScalarField.tsx`, `RepeatedField.tsx`, `schema/types.rs`).

---

### 14. BytesField: URL-safe base64 silently encodes as empty bytes

**What goes wrong:**
`encode.rs` line 325-328 calls `base64::engine::general_purpose::STANDARD.decode(s)` and returns `unwrap_or_default()` on failure — silent empty-bytes fallback with no error surfaced to the user. The standard alphabet uses `+` and `/` as the 62nd and 63rd characters. URL-safe base64 uses `-` and `_` instead. If a user pastes URL-safe base64 (common from web APIs, JWT payloads, or tools like `btoa` in some contexts), the decode returns `Ok([])` silently.

The zod schema for bytes in `ScalarField.tsx` is `z.string()` with no base64 regex — there is no frontend validation that catches this before the IPC call is made.

**Warning sign:**
User sends a message with a bytes field, the consumer receives the field present but empty (`\x0a\x00` style zero-length). No error is shown.

**Prevention:**
(1) Add a zod regex validator for bytes fields: `z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, "Must be standard base64")`. This catches URL-safe input before it reaches Rust. (2) In `base64_decode_or_empty`, attempt URL-safe decode as a fallback if standard decode fails, OR surface the decode failure as a field error via the IPC response rather than silently returning empty. (3) Document in the field hint that standard base64 (RFC 4648, `+` and `/`) is expected.

**Phase to address:** FORM-V2-01 (BytesField implementation).

---

### 15. BytesField: UTF-8 helper button is one-way only — reverse is lossy

**What goes wrong:**
The planned "UTF-8 text helper" button allows entering human-readable text that gets encoded to bytes. The natural completion is a "decode to text" button that converts the base64 back to readable text. However, proto `bytes` fields contain arbitrary binary data — decoding arbitrary bytes as UTF-8 is undefined behavior for most binary payloads and will produce replacement characters (`â`) or a `fromCharCode` error rather than readable text.

If the button attempts `TextDecoder.decode(bytes)` on a non-UTF-8 payload, the result is silently corrupted text. If the user then re-encodes this corrupted text, they produce a different byte sequence than the original.

**Warning sign:**
User loads a history entry with a bytes field, clicks "view as text", sees garbage characters, edits one character, and resends — consumer receives corrupted bytes with no error.

**Prevention:**
Make the UTF-8 helper one-directional: text input → base64 only. Label the button "Encode text as bytes" not "Edit as text." Do NOT provide a "decode to text" button unless a UTF-8 validity check passes first. If you add decode, guard it: `TextDecoder` with `fatal: true` throws on invalid UTF-8 — catch that and show an error ("Not valid UTF-8") rather than silently showing corrupted characters.

**Phase to address:** FORM-V2-01 (BytesField implementation).

---

### 16. BytesField: prost-reflect serializes bytes as standard base64 in JSON output — consume and form must use the same alphabet

**What goes wrong:**
`consume.rs` uses `prost_reflect::SerializeOptions` with `serialize_with_options` (lines 170-180). prost-reflect's proto3 JSON serialization follows the canonical proto3 JSON spec: bytes fields are emitted as **standard-alphabet base64 with padding** (RFC 4648 §4). This means the decoded-message JSON that arrives at the frontend has bytes as a standard-alphabet base64 string.

The encode path in `encode.rs` also uses `base64::engine::general_purpose::STANDARD`. Both paths use the same standard alphabet — they are symmetric.

The pitfall arises if the BytesField UI pre-populates from a decoded/consumed message (e.g., replay from history) and the replayed JSON byte value was serialized by prost-reflect. If the BytesField UI then re-validates with a regex that accidentally excludes `+`, `/`, or `=` (e.g., a URL-safe-only regex), the re-populated field will fail validation on a valid base64 string produced by prost-reflect.

**Warning sign:**
"Replay from history" fills in a bytes field, but the form shows a validation error on a field that was just decoded successfully.

**Prevention:**
Validate bytes fields with the standard-alphabet regex only: `/^[A-Za-z0-9+/]*={0,2}$/`. Never use a URL-safe-only regex (`-_`). The standard alphabet is what both prost-reflect and the `base64 = "0.22"` STANDARD engine produce.

**Phase to address:** FORM-V2-01 (BytesField), cross-referenced with FORM-V2-03 (JSON toggle replay).

---

### 17. MapField: `FieldKind` has no Map variant — map fields fall through to `FieldKind::Message`

**What goes wrong:**
`schema/types.rs` defines `FieldKind` with variants: `Scalar`, `Message`, `Enum`, `Oneof`, `WellKnown`. There is no `Map` variant. `schema/extractor.rs` `extract_field_kind()` does not call `field.is_map()` anywhere.

In proto3, `map<K, V>` is syntactic sugar for a repeated message with two fields (`key` and `value`). The protobuf descriptor represents a map field as a repeated field whose `entry` flag is `true` and whose value type is a synthetic `MapEntry` message. `prost-reflect`'s `FieldDescriptor::is_map()` returns `true` for these fields.

Without a `Map` variant in `FieldKind`, map fields will be extracted as `FieldKind::Message { full_name: "SomeMessage.SomeFieldEntry" }` (the synthetic entry message), which the form renderer will try to render as a nested message form. The user will see a nested sub-form with `key` and `value` inputs rather than a clean key-value row list. This does not crash, but it produces a confusing UX and the resulting form state shape will not match what `encode.rs` expects for map encoding.

**Warning sign:**
A `map<string, string>` field renders as a nested message labeled with a generated entry type name like `MyMessage.LabelsEntry` rather than a key-value row list.

**Prevention:**
(1) Add `Map { key_kind: ScalarKind, value_kind: FieldKind }` to `FieldKind` in `types.rs`. (2) In `extract_field_kind`, call `field.is_map()` before `field.is_list()`. When true, extract the entry message descriptor's `key` and `value` field descriptors and build the `Map` variant. (3) Add a `MapField` component in the frontend. (4) In `encode.rs`'s `set_field_value`, handle `field.is_map()` by building a `Value::Map(HashMap)` rather than a `Value::List`.

**Phase to address:** FORM-V2-02 (MapField). Requires changes in Rust schema extractor, Rust types, Rust encoder, and React renderer — coordinate all four in one phase.

---

### 18. MapField: storing rows as `Array<{k, v}>` vs `Record<K, V>` — silent dedup on duplicate keys

**What goes wrong:**
If the MapField component stores its state in react-hook-form as a `Record<string, V>` (a plain object), JavaScript object semantics silently deduplicate keys: `{ "a": 1, "a": 2 }` collapses to `{ "a": 2 }`. The user can type the same key twice in two rows, both appear in the UI, but only the last value survives in the form state. The duplicate is invisible until the user submits and the consumer receives only one entry.

**Warning sign:**
User adds two rows with the same key, both rows are visible, but after submit the consumer only sees one entry for that key.

**Prevention:**
Store map rows in react-hook-form as `Array<{ k: string; v: unknown }>` using `useFieldArray` — the same pattern as `RepeatedField`. At submit time, serialize to `Record<K, V>` and detect duplicates explicitly. If duplicates exist, surface a visible field-level error ("Duplicate key: 'foo'") and block submit. Never silently deduplicate.

**Phase to address:** FORM-V2-02 (MapField). Document the array-not-record storage decision explicitly in the component.

---

### 19. MapField: proto3 map key types are restricted — not all scalars are valid

**What goes wrong:**
Proto3 allows only specific types as map keys: `int32`, `int64`, `uint32`, `uint64`, `sint32`, `sint64`, `fixed32`, `fixed64`, `sfixed32`, `sfixed64`, `bool`, and `string`. Floating-point types (`float`, `double`), `bytes`, enum types, and message types are explicitly NOT allowed as map keys. The proto spec states: "Note that enum is not a valid key type."

A MapField component that renders a free-text key input or uses the same `ScalarField` without restricting to valid key types would allow the user to construct a key input that the proto schema never permits. If this reaches `encode.rs` and the key field descriptor is checked via `field.kind()`, the Rust code will encounter an unexpected kind for a map key and either panic or silently drop the entry.

**Warning sign:**
Schema has `map<MyEnum, string>` or `map<float, string>` — these are proto schema errors that should be caught by the compiler, but if somehow passed, the form renders a broken key input with no guard.

**Prevention:**
When building the `Map` variant in the schema extractor, assert that the key kind is a valid map key type. In the MapField React component, render the key input based on `key_kind` from the schema — an integer key gets a numeric input with appropriate range validation, a string key gets a text input, a bool key gets a select/checkbox. Never render a generic "enter anything" key field without checking `key_kind`.

**Phase to address:** FORM-V2-02 (MapField schema extraction and key validation).

---

### 20. MapField: proto3 maps are unordered — UI row ordering must not be relied upon

**What goes wrong:**
Proto3 specifies that map fields are unordered. The wire format does not guarantee any entry ordering. `prost-reflect` encodes map entries using `HashMap` iteration order, which is random (randomized hash seed per process in Rust's stdlib). If the MapField UI shows rows in insertion order and the user expects that order to be preserved in the encoded message or visible to the consumer in the same order, they will be surprised.

This is a user-expectation pitfall, not a code bug. It surfaces when: (a) the user is building a map representing ordered configuration and expects the consumer to process entries in the displayed order, or (b) a regression test does byte-level comparison of encoded output and fails because map entry order changed between runs.

**Warning sign:**
Test that encodes a message with a map field and then byte-compares the output to a fixture fails non-deterministically. Or: user reports that "the order of map entries changed" between two sends of identical form data.

**Prevention:**
(1) Show a UI hint on the MapField: "Map fields are unordered — entry order is not preserved in the encoded message." (2) In tests for map encoding, decode the encoded bytes and compare the map entries as a set, not the raw byte sequence. Never byte-compare encoded map output.

**Phase to address:** FORM-V2-02 (MapField), and any test authoring for map encoding.

---

### 21. JSON override toggle: `setValue` does not re-sync `useFieldArray` internal state

**What goes wrong:**
When syncing JSON→form (JSON mode exit), a naive implementation calls `setValue('fieldName', parsedJson.fieldName)` for each field. This works for scalar fields but silently fails for any field using `useFieldArray` (repeated fields and, once implemented, map fields as arrays of `{k,v}` rows).

`useFieldArray` maintains its own internal `fields` ref (an array of `{ id, ...values }` objects where `id` is injected by react-hook-form). `setValue` updates the underlying form store but does NOT update the internal `fields` ref that `useFieldArray` uses to render rows. The result: the form store has the correct data, but the rendered rows show the old count and values until the component remounts. This is a documented react-hook-form behavior — `setValue` bypasses `useFieldArray`'s internal tracking.

**Warning sign:**
User switches to JSON mode, edits a repeated field to have 3 items instead of 2, switches back to form mode — form still shows 2 rows even though the underlying store has 3.

**Prevention:**
Use `reset(parsedJson)` to sync JSON→form. `reset()` reinitializes the entire form including `useFieldArray`'s internal `fields` refs. Alternatively, for targeted updates to specific array fields, call the `replace()` function returned by `useFieldArray` — but this requires each `useFieldArray` instance to expose `replace` to the JSON sync logic, which adds coupling. `reset()` is simpler and correct.

The tradeoff: `reset()` clears all `fieldState` (touched/dirty/errors). That is acceptable for JSON override mode (the user explicitly replaced the form state). Document this decision.

**Phase to address:** FORM-V2-03 (JSON override toggle).

---

### 22. JSON override toggle: stale form state when JSON is invalid and user switches back

**What goes wrong:**
The JSON override panel holds a textarea with a string. If the user edits the JSON to be syntactically invalid (unclosed brace, trailing comma, etc.) and then clicks "back to form", there are three possible behaviors:
- **Block exit** (keep user in JSON mode with an error): correct but potentially trapping.
- **Discard changes** (silently revert to last-valid JSON): loses user work with no warning.
- **Apply partial state** (attempt partial parse): produces corrupted form state.

The pitfall is choosing "discard" or "apply partial" without explicit decision. The default of throwing on `JSON.parse` and then not updating form state leaves the form in whatever state it was when JSON mode was entered — which may be many edits ago if the user made extensive changes in JSON mode before making the syntax error.

A secondary issue: "last valid JSON snapshot" must be stored separately from the form state. If not, there is no clean "revert to last valid" source.

**Warning sign:**
User edits JSON for 5 minutes, makes a typo, tries to switch back to form mode — all 5 minutes of changes are discarded. User is angry.

**Prevention:**
(1) Store the "last valid JSON" snapshot in component state whenever the textarea content parses successfully (on any valid keystroke). (2) On form-mode switch: if current JSON is invalid, show an inline error and offer two explicit choices: "Fix JSON" (stay in JSON mode) and "Discard changes" (revert to last-valid snapshot). Never silently discard. (3) Never attempt partial application of invalid JSON to form state.

**Phase to address:** FORM-V2-03 (JSON override toggle).

---

### 23. JSON override toggle: JSON shape valid but proto schema invalid — silent field drops

**What goes wrong:**
`JSON.parse()` succeeds on any syntactically valid JSON. The JSON override panel accepts user-typed JSON and syncs it back to the form via `reset()`. If the user adds a field that does not exist in the proto schema (e.g., `"nonexistent_field": 42`), `reset()` places it in the form state but `encode.rs`'s `populate_message` iterates `msg_desc.fields()` and simply ignores any JSON keys that do not correspond to known field descriptors. The extra field is silently dropped — no error is shown to the user.

Conversely, if the user renames a required field, the encode produces a message with that field absent (proto3 default value), again with no error.

**Warning sign:**
User types `"user_name": "Alice"` in JSON mode but the field is named `"username"` in the proto. The form shows "Alice" in the `user_name` slot (because `reset()` added it), but the encoded message has an empty `username` field.

**Prevention:**
Validate the parsed JSON object against the proto schema before applying it to the form. The simplest approach: after `JSON.parse`, check that all top-level keys in the JSON exist in `msg_desc.fields()` names. Warn about unknown keys ("Field 'user_name' is not in the schema — did you mean 'username'?"). This does not require a full deep validation pass — key-name checking at the top level catches the most common class of mistake. Full nested validation can be a follow-on improvement.

**Phase to address:** FORM-V2-03 (JSON override toggle).

---

### 24. JSON override toggle: form→JSON snapshot must use `getValues()` not `watch()`

**What goes wrong:**
When the user switches from form mode to JSON mode, the panel must populate the textarea with the current form values. Using `watch()` to subscribe to form changes and derive the JSON representation works, but `watch()` re-renders the JSON panel on every keystroke in the form, causing the textarea to reset to a serialized value while the user is typing. If the JSON panel is open alongside the form, every form change overwrites any edits the user has made in JSON mode.

Using `useFormContext().getValues()` at the moment of mode switch (on the toggle click event) is the correct approach — it reads a snapshot at a point in time and does not subscribe to further changes.

**Warning sign:**
User opens JSON mode, starts editing the JSON, and the textarea content is replaced mid-edit by a re-serialized version of the form.

**Prevention:**
On toggle to JSON mode: call `getValues()` once to read the snapshot, serialize to JSON string, set textarea state. Do not use `watch()` or any subscription that continuously updates the textarea content while JSON mode is active. The JSON textarea must be a fully independent edit buffer while JSON mode is active.

**Phase to address:** FORM-V2-03 (JSON override toggle).

---

## Phase Mapping

| Topic area | Pitfall(s) | Address when |
|------------|-----------|--------------|
| Proto parsing library selection | #1 (prost vs prost-reflect) | Before writing a single line of proto code — foundational |
| Proto parsing: include paths UI | #2 (import path resolution) | When designing the file loading flow — include paths must be first-class |
| Dynamic form generation | #3 (circular/recursive types), #9 (large repeated fields), #10 (oneof UX) | Before implementing the form renderer — depth guard and oneof model from day one |
| AMQP connection layer | #5 (lapin channel lifecycle), #13 (Mutex + async) | AMQP integration milestone |
| Queue/exchange listing | #4 (management API unavailability) | Connection profile feature — text-input fallback is the primary path, API listing is an enhancement |
| Proto encoding | #8 (packed fields, field number reuse) | Encoding implementation — use prost-reflect's encoder, do not hand-roll |
| Tauri project setup | #7 (capabilities model) | Day one — add every command to capabilities immediately after defining it |
| Tauri IPC binary data | #6 (JSON serialisation of Vec<u8>) | Proto encode + send preview feature |
| Distribution | #11 (code signing, notarisation), #12 (WebKitGTK Linux) | First distribution milestone — do not leave for last |
| Cross-platform CI | #12 (WebKitGTK Linux) | CI pipeline setup, not just final QA |
| BytesField (FORM-V2-01) | #14 (URL-safe base64 silent failure), #15 (UTF-8 helper one-way only), #16 (base64 alphabet consistency) | v1.2 BytesField phase |
| MapField (FORM-V2-02) | #17 (no Map FieldKind variant), #18 (array not record storage), #19 (key type restrictions), #20 (ordering not preserved) | v1.2 MapField phase — requires coordinated Rust+React changes |
| JSON override toggle (FORM-V2-03) | #21 (setValue vs reset for arrays), #22 (stale state on invalid JSON), #23 (schema-invalid JSON silent drops), #24 (getValues not watch) | v1.2 JSON toggle phase |

---

## Sources

- prost README: https://github.com/tokio-rs/prost/blob/master/README.md
- prost-reflect docs: https://docs.rs/prost-reflect/latest/prost_reflect/
- prost-reflect CHANGELOG: https://github.com/andrewhickman/prost-reflect/blob/main/CHANGELOG.md
- protox GitHub: https://github.com/andrewhickman/protox
- lapin README (auto_recover experimental): https://github.com/amqp-rs/lapin/blob/main/README.md
- lapin reconnect issue: https://github.com/amqp-rs/lapin/issues/420
- deadpool-lapin channel pooling limitation: https://github.com/deadpool-rs/deadpool/issues/47
- Tauri v1 to v2 migration guide: https://v2.tauri.app/start/migrate/from-tauri-1/
- Tauri 2 permissions: https://v2.tauri.app/security/permissions/
- Tauri 2 capabilities: https://v2.tauri.app/security/capabilities/
- Tauri 2 distribution: https://v2.tauri.app/distribute/
- Tauri macOS signing: https://v2.tauri.app/distribute/sign/macos/
- Tauri Windows signing: https://v2.tauri.app/distribute/sign/windows/
- Tauri prerequisites (webkit2gtk-4.1): https://v2.tauri.app/start/prerequisites/
- Tauri webkit2gtk issue (Ubuntu 24 dropping 4.0): https://github.com/tauri-apps/tauri/issues/9662
- Tauri IPC binary data issue: https://github.com/tauri-apps/tauri/issues/7127
- Protobuf encoding guide: https://protobuf.dev/programming-guides/encoding/
- Protobuf field number reuse: https://protobuf.dev/programming-guides/proto3/
- Protobuf oneof wire semantics: https://protobuf.dev/programming-guides/proto3/ ("Setting any member of the oneof automatically clears all other members")
- Protobuf map key types: https://protobuf.dev/programming-guides/proto3/#maps ("The key_type can be any integral or string type... float and bytes are not supported")
- Circular reference infinite loop (protobuf-swift #38): https://github.com/alexeyxo/protobuf-swift/issues/38
- Kafka UI recursive schema error: https://github.com/provectus/kafka-ui/issues/2824
- RabbitMQ Management Plugin docs: https://www.rabbitmq.com/docs/management
- protobufjs import resolution issue: https://github.com/protobufjs/protobuf.js/issues/368
- react-hook-form useFieldArray + setValue limitation: https://react-hook-form.com/docs/usefieldarray (documented behavior: setValue bypasses internal fields ref)
- react-hook-form reset(): https://react-hook-form.com/docs/useform/reset
- base64 crate (0.22) STANDARD engine: https://docs.rs/base64/latest/base64/engine/general_purpose/constant.STANDARD.html
- Proto3 JSON canonical format (bytes as base64): https://protobuf.dev/programming-guides/proto3/#json
- prost-reflect SerializeOptions: https://docs.rs/prost-reflect/latest/prost_reflect/struct.SerializeOptions.html

---

## v1.3 Publishing UX + Message Blocks Pitfalls

The following pitfalls are specific to the v1.3 milestone: publisher confirms badge (PUBL-02), routing key autocomplete (PUBL-01), message block library with drag-and-drop (BLK-01 to BLK-04). All findings are grounded in the actual v1.3 codebase state — `publish.rs`, `PublishBar.tsx`, `useConnectionStore.ts`, `useHistoryStore.ts`, `App.tsx` (ThemeBootstrap pattern), `tauri.conf.json`.

---

## Publisher Confirms Pitfalls

### 25. Confirmation enum has three variants — current code ignores Nack

**Symptom:**
The broker returns a NACK (e.g., the queue was at capacity and the broker rejected the message), but `publish_message` returns `Ok(())` to the frontend and the UI shows a success badge. The user believes the message was delivered; the consumer never received it.

**Root cause:**
`publish.rs` (line 157) calls `confirm_result.map_err(|e| AppError::AmqpError(e.to_string()))?`. This only converts an `Err(lapin::Error)` — a protocol-level failure — into an `AppError`. The `Confirmation` enum has three variants (verified against `docs.rs/lapin/1.4.3/lapin/publisher_confirm/enum.Confirmation.html`):
- `Ack(Option<Box<BasicReturnMessage>>)` — broker accepted the message
- `Nack(Option<Box<BasicReturnMessage>>)` — broker rejected the message
- `NotRequested` — confirm mode was not enabled

`map_err` on a `Result<Confirmation, lapin::Error>` converts `Err(lapin::Error)` to `AppError`, but a broker NACK is **not an Err** — it is `Ok(Confirmation::Nack(...))`. It passes through the `map_err` undetected, `?` unwraps it to `()`, and the command returns success.

**Prevention for PUBL-02:**
After `confirm_result.map_err(...)?.` add an explicit match on the `Confirmation` value:
```rust
match confirm_result.map_err(|e| AppError::AmqpError(e.to_string()))? {
    Confirmation::Ack(_) => Ok(PublishOutcome::Ack),
    Confirmation::Nack(_) => Ok(PublishOutcome::Nack),
    Confirmation::NotRequested => Err(AppError::AmqpError(
        "Confirm mode not active — this is a bug".to_string()
    )),
}
```
Return `PublishOutcome` (a new enum serializable via serde) to the frontend so it can show distinct ACK / NACK badges. Do not collapse NACK into an `Err` — a NACK is a valid broker response that should surface to the user as a warning, not a hard error.

**Requirement:** PUBL-02.

---

### 26. `BasicPublishOptions::mandatory = false` — unroutable messages ACK silently

**Symptom:**
User selects an exchange that has no binding for the routing key they typed. The broker has no queue to route to, discards the message, and still returns ACK (because confirm mode only confirms delivery to the exchange, not to a queue). The PUBL-02 badge shows green "ACK" while the message was never queued.

**Root cause:**
`BasicPublishOptions::default()` sets `mandatory: false`. With `mandatory: false`, the broker silently drops unroutable messages — the `basic.return` notification is not sent, and the ACK arrives as if delivery succeeded. This is AMQP 0-9-1 protocol behavior, not a lapin bug.

To detect unroutable messages, `mandatory: true` must be set. With `mandatory: true`, if no queue is bound for the routing key the broker sends a `basic.return` frame carrying a `BasicReturnMessage` with reply code 312 (`NO_ROUTE`) before the ACK. In lapin, this arrives as `Confirmation::Ack(Some(Box<BasicReturnMessage>))` — the ACK carries the return message inside it.

**Prevention for PUBL-02:**
For the publisher confirms badge feature, set `mandatory: true` on `BasicPublishOptions`. After awaiting the confirm:
- `Confirmation::Ack(None)` → message routed and queued (show green ACK badge)
- `Confirmation::Ack(Some(ret))` → unroutable: `ret.reply_code == 312` (show amber "No Route" badge, not green ACK)
- `Confirmation::Nack(_)` → broker rejected (show red NACK badge)

The `Ack(Some(...))` variant carrying a return message is subtle and commonly missed — this is the difference between a correct and incorrect ACK badge.

**Requirement:** PUBL-02.

---

### 27. `confirm_future.await` has no timeout — stalled broker hangs the IPC command indefinitely

**Symptom:**
The broker becomes slow or unresponsive after the channel is created and the message is published. The `confirm_future.await` waits forever. The Tauri IPC command never returns. The frontend `Send` button spinner spins indefinitely with no error or timeout.

**Root cause:**
`publish.rs` wraps `Connection::connect` in a 10-second `tokio::time::timeout` (line 64), but `confirm_future.await` (line 152) has no timeout. The connection timeout only protects the initial handshake — it does not protect the confirm wait phase.

**Prevention for PUBL-02:**
Wrap the confirm future in a timeout:
```rust
let confirm = tokio::time::timeout(
    Duration::from_secs(5),
    confirm_future,
)
.await
.map_err(|_| AppError::AmqpError("Publisher confirm timed out (5s)".to_string()))?
.map_err(|e| AppError::AmqpError(e.to_string()))?;
```
Five seconds is a reasonable confirm timeout — well above normal broker latency but short enough to not appear hung. Surface the timeout as a distinct `PublishOutcome::Timeout` to the frontend so the badge shows an amber "Timeout" indicator rather than a generic error.

**Requirement:** PUBL-02.

---

### 28. Publisher confirm badge must be ephemeral — do not persist in global store

**Symptom:**
The ACK/NACK badge added in PUBL-02 is stored in a Zustand store. After the user navigates away and back, or switches profiles, stale badge state remains visible and shows the result of a previous send as if it were current.

**Root cause:**
Following the pattern of `connectionStatus` in `useConnectionStore`, a developer adds `confirmStatus: 'ack' | 'nack' | 'timeout' | null` to the Zustand store for cross-component sharing. Zustand store state persists for the lifetime of the React app (no automatic TTL). The badge does not dismiss itself unless explicitly reset.

**Prevention for PUBL-02:**
Keep the badge state local to `PublishBar` as React `useState`. Use a `useEffect` with a `setTimeout` to auto-dismiss after ~3 seconds. Clear the state on: (a) next send attempt (regardless of outcome), (b) exchange/queue selection change. Do not put ephemeral per-send state in global stores — the precedent from existing code is that `isSending` is local state in `PublishBar.tsx`, not in Zustand. Follow that pattern.

**Requirement:** PUBL-02.

---

## Routing Key Autocomplete Pitfalls

### 29. Race condition: rapid exchange switching causes out-of-order binding responses

**Symptom:**
User rapidly clicks through several exchanges in the dropdown. The last exchange selected is `logs-exchange` but the suggestion list shows bindings for `orders-exchange` — an earlier fetch completed after the later one and overwrote the suggestions.

**Root cause:**
`PublishBar.tsx` already has a `useEffect` with `[activeProfileName, mode]` deps that calls `fetchExchanges`. PUBL-01 adds a second effect (or extends the existing one) that triggers on `selectedExchange` change and calls `fetchBindings(activeProfileName, selectedExchange)`. If the user selects exchange A (fetch A starts), then selects exchange B (fetch B starts), and fetch A resolves after fetch B, `setBindingSuggestions(aResults)` clobbers the correct B results.

**Prevention for PUBL-01:**
Use an `AbortController`-style cancellation ref. Because the actual fetch goes through Tauri IPC (not `fetch()`), true AbortController is not applicable, but the same pattern works with a request ID ref:
```typescript
const requestIdRef = useRef(0);
// Inside effect:
const myId = ++requestIdRef.current;
const bindings = await fetchBindings(activeProfileName, selectedExchange);
if (requestIdRef.current !== myId) return; // stale — discard
setBindingSuggestions(bindings);
```
Increment the ref on each new exchange selection. Discard any response whose request ID no longer matches the latest. Debounce 250ms on `selectedExchange` change to coalesce rapid radio-toggles before firing the IPC call.

**Requirement:** PUBL-01.

---

### 30. Management API unavailability silently breaks autocomplete — no user feedback

**Symptom:**
User is in manual mode (Management API unavailable, Manual badge shown). They type a routing key. No suggestions appear and no explanation is given. User does not know whether the absence of suggestions means "no bindings exist" or "autocomplete is unavailable."

**Root cause:**
When `managementStatus === "manual"` in `useConnectionStore`, the exchange selector is already replaced by a text input (existing behavior in `PublishBar.tsx` lines 277-285). PUBL-01 needs to add binding suggestions to the routing key input. If the effect that fetches bindings is not gated on `managementStatus === "live"`, it fires anyway, fails with a connection error, and surfaces no suggestions — indistinguishable from an exchange with zero bindings.

**Prevention for PUBL-01:**
Gate the bindings-fetch effect on `managementStatus === "live"`. When `managementStatus !== "live"`, render the routing key input as a plain text Input (no combobox). Optionally add a "No binding suggestions — Management API unavailable" tooltip on the input. This is consistent with the existing Live/Manual badge behavior for the exchange/queue picker.

Note: CORS is not a concern here. The bindings call goes through Rust `reqwest` (not WebView `fetch`), so the same-origin browser restriction does not apply.

**Requirement:** PUBL-01.

---

### 31. Topic exchange binding keys contain wildcards — suggesting them as literal routing keys misleads users

**Symptom:**
Exchange `events-topic` has a binding with routing key `orders.*.created`. The autocomplete shows this as a suggestion. User selects it as their routing key. The broker receives a message with routing key `orders.*.created` (literal) — which matches no binding because topic pattern matching only works on the binding side, not the publishing side. Message is dropped silently (or `NO_ROUTE` if `mandatory: true`).

**Root cause:**
RabbitMQ topic exchange binding keys use `*` (exactly one word) and `#` (zero or more words) as wildcards. These are patterns for the broker's routing algorithm. A publisher's routing key must always be a literal dotted string — wildcards in the routing key are not interpreted. Fetching binding `routing_key` values from `/api/exchanges/{vhost}/{name}/bindings/source` and presenting them as-is conflates binding patterns with valid publish targets.

**Prevention for PUBL-01:**
When building autocomplete suggestions from the bindings response (`routing_key` field):
- For fanout exchanges: show no routing key suggestions (fanout ignores routing keys entirely).
- For headers exchanges: show no routing key suggestions (headers exchanges match on headers, not routing key).
- For direct exchanges: show binding keys as suggestions verbatim — direct routing keys are literal.
- For topic exchanges: show binding keys but annotate wildcard patterns with a warning label: `"orders.*.created  (pattern — not a literal key)"`. Allow the user to select a wildcard as a template and edit it before sending. Never silently use a wildcard as a literal routing key.

**Requirement:** PUBL-01. Fetch exchange type from `fetchExchanges` response (currently filtered but type not exposed to frontend) or add a new `fetch_exchange_type` command.

---

### 32. Headers exchanges always return `x-match` as binding key — not a useful routing key

**Symptom:**
User selects a headers exchange. The autocomplete shows `x-match` (or empty string) as the only suggestion. User selects it. The message publishes with routing key `x-match`, which does nothing useful — headers exchanges route on AMQP headers, not routing key.

**Root cause:**
Headers exchange bindings use `arguments` (e.g., `x-match: all`, `type: order`) for routing decisions, not `routing_key`. The `routing_key` field in their binding objects is typically an empty string or `x-match`. These are not meaningful publish targets.

**Prevention for PUBL-01:**
Detect headers exchanges by exchange type and suppress routing key suggestions entirely for them. Show a UI note: "Headers exchanges route on AMQP headers — set headers in Properties, not routing key." This requires the exchange type to be available in the frontend. If `fetchExchanges` currently returns only `Vec<String>` (names), it must be extended to return `Vec<ExchangeInfo { name, type }>` for PUBL-01 to work correctly.

**Requirement:** PUBL-01. The `fetch_exchanges` Rust command currently returns `Vec<String>` — it must be updated to return `Vec<{name, exchange_type}>` to support per-type suggestion behavior.

---

## Drag-and-Drop in Tauri WebView

### 33. `dragDropEnabled: true` (default) blocks HTML5 DnD events inside the WebView on Windows

**Symptom:**
Drag-and-drop works on macOS in development but not on Windows. Or: file drag-and-drop onto the window works (files can be dropped into the app) but in-app element dragging does not. Specifically, any library using HTML5 `dragstart`/`dragover`/`drop` events appears to do nothing on Windows.

**Root cause:**
Tauri 2's `dragDropEnabled` window setting (default: not set, which enables Tauri's OS-level drag-drop interception) intercepts native drag events at the OS level before they reach the WebView's DOM on Windows. This is documented in Tauri issue #8581 (originally `fileDropEnabled` in v1, renamed `dragDropEnabled` in v2): "When fileDropEnabled is enabled, users cannot use drag-and-drop components." The current `tauri.conf.json` does not set `dragDropEnabled` at all, meaning it defaults to Tauri's OS-level handling.

**However:** `@dnd-kit` uses **pointer events** (`PointerSensor`), not HTML5 drag events. Pointer events are not affected by `dragDropEnabled`. This is confirmed by the `@dnd-kit` architecture: "dnd-kit is intentionally not built on the HTML5 Drag and Drop API because it has severe limitations." The `PointerSensor` (the default) works without setting `dragDropEnabled: false`.

**Prevention for BLK-04:**
Use `@dnd-kit/core` with `PointerSensor` only. Do not use `DragSensor` or any library that uses HTML5 `dragstart` events. If proto file drag-drop onto the window is needed (a separate future feature), that uses Tauri's native file drop — which requires `dragDropEnabled: true` (or unset). These two modes are compatible as long as in-app DnD uses pointer events.

Test on Windows during development, not just macOS. Add a Windows-specific smoke test to the CI matrix if one does not exist.

**Requirement:** BLK-04.

---

### 34. `DndContext` must wrap both the block library and the form — shared context required for cross-container drag

**Symptom:**
Drag starts from a block in the block library panel. The drag item disappears (or a ghost appears) but dropping onto the form fields has no effect. The `onDragEnd` handler in `DndContext` reports `over: null`.

**Root cause:**
`@dnd-kit` requires both the draggable source (`useDraggable`) and the droppable target (`useDroppable`) to be inside the **same** `DndContext`. If the block library panel and the form panel are in sibling React subtrees with no shared `DndContext` ancestor, drops across the boundary produce `over: null`. This is a known dnd-kit constraint: "draggables and droppables that belong to different `DndContext` instances cannot interact with each other."

**Prevention for BLK-04:**
Place a single `DndContext` at the layout level — above both the block library panel and the form panel in the component tree. `AppLayout` is the correct insertion point, or a new `BlockDndProvider` wrapper at the same level. Do not add `DndContext` inside either panel individually.

**Requirement:** BLK-04.

---

### 35. Empty form panel has no registered droppable targets — drag ends with `over: null`

**Symptom:**
User drags a block over the form area. The block ghost follows the cursor. On drop, nothing happens. The `onDragEnd` event shows `over: null` even though the cursor was visually over the form.

**Root cause:**
`@dnd-kit` requires each drop target to be registered with `useDroppable`. The form panel is a React tree of individual field components — there is no single "form drop zone" element registered as droppable. When dragging over the form panel area, the cursor is over unregistered DOM elements, so dnd-kit reports `over: null`.

A secondary issue: individual fields within the form cannot easily register as droppable targets because their field paths are dynamic and deeply nested (proto nested messages). Registering each individual field as a droppable target creates hundreds of active drop zones for complex schemas, all of which the dnd-kit collision detection must evaluate on every pointer move frame.

**Prevention for BLK-04:**
Register the entire form panel as a single droppable target with `useDroppable({ id: 'form-panel' })`. BLK-04 spec says "global/type-agnostic" merge — the block contents are merged into matching field names, not dropped onto specific fields. A single large drop zone for the whole form is the correct model and avoids the performance concern of per-field drop zones. In `onDragEnd`, when `over?.id === 'form-panel'`, execute the block merge logic.

**Requirement:** BLK-04.

---

### 36. Radix UI portals capture pointer events during active drag — breaks drag interactions when a popover is open

**Symptom:**
User opens a shadcn/ui Select or DropdownMenu in the block library (e.g., the "..." edit/delete menu on a block item). While that Radix popover is open, the user starts dragging a block. The drag does not initiate — the pointer down event is consumed by Radix's invisible click-outside overlay. Or: drag starts fine but the ghost disappears immediately when the cursor passes over the form area, where a Select dropdown happens to be open.

**Root cause:**
Radix UI renders portals (for Select, Tooltip, DropdownMenu, Popover, Dialog) outside the DndContext React subtree into a `document.body` container. When a Radix popover is open, Radix installs an invisible overlay element (the "dismiss layer") that listens for `pointerdown` events at the document level to detect click-outside. `@dnd-kit`'s `PointerSensor` also listens for `pointerdown` to initiate drag. When the invisible Radix overlay is in front of a draggable element, the Radix overlay captures the `pointerdown` first — Radix closes the popover and the event is not re-dispatched to dnd-kit, so the drag never starts.

Note: this does not affect the DndContext React context (dnd-kit uses React context, not DOM hierarchy). The issue is purely about pointer event capture precedence on the DOM.

**Prevention for BLK-04:**
(1) Dismiss any open Radix popovers before a drag can start: add a `onDragStart` handler in `DndContext` that calls `document.body.click()` or dispatches a synthetic `pointerdown` to force all open Radix dismiss layers to close. (2) Avoid placing block library action menus (edit/delete DropdownMenu) inside the draggable element's drag handle area — move the action buttons to a non-draggable region so pointer events on the menu do not conflict with drag initiation. (3) Use `activationConstraint: { distance: 8 }` on `PointerSensor` — this delays drag activation until the pointer moves 8px, giving Radix time to process any click-outside dismissal before dnd-kit claims the pointer.

**Requirement:** BLK-04.

---

## Block Merge into react-hook-form

### 37. "Fill empty fields only" is ambiguous — proto3 defaults pre-populate every field

**Symptom:**
User fills in several form fields manually, then drags a block onto the form. All their manually-entered values are overwritten by block values, even in fields they explicitly changed.

**Root cause:**
Proto3 defaults pre-populate the entire form on load (all scalars get `""`, `0`, `false`, etc. via `buildDefaultValues`). When block merge logic checks "is this field empty?" using a value-equality test (e.g., `getValues(fieldPath) === "" || getValues(fieldPath) === 0`), every unmodified field appears "empty" — but so does any field where the user happened to type the default value. Conversely, a field the user explicitly set to `0` looks identical to an unmodified field.

**Prevention for BLK-04:**
Use `formState.dirtyFields` to detect user-touched fields, not value comparison. `dirtyFields` is a nested object mirroring the form shape — a field is `true` in `dirtyFields` if its value differs from `defaultValues`. Block merge should call `setValue` only for fields where `getFieldState(fieldPath).isDirty === false`. This correctly distinguishes "user left this at default" from "user explicitly typed a value."

Edge case: `isDirty` compares against `defaultValues` at form initialization. If `defaultValues` was set to the block's own values (e.g., replay path), all fields appear non-dirty. The block store and form initialization must use independent defaults. The form's `defaultValues` must remain the proto schema defaults, never the block values.

**Requirement:** BLK-04.

---

### 38. Block merge path matching is ambiguous for nested proto messages

**Symptom:**
Block contains `{ "name": "Alice" }`. The form has two fields: `user.name` (a string inside a nested `User` message) and `parent.name` (a string inside a `Parent` message). Block merge sets both `user.name` and `parent.name` to "Alice" — the user expected only one to be set.

**Root cause:**
BLK-04 spec says "global/type-agnostic" merge. This means block key names are matched against form field paths. If the block key is `"name"` and the form has multiple fields with path suffix `.name`, the merge strategy must define what "match" means:
- **Top-level only:** match only paths like `name` (no dot) — conservative but misses nested fields entirely
- **Suffix match:** match any path ending in `.name` — fills all matching paths, may fill unintended fields
- **Full-path match:** require the block key to be a full RHF path like `user.name` — explicit but requires the block author to know the form's internal path structure

**Prevention for BLK-04:**
Implement top-level key match as the default behavior: block keys match only the top-level field names in the proto message (e.g., block key `name` matches a field whose RHF path is `name`, not `user.name`). Document this constraint in the block editor UI: "Block keys must match top-level field names in the proto message." Nested fields must use full dot-notation paths (`user.name`) if they are to be filled. Show a warning in the block editor if a key contains a dot but does not match any current schema field.

**Requirement:** BLK-04, BLK-02 (block editor validation).

---

### 39. `setValue` on unregistered fields silently does nothing

**Symptom:**
Block merge runs, calls `setValue('someField', blockValue)` for each matching key. For fields that exist in the block but not in the currently loaded proto schema (or not in the currently rendered form), `setValue` produces no error but also sets nothing. The merge appears to succeed but some block values are not applied.

**Root cause:**
In react-hook-form `mode: onChange`, calling `setValue` on a name that has not been registered via `register` or `Controller` updates the internal store but does not trigger re-renders for unregistered paths, and does not surface an error. If the proto schema was changed (new `.proto` file loaded) since the block was saved, block keys may not correspond to any current field. The merge silently skips them.

**Prevention for BLK-04:**
Before merging, compute the intersection of block keys and registered field names. Use `getValues()` to get all current form paths and diff against block keys. Surface unmatched block keys as a warning toast: "3 block fields did not match current schema: [list]." This is the same user-experience pattern as the JSON override unknown-field warning (pitfall #23).

**Requirement:** BLK-04.

---

### 40. Block merge must not call `reset()` — it must use `setValue` per field to preserve existing state

**Symptom:**
Block merge calls `reset(mergedValues)`. This resets the entire form, clearing all `fieldState` (dirty flags, touched state, validation errors) and resetting all fields — including fields not in the block. The user's work in fields not covered by the block is lost.

**Root cause:**
Pattern #21 (JSON override → use `reset()` for full replacement) does not apply here. Block merge is **partial** — it fills some fields and leaves others intact. `reset()` is a full replacement. Using it for partial merge destroys unrelated field state.

**Prevention for BLK-04:**
Use `setValue(fieldPath, value, { shouldDirty: false, shouldTouch: false })` for each matching field. The `shouldDirty: false` option prevents the block-filled fields from appearing in `dirtyFields` as user-touched — which is consistent with "the block pre-filled this, not the user." This also preserves the `isDirty` signal used in pitfall #37 for subsequent block merges.

Note: `setValue` does not update `useFieldArray` internal `fields` refs for array paths. If a block key targets a `repeated` or `map` field (an array path), use the `replace()` function from the relevant `useFieldArray` instance instead of `setValue`. This is the same constraint documented in pitfall #21.

**Requirement:** BLK-04.

---

### 41. Block JSON values must be coerced to match RHF field types before `setValue`

**Symptom:**
Block contains `{ "user_id": 12345, "status": 1, "active": 1 }`. After merge, `user_id` shows a zod validation error ("Must be an integer (e.g. -9223372036854775808)"), `status` shows no error but submits the wrong value, and `active` cannot be submitted.

**Root cause:**
RHF stores field values in type-specific formats that differ from natural JSON types:
- **int64 / uint64 / sint64 / fixed64 / sfixed64:** `ScalarField.tsx` uses `z.string().regex(...)` and `getInputType` returns `"text"` — values are stored as strings in RHF to avoid JS precision loss for numbers above `Number.MAX_SAFE_INTEGER`. A JSON block providing `{ "user_id": 12345 }` (a JS number) puts a `number` into a slot that zod expects to be a `string`. The validation error fires immediately on the next form interaction.
- **enum fields:** `EnumField.tsx` calls `rhfField.onChange(Number(strVal))` — enums are stored as integer numbers in RHF (not string names). A JSON block providing `{ "status": "ACTIVE" }` (a string name) puts a string into a slot expecting a number. The Select component's `value={String(rhfField.value)}` renders `"ACTIVE"` as the select value, which does not match any `SelectItem value={String(v.number)}`, so the select renders blank.
- **bytes fields:** stored as standard base64 strings. A JSON block providing `{ "data": [72, 101, 108, 108, 111] }` (a byte array) must be base64-encoded before being placed in the field.
- **bool fields** stored as JS `boolean`. A JSON block providing `{ "active": 1 }` (truthy number) puts a number into a slot that the Checkbox `checked={rhfField.value}` coerces — functionally works but bypasses zod `z.boolean()` validation and can produce unexpected type errors.

**Prevention for BLK-04:**
Block merge must coerce each value to the RHF-expected type before calling `setValue`. Write a `coerceBlockValue(value: unknown, fieldKind: FieldKind): unknown` function that applies per-kind coercion:
- `int64` family → `String(value)` if `typeof value === 'number'`
- `enum` → `Number(value)` if `typeof value === 'string'` (look up name in `field.kind.values`)
- `bytes` → base64-encode if value is an array
- `bool` → `Boolean(value)` to normalize truthy integers
- All others → pass through unchanged

Run this coercion in the merge loop before each `setValue` call. Log or toast on coercion failures (e.g., an enum name not found in the descriptor's value list).

**Requirement:** BLK-04, BLK-02 (block editor should store values in coercion-friendly format — prefer strings for int64, numbers for enum).

---

## Block Persistence Pitfalls

### 42. Appending blocks store to `proto-sender.json` risks collisions with existing keys

**Symptom:**
The blocks store is initialized with key `"blocks"` in `proto-sender.json` (the same file used by connection profiles under key `"profiles"` and the theme mode under key `"theme-mode"`). A future key collision (e.g., a profile named "blocks", or a new feature that uses the same key) silently overwrites block data.

**Root cause:**
`proto-sender.json` is the app's primary store for all non-history persistent data (confirmed by `connection.rs` line 46: `app.store("proto-sender.json")`). Using the same file for blocks adds a third unrelated domain. `tauri-plugin-store` uses flat key-value semantics per file — all keys in the same file share a namespace. A key named `"blocks"` in `proto-sender.json` is two characters away from a collision with any future feature that also picks a short common key.

**Prevention for BLK-03:**
Use a dedicated store file: `blocks.json`. Pattern already established by `history.json` (see `useHistoryStore.ts`). Benefits:
- Zero collision risk with `proto-sender.json` keys
- `blocks.json` can be deleted independently to reset the block library without touching profiles or theme
- Store initialization is independent — blocks load asynchronously without blocking profile/theme bootstrap

**Requirement:** BLK-03.

---

### 43. Block store race condition: `appendBlock` fires before store hydration completes

**Symptom:**
App starts. ThemeBootstrap reads `proto-sender.json`. Block library renders immediately. User creates a block before the async `loadBlocks()` call completes. `appendBlock` writes the new block to the store. `loadBlocks()` completes and calls `set({ blocks: saved })`, overwriting the in-memory state and losing the new block.

**Root cause:**
`useHistoryStore.ts` already solves this with a `historyLoaded` flag guard (line 51: `if (!get().historyLoaded) return`). Without the equivalent guard in the block store, a write that races ahead of the initial load is silently overwritten when the load resolves.

**Prevention for BLK-03:**
Mirror the `historyLoaded` pattern exactly: add a `blocksLoaded: boolean` flag to the block store. In `appendBlock`, `updateBlock`, and `deleteBlock`, guard with `if (!get().blocksLoaded) return`. Load `blocksLoaded` at app startup alongside `loadHistory`. The bootstrap sequence in `App.tsx` (or equivalent) must call `loadBlocks()` before the block library panel is interactive.

**Requirement:** BLK-03.

---

### 44. Block store initialization order: blocks panel renders before `loadBlocks()` resolves

**Symptom:**
Block library panel renders with zero blocks on first paint (even if blocks were saved). After a 200–500ms delay, blocks appear. User confusion: "Where did my blocks go?" — then they reappear.

**Root cause:**
`tauri-plugin-store` `load()` is async. The block library component mounts synchronously. If `blocksLoaded` is `false`, the panel renders an empty list. This is functionally correct but visually jarring if not handled.

**Prevention for BLK-03:**
Show a loading skeleton in the block library panel while `!blocksLoaded`. A simple `<Skeleton className="h-8 w-full" />` per expected block slot (or a spinner) prevents the empty-then-populated flash. This is consistent with the approach the connection sidebar already uses while profiles load. Do not show the "No blocks saved" empty state until `blocksLoaded === true`.

**Requirement:** BLK-03, BLK-01 (block library panel UI).

---

### 45. Block schema migration: `blocks.json` has no versioning — adding new required fields silently breaks old data

**Symptom:**
v1.3 ships blocks with `{ id, name, fields: Record<string, unknown> }`. A future milestone adds a `category` field (required) to each block. On app update, the existing `blocks.json` has blocks without `category`. The block list renders but category-dependent sorting/filtering crashes with `undefined` errors.

**Root cause:**
`tauri-plugin-store` stores JSON blobs without schema versioning. Unlike a database migration, there is no migration hook when the app reads a file written by an older version.

**Prevention for BLK-03:**
Apply defensive deserialization: when reading blocks from `blocks.json`, use a schema parser (Zod) that applies defaults for missing fields. If the saved block is missing `category`, Zod's `.default("uncategorized")` silently fills it in. This is the minimum viable migration strategy. Document the block schema version in a `"version"` key in `blocks.json` so future migrations can detect which transformations to apply.

For v1.3, the block schema is simple enough that a Zod parse with defaults covers all forward-compatibility needs without a full migration system.

**Requirement:** BLK-03.

---

## v1.3 Phase Mapping

| Requirement | Pitfall(s) | Address when |
|-------------|-----------|--------------|
| PUBL-02 (publisher confirms badge) | #25 (NACK not an Err), #26 (mandatory=false unroutable ACK), #27 (confirm timeout), #28 (ephemeral local state) | Start of PUBL-02 implementation — Rust command must return `PublishOutcome` enum, not `()` |
| PUBL-01 (routing key autocomplete) | #29 (race condition), #30 (management API unavailable), #31 (wildcard binding keys), #32 (headers exchange), fetch_exchanges must return type | Start of PUBL-01 — `fetch_exchanges` Rust command signature change is a prerequisite |
| BLK-04 (drag-and-drop infrastructure) | #33 (dragDropEnabled on Windows), #34 (DndContext scope), #35 (empty form drop zone), #36 (Radix portal pointer capture) | Before any DnD wiring — `DndContext` placement, droppable registration, and Radix conflict mitigation must be architectural decisions made before component implementation |
| BLK-04 (merge logic) | #37 (dirtyFields for empty detection), #38 (path matching ambiguity), #39 (unregistered field setValue), #40 (setValue not reset), #41 (type coercion before setValue) | During BLK-04 merge implementation — these interact; design the merge function and coercion layer before writing it |
| BLK-03 (block persistence) | #42 (separate store file), #43 (race condition), #44 (loading skeleton), #45 (schema migration) | At BLK-03 design — store file choice and race guard are foundational; skeleton and migration are implementation-time details |

---

## v1.3 Sources

- lapin `Confirmation` enum variants (Ack, Nack, NotRequested): https://docs.rs/lapin/1.4.3/lapin/publisher_confirm/enum.Confirmation.html
- RabbitMQ publisher confirms — `basic.return` with mandatory: https://www.rabbitmq.com/docs/confirms
- RabbitMQ Management API bindings endpoint `/api/exchanges/{vhost}/{name}/bindings/source`: https://www.rabbitmq.com/docs/http-api-reference
- Tauri `dragDropEnabled` intercepts HTML5 DnD on Windows — issue #8581: https://github.com/tauri-apps/tauri/issues/8581
- Tauri `dragDropEnabled` documentation discussion: https://github.com/orgs/tauri-apps/discussions/9696
- @dnd-kit uses pointer events, not HTML5 DnD — architectural rationale: https://docs.dndkit.com/api-documentation/sensors
- @dnd-kit cross-container DndContext requirement: https://github.com/clauderic/dnd-kit/discussions/181
- @dnd-kit empty droppable container issue: https://github.com/clauderic/dnd-kit/issues/708
- Radix UI dismiss layer pointer event capture — known interaction with dnd-kit: https://github.com/clauderic/dnd-kit/issues/291
- react-hook-form `dirtyFields` and `getFieldState`: https://react-hook-form.com/docs/useformstate
- react-hook-form `setValue` options (shouldDirty, shouldTouch): https://react-hook-form.com/docs/useform/setvalue
- Existing codebase: `ScalarField.tsx` lines 42-53 — int64/uint64 use z.string() and input type "text" (confirmed)
- Existing codebase: `EnumField.tsx` line 48 — `rhfField.onChange(Number(strVal))` stores enum as integer (confirmed)
- Existing codebase: `useHistoryStore.ts` historyLoaded race guard pattern
- Existing codebase: `publish.rs` — confirm_select already enabled, Confirmation not matched
- Existing codebase: `PublishBar.tsx` — managementStatus gating pattern, isSending as local state
- Existing codebase: `connection.rs` fetch_exchanges — returns Vec<String>, not Vec<{name, type}>
- Existing codebase: `tauri.conf.json` — dragDropEnabled not set (defaults to OS-level handling)


---

## v1.4 Advanced Response Consumer Pitfalls

The following pitfalls are specific to the v1.4 milestone: replacing the one-at-a-time `basic_get` reader with drain mode and live subscribe mode using `basic_consume`. All findings are grounded in the existing v1.3 codebase — `consume.rs`, `lib.rs`, `useResponseStore.ts`, `ResponseTab.tsx`.

---

## Long-Lived Consumer Lifecycle

### 46. Prefetch count defaults to unlimited — broker dumps entire queue into client buffer

**What goes wrong:**
`lapin` starts a consumer with `basic_consume` and no prior `basic_qos` call. By default, RabbitMQ delivers an unlimited number of messages to the client before any are acked. On a queue with 50,000 messages, the broker pushes all 50,000 into the TCP buffers immediately. The Rust task accumulates them faster than the UI can process and emit events, leading to heap exhaustion (OOM kill of the app) or multi-second UI freeze.

**Why it happens:**
The existing `basic_get` pattern fetches one message at a time — there is no prefetch concept because the caller controls the loop. Switching to `basic_consume` without reading the prefetch documentation replicates the old mental model but breaks under the new delivery model.

**Prevention:**
Always call `channel.basic_qos(prefetch_count, BasicQosOptions::default()).await` before `basic_consume`. For this dev tool, 100–500 is the right range: enough to keep the pipe fed without buffering the whole queue. Drain mode should set prefetch to the requested drain count (e.g., drain-50 → prefetch 50) so the broker stops sending after N messages. Live subscribe mode should use a fixed low prefetch (100–200).

**Warning signs:**
App memory climbs rapidly on subscribe start. UI thread blocks for several seconds before showing the first message.

**Phase to address:** Live subscribe phase — drain mode phase must also set prefetch if using `basic_consume` as the underlying primitive.

---

### 47. `tauri::ipc::Channel<T>` not `app.emit()` for streaming to React

**What goes wrong:**
Developer reaches for `app.emit("amqp-message", payload)` (the global event system) to push each arriving message to the frontend. This creates four interacting problems:

1. **No per-invocation routing.** Global events are broadcast to all windows. If two subscribe calls are active (impossible in v1.4 but easy to hit in future), both listeners receive each other's messages.
2. **Ghost listeners on re-mount.** Every time `ResponseTab` mounts, it calls `listen("amqp-message", handler)`. If the previous unlisten cleanup did not run (component unmounted abnormally, fast re-mount), the handler from the previous mount is still registered. Each arriving message fires the handler twice (or more), producing duplicate rows in the list.
3. **String-keyed routing.** Unique event names per session (e.g., `"amqp-message-"`) are needed to avoid crosstalk — a pattern that introduces a coordination contract between Rust and TypeScript that must be kept in sync.
4. **No backpressure.** `app.emit()` is fire-and-forget with no ordering guarantee under high load.

`tauri::ipc::Channel<T>` is the correct primitive. It is per-invocation (the frontend creates a `new Channel<MsgType>()` and passes it as a command argument), ordered, typed, and automatically scoped to the one invoke call. There are no global event names, no ghost listener risk, and no session ID coordination needed.

**Prevention:**
Design the `start_consume` command signature to accept a `tauri::ipc::Channel<ConsumedMessage>` argument:
```rust
#[tauri::command]
pub async fn start_consume(
    ...,
    on_message: tauri::ipc::Channel<ConsumedMessage>,
) -> Result<(), AppError> { ... }
```
Frontend passes it in invoke:
```typescript
import { invoke, Channel } from '@tauri-apps/api/core';
const onMessage = new Channel<ConsumedMessage>();
onMessage.onmessage = (msg) => addToList(msg);
await invoke('start_consume', { ..., onMessage });
```
The Channel is closed automatically when the command future resolves or the connection is cancelled.

**Warning signs:**
Duplicate rows appearing in the message list. Messages from a previous subscribe session appearing in a new one. Event listener count in DevTools grows on each mount.

**Phase to address:** Live subscribe phase — use Channel<T> from the first implementation; retrofitting from global events is disruptive.

---

### 48. `std::sync::Mutex` on consumer handle state panics when guard is held across await

**What goes wrong:**
The existing `lib.rs` stores the `DescriptorPool` behind a `std::sync::Mutex` (line 33: `Mutex::new(Option::<prost_reflect::DescriptorPool>::None)`). This pattern works because the lock is taken, the pool is cloned (O(1), Arc-backed), and the guard is dropped before any `.await`. The same pattern applied naively to a long-lived consumer handle fails.

A new `Mutex<Option<ConsumerHandle>>` stored in Tauri managed state, with a command that locks the mutex, reads the handle, and then `.await`s a stop signal — holds the `std::sync::MutexGuard` across an async boundary. `std::sync::MutexGuard` is `!Send`. The compiler rejects this with "future is not `Send`" pointing at the guard.

The attempted fix — cloning the handle out before the await — does not work if the handle itself is not cheaply cloneable (e.g., a `lapin::Consumer` stream is not `Clone`).

**Prevention:**
Use `tokio::sync::Mutex` for any state that must be locked across an async boundary (the stop-signal sender, a consumer join handle). Alternatively, store the cancel token (`tokio_util::CancellationToken`) and a task JoinHandle separately:
```rust
// In lib.rs managed state:
Mutex::new(Option::<tokio_util::CancellationToken>::None)
```
The `CancellationToken` is `Clone + Send + Sync`, so it can be taken out of the mutex before the await — no lock held across the async boundary. The consumer task holds its own copy; the stop command holds another.

**Warning signs:**
Compile error: "future is not `Send`" in any command that touches `Mutex<ConsumerState>`. Runtime deadlock if `std::sync::Mutex` is used inside a tokio task that yields.

**Phase to address:** Live subscribe phase — state shape is the first decision.

---

### 49. Stop/cancel design: `basic_cancel` alone does not drain buffered messages

**What goes wrong:**
When user clicks Stop, the command calls `channel.basic_cancel(consumer_tag, BasicCancelOptions::default()).await`. This sends a `basic.cancel` frame to the broker, which stops new deliveries. But the lapin `Consumer` stream is backed by an internal channel that may already hold dozens of messages that the broker delivered before the cancel frame was processed. The consumer task loop is still blocked in `consumer.next().await` and will continue yielding those buffered messages — emitting them to the UI — for an indeterminate period after the user clicked Stop.

The cancel is not instantaneous: messages already in-flight on the TCP connection or buffered in lapin's internal queue are delivered before the stream yields `None`.

**Prevention:**
Use a `tokio_util::CancellationToken` as the primary stop signal. Wrap the consumer loop with `tokio::select!`:
```rust
loop {
    tokio::select! {
        biased;
        _ = token.cancelled() => { break; }
        msg = consumer.next() => {
            match msg { ... }
        }
    }
}
// Drop consumer here — releases the channel
drop(consumer);
let _ = channel.close(0, "consumer stopped").await;
```
The `biased;` directive checks the cancellation branch first on each iteration, so the loop exits as soon as the token is cancelled even if messages are buffered. Messages that were already delivered and are in the `consumer.next()` buffer are discarded after cancellation — document this as "in-flight messages at stop time may not be displayed." For a dev tool, this is acceptable.

**Warning signs:**
Messages continue appearing in the UI 1–2 seconds after Stop is clicked. Stop appears laggy.

**Phase to address:** Live subscribe phase — the select! pattern must be designed before the consumer loop is written.

---

### 50. Race between stop and in-flight ack: already-acked messages lost on stop

**What goes wrong:**
The existing `consume.rs` uses D-10: ack before decode, immediately after receiving the delivery. The same pattern applied in the consumer loop means the broker acks each message the instant `consumer.next().await` resolves — before the message is decoded or emitted to the UI.

If the user clicks Stop between ack and emit (the decode + channel send window), the message is acked (removed from broker queue) but never shown in the UI. From the user's perspective, the queue lost a message.

**Prevention:**
This race is narrow (microseconds) and acceptable for a developer tool. Document explicitly: "Messages acked by the consumer but not yet displayed may be lost if Stop is clicked mid-flight. This is by design — consistent with D-10 ack-before-decode." Do not attempt to buffer acked messages to guarantee display — the complexity outweighs the benefit for this use case.

If the stricter guarantee is needed in a future milestone, reverse the order: decode first, emit to UI via Channel, then ack. This makes decode failure recoverable (re-deliver) but reintroduces the poison-pill problem that D-10 was designed to prevent.

**Warning signs:**
Rare: user reports queue count decreasing by more than the displayed message count when Stop is clicked.

**Phase to address:** Live subscribe phase — document the accepted race at code review time.

---

### 51. Connection drop silently kills the consumer — no UI feedback

**What goes wrong:**
The lapin `Consumer` stream yields `None` when the underlying channel is closed — either explicitly or due to a connection error (broker restart, network drop, TCP timeout). The consumer loop exits normally with no error. If the loop exit is not translated into a UI notification, the live feed just silently stops with no indication to the user.

The app appears stuck: the live feed shows old messages, the Stop button is still enabled, and new messages being published to the queue are not appearing.

**Why it happens:**
Developers implement `while let Some(delivery) = consumer.next().await` loops correctly for the happy path but do not handle the `None` case (stream end).

**Prevention:**
After the consumer loop exits (either by cancellation or by stream end), emit a status event to the frontend. Distinguish the two exit paths:
- Cancelled by user: emit `{ status: "stopped" }` via the Channel before it closes.
- Stream ended unexpectedly: emit `{ status: "disconnected", reason: "AMQP connection lost" }`.

The frontend should transition the UI to a "Disconnected" state that requires the user to re-connect and re-subscribe. Do not auto-reconnect — surfacing the error is sufficient for a dev tool.

Monitor `conn.on_error()` in the consumer task (lapin provides an `on_error` callback on `Connection`) as an alternative signal for network-level failures that do not propagate through the consumer stream immediately.

**Warning signs:**
Live feed stops updating. No error shown. Stop button remains active. Queue depth counter (if implemented) continues rising.

**Phase to address:** Live subscribe phase — exit-path handling must be a first-class concern, not an afterthought.

---

## Tauri Event Streaming to React

### 52. React useEffect event listener not cleaned up — ghost handlers on re-mount

**What goes wrong:**
If `app.emit()` + `listen()` is used despite pitfall #47, every `ResponseTab` mount registers a new handler. If the component unmounts without calling `unlisten()` — either because the cleanup function was omitted from the `useEffect` return or because `listen()` resolves asynchronously and the unlisten promise is not awaited — the previous handler keeps firing. On each re-mount, a new handler stacks on top. After 3 re-mounts, each message produces 3 appends to the list.

This is the single most commonly reported Tauri+React integration bug across the community.

**Why it happens:**
`listen()` returns a `Promise<UnlistenFn>`. Developers write the unlisten in the `useEffect` return but forget that the returned cleanup runs synchronously while the `UnlistenFn` is async-resolved. Naive cleanup:
```typescript
useEffect(() => {
  const unlistenP = listen('amqp-message', handler);
  return () => { unlistenP.then(fn => fn()); }; // WRONG: cleanup is fire-and-forget
}, []);
```
The cleanup fires the unlisten but does not wait for it — if the component remounts before the promise resolves, the old handler is still active.

**Prevention:**
Use `tauri::ipc::Channel<T>` (pitfall #47) to eliminate this entire class of issue. If global events are used for any reason, follow this pattern:
```typescript
useEffect(() => {
  let unlisten: (() => void) | null = null;
  let cancelled = false;
  listen('amqp-message', handler).then(fn => {
    if (cancelled) fn(); // already unmounted
    else unlisten = fn;
  });
  return () => {
    cancelled = true;
    unlisten?.();
  };
}, []);
```

**Warning signs:**
Console shows the handler firing multiple times per message. List row count grows faster than expected.

**Phase to address:** Live subscribe phase — architectural choice (Channel vs emit) prevents this entirely.

---

### 53. Unbounded React list state causes progressive UI freeze at high message rates

**What goes wrong:**
Each arriving AMQP message appends to a `messages: ConsumedMessage[]` array in `useResponseStore`. React re-renders the list on every append. At 100 messages/sec, this is 100 full re-renders per second. At 500 messages/sec, the React scheduler cannot keep up — the UI drops frames and the app becomes unresponsive. The list grows indefinitely: at 10,000 messages, serializing the Zustand state for devtools or persistence alone takes significant CPU.

**Why it happens:**
The single-message pattern (`setLastResult`) in `useResponseStore` does not need a cap. The transition to a list-based store for v1.4 introduces an unbounded accumulation that was not a problem before.

**Prevention:**
Cap the in-memory list at a hard limit (recommended: 500 messages). Apply FIFO truncation on each append:
```typescript
setMessages: (msg) => set((s) => ({
  messages: s.messages.length >= MAX_MESSAGES
    ? [...s.messages.slice(1), msg]  // drop oldest
    : [...s.messages, msg]
})),
```
Show a "Capped at 500 — oldest messages removed" banner when the limit is reached. For high-frequency queues (hundreds/sec), add a UI message rate indicator and recommend enabling filtering to reduce the ingest rate.

For list virtualization: use `react-window` (FixedSizeList or VariableSizeList) for the message list. Without virtualization, rendering 500 DOM rows of expandable message cards becomes slow to scroll. The existing app already has a precedent concern for large lists — message history is capped at 100 (`HIST-CAP-01`). Apply the same philosophy here.

**Warning signs:**
UI frame rate drops below 30fps with more than ~200 messages in the list. Chrome DevTools Performance panel shows long React reconciliation tasks.

**Phase to address:** Both drain mode and live subscribe phases — the list and its cap must exist before either mode appends to it.

---

## Drain Mode Pitfalls

### 54. Drain mode implemented as a `basic_get` loop re-opens a new connection per message

**What goes wrong:**
The simplest drain implementation loops N times calling the existing `consume_message` IPC command (which creates a new lapin connection, fetches one message, acks it, closes the connection). For drain-50, this opens and closes 50 TCP connections to the RabbitMQ broker. On a remote broker, each connection takes 50–300ms to establish. Draining 50 messages takes 2.5–15 seconds instead of under 1 second.

**Why it happens:**
The existing `consume_message` command is already implemented and tested. Calling it in a loop from the frontend is the path of least resistance.

**Prevention:**
Implement drain mode as a single backend command that opens one connection, sets prefetch to N, starts a `basic_consume`, collects up to N messages, stops, and returns all results (or streams them via `Channel<T>`). One connection, one channel, N message deliveries. This is the same infrastructure as live subscribe — drain is just subscribe-with-auto-stop-after-N.

If the frontend-loop approach is kept for simplicity (only acceptable for very small drain counts like ≤5), add a clear comment documenting the connection-per-message overhead and the threshold at which it becomes unacceptable.

**Warning signs:**
Drain of 20+ messages takes noticeably longer than expected. RabbitMQ management UI shows connection count spiking during drain.

**Phase to address:** Drain mode phase — implement as a proper backend command, not a frontend loop.

---

### 55. Drain mode acks all N messages before any are displayed — no partial failure recovery

**What goes wrong:**
Drain command acks each message immediately after receipt (D-10 pattern: ack-before-decode). If the frontend call succeeds but the app crashes before the user sees the results (e.g., process kill mid-drain), all N messages are gone from the queue — unrecoverable.

**Prevention:**
For a developer tool, this risk is acceptable — the same as the existing single-message D-10 behavior. Document it explicitly in the drain mode UI: "Messages are acked immediately. If this session closes before results are displayed, messages will not be re-delivered." Do not reverse the ack-after-decode order to solve this — it reintroduces poison-pill blocking.

For extra resilience (optional, not required for v1.4): after all N messages are acked and decoded, write results to a temporary `drain-session.json` via `tauri-plugin-store` before displaying them. This acts as a crash recovery buffer. Clear it when the user dismisses the drain results or starts a new operation.

**Warning signs:**
User reports messages disappearing from the queue after a drain that showed no results (app crashed between ack and display).

**Phase to address:** Drain mode phase — document the D-10 extension at design time.

---

## DescriptorPool Snapshot Pitfalls

### 56. DescriptorPool snapshot taken at subscribe start — proto schema changes not reflected

**What goes wrong:**
`consume.rs` clones the `DescriptorPool` at command start (line 40-54 pattern). For a long-lived consumer, this snapshot is taken when `start_consume` is invoked. If the user loads a new `.proto` file while the consumer is running, the consumer task continues decoding with the old schema. Messages that use the new schema are decoded incorrectly (fields mapped to wrong names, unknown fields silently ignored) without any error.

**Why it happens:**
The existing pool-clone pattern is correct and efficient for ephemeral commands. Extending it unchanged to long-lived commands silently creates a stale-schema risk.

**Prevention:**
Snapshot the pool at subscribe start. This is the correct behavior for a dev tool — the user chose a schema when they started the subscribe session. Document in the UI: "Schema snapshot taken at subscribe start. Load a new .proto file and re-subscribe to use the updated schema." When a new proto is loaded while the consumer is running, show a warning banner: "Proto schema changed — active consumer is using the old schema. Stop and re-subscribe to decode with the new schema."

This is simpler than re-fetching the pool on each decode and avoids a second lock acquisition per message in the hot path.

**Warning signs:**
User loads a new proto, consumer is still running, decoded fields start showing wrong names or missing fields.

**Phase to address:** Live subscribe phase — add the schema-changed warning at the proto-load command level.

---

## App Shutdown Pitfalls

### 57. App quit while consumer is running leaves tokio task running until OS kills the process

**What goes wrong:**
User closes the app window while a live subscribe session is active. The Tauri window is destroyed, but the tokio task running the consumer loop is still alive, holding a lapin `Connection` and an open TCP socket to the broker. The task continues reading from the consumer stream (and trying to emit to the now-closed Channel or AppHandle). Eventually the task errors out, but the TCP connection may remain open on the broker side until the keep-alive timeout (default: 60s in RabbitMQ).

On the Rust side: if the task panics after the AppHandle is dropped, the panic output goes to stderr but may not be visible to the user. The process exits cleanly but leaves behind a ghost consumer registration in RabbitMQ (visible in management UI as a dangling consumer).

**Prevention:**
Register a `RunEvent::ExitRequested` handler in `lib.rs` that cancels the active consumer token before allowing the process to exit:
```rust
.on_window_event(|_window, event| {
    if let tauri::WindowEvent::Destroyed = event {
        // cancel active consumer if running
    }
})
```
Alternatively, store the `CancellationToken` in managed state and cancel it in the `RunEvent::ExitRequested` callback. The consumer task detects cancellation, closes the channel, and the task future resolves cleanly before the runtime shuts down.

For a developer tool, the impact is low (ghost consumer visible in RabbitMQ management), but it is easy to prevent.

**Warning signs:**
RabbitMQ management UI shows a consumer registered on a queue even after the app is closed. The consumer disappears only after the broker's heartbeat timeout expires.

**Phase to address:** Live subscribe phase — add shutdown hook when the consumer state is first introduced to managed state.

---

## v1.4 Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Re-use existing `consume_message` in a frontend loop for drain | No new Rust code | 1 connection per message — unusably slow for drain > 5 | Never for drain > 5 messages |
| Use `app.emit()` instead of `Channel<T>` | Familiar pattern | Ghost listeners, session crosstalk, no per-invocation typing | Never — use Channel<T> from the start |
| Skip `basic_qos` prefetch | Simpler code | OOM on large queues, entire queue buffered in memory | Never |
| Extend `std::sync::Mutex` to consumer handle | Consistent with pool pattern | Compile error on any await holding the guard | Never — use CancellationToken (Clone+Send) |
| Unbounded messages array in store | Simple append logic | Progressive UI freeze past ~200 messages | Never — cap at 500 from day one |

---

## v1.4 Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| lapin `basic_consume` | No `basic_qos` before consume | Always set prefetch_count before `basic_consume` |
| lapin Consumer stream | `basic_cancel` alone as stop mechanism | `CancellationToken` + `tokio::select! biased` to exit loop, then drop Consumer |
| lapin Consumer stream end | Not handling `None` yield | Translate stream-end to "disconnected" UI state |
| Tauri streaming | `app.emit()` + `listen()` | `tauri::ipc::Channel<T>` passed as command argument |
| Zustand message list | Unbounded array append | FIFO-capped array at 500 + react-window virtualization |
| DescriptorPool in long-lived task | Re-locking mutex per message | Snapshot Arc-clone at task start, warn on proto reload |
| App shutdown | Ignoring exit event | `on_window_event Destroyed` cancels CancellationToken |

---

## v1.4 Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| #46 Prefetch unlimited | Drain phase + Live subscribe phase | Test with a queue containing 1000+ messages — app memory stays stable |
| #47 emit() vs Channel<T> | Live subscribe phase — architectural decision | No duplicate rows on component re-mount; no event name strings in Rust streaming code |
| #48 std::sync::Mutex + await | Live subscribe phase — state design | Compile succeeds; no deadlock under concurrent stop + message arrival |
| #49 basic_cancel + buffered messages | Live subscribe phase — loop design | Stop responds within one consumer.next() iteration (< 1s on idle queue) |
| #50 ack/display race | Live subscribe phase — accepted, document | Code review comment at the ack call site; no "fix" needed |
| #51 Silent connection drop | Live subscribe phase — exit path | Kill broker mid-subscribe; UI shows "Disconnected" within heartbeat interval |
| #52 Ghost listeners | Live subscribe phase — use Channel<T> | Handler fires exactly once per message after 3 rapid tab remounts |
| #53 Unbounded list freeze | Drain + live subscribe phases | UI stays responsive at 500 messages; cap banner appears at limit |
| #54 Loop of basic_get for drain | Drain phase — backend command | Drain-20 completes in < 1 second on local broker |
| #55 Drain ack before display | Drain phase — accepted, document | D-10 extended: code comment + UI tooltip |
| #56 Stale schema snapshot | Live subscribe phase — proto reload warning | Load new proto while consuming; warning banner appears |
| #57 App quit with live consumer | Live subscribe phase — shutdown hook | Close app window; RabbitMQ consumer count returns to 0 immediately |

---

## v1.4 Sources

- Tauri 2 Channel<T> IPC streaming — command argument pattern: https://v2.tauri.app/develop/calling-frontend/ (confirmed: `new Channel<T>()` on frontend, `tauri::ipc::Channel<T>` as command param)
- lapin basic_qos + prefetch_count: https://docs.rs/lapin/latest/lapin/struct.Channel.html#method.basic_qos
- lapin Consumer stream + basic_cancel: https://docs.rs/lapin/latest/lapin/struct.Consumer.html
- tokio_util CancellationToken: https://docs.rs/tokio-util/latest/tokio_util/sync/struct.CancellationToken.html
- tokio::select! biased: https://docs.rs/tokio/latest/tokio/macro.select.html (biased directive — checks branches in order)
- Tauri listen() + UnlistenFn cleanup: https://v2.tauri.app/develop/calling-frontend/#event-system
- RabbitMQ prefetch (basic.qos) documentation: https://www.rabbitmq.com/docs/confirms#channel-qos-prefetch
- Tauri RunEvent::ExitRequested / WindowEvent::Destroyed: https://docs.rs/tauri/latest/tauri/enum.RunEvent.html
- Existing codebase: `consume.rs` — D-10 ack-before-decode, DescriptorPool clone pattern (lines 40–54)
- Existing codebase: `lib.rs` — `std::sync::Mutex<Option<DescriptorPool>>` managed state pattern (line 33)
- Existing codebase: `useResponseStore.ts` — `lastResult` single-result store shape
- Existing codebase: `useHistoryStore.ts` — FIFO cap at 100 (HIST-CAP-01 precedent)
- react-window (FixedSizeList, VariableSizeList): https://react-window.vercel.app/
