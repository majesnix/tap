# Architecture Research: Proto Sender

**Researched:** 2026-05-17
**Confidence:** HIGH (all critical claims verified against official docs, docs.rs, and Context7)

---

## Component Overview

The application has six distinct components with clear ownership boundaries. Four live in Rust (backend), three live in React (frontend).

```
┌─────────────────────────────────────────────────────────────────┐
│  React Frontend                                                 │
│  ┌───────────────────┐   ┌────────────────────────────────┐    │
│  │  ProtoFormEngine  │   │  ConnectionProfileManager      │    │
│  │  (UI only)        │   │  (UI only)                     │    │
│  └───────────────────┘   └────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  MessageHistoryView  (UI only)                           │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                          │  Tauri IPC (commands + events)
┌─────────────────────────────────────────────────────────────────┐
│  Rust Backend                                                   │
│  ┌─────────────────────┐   ┌───────────────────────────────┐   │
│  │  ProtoEngine        │   │  AmqpBroker                   │   │
│  │  (protox +          │   │  (lapin + reqwest)            │   │
│  │   prost-reflect)    │   │                               │   │
│  └─────────────────────┘   └───────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────┐   ┌───────────────────────────────┐   │
│  │  ProfileStore       │   │  HistoryStore                 │   │
│  │  (plugin-store +    │   │  (SQLite via                  │   │
│  │   keyring crate)    │   │   tauri-plugin-sql)           │   │
│  └─────────────────────┘   └───────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Owner | Responsibility | Does NOT Own |
|-----------|-------|---------------|--------------|
| ProtoFormEngine | React | Render form from descriptor JSON; collect field values | Parsing, encoding |
| ConnectionProfileManager | React | Profile CRUD UI; invokes Tauri commands for credential ops | Credential storage |
| MessageHistoryView | React | Display, filter, replay history entries | Storage |
| ProtoEngine | Rust | Parse .proto text → descriptor JSON; encode form values → bytes | UI, networking |
| AmqpBroker | Rust | Hold live lapin Connection; publish bytes; call Management HTTP API | Proto logic |
| ProfileStore | Rust | Persist profile metadata (JSON via plugin-store); passwords via OS keychain | AMQP logic |

---

## Data Flow

### Proto Parse Flow

```
User picks .proto file via OS dialog
         │
         ▼
Tauri dialog plugin returns file path string
         │
         ▼ (Tauri command: parse_proto)
ProtoEngine (Rust):
  protox::Compiler::new([include_roots])?
    .open_file(proto_path)?
    .file_descriptor_set()
         │
         ▼
FileDescriptorSet consumed by prost-reflect:
  DescriptorPool::from_file_descriptor_set(fds)
  → walk MessageDescriptor fields to build SchemaNode tree
         │
         ▼ IPC return (serde_json)
Frontend receives SchemaNode tree
         │
         ▼
ProtoFormEngine renders dynamic form
```

### Send Flow

```
User fills form + clicks Send
         │
         ▼ (Tauri command: encode_and_publish)
ProtoEngine (Rust):
  Rebuild DynamicMessage from SchemaNode + form values JSON
  DynamicMessage.encode_to_vec() → Vec<u8>
         │
         ▼
AmqpBroker (Rust):
  channel.basic_publish(exchange, routing_key, bytes, props)
  PublisherConfirm awaited
         │
         ▼
HistoryStore (Rust):
  INSERT INTO message_history (proto_file, message_type, values_json, bytes_hex, target, ts)
         │
         ▼ Tauri event: publish-result
Frontend shows success/error toast; history view refreshes
```

### Queue/Exchange Listing Flow

```
User opens connection (or clicks Refresh)
         │
         ▼ (Tauri command: connect)
AmqpBroker creates lapin Connection, stores in AppState
         │
         ▼ (Tauri command: list_queues / list_exchanges)
reqwest GET http://{host}:15672/api/queues/{vhost}
         Authorization: Basic {user}:{password}
         │
         ▼ IPC return
Frontend populates target selector
```

---

## Tauri IPC Design

### Command Boundary Rule

An operation is a Rust command if it needs any of: filesystem access, AMQP connection, credential storage, or binary encoding. Pure UI state stays in React.

### Commands (Rust → exposed to frontend)

| Command | Input | Output | Notes |
|---------|-------|--------|-------|
| `parse_proto` | `{path: String, include_roots: Vec<String>}` | `SchemaNode` (JSON) | Triggers protox + prost-reflect |
| `encode_message` | `{descriptor_name: String, values: serde_json::Value}` | `Vec<u8>` as base64 string | For validation/preview without send |
| `connect` | `{profile_id: String}` | `ConnectionStatus` | Stores live Connection in AppState |
| `disconnect` | — | — | Drops lapin Connection from AppState |
| `list_queues` | `{profile_id: String}` | `Vec<QueueInfo>` | Management HTTP API via reqwest |
| `list_exchanges` | `{profile_id: String}` | `Vec<ExchangeInfo>` | Management HTTP API via reqwest |
| `publish` | `{profile_id, exchange, routing_key, payload_bytes_b64, props}` | `PublishResult` | Uses stored Connection |
| `save_profile` | `ConnectionProfile` | — | Writes JSON via plugin-store + password to keychain |
| `load_profiles` | — | `Vec<ConnectionProfile>` (no passwords) | Passwords fetched on demand |
| `get_password` | `{profile_id: String}` | `String` | Reads from OS keychain |
| `delete_profile` | `{profile_id: String}` | — | Deletes store entry + keychain entry |
| `list_history` | `{limit, offset, filter}` | `Vec<HistoryEntry>` | SQLite paginated query |
| `replay_message` | `{history_id: u64}` | `PublishResult` | Re-encodes + re-publishes |

### Events (Rust → Frontend push, no request needed)

| Event | Payload | When Emitted |
|-------|---------|--------------|
| `connection-status` | `{profile_id, status: Connected/Disconnected/Error}` | On lapin connection state change |
| `publish-result` | `{success: bool, message_id, error_msg?}` | After publish completes or fails |

### Why this split

`parse_proto` and `publish` are Rust-only because: protox and prost-reflect are Rust crates with no WASM-compatible alternative; lapin requires a native async runtime; keychain access is OS-native. The frontend never touches binary bytes or file paths directly — it sends structured JSON and receives structured JSON.

---

## State Management

### Rust AppState (managed via `tauri::Builder::manage`)

```rust
pub struct AppState {
    // Keyed by profile_id.
    // Must be tokio::sync::Mutex (not std::sync::Mutex) because lapin's
    // channel.basic_publish is async and the lock may be held across await points.
    // Holding a std::sync::Mutex across an await would block the Tokio worker thread.
    pub connections: tokio::sync::Mutex<HashMap<String, ActiveConnection>>,
    // Parsed descriptors keyed by proto_path.
    // RwLock: reads are common (encode on every send), writes are rare (new file).
    pub descriptor_cache: tokio::sync::RwLock<HashMap<String, DescriptorPool>>,
}

pub struct ActiveConnection {
    pub connection: lapin::Connection,
    pub channel: lapin::Channel,
}
```

The Tauri v2 docs explicitly state that async commands must use async-compatible locks when held across await points. `tokio::sync::Mutex` is re-exported as `tauri::async_runtime::Mutex` for convenience.

### React State (React Query + Zustand)

| State | Where | Shape |
|-------|-------|-------|
| Parsed schema (SchemaNode tree) | Zustand store | Updated after `parse_proto` command returns |
| Form field values | React local state (per form) | `Record<string, unknown>` |
| Active profile | Zustand store | `ConnectionProfile` (no password) |
| Connection status | Zustand store | Updated by `connection-status` event listener |
| History list | React Query (auto-fetch) | Paginated, invalidated after each publish |
| Queue/Exchange list | React Query (stale-while-revalidate) | Cached per profile connection |

Do not use Redux for this app — it is overkill for a single-window desktop tool. React Query handles async server state (queues, history) and Zustand handles app-level UI state (active schema, active profile, connection status).

---

## Storage Strategy

Three distinct persistence needs require three different mechanisms.

### Connection Profile Metadata (non-secret fields)

**Use:** `@tauri-apps/plugin-store` v2 (official Tauri plugin; crate: `tauri-plugin-store = "2.0.0"`)
**Location:** `profiles.json` in the app's data directory (managed by plugin; path resolved via `BaseDirectory.AppData`)
**Contents:** `{ id, name, host, port, vhost, username, management_port }` — no passwords
**Why:** The official Tauri store plugin handles atomic writes, JSON serialization, cross-platform path resolution, and is accessible from both Rust and JS. No custom file management needed.
**API:** `import { Store } from '@tauri-apps/plugin-store'`; `store.set(key, value)` / `store.get<T>(key)`

### Passwords

**Use:** `keyring` crate (open-source-cooperative/keyring-rs, version 3.x) called from Rust Tauri commands
**Location:** OS keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service via libsecret)
**Key scheme:** `proto-sender:{profile_id}`
**Why:** The `keyring` crate is the most mature cross-platform Rust credential store library (2,000+ dependents). It is invoked only from Rust via custom Tauri commands (`save_profile`, `get_password`, `delete_profile`) — the frontend never calls keychain directly.
**Alternative considered:** `tauri-plugin-keyring` (charlesportwoodii) — community plugin with identical underlying crate but adds a JS API surface that is not needed here since all credential ops go through explicit Rust commands. Prefer the bare crate to avoid community plugin maintenance risk for a security-sensitive component.
**Linux caveat:** Requires `libsecret` (GNOME) or `kwallet` (KDE). Not present by default on all minimal Linux installs. Must be documented in install instructions.

### Message History

**Use:** `@tauri-apps/plugin-sql` v2 with SQLite feature (official Tauri plugin; crate: `tauri-plugin-sql = "2.0.0"`, feature `sqlite`)
**Location:** `history.db` relative to `BaseDirectory.AppConfig` (managed by plugin)
**Why:** History needs queryable filtering (by proto type, date, profile) and pagination. A flat JSON file would require loading all records into memory. The official Tauri SQL plugin exposes SQLite to the JS side without needing custom Rust query commands, and supports inline schema migrations via `Builder::add_migrations`.
**API:** `import Database from '@tauri-apps/plugin-sql'`; `Database.load('sqlite:history.db')`

**Schema:**
```sql
CREATE TABLE message_history (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_id  TEXT    NOT NULL,
  proto_path  TEXT    NOT NULL,
  msg_type    TEXT    NOT NULL,
  values_json TEXT    NOT NULL,
  payload_hex TEXT    NOT NULL,
  exchange    TEXT    NOT NULL,
  routing_key TEXT    NOT NULL,
  sent_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

`values_json` stores the original form input; `payload_hex` stores the encoded bytes. This lets replay re-send the exact bytes without re-encoding (bit-for-bit identical) while also allowing the user to open a past message in the form editor.

---

## Suggested Build Order

Dependencies flow bottom-up. Each step can be tested independently.

### Step 1 — ProtoEngine (pure Rust, no Tauri)

Build and test `protox::Compiler` + `prost-reflect::DescriptorPool` + `DynamicMessage` encoding in a standalone Rust binary. Acceptance test: parse a `.proto` with nested messages, a `repeated` field, an `enum`, and a `google.protobuf.Timestamp` import; encode a test message; verify the bytes decode correctly with a known-good decoder.

**Why first:** This is the highest-risk unknown. It is also entirely independent of Tauri and RabbitMQ. Verifying it in isolation removes the largest technical risk before writing any UI.

### Step 2 — Tauri shell + ProtoEngine commands

Scaffold Tauri 2 app. Expose `parse_proto` and `encode_message` as Tauri commands. Establish `AppState` with descriptor cache. Configure `fs:scope` with `"**/*"` in capabilities to allow reading user proto files from arbitrary paths. On macOS, add the `com.apple.security.temporary-exception.files.absolute-path.read-write` entitlement to allow reading from outside the sandbox.

**Why second:** Establishes the IPC boundary and the permissions model before any UI is built on top of it. Testing via a minimal invoke call confirms the Tauri scaffolding is correct.

### Step 3 — ProtoFormEngine (React, no AMQP)

Implement the React form renderer consuming the `SchemaNode` JSON from `parse_proto`. Support scalars first (string, int32/64, float, bool), then nested messages (recursive renderer), then `repeated` fields (add/remove row), then `enum` (select), then `oneof` (radio to select active branch). Wire the form's Submit to call `encode_message` and display the resulting hex bytes for inspection.

**Why third:** This is the second-largest unknown (dynamic form generation for all proto field types). Completing it without AMQP means it can be tested against any `.proto` file immediately without a running broker.

### Step 4 — AmqpBroker: connect + publish

Implement `connect`, `disconnect`, and `publish` commands with a hardcoded test profile. Test against a local RabbitMQ Docker container. Emit `connection-status` and `publish-result` events. Use publisher confirms (`channel.confirm_select` + awaiting `PublisherConfirm`) for reliable delivery.

**Why fourth:** AMQP is a solved problem (lapin is mature) but needs integration testing. Doing it after the proto pipeline means each test send carries real encoded bytes.

### Step 5 — ProfileStore (metadata + keychain)

Implement `save_profile`, `load_profiles`, `get_password`, `delete_profile`. Integrate `@tauri-apps/plugin-store` for non-secret metadata and the `keyring` crate for passwords. Wire the ConnectionProfileManager UI. Replace the hardcoded test profile from Step 4 with a real saved profile.

**Why fifth:** Profile management is straightforward but has platform-specific behavior (Linux keychain dependency). Deferring until the core pipeline works means profile bugs remain isolated from proto/AMQP bugs.

### Step 6 — Queue/Exchange listing

Implement `list_queues` and `list_exchanges` via reqwest to the RabbitMQ Management HTTP API. Populate the target selector UI. Handle the case where the management plugin is not enabled on the broker with a clear error and a manual text-entry fallback.

**Why sixth:** Depends on working profiles (Step 5) to get credentials for the management API. Can proceed in parallel with Step 7 once Step 5 is done.

### Step 7 — HistoryStore + replay

Initialize SQLite database on app startup using `Builder::add_migrations`. Write history entries after every successful publish (Step 4 already emits `publish-result`). Implement `list_history` (paginated) and `replay_message`. Build `MessageHistoryView` with filter and resend UI.

**Why last:** No dependencies that are not already satisfied. Zero risk of blocking earlier work. Technically the most straightforward component.

---

## Key Architectural Decisions

These are choices that constrain future work. Each is made here with rationale so they are not relitigated in every phase.

### Decision 1: Proto parsing and encoding happen entirely in Rust

The frontend receives `SchemaNode` (a plain JSON structure describing field names, types, and nesting) and sends form values back as a `serde_json::Value` tree. The frontend never handles binary bytes, protobuf descriptors, or `FileDescriptorSet` structures.

**Consequence:** Adding a second message format (e.g., JSON-only publish) in v2 only requires a new Rust command. The `SchemaNode` type becomes the stable IPC contract between backend and frontend.

### Decision 2: protox (pure Rust) over shelling out to protoc

`protox` v0.9.1 is pure Rust, requires no external binary, bundles all `google/protobuf/*` well-known types automatically (confirmed in Compiler::new docs), and accepts multiple include root paths. It outputs a `FileDescriptorSet` that `prost-reflect` v0.16.3 consumes directly via `DescriptorPool::from_file_descriptor_set`.

**Consequence:** The distributed binary has no dependency on a protoc installation, which is essential for cross-platform team distribution. The tradeoff is that protox may trail the latest proto specification — acceptable given the field types in scope (scalars, nested messages, repeated, enum, oneof, map, WKT).

### Decision 3: Persistent lapin Connection per active profile (not open/close per send)

A lapin `Connection` is established when the user activates a profile and torn down on disconnect or app close. Each publish reuses the stored channel (or creates a new one if the previous channel was closed by an error).

**Consequence:** Connection state must live in `AppState` behind a `tokio::sync::Mutex`. The `connection-status` event gives the frontend a reliable signal to disable the Send button when not connected.

### Decision 4: Include roots must be user-declared for import resolution

When the user picks a `.proto` file, the default include root is the directory containing that file. Users can add additional roots (e.g., a shared `proto/` directory in their monorepo). The `parse_proto` command accepts `Vec<String>` for include roots.

**Consequence:** The UI needs an "include paths" management field in the file picker flow. This is a required interaction — without it, any proto that imports from a different directory will fail to parse.

**macOS note:** Reading proto files from arbitrary user directories requires both the `fs:scope: ["**/*"]` capability permission and the `com.apple.security.temporary-exception.files.absolute-path.read-write` entitlement. Both must be configured in Step 2.

### Decision 5: Queue/exchange listing requires RabbitMQ Management HTTP API

AMQP 0.9.1 itself cannot enumerate queues or exchanges. The Management HTTP API (`GET /api/queues/{vhost}`, `GET /api/exchanges/{vhost}`) requires the `rabbitmq_management` plugin on the target broker. It is enabled by default in development (`rabbitmq:3-management` Docker image) but not always in production.

**Consequence:** The profile must store a separate management port (default 15672). When the management API is unreachable, the app falls back to a manual text entry field for queue/exchange name rather than showing a hard error.

### Decision 6: Message history stores both form values and encoded bytes

`values_json` lets the user open a past message in the form editor. `payload_hex` lets replay send the exact bytes without re-encoding (bit-for-bit reproducibility).

**Consequence:** History entries are slightly larger, but replay behavior is unambiguous and the edit-from-history flow works without re-parsing the proto file.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| protox runtime parsing + WKT bundling | HIGH | docs.rs/protox Compiler::new docs explicitly confirmed |
| prost-reflect DynamicMessage encoding | HIGH | docs.rs/prost-reflect v0.16.3; implements prost::Message |
| lapin publish + publisher confirms | HIGH | Context7 official docs; code examples verified |
| Tauri 2 command/async state pattern | HIGH | v2.tauri.app official docs; tokio Mutex requirement explicit |
| @tauri-apps/plugin-store v2 | HIGH | Official plugins-workspace v2 branch; verified API |
| @tauri-apps/plugin-sql v2 SQLite | HIGH | Official plugins-workspace v2 branch; migration support confirmed |
| keyring crate for passwords | HIGH | Widely used (open-source-cooperative/keyring-rs v3) |
| Management HTTP API for queue listing | HIGH | RabbitMQ official docs; standard endpoints |
| Linux keychain availability | MEDIUM | libsecret required; not universal across distros |
| macOS entitlement for arbitrary file reads | MEDIUM | Confirmed in community discussion; needs testing per Tauri version |

---

## Gaps to Address in Later Phases

1. **`oneof` form UX** — the exact React pattern (radio + conditional field group vs. tabs) needs a UX decision in Phase 3. Both are implementable; radio is simpler.
2. **`bytes` field input** — options are base64 text input, hex string input, or a file picker to load raw bytes. Decide in Phase 3; base64 is the lowest-friction default.
3. **`map<K, V>` fields** — valid proto3 and common in real schemas. The form renderer must handle them as a dynamic list of key-value pair rows. Verify prost-reflect exposes them correctly before Phase 3 is considered complete.
4. **Connection recovery** — lapin has experimental auto-reconnect. Phase 4 should decide: use it, or implement explicit reconnect-on-error triggered by a UI button. Explicit is safer for a dev tool where reconnect intent should be clear.
5. **Management API port vs. AMQP port** — profiles need both ports. Cloud-hosted RabbitMQ (CloudAMQP, etc.) uses non-standard port assignments. The profile UI must make this explicit, not default-hide the management port.
6. **Parse performance** — if protox takes >200ms on large import chains, Phase 2 should add progress feedback via a Tauri event from within the `parse_proto` command rather than leaving the UI unresponsive.
