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
