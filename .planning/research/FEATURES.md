# Features Research: Proto Sender

**Domain:** Developer desktop tool — RabbitMQ + protobuf message testing
**Researched:** 2026-05-17
**Analogous tools studied:** RabbitMQ Management UI, RabbitGUI, Kreya, BloomRPC, grpcui, MQTT Explorer, Postman

---

## Table Stakes (must have or users will leave)

These are features whose absence causes immediate abandonment. Every comparable tool ships all of them.

| Feature | Rationale | Source signal |
|---------|-----------|---------------|
| **Named connection profiles** | Developers work against dev/staging/prod simultaneously. Switching should be a single click. The built-in RabbitMQ management UI forces repeated logins per tab — this is its most-cited pain point. | RabbitGUI blog, Postman environments pattern |
| **Live queue + exchange list** | Users should not type queue names by hand. Fetching the list via the management API removes a whole class of typo errors and lets users discover what exists. | RabbitMQ management plugin, RabbitGUI |
| **Direct-to-queue and exchange + routing key publish modes** | Both patterns are used daily. Direct queue publish is for testing consumers directly. Exchange + routing key is how production systems work. Omitting either cripples half the use cases. | RabbitMQ AMQP model docs |
| **Form-based proto field editor (type-aware)** | Typed input per field (string, int32/64, float, bool, enum dropdown, bytes) is what separates this tool from pasting raw JSON. This is the core differentiator of the whole category. grpcui pioneered it; users explicitly praise it over JSON-only editors. | grpcui docs, urmaul.com review |
| **Nested message support (recursive)** | Real proto schemas are never flat. Any tool that only handles top-level scalar fields is unusable on production schemas. | Proto language guide, Applied Intuition blog |
| **Repeated field support (add/remove entries)** | Repeated fields are ubiquitous in real schemas (lists, arrays). The UI needs an "add item" / "remove item" control per repeated field. | Proto language guide, grpcui |
| **Enum rendered as dropdown** | Enums typed as raw integers are error-prone and opaque. Dropdown with named values is expected. | grpcui behavior, general UI expectation |
| **Message history log with re-send** | Every send-once tool frustrates users immediately when they need to tweak one field and resend. History is Postman's #2 most-used feature. | Postman docs, MQTT Explorer history |
| **Send status feedback** | Confirm the message was accepted by the broker, or show a meaningful error. Without this, users cannot tell if their message was published. | Postman, general UX expectation |
| **Runtime `.proto` file loading (no compile step)** | Explicitly required by PROJECT.md. Also: this is why tools like BloomRPC won market share — zero build step. | PROJECT.md, BloomRPC |
| **Import resolution from filesystem** | Proto files routinely import other proto files. A tool that fails on `import "common/types.proto"` is unusable on any real codebase. | PROJECT.md, proto language guide |
| **Content-Type AMQP property** | The consumer needs to know how to interpret the payload. Setting `application/x-protobuf` is standard practice. Without it, consumers often fail silently. | RabbitMQ publishers docs |
| **Delivery mode (persistent vs transient)** | Persistent = message survives broker restart. This distinction matters for integration testing. | RabbitMQ publishers docs |

---

## Differentiators (competitive advantage for v1)

These features are not universally present in comparable tools. Shipping one or two of them creates meaningful advantage over the baseline (management UI + curl).

| Feature | Value proposition | Effort estimate | Source signal |
|---------|-------------------|-----------------|---------------|
| **Dual mode: form + raw JSON** | Power users want to paste a serialized JSON fixture without filling 40 fields. grpcui offers this and it is specifically praised. Implement form as the primary mode with a "JSON override" toggle. | Medium — form state must roundtrip to/from JSON representation | grpcui, urmaul.com |
| **oneof rendered as radio/select** | `oneof` fields are notoriously awkward in form UIs. Rendering them as a radio group (select one variant, others collapse) is the correct UX. buf.build documents how painful raw oneofs are. | Medium — requires tracking which branch is active | buf.build blog, proto language guide |
| **Pre-populated defaults from schema** | On form load, pre-fill scalar fields with zero-value defaults (0, "", false) so the form is always valid and sendable immediately. Removes the "blank form" friction that frustrates new users. | Low | grpcui observation |
| **Field-level validation feedback** | Highlight fields with type mismatches inline (e.g., "not a valid int32", "required field empty") before the user hits send. BloomRPC's auto-fill was praised for exactly this feedback loop. | Medium | BloomRPC feature notes |
| **Routing key autocomplete from exchange bindings** | Fetch the binding list from the management API and suggest routing keys for the selected exchange. The default management UI has zero autocomplete here — it is explicitly called out as a pain point. | Medium — requires management API call for bindings | RabbitMQ management docs |
| **Full AMQP property panel (collapsed by default)** | Expose all AMQP message properties (content-type, content-encoding, message-id, correlation-id, reply-to, expiration/TTL, timestamp, app-id, user-id, type, priority 0–9, delivery mode) in a collapsible section. Advanced users need these for integration testing; beginners should not be overwhelmed. | Low — mostly text/number inputs | RabbitMQ publishers docs |
| **Custom headers (key-value pairs)** | Arbitrary headers are required for header exchanges and for consumer-side metadata expectations. A dynamic key-value table (add/remove rows) is the correct UI pattern. | Low | RabbitMQ AMQP model docs |
| **Connection test on profile save** | Attempt AMQP connect when the user saves a profile and report success/failure immediately. Prevents "why isn't it working?" confusion later. | Low | RabbitGUI UX pattern |
| **History search / filter** | When history grows beyond 20 entries, users need to find a past message by schema name, queue, or partial content. Even simple substring filter on message type + queue name is enough for v1. | Low | MQTT Explorer history, Postman history tab |

---

## Anti-Features (deliberately NOT build)

These features look obvious but add disproportionate complexity and are explicitly out of scope or should stay out.

| Anti-Feature | Why avoid | What to do instead |
|--------------|-----------|-------------------|
| **Message consumption / queue reading** | PROJECT.md out of scope. Adding consume mode doubles the surface area (threading, ack/nack, message rendering) for zero benefit to the core send-test loop. | Stay send-only. If users need to verify a message arrived, they use the RabbitMQ management UI or their consumer logs. |
| **Real-time stream monitoring** | Out of scope. Turns a focused tool into a broker dashboard. | Defer entirely. |
| **Team-shared cloud sync of profiles/history** | PROJECT.md explicitly out of scope. Introduces auth, backend, privacy concerns. | Profiles live in local config files (git-diffable is a bonus). No sync in v1. |
| **Non-protobuf message formats (JSON, Avro, etc.)** | Out of scope for v1. Each format needs its own schema/editor paradigm. | Binary protobuf only. Content-type header can still be set freely. |
| **Pre-compiled descriptor (`.pb`) import** | Proto compilation step is what the tool eliminates. Adding `.pb` support creates a parallel workflow that undermines the core value prop. | Runtime `.proto` file parsing only. |
| **Schema registry integration** | Adds external dependency, version management, network calls. High complexity for a dev tool where devs already have the `.proto` file. | File-based loading only. |
| **Request scripting / pre-send hooks** | Postman's scripting is powerful but is the #1 source of complexity complaints. Unnecessary for a publish-only tool. | Use environment variable interpolation instead if dynamic values are needed later. |
| **Visual exchange/queue topology graph** | Pretty but zero value for send-test workflow. | Show flat lists with key attributes. |
| **OAuth or SSO for RabbitMQ connection** | PROJECT.md says each user manages own credentials. Complex auth flows are not needed for team dev instances. | Username + password + vhost in named profiles. |
| **Plugin architecture** | Premature generality. Add complexity only when concrete extension needs emerge. | Hard-code the feature set for v1. |

---

## Feature Complexity Notes

Features that look simple but contain hidden implementation depth.

### Import resolution for `.proto` files
**Surface complexity:** "Just follow the import path."
**Actual complexity:** Proto imports can be relative or absolute, may reference Google well-known types (`google/protobuf/timestamp.proto`, `google/protobuf/any.proto`, etc.) that are bundled with `protoc` but not with the user's project. The tool must either bundle the well-known types or detect and resolve them from a known location. The Rust `prost` / `protox` ecosystem handles this, but it requires thought at design time.
**Recommendation:** Bundle `google/protobuf/*.proto` well-known types in the binary and check them as a fallback before filesystem resolution.

### `oneof` field rendering
**Surface complexity:** "Show a dropdown to pick which variant."
**Actual complexity:** The active variant changes which fields are visible and valid. State management must track which `oneof` branch is selected per message instance, especially in nested or repeated contexts. A nested message with a `oneof` inside a `repeated` list multiplies this state.
**Recommendation:** Design the form state as a tree that mirrors the proto descriptor graph; each `oneof` node carries a `selectedBranch` discriminator.

### `bytes` field input
**Surface complexity:** "Accept a string."
**Actual complexity:** Bytes fields are raw binary. User input must be accepted as base64 (standard proto JSON mapping), but users may expect hex or UTF-8 text. The tool must choose a convention and communicate it clearly. protobuf.js accepts base64 via `fromObject`.
**Recommendation:** Accept base64 input with a placeholder label. Add a "paste as text (UTF-8)" helper button in v1 if feedback demands it.

### `google.protobuf.Timestamp` and other well-known types
**Surface complexity:** "Render as a date picker."
**Actual complexity:** Well-known types have their own JSON mapping (Timestamp serializes as RFC 3339 string). If the form state uses proto JSON mapping throughout, well-known types need special-cased rendering (date/time picker for Timestamp, a number for Duration, etc.). If they are treated as opaque nested messages, users get confusing `seconds`/`nanos` fields.
**Recommendation:** Detect well-known type URLs and render purpose-built controls (datetime picker for Timestamp, numeric input for Duration). Enumerate the ~15 well-known types; most projects only use 3–4.

### AMQP property panel — `expiration` field
**Surface complexity:** "A text box for TTL."
**Actual complexity:** RabbitMQ `expiration` is a string, not an integer, even though it represents milliseconds. A numeric input must be stored and sent as a string. Mistyping causes silent discard of the property.
**Recommendation:** Validate as a non-negative integer, stringify before publish, label as "TTL (ms)".

### Message history replay with schema evolution
**Surface complexity:** "Re-send the stored message."
**Actual complexity:** The user may have modified the `.proto` file since the message was recorded. The stored payload (field values) may not match the current schema (renamed fields, removed fields, added required fields). The tool must handle this gracefully — either by matching on field names (lenient) or surfacing a warning when the schema no longer matches the replay payload.
**Recommendation:** Store history as a JSON snapshot of form state keyed by message type full name. On replay, attempt to load into current form; surface any unrecognized or missing fields as warnings rather than hard errors.

---

## Dependencies Between Features

```
Runtime .proto loading
  └─► Import resolution from filesystem
        └─► Well-known types bundled in binary
              └─► Form generation (all field types)
                    ├─► Scalar fields (string, int, float, bool)
                    ├─► Enum → dropdown
                    ├─► Repeated fields → add/remove list
                    ├─► oneof → radio/select + conditional visibility
                    ├─► Nested message → recursive form section
                    └─► bytes field → base64 input

Connection profiles
  └─► Connection test on save
        └─► Live queue + exchange list fetch
              ├─► Direct-to-queue publish target picker
              └─► Exchange + routing key publish target picker
                    └─► Routing key autocomplete from bindings [differentiator]

Message publish
  ├─► Requires: Form generation (payload)
  ├─► Requires: Connection profiles (broker)
  ├─► Requires: Publish target picker (queue/exchange)
  ├─► AMQP property panel (content-type, delivery mode, TTL, etc.)
  ├─► Custom headers key-value table
  └─► Send status feedback

Message history
  ├─► Requires: Message publish (entries to log)
  ├─► Re-send / replay
  │     └─► Schema evolution warning [complexity note above]
  └─► History search / filter [differentiator]

Dual mode (form + JSON) [differentiator]
  └─► Requires: Form generation (as source of truth)
        └─► JSON roundtrip must preserve all field values including oneof, repeated, bytes
```

---

## Sources

- [RabbitMQ Publishers docs](https://www.rabbitmq.com/docs/publishers) — authoritative list of AMQP message properties (HIGH confidence)
- [RabbitMQ Management Plugin](https://www.rabbitmq.com/docs/management) — management UI capabilities (HIGH confidence)
- [RabbitGUI: A better RabbitMQ UI](https://rabbitgui.com/blog/a-better-rabbitmq-ui) — pain points with default management UI (MEDIUM confidence)
- [grpcui GitHub](https://github.com/fullstorydev/grpcui) — form vs JSON dual mode, well-known type support (HIGH confidence)
- [Kreya gRPC operations docs](https://kreya.app/docs/operations/grpc/) — environment + metadata patterns (MEDIUM confidence)
- [BloomRPC GitHub](https://github.com/bloomrpc/bloomrpc) — auto-fill, streaming, feature gaps (MEDIUM confidence — project deprecated)
- [Good gRPC GUI Clients](https://urmaul.com/blog/good-grpc-gui-clients/) — form mode preference, grpcui vs Warthog analysis (MEDIUM confidence)
- [buf.build: fixing oneofs](https://buf.build/blog/fixing-oneofs) — oneof pain points (HIGH confidence)
- [Applied Intuition: auto-generated GUIs from proto](https://www.appliedintuition.com/blog/auto-generated-guis-with-scenario-editor) — proto descriptor graph UI pattern (MEDIUM confidence)
- [RabbitMQ AMQP 0-9-1 Model](https://www.rabbitmq.com/tutorials/amqp-concepts) — exchange types, routing key, headers exchange (HIGH confidence)
- [Postman docs: variables and history](https://learning.postman.com/docs/sending-requests/variables/variables-intro) — environment/collection patterns (HIGH confidence)
- [Tauri secure storage discussion](https://github.com/orgs/tauri-apps/discussions/7846) — OS keyring for credentials (MEDIUM confidence)

---

---

# v1.2 Form Improvements: Feature Research

**Researched:** 2026-05-18
**Scope:** Three new features only — BytesField upgrade, MapField, JSON override toggle
**Method:** Proto3 spec (protobuf.dev), codebase archaeology (existing form patterns), protocol spec verification
**Overall confidence:** HIGH (spec-derived) for proto behavior; MEDIUM for UX patterns (inferred from grpcui, Kreya, tool analogues)

---

## BytesField

### Table Stakes

| Behavior | Why Required | Proto Spec Basis |
|----------|--------------|-----------------|
| Default mode is base64 text input | bytes maps to base64-encoded string per proto3 JSON mapping spec. Every proto-aware tool (grpcui, Kreya, buf CLI) uses base64 as the canonical text representation. | proto3 JSON mapping: "bytes" → base64 string, standard alphabet, with padding |
| Validate as legal base64 on blur | An input that accepts arbitrary text and silently sends corrupt bytes is worse than no input. Validation must reject characters outside `[A-Za-z0-9+/=]` and flag incorrect padding. | Base64 RFC 4648 §4 |
| Clearly label the field as "base64" | Users who don't know proto will type plain text into the box and get garbage wire data. The label is a contract. Existing `ScalarField` already shows a "bytes (base64)" badge — this behavior must be preserved and strengthened. | UX requirement derived from existing codebase (ScalarField.tsx line 146–149) |
| Show byte count (decoded length) | Users need confirmation that their base64 decoded to the expected number of bytes. "14 bytes" next to the input closes the feedback loop. | Practical UX for a dev tool |
| Empty string is valid (zero-length bytes) | Proto bytes default is empty (`b""`). Form must allow an empty base64 input and encode it as zero-length bytes, not as an error. | proto3 scalar default: bytes default = empty byte string |

### Differentiators

| Behavior | Value | Implementation Notes |
|----------|-------|---------------------|
| UTF-8 text helper button | Developers frequently want to send a string payload as bytes (e.g., a JSON body stored in a bytes field). The button converts the current text input (treated as UTF-8) to its base64 encoding in one click, replacing the field value. This eliminates manual base64 encoding. | One-shot transform: take input string → TextEncoder → base64 → set field value. NOT a persistent mode — keeps the base64-always contract. This answers the task spec ambiguity: it is a conversion button, not a toggle. |
| Hex view of decoded bytes | Show the decoded bytes as a hex string beneath the input (e.g., `48 65 6c 6c 6f`) for users who think in hex. Read-only display only. | Low complexity, high debuggability. Can reuse existing `bytesToHex` utility in FormPanel.tsx. |
| File-upload-to-base64 | Load a binary file from disk and populate the field with its base64 encoding. Useful for embedding thumbnails, certificate PEM bodies, etc. | Deferred — uses `@tauri-apps/plugin-fs` but adds UI surface. Not table stakes. |

### Proto Spec Notes

- **Wire format:** bytes fields use wire type 2 (length-delimited). The raw bytes sent on the wire are the decoded binary from the base64 input — not the base64 string itself. The form stores base64; `prost-reflect` decodes to `Vec<u8>` before encoding.
- **JSON mapping (proto3 spec, HIGH confidence):** bytes → base64-encoded string using standard alphabet (`+` and `/`) with padding (`=`). URL-safe alphabet (`-` and `_`) is NOT standard — do not accept it without explicit mention in requirements.
- **Empty value:** An empty base64 string `""` encodes to zero-length bytes `b""`. This is the proto3 default and must be valid input.
- **Current state in codebase:** `ScalarField` dispatches bytes as `kind.scalar === "bytes"` → `inputType = "text"`, no validation beyond `z.string()`, only a badge label. The `BytesField` upgrade replaces this inline dispatch with a dedicated component.
- **Integration point:** `ProtoFormRenderer` already routes `case "scalar"` to `ScalarField`. `BytesField` can be extracted from `ScalarField` by adding a branch on `scalar === "bytes"` inside `renderField`, or by delegating from within `ScalarField` itself. Either is clean; the dedicated-component approach is preferred for testability.

### Complexity: Low

Single-field upgrade. No new form state shape. No new `FieldKind` type needed. The only complexity is the base64 validation regex and the UTF-8 conversion button logic.

---

## MapField

### Table Stakes

| Behavior | Why Required | Proto Spec Basis |
|----------|--------------|-----------------|
| Render as dynamic key-value row list | A map is conceptually a dictionary. A row list (key input + value input + remove button per row, plus an add-row button) is the only UX that communicates this without confusion. Attempting to use a flat repeated list or a single textarea would be unusable. | proto3 maps spec: `map<K,V>` is a repeated key-value pair on the wire |
| Add row appends a new empty key-value pair | Same interaction as RepeatedField "Add item". Row gets default empty key and default value for the value type. | Expected from repeated-field pattern established in existing codebase |
| Remove button per row | Mirror of RepeatedField "Remove" button. | Existing pattern |
| Key input typed by map key type | The key input must match the declared key scalar type: string key → text input; integral key (int32/uint32/int64/etc.) → numeric or text input with range validation; bool key → checkbox or dropdown. | proto3 map spec: "Map keys can be any integral or string type" — NOT float, double, bytes, enum, or message |
| Value input typed by value type | The value column must render the correct widget: scalar → ScalarField-equivalent; enum → EnumField-equivalent; nested message → collapsed NestedMessageField or inline fields. | proto3 map spec: "any type except another map" is allowed as value |
| Duplicate key warning | The spec says last-key-wins on parse, but silently allowing duplicate keys in the editor leads to data loss (the user types two entries thinking both will send, only one does). Surface a warning inline when two rows share the same key. | proto3 JSON mapping: map → `{"k": v}` object — a JSON object cannot have duplicate keys (RFC 7159) |
| Empty map is valid (zero rows) | Proto default for a map field is an empty map. Zero rows must be accepted and encoded as an empty map, not as an error. | proto3 scalar defaults |

### Differentiators

| Behavior | Value | Notes |
|----------|-------|-------|
| Key sorting option | Proto3 text format sorts map keys numerically/lexicographically. The UI does not need to sort, but an optional "sort by key" button would help users visually verify large maps. | Low priority for a dev tool — deferred. |
| Paste from JSON object | Allow pasting `{"key1": "val1", "key2": "val2"}` into a textarea and populating rows from it. Power user shortcut. | Medium complexity — needs JSON parse + row generation. Not table stakes. |

### Proto Spec Notes

- **Key type restriction (HIGH confidence, verified against protobuf.dev):** Only integral scalars and `string` are allowed. Specifically allowed: `int32`, `int64`, `uint32`, `uint64`, `sint32`, `sint64`, `fixed32`, `fixed64`, `sfixed32`, `sfixed64`, `bool`, `string`. Forbidden: `float`, `double`, `bytes`, any enum, any message type. The form renderer must enforce this — if the schema declares a forbidden key type, surface an "unsupported map key type" placeholder rather than crashing.
- **Value type restriction:** Any type except another map field. Messages are allowed as values, so the value column can recursively render a `NestedMessageField`. This is the most complex case.
- **Wire format:** `map<K,V>` is sugar for `repeated MapFieldEntry { key=1; value=2; }`. `prost-reflect` handles this transparently — no special Rust command changes needed. The form simply needs to produce the correct JSON shape `{"k": v}` for encoding.
- **JSON mapping (HIGH confidence):** `map<K,V>` → JSON object `{"key": value}`. Integer keys are serialized as JSON string keys (e.g., `map<int32, string>` → `{"42": "hello"}`). This matters for the JSON override mode interaction: a map with integer keys that a user edits as raw JSON must use quoted numeric strings, not bare integers, or the encoder will reject it.
- **Ordering:** Wire ordering is undefined. Map field iteration order is not guaranteed. Do not present rows in a way that implies ordering is preserved (no "row 1, row 2" numbering that implies array semantics).
- **Duplicate key behavior:** Spec says last-key-wins during parsing. For the editor, warn on duplicate keys rather than silently accepting them — data loss is unintuitive.
- **New FieldKind needed:** The existing `FieldKind` union in `src/lib/types.ts` has no `map` variant. A new variant must be added: `{ type: "map"; key_scalar: ScalarKind; value_kind: FieldKind }`. The Rust backend's schema serialization must be updated to emit this variant when it encounters a `prost_reflect::Kind::Map`.
- **Integration point (dependency on RepeatedField):** `MapField` should mirror `RepeatedField` structurally. Use `useFieldArray` with control from `useFormContext`. Each row is `{ key: string | number | boolean, value: unknown }`. The `renderItem` prop pattern from `RepeatedField` is reusable for rendering the value column.
- **ProtoFormRenderer dispatch:** `renderField` must add a `case "map"` branch that renders `<MapField>`. The `repeated` flag on a `FieldSchema` is separate — a map field is not `repeated: true`, it is `kind.type === "map"`. Verify that the Rust schema serializer sets this correctly.

### Complexity: Medium

Requires a new `FieldKind` variant in the TypeScript type system, a schema serialization change in the Rust backend (`src-tauri`), and a new `MapField` component. The value-is-message case (recursive rendering) is the hardest edge. Duplicate key detection adds a validation pass over the field array on each change.

---

## JSON Override Toggle

### Table Stakes

| Behavior | Why Required | Proto Spec Basis |
|----------|--------------|-----------------|
| Toggle button switches between form view and JSON editor | The primary UX contract. One click enters JSON mode, one click exits. The form is hidden while in JSON mode; the JSON editor is hidden while in form mode. | grpcui pattern, developer tool convention |
| Form → JSON on entering JSON mode | When the user clicks "Edit as JSON", serialize current form values to proto3 JSON and populate the editor. The user sees exactly what they've filled in. | proto3 JSON mapping: field names as lowerCamelCase by default |
| JSON → form on exiting JSON mode | When the user clicks "Back to Form", parse the JSON and call `form.reset(parsedValues)` to restore form state. The existing `resetRef` pattern in `ProtoFormRenderer` supports this. | Existing codebase: `resetRef.current(values)` triggers `methods.reset(values)` |
| Invalid JSON blocks exit with inline error | If the JSON editor contains a syntax error, the "Back to Form" button must show an error and refuse to switch. Do not clobber existing form state with a parse failure. | Data integrity requirement |
| JSON editor has syntax highlighting | A plain textarea for JSON is adequate but hostile. A code editor with JSON highlighting is table stakes for developer tools. Even minimal coloring (string/number/key distinction) prevents transcription errors. | Developer tool expectation — Postman, Insomnia, grpcui all use code editors |

### Differentiators

| Behavior | Value | Notes |
|----------|-------|-------|
| JSON validation against proto schema on exit | Beyond syntax check, validate that the parsed JSON has the correct field names and types for the current message schema. Surface semantic errors (e.g., "field 'foo' is not in schema", "field 'bar' expected string, got number") before corrupting form state. | Medium complexity — requires walking the schema and parsed object in parallel. High value for correctness. |
| Live JSON validation (as-you-type) | Highlight JSON syntax errors in the editor in real time. Prevents the user from typing a large payload and discovering errors only on exit. | Depends on editor component capability (CodeMirror/Monaco provide this natively). |
| Format/prettify button | One-click pretty-print the raw JSON in the editor. Useful when the user pastes a minified payload. | Low complexity if the editor exposes a `setValue(JSON.stringify(JSON.parse(v), null, 2))` API. |
| Preserve unknown fields on round-trip | If the user types a field in JSON that is not in the schema, and then returns to form mode and back to JSON, preserve that field rather than stripping it. | Low priority for a dev tool — schema-validated editing is the primary mode. Deferred. |

### Proto Spec Notes (HIGH confidence — verified against protobuf.dev)

The JSON override mode must produce and consume valid proto3 JSON. The following encoding rules govern what the editor displays and what the parser must accept:

**Field naming:**
- Serializer emits lowerCamelCase field names (e.g., `foo_bar` → `"fooBar"`). If the field has a `json_name` option, that takes precedence.
- Parser accepts BOTH lowerCamelCase AND original proto field names (snake_case). The form-to-JSON serializer should emit lowerCamelCase for consistency; the JSON-to-form parser should tolerate both.

**Type-specific JSON encodings (all required for correct round-trip):**

| Proto Type | JSON Encoding | Notes |
|------------|--------------|-------|
| `int64`, `uint64`, `sint64`, `fixed64`, `sfixed64` | JSON string `"1234"` | JS `number` is IEEE 754 double — values > 2^53 lose precision. Must be string. |
| `float`, `double` special values | `"NaN"`, `"Infinity"`, `"-Infinity"` as strings | All other float/double values are JSON numbers. |
| `bytes` | base64-encoded string (standard alphabet) | Same as BytesField. Padding required on output. |
| `enum` | Named string (e.g., `"FOO_BAR"`) by default; integer accepted on parse | Parser must also accept the integer value. |
| `bool` | JSON `true`/`false` | |
| `map<K,V>` | JSON object `{"k": v}` — integer keys serialized as string keys | e.g., `map<int32,string>` with key 42 → `{"42": "hello"}` |
| `repeated V` | JSON array `[v, ...]` | |
| `google.protobuf.Timestamp` | RFC 3339 string `"1972-01-01T10:00:20.021Z"` | |
| `google.protobuf.Duration` | String `"1.5s"`, `"1.000340012s"` | |
| `google.protobuf.Any` | Object `{"@type": "type.googleapis.com/...", ...fields}` | |
| `google.protobuf.FieldMask` | Comma-separated lowerCamelCase string `"f.fooBar,h"` | |
| `google.protobuf.Struct` | JSON object | |
| `google.protobuf.Value` | Any JSON value | |
| `google.protobuf.ListValue` | JSON array | |
| `google.protobuf.NullValue` | `null` | |
| Wrapper types (`google.protobuf.Int32Value`, etc.) | Primitive or `null` | |

**Default value emission:**
- Fields at their proto3 default value (0, `""`, `false`, empty array, empty map) should NOT be emitted by the serializer. This matches the proto3 spec and prevents the JSON editor from being cluttered with zero-value noise.
- Parser must treat a missing field as the proto3 default. Do not error on absent fields.
- Parser option "always emit fields with default values" is a non-default opt-in — do not enable it by default.

**Unknown fields:**
- Proto3 JSON parser rejects unknown field names by default. The editor must warn the user if they type a field name not present in the schema.
- An "ignore unknown fields" mode is a spec-defined parser option — expose it as a checkbox if needed, but default to strict.

**oneof in JSON:**
- A oneof group can have at most one member set. The JSON object should contain only one field from the oneof. If the user types multiple oneof members in the JSON editor, the last one wins per spec. The form-to-JSON serializer must emit only the active branch's field.
- On JSON-to-form parse, if multiple oneof members are present, detect the last one and set `_selected` accordingly for the `OneofField` state model.

**Null semantics:**
- Parser accepts `null` for any field, treating it as "unset" (proto3 default). Serializer must NOT emit `null` (except `google.protobuf.NullValue`).
- `null` is forbidden inside `repeated` arrays.

**Critical edge cases for two-way sync (highest risk area of this feature):**

1. **Invalid JSON on exit:** Stay in JSON mode, show parse error, do not touch form state. No data loss.
2. **Schema mismatch on exit:** Parse succeeds but field names/types do not match schema. Options: (a) warn and allow, loading only recognized fields; (b) block exit. Recommendation: warn and allow — drop unknown fields, coerce known fields. Strict block is too hostile for a dev tool.
3. **oneof round-trip:** Form has oneof active branch "variant_a". Serialize to JSON → only "variantA" key present. User does not change it. Parse back → detect "variantA" → set `_selected = "variant_a"`. This must be reliable.
4. **Default-value churn:** If the serializer emits default values (0, ""), the form will pre-populate them on round-trip even if the user left them empty. Use the proto3 default: do not emit default values. On parse, missing = default.
5. **int64 string keys in maps:** A map with int32 keys serializes as `{"42": "hello"}`. When the user edits this JSON and exits, the parser must recognize `"42"` as integer key 42, not string key "42". The existing form state for int64/uint64 scalars already uses string representation (confirmed in `ScalarField.tsx` lines 43–53) — this is consistent.

### JSON Editor Component Requirement

The JSON override mode needs a code editor widget with:
- JSON syntax highlighting
- Error annotation (line-level error markers)
- Controlled value (set programmatically on mode entry)

This is a library decision (CodeMirror 6 vs Monaco vs simple textarea with highlighting). This research file does not prescribe the library — that belongs in STACK.md. Note that Monaco is heavy (~2MB gzipped); CodeMirror 6 is ~30KB core and is the standard choice for Tauri/Electron apps where bundle size matters.

### Complexity: High

This is the highest-complexity feature of the three. The JSON editor is a new UI surface with a library dependency. The two-way sync has multiple error modes that must all be handled without data loss. The full scope of proto3 JSON encoding must be implemented correctly for round-trip fidelity — this includes all existing form features (oneof, repeated, nested messages, WellKnownTypes, enums, bytes, and now map). The `buildDefaultValues` function in `ProtoFormRenderer.tsx` and the `pendingReplayValues` / `resetRef` machinery in `FormPanel.tsx` are the integration points.

**Dependency on existing features:** JSON override must round-trip ALL existing form field types correctly, not just the three new ones in v1.2. This means the implementation must handle oneof `_selected` state, nested message null-vs-populated state, WellKnownType string representations, and enum integer-vs-name encoding — before writing a single line of new code for bytes or map.

---

## v1.2 Feature Dependency Map

```
BytesField (Low)
  └─► Upgrade from ScalarField dispatch (inline branch on scalar === "bytes")
        └─► New BytesField component replaces bytes case in renderField
              └─► base64 validation (z.string().regex)
              └─► UTF-8 helper button (one-shot: TextEncoder → btoa)
              └─► byte count display (atob(value).length)

MapField (Medium)
  ├─► New FieldKind variant: { type: "map"; key_scalar: ScalarKind; value_kind: FieldKind }
  ├─► Rust backend schema serializer must emit map FieldKind
  ├─► New MapField component (mirrors RepeatedField structure)
  │     └─► useFieldArray rows: { key, value }
  │     └─► key column: ScalarField-equivalent for key_scalar type
  │     └─► value column: renderItem(value_kind) — recursive renderField call
  │     └─► duplicate key detection: warn inline
  └─► ProtoFormRenderer dispatch: new case "map"

JSON Override Toggle (High)
  ├─► Depends on all existing form field types round-tripping correctly via proto3 JSON spec
  ├─► Depends on BytesField (base64 encoding in JSON)
  ├─► Depends on MapField (map → JSON object encoding)
  ├─► New FormPanel UI: toggle button, mode state (form | json)
  ├─► Form → JSON: serialize latestValues using proto3 JSON rules
  │     └─► lowerCamelCase field names
  │     └─► int64/uint64 → string
  │     └─► bytes → base64 string
  │     └─► enums → named string
  │     └─► oneof → emit only active branch field
  │     └─► map<intKey,V> → {"42": v} (string-quoted keys)
  │     └─► omit default values
  ├─► JSON editor component (syntax highlighting, error markers)
  └─► JSON → Form: parse JSON, validate against schema, call resetRef.current(parsed)
        └─► invalid JSON: show error, block exit
        └─► schema mismatch: warn, load recognized fields only
        └─► oneof: detect active branch, set _selected
        └─► missing fields: treat as proto3 default
```

---

## Sources (v1.2 additions)

- [Proto3 JSON Mapping — protobuf.dev](https://protobuf.dev/programming-guides/json/) — canonical JSON encoding rules for all proto types (HIGH confidence — official spec)
- [Proto3 Maps — protobuf.dev](https://protobuf.dev/programming-guides/proto3/#maps) — map key/value type restrictions, wire format, ordering, duplicate handling (HIGH confidence — official spec)
- [RFC 4648: Base64 Data Encodings](https://datatracker.ietf.org/doc/html/rfc4648) — base64 alphabet and padding rules (HIGH confidence)
- Existing codebase (`src/components/form/fields/ScalarField.tsx`) — current bytes handling, int64 string representation pattern (HIGH confidence — primary source)
- Existing codebase (`src/components/form/fields/RepeatedField.tsx`) — useFieldArray pattern reusable for MapField rows (HIGH confidence — primary source)
- Existing codebase (`src/lib/types.ts`) — current FieldKind union, confirms no map variant exists (HIGH confidence — primary source)
- Existing codebase (`src/components/form/FormPanel.tsx`) — resetRef/pendingReplayValues integration points for JSON-to-form sync (HIGH confidence — primary source)

---

---

# v1.3 Publishing UX + Message Blocks: Feature Research

**Researched:** 2026-05-19
**Scope:** Three features — Routing key autocomplete (PUBL-01), Publisher confirms badge (PUBL-02), Message block library (BLK-01 through BLK-04)
**Method:** RabbitMQ HTTP API reference (official docs), lapin 4.x docs.rs, AMQP internals, Postman/Bruno/Insomnia docs, UX pattern analysis
**Overall confidence:** HIGH for RabbitMQ API specifics and lapin API; MEDIUM for block library UX patterns (no direct analogues — closest tools use variable interpolation, not field-merge)

---

## Routing Key Autocomplete

### RabbitMQ Management API — Verified Endpoint Specification

**Endpoint for bindings where a specific exchange is the source (HIGH confidence — official HTTP API reference):**

```
GET /api/exchanges/{vhost}/{name}/bindings/source
```

- `{vhost}` must be URL-encoded (e.g., `/` → `%2F`)
- `{name}` is the exchange name
- Returns a JSON array of binding objects

**Binding object fields (HIGH confidence — verified from RabbitMQ HTTP API reference):**

| Field | Type | Description |
|-------|------|-------------|
| `source` | string | Exchange name (same as `{name}` in URL) |
| `destination` | string | Queue or exchange name the binding points to |
| `destination_type` | string | `"queue"` or `"exchange"` |
| `routing_key` | string | The routing key for this binding — extract this for autocomplete |
| `arguments` | object | Binding arguments (headers exchange uses this; direct/topic/fanout use `{}`) |
| `properties_key` | string | Composite identifier used as binding identifier in REST API (hash of routing_key + arguments) |
| `vhost` | string | Virtual host |

**Example response item:**
```json
{
  "source": "my-exchange",
  "vhost": "/",
  "destination": "my-queue",
  "destination_type": "queue",
  "routing_key": "orders.created",
  "arguments": {},
  "properties_key": "orders.created"
}
```

**For autocomplete:** collect all unique non-empty `routing_key` values from the response array.

### Exchange Type Constraint — Critical

**Headers exchanges** route by `arguments` (the `x-match` header and custom key-value headers), not by `routing_key`. For a headers exchange binding, `routing_key` is always `""` (empty string). Suggesting empty strings as autocomplete options is useless noise.

**Detection:** The exchange object (already fetched for the exchange dropdown) includes `"type": "headers"`. Suppress routing key autocomplete entirely when the selected exchange type is `"headers"`. Show a tooltip or disabled state explaining "Headers exchange routes by arguments, not routing key."

**Fanout exchanges** also always produce empty `routing_key` bindings. Same suppression applies (`"type": "fanout"`).

**Direct and topic exchanges** produce meaningful `routing_key` values — autocomplete is valuable here.

### Table Stakes

| Behavior | Rationale | Complexity |
|----------|-----------|------------|
| Fetch bindings from `GET /api/exchanges/{vhost}/{name}/bindings/source` when exchange is selected | Without this, the input is a blank text box — same as the RabbitMQ management UI that users already find painful | Low — one reqwest call, reuses existing auth credentials from active profile |
| Display unique non-empty routing keys as a dropdown suggestion list | Eliminates the primary pain point: having to look up valid routing keys manually | Low — deduplicate array, render combobox |
| Suppress autocomplete for headers/fanout exchanges | Those exchange types do not use routing key for routing — showing suggestions would mislead | Low — check exchange type before triggering fetch |
| Allow free text entry even when suggestions exist | The user may want to use a routing key not yet bound (e.g., new binding they are testing) | Existing behavior to preserve — combobox, not a locked select |
| Show fetch error gracefully | Management API may not be enabled, or exchange may have no bindings | Low — show empty suggestion list with "No bindings found" message, do not block publish |

### Differentiators

| Behavior | Value | Complexity |
|----------|-------|------------|
| Instant filter on existing suggestions (no debounce) | The binding list is fetched once per exchange selection and stored in component state. Filtering is client-side substring match on the cached list — no additional network calls. Instant response, no debounce needed. | None — filter is a `.filter()` on already-fetched array |
| Show destination queue name alongside routing key | Displaying `orders.created → orders-queue` helps users confirm they're targeting the right binding | Low — display `routing_key` + `destination` in each suggestion row |
| Re-fetch on exchange change, not on every keypress | Cache per exchange name. Invalidate when exchange selection changes. | Low — single state variable per selected exchange |

### Anti-Features

| Anti-Feature | Why Avoid |
|--------------|-----------|
| Debounced server search per keystroke | The total number of bindings per exchange is small (typically < 50). Fetching once and filtering client-side is always faster and does not add AMQP/HTTP load. Debouncing is for server-side search over large datasets. |
| Locking the input to suggestion values only (select, not combobox) | Users testing new routing key patterns before they are bound need free text entry. A locked select would block valid use cases. |
| Fetching all bindings (`GET /api/bindings/{vhost}`) then filtering | The exchange-scoped endpoint is purpose-built and returns only relevant bindings. The cluster-wide endpoint can return hundreds of rows from unrelated exchanges. |

### Complexity: Low

Single `reqwest` call on exchange selection, JSON array parsing, client-side deduplication, combobox UI. Reuses the existing Management API auth pattern from queue/exchange list fetching. The only non-trivial part is the UI: a combobox input with an inline suggestion dropdown. The shadcn/ui `Command` component (already in the project for search-style dropdowns) is a direct fit.

**Integration points:**
- Rust: new `fetch_exchange_bindings(exchange: &str, vhost: &str) -> Vec<BindingInfo>` command, mirrors existing `fetch_queues`/`fetch_exchanges` pattern
- React: `useExchangeBindings(exchangeName, vhost)` hook fetches on mount/exchange-change, exposes `routingKeys: string[]`
- PublishBar: routing key input upgrades from plain `<Input>` to a combobox that shows `routingKeys` as suggestions

---

## Publisher Confirms

### AMQP Confirm-Select Mode — Verified API (HIGH confidence — lapin 4.7.4 docs.rs)

**How it works in lapin:**

```rust
// 1. Enable confirm mode on the channel (once per channel, before any publish)
channel.confirm_select(ConfirmSelectOptions::default()).await?;

// 2. basic_publish returns PublisherConfirm (a Future)
let publisher_confirm: PublisherConfirm = channel
    .basic_publish(exchange, routing_key, options, payload, properties)
    .await?;

// 3. Await the PublisherConfirm to get the broker's acknowledgement
let confirmation: Confirmation = publisher_confirm.await?;

// 4. Check result
match confirmation {
    Confirmation::Ack(_) => { /* broker accepted the message */ }
    Confirmation::Nack(_) => { /* broker rejected — abnormal queue exit */ }
    Confirmation::NotRequested => { /* confirm mode was not enabled */ }
}
```

**Note:** `basic_publish` is awaited twice: once for the method response (returns `PublisherConfirm`), once for the confirmation itself (returns `Confirmation`). This is the idiomatic lapin pattern.

**The `Confirmation` enum (HIGH confidence — docs.rs verified):**
- `Ack(Option<BasicReturnMessage>)` — message accepted by broker
- `Nack(Option<BasicReturnMessage>)` — message rejected (see NACK semantics below)
- `NotRequested` — channel not in confirm mode

### NACK Semantics — What It Actually Means

**NACK is NOT a routing failure.** This is a common misconception.

- **NACK cause (HIGH confidence — RabbitMQ internals doc):** Sent when a queue that should have handled the message has exited abnormally (e.g., queue crash, queue deletion with pending messages). This is rare in normal operation.
- **Routing failure (no binding match) + `mandatory: false`:** Message is silently discarded or sent to an alternate exchange. The broker sends an **ACK** (it accepted and discarded the message). No NACK.
- **Routing failure + `mandatory: true`:** Message is returned via `basic.return` and an ACK is still sent. A `BasicReturnMessage` is carried in the `Ack(Some(...))` variant.
- **Queue full:** Not a standard NACK trigger. RabbitMQ uses flow control and `basic.return` for this, not confirms NACK.

**Practical implication for UX:** The vast majority of confirms in a dev tool will be ACK. NACK is exceptional. Design the badge for ACK-is-normal, not ACK-is-rare.

### Expected Latency

Confirms are asynchronous broker acknowledgements. In a local or LAN RabbitMQ:
- Transient messages (delivery-mode 1): confirm arrives after broker enqueues the message — typically **< 5ms** on localhost
- Persistent messages (delivery-mode 2): confirm arrives after broker writes to disk — typically **10–50ms** on SSD, up to **200ms** on HDD or network storage
- No published latency data in official docs (MEDIUM confidence — inferred from AMQP spec and community knowledge)

For a dev tool the round-trip (publish + confirm) will feel instantaneous on localhost. On a remote broker over VPN it may be 50–200ms. Design for up to 500ms before showing a timeout fallback.

### Table Stakes

| Behavior | Rationale | Complexity |
|----------|-----------|------------|
| Show ACK badge (green) after successful confirm | Closes the feedback loop that currently only shows HTTP-level send success, not broker-level acceptance | Low — match on `Confirmation::Ack` |
| Show NACK badge (red/amber) when broker rejects | Rare but must be surfaced; without it the user has no signal that something went wrong at broker level | Low — match on `Confirmation::Nack` |
| Auto-dismiss badge after ~3 seconds | Ephemeral feedback — does not block the UI, disappears without user action | Low — `setTimeout` + CSS transition, or Zustand ephemeral state |
| Badge positioned adjacent to the Send button | Send button is the action point; feedback belongs close to where the action was taken | Design decision — inline in PublishBar |
| Timeout/error state if confirm never arrives | Network partition, broker crash, or very slow disk can delay confirms indefinitely | Low — race `publisher_confirm.await` against a timeout future |

### Differentiators

| Behavior | Value | Complexity |
|----------|-------|------------|
| Show "Returned" sub-state when ACK carries a BasicReturnMessage | When `mandatory: true` and no binding matches, the message is returned AND confirmed. This is the only way the user knows their message was unroutable. Display as "Returned" in amber alongside the ACK green badge. | Medium — requires checking `Ack(Some(return_msg))` vs `Ack(None)` |
| Include delivery time in badge tooltip | "ACK in 12ms" reassures users the broker is healthy; "ACK in 450ms" warns of slow disk or network | Low — timestamp before/after, display in tooltip |

### Anti-Features

| Anti-Feature | Why Avoid |
|--------------|-----------|
| Blocking the Send button until confirm arrives | Confirms can take up to 500ms on slow disk. Blocking the UI that long for a dev tool is hostile. Show the badge asynchronously after send returns. |
| Persistent confirm history | The existing message history already logs sends. A separate confirm log duplicates data with no incremental value. |
| Treating NACK as "message not delivered to consumer" | NACK only means broker-level rejection (abnormal queue exit), not consumer-level delivery failure. Mislabeling it would mislead developers. |
| Per-batch confirms via `wait_for_confirms()` | The dev tool sends one message at a time. `wait_for_confirms()` is for batch publishing. Use per-message `publisher_confirm.await`. |

### Badge UX Specification

State machine for the badge after the user clicks Send:

```
[idle] → [sending] → [ack]     auto-dismiss after 3s → [idle]
                   → [nack]    auto-dismiss after 5s → [idle]
                   → [returned] auto-dismiss after 5s → [idle]
                   → [timeout] stays until user dismisses → [idle]
```

Colors (shadcn/ui semantic tokens):
- ACK: green (`text-green-600`, `bg-green-50` / dark: `text-green-400`, `bg-green-950`)
- NACK: red (`text-red-600`, `bg-red-50`)
- Returned: amber (`text-amber-600`, `bg-amber-50`) — with tooltip explaining "message was returned (no binding matched)"
- Timeout: gray with a warning icon

Positioning: inline in the PublishBar, to the right of the Send button. Not a toast — toasts are for non-action-adjacent feedback. A badge inline with the action is the correct pattern for per-action status (Carbon Design System "status indicators" pattern).

### Complexity: Low-Medium

The lapin API is straightforward. The main complexity is:
1. Tauri command must return both the send success AND the confirm result — requires returning from the command only after the second `await`, or returning a structured result with both outcomes
2. Badge state transitions and auto-dismiss in React require a small state machine (idle → pending → ack/nack/timeout → idle) — manageable with a single `useReducer` or Zustand slice
3. The existing ephemeral connection pattern (one connection per operation) means each publish creates a new channel — `confirm_select` must be called on that channel before `basic_publish`

**Integration point:** The existing `publish_message` Tauri command must be modified to: (1) call `confirm_select` before `basic_publish`, (2) await the `PublisherConfirm`, (3) return a `ConfirmResult { acked: bool, returned: bool }` alongside the existing success/error return.

---

## Message Blocks

### What This Feature Is (and Is Not)

The closest analogues in developer tools are:

| Tool | Feature | Mechanism |
|------|---------|-----------|
| Postman | Environments / Variables | `{{variable_name}}` interpolation into request bodies and URLs |
| Bruno | Variables (global, env, collection, folder) | `{{var}}` interpolation, dotenv files |
| Insomnia | Environments | `{{ _.variable }}` Nunjucks template interpolation |
| Postman | Collection-level body examples | Saved JSON snippets selectable per request |

**The critical analogy mismatch:** Postman/Bruno/Insomnia use variable *interpolation* (inserting scalar values into string templates). The message blocks feature is field *merging* (copying key-value pairs from a saved JSON object into the current form state). These are architecturally different. The tools do not provide a direct UX template to follow.

The closest real analogue is Postman's "Examples" feature (saved request/response pairs per endpoint), but even that does full-body replacement, not selective field merge.

### Table Stakes

| Behavior | Rationale | Complexity |
|----------|-----------|------------|
| Collapsible panel listing saved blocks by name | The primary surface for the library. Collapsed by default — does not reduce form real estate unless user opens it. | Low — shadcn/ui Collapsible or Sheet, list of named blocks |
| Create block: named JSON key-value editor | User creates a block by giving it a name and editing JSON. The block is a flat or nested JSON object whose keys are proto field names. | Low — name input + CodeMirror JSON editor (already in project from v1.2) |
| Edit existing block | Double-click or edit button opens the JSON editor populated with current block content. | Low |
| Delete block with confirmation | No accidental deletion. | Low |
| Persist blocks across restarts via tauri-plugin-store | Blocks are reused across sessions — this is the entire value proposition. | Low — same pattern as connection profiles |
| Drag-and-drop block onto form → merge fills empty fields only | Core interaction. Dragging a block onto the form panel applies block key-value pairs to matching form fields, but only if the field is currently empty. Does not overwrite user-entered values. | Medium — HTML5 drag-and-drop or react-dnd; form field matching logic |

### Merge Semantics — The Hard Part

The v1.3 requirement says "merge fills empty fields only, global/type-agnostic." This is the correct starting behavior (non-destructive), but the "type-agnostic" qualifier introduces a set of failure modes that must be explicitly handled.

**Merge algorithm (recommended):**

```
for each key in block JSON:
  1. Find the form field whose name matches key
     - Match on proto field name (snake_case) first
     - Fall back to lowerCamelCase match (consistent with JSON toggle)
  2. If no matching field: skip silently (log to console for debugging)
  3. If matching field has a non-empty value: skip (non-destructive)
  4. If matching field is empty:
     a. Attempt to set the field value from block JSON value
     b. Trigger RHF validation on that field
     c. If validation fails: revert to empty, surface warning inline
```

**Failure modes (all must be handled explicitly):**

| Failure Mode | Example | Recommended Handling |
|--------------|---------|---------------------|
| Field name mismatch (snake_case vs camelCase) | Block has `"userId"`, form field is `user_id` | Normalize to snake_case before matching; fall back to camelCase if no match |
| Type coercion failure | Block has `"count": "not-a-number"`, form field is `int32` | Attempt coerce, trigger zod validation; if invalid, skip the field and show warning banner "Block field 'count' has incompatible type — skipped" |
| Schema A block applied to Schema B form | Block created for `OrderRequest` has `"orderId"`, current schema is `UserRequest` with no `orderId` | Skip silently — non-matching keys are ignored. The user sees no error unless they expect a field to be filled. |
| Merging into `repeated` fields | Block has `"items": [...]`, form field is `repeated Item` | Append block items to existing list (or replace if field is empty). Complex — repeated fields use `useFieldArray` whose `append`/`replace` methods must be called explicitly. |
| Merging into `oneof` fields | Block has `"variantA": {...}`, form has a `oneof` with `variant_a` branch | Set `_selected` to the matching oneof branch and populate the branch fields. Requires knowing the oneof structure from schema context. |
| Merging into nested messages | Block has `"address": {"city": "Berlin"}` | Recursively apply to nested message sub-fields. |
| Merging `bytes` field | Block has `"payload": "aGVsbG8="` | Treat as base64 string; set value; trigger base64 validation. |
| Map field merge | Block has `"metadata": {"env": "prod"}` | Replace the map rows if the field is empty; append or ignore if non-empty. |

**The `oneof` and `repeated` cases require schema awareness.** A purely type-agnostic merge that just calls `setValue(key, value)` will silently fail for `oneof` (the `_selected` discriminator won't update) and produce invalid form state for `repeated` fields (cannot set an array directly on an `useFieldArray`-managed field). The implementation must be schema-aware for these cases.

### Differentiators

| Behavior | Value | Complexity |
|----------|-------|------------|
| Click-to-apply alternative to drag-and-drop | Not all users want drag-and-drop. A "Apply" button on each block card achieves the same merge via click. | Low — same merge logic, different trigger |
| Block preview on hover | Show a collapsed preview of the block's JSON when hovering over the block name in the list. Helps user confirm which block to use without opening the editor. | Low — tooltip with JSON snippet |
| Block tagging / grouping | Group blocks by message type (e.g., "OrderRequest blocks" vs "UserRequest blocks"). Helps as the library grows beyond 5–10 blocks. | Medium — add a `tags` field to block schema |

### Anti-Features

| Anti-Feature | Why Avoid |
|--------------|-----------|
| Type-coercion without user notification | Silently coercing `"true"` (string) to `true` (bool) or `"42"` to `42` (int) hides the mismatch. Always validate after coerce and warn on failure. |
| Overwriting non-empty fields | "Apply block merges ALL fields, including filled ones" is the wrong default. Non-destructive merge (empty-only) is safer. Add a "force apply" option only if user demand is clear. |
| Sharing blocks across proto schemas without warning | A block created for `OrderRequest` is meaningless for `UserRequest`. There is no schema tagging in v1.3 scope — silently skipping non-matching keys is acceptable. Do not attempt cross-schema type coercion. |
| Nested drag-and-drop (block-onto-field level) | Field-level drop targets multiply the UI surface significantly. Block-onto-form-panel is sufficient. |
| Block version history | Block edits are not reversible in v1.3. Undo is out of scope. |
| Auto-generating blocks from history entries | Useful but adds scope. Defer to a future milestone. |

### Complexity: Medium

The JSON editor and persistence are Low. The drag-and-drop interaction is Low-Medium (HTML5 drag events on a div target, or `@dnd-kit/core` if the existing project already has it). The merge algorithm is Medium because of the `oneof`, `repeated`, and nested message edge cases — a naive `setValue` loop will not work for these.

**The biggest risk:** The merge function needs access to the form's schema descriptor to handle oneof and repeated fields correctly. This means the merge function must be co-located with the form renderer where schema context is available (or the schema must be passed as a parameter).

**Integration points:**
- New `BlockLibraryPanel` component (collapsible, beside or below the form)
- New `useBlockLibrary` hook (CRUD operations + tauri-plugin-store persistence)
- `mergeBlockIntoForm(block: Record<string, unknown>, schema: MessageSchema, formMethods: UseFormReturn)` utility function — the core algorithm
- Drag target: the `FormPanel` or its outermost `<div>` becomes a drop zone; drag-over highlights the panel border

### v1.3 Feature Dependency Map

```
PUBL-01: Routing Key Autocomplete (Low)
  ├─► New Rust command: fetch_exchange_bindings(exchange, vhost) → Vec<BindingInfo>
  │     └─► Reuses: existing reqwest + Management API auth pattern
  └─► React: RoutingKeyCombobox component replaces plain Input in PublishBar
        └─► useExchangeBindings(exchangeName, vhost) hook
        └─► Client-side filtering on cached binding list

PUBL-02: Publisher Confirms Badge (Low-Medium)
  ├─► Rust: modify publish_message to call confirm_select + await PublisherConfirm
  │     └─► Returns ConfirmResult { acked: bool, returned: bool, error: Option<String> }
  └─► React: ConfirmBadge component in PublishBar
        └─► State machine: idle → pending → ack|nack|returned|timeout → idle
        └─► Auto-dismiss: 3s for ack, 5s for nack/returned, manual for timeout

BLK-01/02/03: Block Library Panel + Editor + Persistence (Low)
  ├─► BlockLibraryPanel (collapsible panel, block list)
  ├─► BlockEditor (name input + CodeMirror JSON editor — reuse @uiw/react-codemirror from v1.2)
  └─► useBlockLibrary hook (tauri-plugin-store, same pattern as connection profiles)

BLK-04: Drag-and-Drop Merge (Medium)
  ├─► Depends on: BLK-01/02/03 (blocks must exist before merging)
  ├─► Depends on: FormPanel schema context (for oneof/repeated awareness)
  └─► mergeBlockIntoForm(block, schema, formMethods) utility
        ├─► Field name normalization (snake_case ↔ camelCase)
        ├─► Empty-field-only guard (skip non-empty)
        ├─► Type validation via zod after set (skip + warn on failure)
        ├─► Special handling: repeated (append), oneof (_selected), nested (recursive)
        └─► Warning banner: "N fields skipped (type mismatch or already filled)"
```

---

## Sources (v1.3 additions)

- [RabbitMQ HTTP API Reference](https://www.rabbitmq.com/docs/http-api-reference) — `/api/exchanges/{vhost}/{name}/bindings/source` endpoint verified, binding object fields listed (HIGH confidence — official docs)
- [RabbitMQ Publishers docs](https://www.rabbitmq.com/docs/publishers) — mandatory flag, ACK/NACK semantics, return messages (HIGH confidence — official docs)
- [RabbitMQ Internals: Publisher Confirms](https://github.com/rabbitmq/internals/blob/master/publisher_confirms.md) — NACK means abnormal queue exit, not routing failure (HIGH confidence — official internals doc)
- [lapin 4.7.4 — Channel struct](https://docs.rs/lapin/latest/lapin/struct.Channel.html) — `confirm_select`, `basic_publish` → `PublisherConfirm`, `wait_for_confirms` signatures (HIGH confidence — docs.rs)
- [lapin 4.7.4 — PublisherConfirm struct](https://docs.rs/lapin/latest/lapin/struct.PublisherConfirm.html) — implements `Future<Output = Result<Confirmation, Error>>` (HIGH confidence — docs.rs)
- [lapin 4.7.4 — Confirmation enum](https://docs.rs/lapin/latest/lapin/enum.Confirmation.html) — `Ack(Option<BasicReturnMessage>)`, `Nack(Option<BasicReturnMessage>)`, `NotRequested` variants (HIGH confidence — docs.rs)
- [RabbitMQ Exchanges docs](https://www.rabbitmq.com/docs/exchanges) — headers exchange ignores routing_key, routes by arguments; fanout ignores routing_key (HIGH confidence — official docs)
- [Carbon Design System: Status Indicator Pattern](https://carbondesignsystem.com/patterns/status-indicator-pattern/) — badge vs toast vs inline indicator positioning guidance (MEDIUM confidence — authoritative design system)
- [NN/g: Indicators, Validations, Notifications](https://www.nngroup.com/articles/indicators-validations-notifications/) — notification timing and dismissal patterns (HIGH confidence — authoritative UX research)
- [Postman docs: Variables and Environments](https://learning.postman.com/docs/sending-requests/variables/variables-intro) — variable interpolation mechanism (confirmed NOT field merge) (HIGH confidence — official docs)
- [Bruno docs](https://docs.usebruno.com/) — variable scoping, environment files (MEDIUM confidence — official docs, not directly applicable)
- [RabbitMQ AMQP 0-9-1 Model](https://www.rabbitmq.com/tutorials/amqp-concepts) — exchange types, binding semantics (HIGH confidence — official docs)
