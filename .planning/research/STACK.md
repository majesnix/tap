# Stack Research: Proto Sender

**Researched:** 2026-05-17
**Overall confidence:** MEDIUM-HIGH (core Rust picks verified; React form approach is opinionated but well-supported)

---

## Recommended Stack

### Rust Backend

#### Runtime Proto Parsing

**`protox` 0.9.1** — Pure-Rust `.proto` compiler that produces a `FileDescriptorSet` at runtime without needing `protoc` installed.

Use the `Compiler` struct directly:

```rust
use protox::Compiler;

let descriptor_set = Compiler::new(["./proto/includes"])?
    .include_imports(true)
    .include_source_info(false)
    .open_file("my_message.proto")?
    .file_descriptor_set();
```

- `Compiler::new(includes)` — accepts a slice of include paths for import resolution
- `include_imports(true)` — ensures imported `.proto` files appear in the output (needed for `prost-reflect` to resolve nested types)
- `open_file()` / `open_files()` — compile individual files or batches
- Returns a `prost_types::FileDescriptorSet` directly usable by `prost-reflect`

Do NOT use `prost-build` for this — it is a build-time code generator, not a runtime parser. Do NOT use `protoc-rust` — requires the `protoc` binary installed on user machines.

**`prost-reflect` 0.16.3** — Dynamic protobuf message encoding/decoding from a descriptor at runtime. This is the layer that sits between `protox` output and the wire-format bytes you send to RabbitMQ.

Key API:

```rust
use prost_reflect::{DescriptorPool, DynamicMessage, Value};

// Build pool from protox output
let pool = DescriptorPool::from_file_descriptor_set(descriptor_set)?;
let message_desc = pool.get_message_by_name("my.package.MyMessage").unwrap();

// Build message from form values
let mut msg = DynamicMessage::new(message_desc.clone());
msg.set_field_by_name("user_id", Value::U32(42));
msg.set_field_by_name("name", Value::String("alice".to_string()));

// Encode to binary wire format
let mut buf = Vec::new();
msg.encode(&mut buf)?;
```

`DynamicMessage` handles nested messages, repeated fields, enums, and oneof fields. The `MessageDescriptor` exposes field metadata needed to build the React form schema. Enable the `serde` feature for JSON debug output.

**`prost` 0.13.x** — Underlying codec used by both `protox` and `prost-reflect`. Include explicitly in `Cargo.toml` for `Message::encode` trait access.

```toml
[dependencies]
prost = "0.13"
prost-reflect = { version = "0.16", features = ["serde"] }
protox = "0.9"
```

---

#### AMQP Client

**`lapin` 4.7.x** — The standard Rust AMQP 0-9-1 client for RabbitMQ. Actively maintained (4.7.4 released May 2025). Pure async/await. Supports all required operations: `basic_publish`, `exchange_declare`, `queue_declare` (passive), TLS, vhost routing via connection URI.

```toml
[dependencies]
lapin = "4"
```

Key usage pattern:

```rust
use lapin::{Connection, ConnectionProperties, BasicProperties, options::*};

let conn = Connection::connect(
    "amqp://user:pass@host:5672/vhost",
    ConnectionProperties::default()
).await?;

let channel = conn.create_channel().await?;
channel.basic_publish(
    "my_exchange",      // exchange name, or "" for default
    "routing.key",      // routing key
    BasicPublishOptions::default(),
    &proto_bytes,       // encoded protobuf bytes
    BasicProperties::default()
        .with_content_type("application/protobuf".into())
        .with_delivery_mode(2),  // persistent
).await?;
```

**Why not `amqprs`:** `amqprs` is newer and benchmarks better on syscall count, but it has a substantially smaller user base and ecosystem. `lapin` is the de facto standard, appears in all RabbitMQ Rust tutorials, and has broader feature coverage. For a developer tool where publish throughput is not a bottleneck, `lapin`'s maturity wins.

---

#### RabbitMQ Queue/Exchange Discovery

**`reqwest` 0.12.x** against the **RabbitMQ Management HTTP API**.

AMQP 0-9-1 has no protocol-level operation to list queues or exchanges. `queue.declare` with `passive=true` only checks existence of a queue you already know by name — it cannot enumerate. The Management Plugin HTTP API (`GET /api/queues/{vhost}`, `GET /api/exchanges/{vhost}`) is the only reliable approach.

**Consequence and requirement:** The tool requires the RabbitMQ Management Plugin to be enabled on the broker. This plugin is enabled by default on all standard RabbitMQ installations and on all hosted RabbitMQ services (CloudAMQP, Amazon MQ, etc.). Document this as an explicit prerequisite.

```rust
// List queues
let url = format!("http://{}:{}/api/queues/{}", host, mgmt_port, vhost);
let queues: Vec<QueueInfo> = reqwest::Client::new()
    .get(&url)
    .basic_auth(&user, Some(&password))
    .send().await?
    .json().await?;
```

Default management port: `15672`. Add `reqwest` with the `json` feature:

```toml
reqwest = { version = "0.12", features = ["json"] }
```

There is also a dedicated crate `rabbitmq-management-client` that wraps these endpoints, but it adds unnecessary abstraction for the limited surface area needed (just list queues + list exchanges). Use `reqwest` directly.

---

#### Local Profile Storage

**`tauri-plugin-store` 2.x** — Official Tauri plugin for persistent key-value storage. Stores profiles as a JSON file in the platform's app data directory. Survives app restarts. Works from both Rust and JavaScript sides.

```toml
# Cargo.toml
tauri-plugin-store = "2"
```

```bash
npm install @tauri-apps/plugin-store
```

Profiles are JSON objects keyed by profile name. Use `store.json` as the backing file. Each profile: `{ name, host, port, vhost, username, password, mgmt_port }`.

Do NOT use `serde_json` + manual file writes via `tauri-plugin-fs` for profiles. `tauri-plugin-store` handles file location, atomic writes, and cross-platform paths correctly.

---

#### Supporting Rust Crates

| Crate | Version | Purpose |
|-------|---------|---------|
| `tokio` | 1.x | Async runtime (Tauri embeds one; use `tauri::async_runtime::spawn` not `tokio::spawn` directly — see Tauri Integration section) |
| `serde` | 1.x | JSON serialization for IPC data transfer |
| `serde_json` | 1.x | JSON encode/decode for profile data and form schema |
| `thiserror` | 2.x | Ergonomic error types for Tauri commands |
| `tracing` | 0.1 | Structured logging in Rust backend |

---

### React Frontend

#### Dynamic Form Generation

**Approach: hand-rolled renderer using `react-hook-form` 7.x + `zod` 3.x**

Do NOT use `@rjsf/core` (JSON Schema Form). The reason: proto3 descriptors do not map cleanly to JSON Schema. `oneof` fields (proto's union type) have no direct JSON Schema equivalent, and `repeated` fields with nested messages require nested `useFieldArray` patterns that RJSF handles poorly. You would spend more time fighting RJSF's abstractions than building the renderer yourself.

The correct approach:
1. Rust command serializes the `MessageDescriptor` fields into a custom `FieldSchema` JSON array (field name, type, label, enum values, nested message reference)
2. React receives this schema and renders fields by switching on the field type
3. `react-hook-form` + `useFieldArray` handles repeated fields and nested messages
4. `zod` validates proto type constraints (int32 range, required fields, enum membership)

```bash
npm install react-hook-form @hookform/resolvers zod
```

**Why `react-hook-form` over Formik:** RHF is uncontrolled by default (no re-render per keystroke), which matters when a proto schema has 20+ fields. `useFieldArray` is first-class for repeated fields.

---

#### UI Components

**`shadcn/ui` (latest)** — Not a package dependency but a component collection you copy into your project (the shadcn CLI adds components to `src/components/ui/`). Built on Radix UI primitives + Tailwind CSS. Zero runtime overhead beyond what you use. Right choice for a dev tool: accessible, keyboard-navigable, dark-mode-compatible out of the box.

```bash
npx shadcn@latest init
npx shadcn@latest add input select checkbox badge card tabs
```

Components needed: `Input`, `Select` (for enum fields and queue/exchange pickers), `Switch` (for bool fields), `Textarea` (for bytes fields as hex input), `Badge` (for message history), `Card`, `Tabs`, `Button`.

Do NOT use MUI or Ant Design — they impose large bundle sizes and opinionated theming that conflicts with Tauri's native-feel goals. Do NOT use Chakra UI — peer dependency issues with React 19.

---

#### State Management

**Zustand 5.x** — Minimal global state for: active connection profile, selected queue/exchange, message history log. Avoid Redux for a tool of this scope — it is over-engineered. Zustand's atomic slice pattern keeps connection state and history state independent.

```bash
npm install zustand
```

---

#### React Supporting Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `@tauri-apps/api` | 2.x | Core Tauri IPC (`invoke`) |
| `@tauri-apps/plugin-store` | 2.x | Profile storage JS bindings |
| `@tauri-apps/plugin-dialog` | 2.x | Native file picker for `.proto` files |
| `@tauri-apps/plugin-fs` | 2.x | Read `.proto` file content and resolve sibling imports |
| `react-hook-form` | 7.x | Form state, dynamic fields, validation hooks |
| `@hookform/resolvers` | 3.x | Zod resolver adapter |
| `zod` | 3.x | Runtime validation schema for proto field types |
| `zustand` | 5.x | Lightweight global state |
| `tailwindcss` | 4.x | Utility CSS (required by shadcn/ui) |

---

### Tauri Integration

#### IPC Pattern

All backend operations are exposed as Tauri commands. Arguments and return values must be JSON-serializable. Use `#[tauri::command]` on Rust async functions.

```rust
#[tauri::command]
async fn parse_proto(
    file_path: String,
    include_dirs: Vec<String>,
) -> Result<MessageSchemaJson, String> {
    // protox compile → prost-reflect descriptor → serialize to JSON schema
}

#[tauri::command]
async fn publish_message(
    connection_id: String,
    exchange: String,
    routing_key: String,
    field_values: serde_json::Value,
    message_type: String,
) -> Result<(), String> {
    // DynamicMessage build → encode → lapin publish
}

#[tauri::command]
async fn list_queues(profile: ConnectionProfile) -> Result<Vec<QueueInfo>, String> {
    // reqwest → Management API
}
```

Register in `lib.rs`:

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![
        parse_proto,
        publish_message,
        list_queues,
        list_exchanges,
        // ...
    ])
```

#### CRITICAL: Use `tauri::async_runtime::spawn`, NOT `tokio::spawn`

In Tauri 2.x, calling `tokio::spawn` inside window event listeners or certain plugin callbacks causes a panic on Windows. Always use:

```rust
tauri::async_runtime::spawn(async move { /* lapin connection management */ });
```

Tauri owns the Tokio runtime. Do not annotate `main` with `#[tokio::main]` — Tauri initializes its own.

#### File System Access (`.proto` files)

Use `tauri-plugin-dialog` for the file picker (native OS dialog for selecting `.proto` files). Use `tauri-plugin-fs` to read file content. Both require explicit permissions in `src-tauri/capabilities/default.json`:

```json
{
  "permissions": [
    "core:default",
    "store:default",
    "dialog:default",
    "fs:allow-read-file",
    "fs:allow-read-dir"
  ]
}
```

Pass the resolved file path and include directory to the `parse_proto` Tauri command. The Rust backend (via `protox`) handles import resolution on the filesystem — do not try to resolve imports in the frontend.

#### AMQP Connection Lifecycle

Hold AMQP connections in a `tauri::State<Mutex<HashMap<String, lapin::Connection>>>`. Long-lived connections should be managed in Rust, not recreated per publish. Expose connect/disconnect commands explicitly.

---

## Alternatives Considered

| Category | Recommended | Rejected | Reason Rejected |
|----------|-------------|----------|-----------------|
| Proto runtime parsing | `protox` 0.9.1 | `protobuf` crate (stepancheg) | `protobuf` crate's runtime reflection API is more complex and the crate is less actively maintained in 2025; `protox` + `prost-reflect` is the cleaner split |
| Proto runtime parsing | `protox` 0.9.1 | `prost-build` | Build-time only — requires `protoc` and runs at compile time, not usable for loading user files at runtime |
| Dynamic encoding | `prost-reflect` | `protobuf::reflect` (stepancheg crate) | Older API, more verbose, the `prost` ecosystem is the community default |
| AMQP client | `lapin` 4.x | `amqprs` | `amqprs` is faster in benchmarks but `lapin` has larger ecosystem, more tutorials, more community usage; throughput is irrelevant for a dev tool |
| Queue/exchange listing | `reqwest` + Management API | AMQP passive declare | AMQP 0-9-1 has no enumeration operation; passive declare only checks existence of a known name |
| Queue/exchange listing | `reqwest` directly | `rabbitmq-management-client` crate | Thin wrapper adds abstraction over a 2-endpoint use case; `reqwest` is simpler |
| Profile storage | `tauri-plugin-store` | `tauri-plugin-fs` + manual JSON | `tauri-plugin-store` handles atomic writes, app data directory resolution, and cross-platform paths; manual file I/O is unnecessary complexity |
| Form generation | Hand-rolled + `react-hook-form` | `@rjsf/core` | Proto `oneof` and `repeated` fields do not map cleanly to JSON Schema; RJSF fights against the proto type model |
| UI components | `shadcn/ui` | MUI / Ant Design | Bundle bloat; opinionated theming; `shadcn/ui` is zero-dependency (components are source-copied) |
| Global state | Zustand 5 | Redux / Jotai | Redux is over-engineered for this scope; Zustand has simpler ergonomics with same capability |

---

## Version Constraints

| Constraint | Detail |
|------------|--------|
| Rust minimum | 1.77.2+ (required by Tauri 2 plugin ecosystem) |
| `lapin` async runtime | Must use `tauri::async_runtime::spawn`, not bare `tokio::spawn` inside event listeners — causes panic in Tauri 2 on Windows |
| `prost-reflect` + `protox` | Both use `prost_types::FileDescriptorSet` as the handoff type; ensure `prost` versions match (both should pull `prost` 0.13.x) |
| `tauri-plugin-*` | All official Tauri plugins must be on the v2 branch; v1 plugins are incompatible with Tauri 2.x |
| Node / npm | Use Node 20 LTS; Tailwind 4.x requires Node 18+ |
| `reqwest` TLS | Add `features = ["json", "rustls-tls"]` to `reqwest` if targeting Linux musl or avoiding OpenSSL linking issues in cross-compilation |
| `shadcn/ui` | Requires Tailwind CSS 4.x and Radix UI; verify Vite config for Tauri is compatible with Tailwind 4 (uses CSS `@import` rather than `tailwind.config.js` in v4) |
| `#[tokio::main]` conflict | Do NOT add `#[tokio::main]` to the Tauri `main.rs` — Tauri manages the runtime; adding it creates a nested runtime conflict |

---

## Confidence Levels

| Area | Confidence | Reasoning |
|------|------------|-----------|
| `protox` for runtime proto parsing | HIGH | Docs.rs verified at 0.9.1; `Compiler` API confirmed with include paths and `file_descriptor_set()` output; direct integration with `prost-reflect` via `DescriptorPool` confirmed |
| `prost-reflect` dynamic encoding | HIGH | Docs.rs confirmed at 0.16.3; `DynamicMessage`, `DescriptorPool`, `MessageDescriptor` APIs confirmed; oneof and repeated field support is documented |
| `lapin` AMQP client | HIGH | Confirmed active at 4.7.4 (released May 2025); `basic_publish`, `exchange_declare`, `queue_declare` APIs verified via Context7; is the de facto standard |
| Management API for queue listing | HIGH | AMQP 0-9-1 protocol limitation is unambiguous; confirmed by RabbitMQ official docs and multiple sources; Management Plugin is enabled by default on all standard installs |
| `tauri-plugin-store` profiles | HIGH | Official Tauri plugin, v2 confirmed, setup docs verified via v2.tauri.app |
| `tauri::async_runtime::spawn` requirement | HIGH | Confirmed via Tauri GitHub issue #10289 — `tokio::spawn` in event listeners panics on Windows in Tauri 2 |
| `react-hook-form` + `useFieldArray` | HIGH | Version 7.66.0 confirmed; `useFieldArray` for repeated fields, nested objects, and validation are documented and verified |
| shadcn/ui for dev tool UI | MEDIUM | Strong community consensus; version compatibility with Tailwind 4 requires verification during project setup (Tailwind 4 changed config format) |
| Hand-rolled form renderer vs RJSF | MEDIUM | Reasoned recommendation based on proto type system vs JSON Schema mismatch; no head-to-head benchmark available, but the architectural argument is sound |
| `reqwest` 0.12 for Management API | HIGH | Standard HTTP client; no compatibility concerns with the Management API |

---

## Sources

- protox Compiler API: https://docs.rs/protox/latest/protox/struct.Compiler.html
- prost-reflect DynamicMessage: https://docs.rs/prost-reflect/latest/prost_reflect/
- lapin crate (amqp-rs): https://crates.io/crates/lapin
- RabbitMQ AMQP 0-9-1 model (no queue enumeration): https://www.rabbitmq.com/tutorials/amqp-concepts
- tauri-plugin-store setup: https://v2.tauri.app/plugin/store/
- Tauri 2 IPC commands: https://v2.tauri.app/develop/calling-rust/
- Tauri 2 async_runtime spawn: https://docs.rs/tauri/latest/tauri/async_runtime/index.html
- Tauri 2 tokio::spawn panic issue: https://github.com/tauri-apps/tauri/issues/10289
- react-hook-form useFieldArray: https://react-hook-form.com/ (Context7 verified v7.66.0)
- rabbitmq-management-client crate: https://github.com/stefandanaita/rabbitmq-management-client
