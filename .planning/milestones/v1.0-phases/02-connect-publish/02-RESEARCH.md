# Phase 02: Connect + Publish - Research

**Researched:** 2026-05-17
**Domain:** Tauri 2 + Rust (lapin AMQP, keyring-core OS keychain, reqwest Management API) + React (Zustand, shadcn/ui)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Connection Sidebar Panel**
- D-01: Sidebar connection section is compact — shows a profile dropdown (shadcn Select, same pattern as Message Type selector above it), a status dot, and a "Manage" gear button that opens the profile management modal.
- D-02: 3 connection states: Connected (green dot) / Error (red dot) / Not connected (gray dot). No separate "Testing" spinner state — testing happens synchronously during save inside the modal.
- D-03: First launch (no profiles saved): show a muted "Add connection" link/button — consistent with the "Load a .proto file to get started" hint style already in Sidebar.tsx.
- D-04: Profile switching via the sidebar dropdown (same shadcn Select pattern as Message Type). Switching connects to the selected profile.

**Profile Management Flow**
- D-05: Profile management lives in a modal dialog (shadcn Dialog) — consistent with the IncludePathDialog pattern established in Phase 1. Lists saved profiles; a "+ New Profile" button opens an inline form within the modal.
- D-06: Connection test result shown inline below the form fields: spinner while testing → green checkmark + "Connected" on success, or red X + error message on failure. User can still close the modal after seeing the result.
- D-07: Saving a profile triggers the connection test. If the test passes, the new profile becomes the active connection immediately (save + test + activate in one action).
- D-08: All 6 profile fields always visible: host, port, vhost, username, password, management API port. Management API port pre-filled with 15672 (RabbitMQ default) but editable. No collapsible "Advanced" section.

**Publish Controls Placement**
- D-09: A persistent publish bar at the top of the main panel, above the proto form. Layout: [Queue/Exchange radio toggle] [Queue or Exchange selector] [Routing key input — visible only in Exchange mode] [Send button]. User configures the target once, then iterates on the form below.
- D-10: Queue vs Exchange mode: radio toggle (two-option SegmentedControl). Selecting "Queue" shows the queue picker. Selecting "Exchange" shows the exchange picker + routing key text input.
- D-11: Management API availability indicator: status badge next to the picker — "Live" (green dot) when dropdown is populated from Management API, "Manual" (yellow dot) when Management API is unreachable and input switches to a plain text field.
- D-12: Send button is disabled (grayed out) when no active connection. Hovering shows tooltip: "Connect to a RabbitMQ profile to send."

**After-Send Feedback**
- D-13: Successful send: shadcn/ui toast notification — "Message sent to [queue/exchange name]" — 3 seconds, non-blocking. Uses the existing Toaster infrastructure (shadcn/ui).
- D-14: Failed send: red/destructive toast variant — "Send failed: [error message]". Same location as success toast for consistency.
- D-15: Form retains all field values after a successful send.

### Claude's Discretion

None declared — discussion stayed within phase scope.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONN-01 | User can create and save named connection profiles (host, port, vhost, username, password, management API port) | `tauri-plugin-store` for non-secret fields; `keyring-core` + `dbus-secret-service-keyring-store` for passwords |
| CONN-02 | User can switch between saved connection profiles with a single click | Zustand `useConnectionStore` active profile state; Tauri command `activate_profile` drives lapin connection |
| CONN-03 | App tests connection reachability and credential validity when the user saves a profile | `lapin::Connection::connect()` in a `#[tauri::command]`; distinguish IO error (unreachable) vs AMQP error (bad creds) |
| CONN-04 | Passwords are stored in the OS keychain — never in plain config files | `keyring-core` 1.x + platform store crates; service name `dev.protosender.app`; username = profile name |
| PUBL-01 | User can publish a message directly to a named queue (via the default exchange) | `lapin::Channel::basic_publish("", queue_name, ...)` — empty string = default exchange |
| PUBL-02 | User can publish to a named exchange with a user-specified routing key | `lapin::Channel::basic_publish(exchange, routing_key, ...)` with `BasicProperties::with_content_type("application/x-protobuf")` |
| PUBL-03 | Live dropdown populated from Management API; falls back to manual text input | `reqwest` 0.13 GET `/api/queues/{vhost}` and `/api/exchanges/{vhost}` with `%2F` vhost encoding; fallback on any HTTP error or connection refused |
</phase_requirements>

---

## Summary

Phase 2 wires the existing proto-encode pipeline (Phase 1) to a live RabbitMQ broker. The Rust backend gains three new capability modules: AMQP connection management via `lapin` 4.x, OS keychain password storage via `keyring-core` 1.x with platform-specific store crates, and Management API HTTP queries via `reqwest` 0.13. The React frontend gains a new `useConnectionStore` (Zustand), a profile management modal (shadcn Dialog, same pattern as `IncludePathDialog`), a connection section in the Sidebar replacing the `<div className="flex-1" />` placeholder, and a persistent publish bar above `FormPanel`.

The key architectural concern is **connection lifecycle**: an ephemeral-per-publish strategy (connect → publish → close) is recommended over a persistent connection in Tauri `manage()`. This eliminates stale-connection bugs with minimal performance penalty for a dev tool.

The second concern is **keyring architecture change**: the `keyring` 4.x crate on crates.io is now a CLI/sample tool only — the library split into `keyring-core` + separate platform store crates. Phase 2 must depend on `keyring-core` directly plus the appropriate store crates per platform.

**Primary recommendation:** Use ephemeral lapin connections per publish, `keyring-core` 1.x with `dbus-secret-service-keyring-store` for Linux + platform natives for macOS/Windows, and `reqwest` 0.13 with `rustls-tls` for Management API calls.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Profile data (non-secret) | Tauri / Rust + `tauri-plugin-store` | — | Atomic writes, app-data path resolution, cross-platform paths |
| Password storage | Rust backend only (`keyring-core`) | — | Must never touch frontend; OS keychain is a native system call |
| AMQP connection + publish | Rust backend (`lapin`) | — | Binary protocol, async runtime, credentials live in Rust |
| Management API queries | Rust backend (`reqwest`) | — | Credentials must not leave Rust; avoids CORS; response filtered before IPC |
| Connection state display | React frontend (Zustand store) | — | UI reads from store, does not drive AMQP directly |
| Profile form UI | React frontend (shadcn Dialog) | — | Form validation, field rendering, test-result display |
| Publish bar UI | React frontend | — | Mode toggle, queue/exchange picker, routing key, send button |
| Send orchestration | React → Tauri IPC → Rust | — | React calls `invoke('publish_message', {...})`, Rust does the actual send |

---

## Standard Stack

### Core (Rust)
| Crate | Version | Purpose | Why Standard |
|-------|---------|---------|--------------|
| `lapin` | 4.7.4 | AMQP 0-9-1 client | De facto standard Rust AMQP client; confirmed active May 2025 [VERIFIED: cargo search] |
| `keyring-core` | 1.0.0 | Platform-agnostic credential store API | Library portion extracted from `keyring` v4 split [VERIFIED: docs.rs/keyring-core] |
| `dbus-secret-service-keyring-store` | 1.0.0 | Linux: synchronous DBus Secret Service | No async runtime dependency; compatible with Tauri's Tokio [VERIFIED: cargo search / docs.rs] |
| `reqwest` | 0.13.3 | HTTP client for Management API | Standard Rust HTTP; now defaults to rustls [VERIFIED: cargo search] |

### Supporting (Rust)
| Crate | Version | Purpose | When to Use |
|-------|---------|---------|-------------|
| `tokio` | 1.x | Async runtime (already in Cargo.toml) | Already present; used via `tauri::async_runtime::spawn` |
| `url` | 2.x | URL-encode vhost for Management API path | Needed for vhost special-char encoding (%2F) |
| `serde` / `serde_json` | 1.x | Deserialize Management API JSON | Already in Cargo.toml |
| `thiserror` | 2.x | Error variants for new commands | Already in Cargo.toml |

### Core (React Frontend)
| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| `zustand` | 5.x | `useConnectionStore` global state | Already in package.json |
| `@tauri-apps/plugin-store` | 2.4.3 | Profile data persistence from JS | Already in package.json |
| shadcn/ui Dialog | existing | Profile management modal | Already installed (`src/components/ui/dialog.tsx`) |
| shadcn/ui Select | existing | Profile dropdown in sidebar | Already installed (`src/components/ui/select.tsx`) |
| shadcn/ui Badge | existing | Management API "Live"/"Manual" badge | Already installed (`src/components/ui/badge.tsx`) |
| shadcn/ui RadioGroup | existing | Queue/Exchange toggle | Already installed (`src/components/ui/radio-group.tsx`) |

### Missing shadcn/ui Components (need `npx shadcn add`)
| Component | Purpose |
|-----------|---------|
| `toast` / `sonner` | After-send feedback (D-13/D-14) — shadcn now recommends Sonner over the legacy Toast |

**Important note on toast:** The original shadcn `toast` component (useToast hook + Toaster) has been deprecated in favor of the `sonner` component. CONTEXT.md D-13 says "Uses the existing Toaster infrastructure (shadcn/ui)" — verify whether the project already has `sonner` installed before adding it. [VERIFIED: package.json inspection — neither `sonner` nor toast is currently installed]

### Installation (Rust)
```toml
# src-tauri/Cargo.toml additions
[dependencies]
lapin = { version = "4", features = ["tokio"] }
keyring-core = "1"
reqwest = { version = "0.13", features = ["json", "rustls-tls"] }
url = "2"

# Platform-specific keyring stores
[target.'cfg(target_os = "linux")'.dependencies]
dbus-secret-service-keyring-store = { version = "1", features = ["crypto-rust"] }

[target.'cfg(target_os = "macos")'.dependencies]
apple-native-keyring-store = "1"   # [VERIFIED: cargo search 2026-05-17]

[target.'cfg(target_os = "windows")'.dependencies]
windows-native-keyring-store = "1"  # [VERIFIED: cargo search 2026-05-17]
```

**Version verification:** [VERIFIED: cargo search 2026-05-17]
- `lapin` = 4.7.4
- `keyring` (CLI, do NOT use) = 4.0.1 — use `keyring-core` 1.0.0 instead
- `reqwest` = 0.13.3

---

## Architecture Patterns

### System Architecture Diagram

```
User Action (React)
    │
    ├─ Profile Save ──────────► Tauri Command: save_profile
    │                              │
    │                              ├─ Non-secret fields → tauri-plugin-store (tap.json)
    │                              ├─ Password → keyring-core::Entry::new("dev.protosender.app", profile_name)
    │                              └─ test_connection (lapin connect+close) → result → UI
    │
    ├─ Profile Switch ────────► Tauri Command: activate_profile
    │                              │
    │                              └─ Load fields from store + password from keyring → test → update state
    │
    ├─ Fetch Queues/Exchanges ► Tauri Command: fetch_queues / fetch_exchanges
    │                              │
    │                              └─ reqwest GET /api/queues/{%2F-encoded vhost}
    │                                 → filter internal + system exchanges
    │                                 → return Vec<String> names
    │
    └─ Send Message ──────────► Tauri Command: publish_message
                                   │
                                   ├─ Load active profile from store + keyring
                                   ├─ Build AMQP URI: amqp://user:pass@host:port/vhost
                                   ├─ Connection::connect() → create_channel()
                                   ├─ channel.basic_publish(exchange, routing_key, ..., payload, props)
                                   └─ connection.close() → return Ok / Err
```

### Recommended Project Structure (additions only)
```
src-tauri/src/
├── commands/
│   ├── mod.rs              # Add: pub mod connection; pub mod publish;
│   ├── connection.rs       # save_profile, test_connection, activate_profile, fetch_queues, fetch_exchanges
│   ├── publish.rs          # publish_message
│   ├── encode.rs           # (existing)
│   └── proto.rs            # (existing)
├── profiles/
│   └── mod.rs              # ConnectionProfile struct, keyring service constants, store helpers
├── error.rs                # Add AppError variants: AmqpError, KeyringError, ManagementApiError

src/
├── stores/
│   ├── useProtoStore.ts    # (existing)
│   └── useConnectionStore.ts  # new: profiles, activeProfile, connectionStatus, managementAvailable
├── components/
│   ├── sidebar/
│   │   ├── ConnectionSection.tsx  # new: profile dropdown + status dot + Manage button
│   │   └── Sidebar.tsx            # modified: replace <div className="flex-1" /> with <ConnectionSection />
│   ├── connection/
│   │   ├── ProfileManagementModal.tsx   # new: list + inline new-profile form
│   │   └── ConnectionTestResult.tsx     # new: spinner / checkmark / error inline display
│   └── publish/
│       └── PublishBar.tsx          # new: Queue/Exchange toggle, picker, routing key, Send button
├── lib/
│   └── ipc.ts              # Add: saveProfile, fetchQueues, fetchExchanges, publishMessage
```

### Pattern 1: Ephemeral AMQP Connection Per Publish

**What:** Open a new lapin connection for each publish (or test) command, close it after use.
**When to use:** All AMQP operations in this app — there is no subscribe/consume pattern.
**Why:** Eliminates stale-connection state machine. No background reconnect loop. Clean error surfacing on every operation.

```rust
// Source: lapin docs (docs.rs/lapin) + project pattern
use lapin::{Connection, ConnectionProperties, BasicProperties, options::*};

pub async fn publish_once(
    uri: &str,
    exchange: &str,
    routing_key: &str,
    payload: Vec<u8>,
) -> Result<(), AppError> {
    let conn = Connection::connect(uri, ConnectionProperties::default())
        .await
        .map_err(|e| AppError::AmqpError(e.to_string()))?;

    let channel = conn.create_channel()
        .await
        .map_err(|e| AppError::AmqpError(e.to_string()))?;

    channel.basic_publish(
        exchange,            // "" for default exchange (PUBL-01), named exchange (PUBL-02)
        routing_key,         // queue name (PUBL-01) or explicit routing key (PUBL-02)
        BasicPublishOptions::default(),
        &payload,            // binary protobuf bytes — Vec<u8> from encode_message
        BasicProperties::default()
            .with_content_type("application/x-protobuf".into()),
    )
    .await
    .map_err(|e| AppError::AmqpError(e.to_string()))?
    .await                   // await the publisher-confirm future (even without confirms mode)
    .map_err(|e| AppError::AmqpError(e.to_string()))?;

    conn.close(0, "")
        .await
        .map_err(|e| AppError::AmqpError(e.to_string()))?;

    Ok(())
}
```

**CRITICAL — default exchange:** To publish to a queue directly (PUBL-01), use exchange = `""` (empty string) and routing_key = queue_name. NOT `"amq.default"`. [VERIFIED: lapin GitHub example + AMQP 0-9-1 spec]

### Pattern 2: AMQP URI Construction

```rust
// Vhost must be URL-percent-encoded. The default vhost "/" → "%2f"
// Source: lapin docs (amqp://127.0.0.1:5672/%2f example)
use url::percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};

fn build_amqp_uri(host: &str, port: u16, vhost: &str, user: &str, pass: &str) -> String {
    let encoded_vhost = utf8_percent_encode(vhost, NON_ALPHANUMERIC).to_string();
    let encoded_pass = utf8_percent_encode(pass, NON_ALPHANUMERIC).to_string();
    format!("amqp://{}:{}@{}:{}/{}", user, encoded_pass, host, port, encoded_vhost)
}
// "/" vhost → "amqp://user:pass@host:5672/%2F"
// IMPORTANT: "/" in vhost becomes "%2F" not "%2f" — case insensitive but %2F is conventional
```

### Pattern 3: keyring-core OS Keychain Password Storage

```rust
// Source: keyring-core docs (docs.rs/keyring-core)
// NOTE: keyring 4.x on crates.io is CLI only — use keyring-core directly
use keyring_core::{Entry, set_default_store};

const KEYRING_SERVICE: &str = "dev.protosender.app";

// Call once at app startup in lib.rs (before any Entry operations)
// On Linux: register dbus_secret_service_keyring_store::Store
// On macOS/Windows: register apple_native_keyring_store::Store or windows_native_keyring_store::Store

fn store_password(profile_name: &str, password: &str) -> Result<(), AppError> {
    let entry = Entry::new(KEYRING_SERVICE, profile_name)
        .map_err(|e| AppError::KeyringError(e.to_string()))?;
    entry.set_password(password)
        .map_err(|e| AppError::KeyringError(e.to_string()))?;
    Ok(())
}

fn get_password(profile_name: &str) -> Result<String, AppError> {
    let entry = Entry::new(KEYRING_SERVICE, profile_name)
        .map_err(|e| AppError::KeyringError(e.to_string()))?;
    entry.get_password()
        .map_err(|e| AppError::KeyringError(e.to_string()))
}

fn delete_password(profile_name: &str) -> Result<(), AppError> {
    let entry = Entry::new(KEYRING_SERVICE, profile_name)
        .map_err(|e| AppError::KeyringError(e.to_string()))?;
    entry.delete_credential()
        .map_err(|e| AppError::KeyringError(e.to_string()))?;
    Ok(())
}
```

**Naming scheme:** service = `"dev.protosender.app"` (reverse-DNS style, stable), username = profile_name (user-chosen, must be unique). [ASSUMED — reverse-DNS naming is conventional but not mandated by keyring-core docs]

### Pattern 4: Management API Queries with reqwest

```rust
// Source: reqwest docs + RabbitMQ Management HTTP API
// reqwest 0.13 now defaults to rustls (no native-tls needed)
use reqwest::Client;
use serde::Deserialize;
use url::percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};

#[derive(Deserialize)]
struct QueueInfo {
    name: String,
    vhost: String,
}

#[derive(Deserialize)]
struct ExchangeInfo {
    name: String,
    #[serde(rename = "type")]
    exchange_type: String,
    internal: bool,
}

async fn fetch_queues(
    host: &str, mgmt_port: u16, vhost: &str, user: &str, pass: &str
) -> Result<Vec<String>, AppError> {
    let encoded_vhost = utf8_percent_encode(vhost, NON_ALPHANUMERIC).to_string();
    let url = format!("http://{}:{}/api/queues/{}", host, mgmt_port, encoded_vhost);

    let client = Client::new();
    let resp = client
        .get(&url)
        .basic_auth(user, Some(pass))
        .send()
        .await
        .map_err(|e| AppError::ManagementApiError(e.to_string()))?;

    if !resp.status().is_success() {
        return Err(AppError::ManagementApiUnavailable(resp.status().as_u16()));
    }

    let queues: Vec<QueueInfo> = resp.json().await
        .map_err(|e| AppError::ManagementApiError(e.to_string()))?;

    Ok(queues.into_iter().map(|q| q.name).collect())
}

async fn fetch_exchanges(
    host: &str, mgmt_port: u16, vhost: &str, user: &str, pass: &str
) -> Result<Vec<String>, AppError> {
    // Same pattern — but filter out internal and system (amq.*) exchanges
    // and the default empty-name exchange
    // ...
    let exchanges: Vec<ExchangeInfo> = resp.json().await?;
    Ok(exchanges.into_iter()
        .filter(|e| !e.internal && !e.name.starts_with("amq.") && !e.name.is_empty())
        .map(|e| e.name)
        .collect())
}
```

### Pattern 5: Tauri Command with Async Runtime

```rust
// CRITICAL: use tauri::async_runtime::spawn — NOT tokio::spawn
// Source: Tauri GitHub issue #10289 — tokio::spawn in event listeners panics on Windows
#[tauri::command]
pub async fn publish_message(
    exchange: String,
    routing_key: String,
    payload: Vec<u8>,
) -> Result<(), String> {
    // Tauri commands are already async — await directly, no spawn needed here
    publish_once(&uri, &exchange, &routing_key, payload)
        .await
        .map_err(|e| e.to_string())
}
```

### Pattern 6: useConnectionStore (Zustand)

```typescript
// Source: Phase 1 established pattern (src/stores/useProtoStore.ts)
// Follow same typed interface + INITIAL_STATE + create() pattern

interface ConnectionProfile {
  name: string;
  host: string;
  port: number;        // default 5672
  vhost: string;       // default "/"
  username: string;
  managementPort: number; // default 15672
  // password NOT stored in JS — retrieved via IPC from keyring when needed
}

type ConnectionStatus = "connected" | "error" | "disconnected";
type ManagementStatus = "live" | "manual" | "unknown";

interface ConnectionStore {
  profiles: ConnectionProfile[];
  activeProfileName: string | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;
  managementStatus: ManagementStatus;
  queues: string[];
  exchanges: string[];
  // actions...
}
```

**CRITICAL:** Password is NEVER stored in the Zustand store or any JS variable. It is read from the OS keychain by the Rust backend only when needed for connection/publish.

### Pattern 7: Connection State Machine

The CONTEXT defines 3 states (D-02) but does not specify transitions. Based on the locked decisions:

| Event | From | To | Notes |
|-------|------|----|-------|
| Save profile (test passes) | any | `connected` | D-07: save + test + activate |
| Save profile (test fails) | any | `error` | D-06: inline error shown |
| Profile switch (dropdown change) | any | re-test → `connected` or `error` | D-04 |
| `publish_message` fails with AMQP error | `connected` | `error` | Error toast shown (D-14) |
| No profiles on startup | — | `disconnected` | D-03: show "Add connection" hint |

**No background polling.** Connection status only transitions on explicit user actions or publish failures.

### Anti-Patterns to Avoid

- **Storing AMQP connection in `tauri::manage()`:** Persistent connections require a stale-detection loop. Use ephemeral connections instead.
- **Using `keyring` 4.x crate from crates.io:** It is now a CLI sample tool, not a library. Use `keyring-core` 1.x + platform store crates.
- **Calling `tokio::spawn` inside Tauri commands or event handlers:** Causes panic on Windows in Tauri 2. Always use `tauri::async_runtime::spawn` when spawning tasks outside of command context.
- **Adding `#[tokio::main]` to `main.rs`:** Tauri manages the runtime; nested runtime panics.
- **Using `reqwest` 0.12 features:** reqwest is now 0.13.3 and defaults to rustls. CLAUDE.md says 0.12 — **update to 0.13**. The API is mostly compatible, but TLS features changed.
- **Not URL-encoding vhost:** The `/` vhost must become `%2F` in the AMQP URI and Management API URL. Forgetting this is the most common RabbitMQ integration bug.
- **Storing password in `tauri-plugin-store`:** Plain JSON file. Passwords go to `keyring-core` only.
- **Filtering `amq.*` exchanges only:** Also filter `internal: true` exchanges and the empty-name default exchange from the picker dropdown.
- **Using `keyring::Entry::new` from v3 docs:** v4 split the API; `Entry::new` now lives in `keyring-core::Entry::new`. Import path changed.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| AMQP connection + channel management | Custom TCP socket + framing | `lapin` 4.x | AMQP 0-9-1 framing is complex; heartbeat, flow control, channel lifecycle |
| OS keychain integration | Platform-specific syscalls per OS | `keyring-core` + platform store crates | macOS Keychain, Windows Credential Manager, and Linux Secret Service each have incompatible APIs |
| TLS for HTTP (Management API) | Custom certificate handling | `reqwest` with `rustls-tls` feature | Trust chain validation, ALPN, cross-platform cert stores |
| JSON deserialization of Management API response | Manual string parsing | `serde` + `serde_json` + typed structs | Over-50-field response; only `name`, `type`, `internal` needed — let serde ignore the rest |
| Form validation in profile modal | Manual field checks | `zod` (already in project) + `react-hook-form` | Already established pattern in project |

**Key insight:** The AMQP protocol and OS keychain APIs have enough edge cases (special chars, encoding, heartbeats, platform variations) that any custom solution will fail on the second developer machine it runs on.

---

## Common Pitfalls

### Pitfall 1: Vhost URL Encoding Missing
**What goes wrong:** `reqwest` GET `/api/queues///` returns 404; lapin connect to `amqp://host:5672//` connects to an empty vhost (""), not the root vhost ("/").
**Why it happens:** The `/` character in the vhost path segment is a URL path delimiter, not a literal slash.
**How to avoid:** Always `percent_encode(vhost, NON_ALPHANUMERIC)` before interpolating into both the AMQP URI and the Management API URL. "/" → "%2F".
**Warning signs:** 404 from Management API on default vhost; connection succeeds but no queues found.

### Pitfall 2: keyring 4.x Is Not the Library
**What goes wrong:** Adding `keyring = "4"` to Cargo.toml compiles but `Entry::new` is gone or behaves as a CLI wrapper.
**Why it happens:** The `keyring` 4.x crate is now sample/CLI code only. The library split into `keyring-core` + individual store crates.
**How to avoid:** Add `keyring-core = "1"` plus the platform store crates shown in the Cargo.toml pattern above. Call `set_default_store()` at startup.
**Warning signs:** Compile errors on `keyring::Entry`, missing `Entry::new` method.

### Pitfall 3: Default Exchange Name Confusion
**What goes wrong:** Publishing to queue "myqueue" fails with "NOT_FOUND - no exchange 'default'" or similar.
**Why it happens:** Developer passes exchange = "default" or "amq.default" instead of "".
**How to avoid:** For PUBL-01, exchange MUST be empty string `""`. Routing key = queue name. Document this in the `publish_message` command signature.
**Warning signs:** AMQP exception with NOT_FOUND or PRECONDITION_FAILED on publish.

### Pitfall 4: Password Special Characters in URI
**What goes wrong:** AMQP connection fails with "access refused" for a password containing `@`, `:`, `/`, `#`, `$` or other special characters.
**Why it happens:** These characters have special meaning in URIs. An unencoded `@` in the password breaks the user:pass@host parsing.
**How to avoid:** Always `percent_encode(password, NON_ALPHANUMERIC)` when building the AMQP URI. Retrieve password from keyring, encode, interpolate.
**Warning signs:** Intermittent failures depending on password complexity; `guest/guest` works but custom passwords don't.

### Pitfall 5: reqwest Version Mismatch
**What goes wrong:** Build errors or TLS failures when combining reqwest 0.12 code patterns with reqwest 0.13.
**Why it happens:** CLAUDE.md references `reqwest 0.12` — but the current version is 0.13.3. reqwest 0.13 changed TLS defaults (rustls by default) and some ClientBuilder method names (soft-deprecated, still mostly work).
**How to avoid:** Use `reqwest = { version = "0.13", features = ["json", "rustls-tls"] }`. The `"json"` and `"rustls-tls"` features are the same names. The `tls_backend_*` builder methods are new in 0.13 but `default_tls_native()` still works as a soft-deprecated alias.
**Warning signs:** `rustls` linking errors on Linux musl; `use_native_tls` method not found.

### Pitfall 6: tauri::async_runtime::spawn Required (Not tokio::spawn)
**What goes wrong:** Tauri app panics on Windows when `tokio::spawn` is called inside an event listener or plugin.
**Why it happens:** Tauri embeds Tokio but with its own runtime configuration; bare `tokio::spawn` creates a second runtime context on Windows.
**How to avoid:** Use `tauri::async_runtime::spawn(async move { ... })` everywhere. Tauri commands are already async and can be `.await`ed directly — spawn is only needed for fire-and-forget background tasks.
**Warning signs:** "no current thread runtime" panic on Windows; macOS/Linux work fine.

### Pitfall 7: Management API Error Disambiguation
**What goes wrong:** All Management API failures are treated as "plugin unavailable" causing the dropdown to silently become a text input when the real issue is wrong credentials.
**Why it happens:** Status codes differ: 401 = wrong credentials, 404 on `/api/` = plugin not installed/enabled, connection refused = management port closed.
**How to avoid:** Distinguish in the `fetch_queues`/`fetch_exchanges` command:
- `reqwest::Error` with `is_connect()` → port unreachable → fallback to manual input
- HTTP 401 → surface "wrong management API credentials" — do not silently fall back
- HTTP 404 → plugin not enabled → fallback to manual input
**Warning signs:** User has wrong credentials but gets "Manual" badge instead of an error.

### Pitfall 8: linux-keyutils Does Not Persist Across Reboots
**What goes wrong:** Passwords stored via linux-keyutils disappear after reboot.
**Why it happens:** Linux kernel keyring (keyutils) is an in-memory keyring, not a persistent credential store.
**How to avoid:** Use `dbus-secret-service-keyring-store` on Linux (persists to GNOME Keyring or KWallet), not `linux-keyutils-keyring-store`.
**Warning signs:** Passwords work in one session, but users need to re-enter them after reboot.

---

## Code Examples

### Building the AMQP URI with Proper Encoding
```rust
// Source: lapin docs (amqp://127.0.0.1:5672/%2f URI example)
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};

fn build_amqp_uri(host: &str, port: u16, vhost: &str, user: &str, pass: &str) -> String {
    let enc_vhost = utf8_percent_encode(vhost, NON_ALPHANUMERIC);
    let enc_pass  = utf8_percent_encode(pass, NON_ALPHANUMERIC);
    format!("amqp://{}:{}@{}:{}/{}", user, enc_pass, host, port, enc_vhost)
}
// "/" → "%2F"; "@" in password → "%40"; standard ASCII stays unchanged
```

### lapin basic_publish (both PUBL-01 and PUBL-02)
```rust
// Source: lapin GitHub README + nodlandhodl.com example (verified)
use lapin::{Connection, ConnectionProperties, BasicProperties, options::*};

// PUBL-01: queue direct
channel.basic_publish(
    "",           // default exchange — MUST be empty string
    "my-queue",   // routing key = queue name
    BasicPublishOptions::default(),
    &payload,
    BasicProperties::default()
        .with_content_type("application/x-protobuf".into()),
).await?.await?;

// PUBL-02: named exchange + routing key
channel.basic_publish(
    "my-exchange",
    "my.routing.key",
    BasicPublishOptions::default(),
    &payload,
    BasicProperties::default()
        .with_content_type("application/x-protobuf".into()),
).await?.await?;
```

### Management API GET /api/queues/{vhost}
```rust
// Source: RabbitMQ Management API docs + reqwest 0.13 docs [CITED: www.rabbitmq.com/docs/management]
let encoded_vhost = utf8_percent_encode(vhost, NON_ALPHANUMERIC).to_string();
let url = format!("http://{}:{}/api/queues/{}", host, mgmt_port, encoded_vhost);
let resp = reqwest::Client::new()
    .get(&url)
    .basic_auth(user, Some(pass))
    .send()
    .await?;
// Disambiguate errors — do NOT treat 401 as "unavailable"
match resp.status().as_u16() {
    200 => { /* parse JSON */ }
    401 => return Err(AppError::ManagementApiAuthFailed),
    404 => return Err(AppError::ManagementApiUnavailable),
    other => return Err(AppError::ManagementApiError(other)),
}
```

### keyring-core Entry Usage
```rust
// Source: keyring-core README (github.com/open-source-cooperative/keyring-core)
use keyring_core::Entry;

// On app startup — call this once (see keyring-core README for store init)
// Linux: set_default_store(dbus_secret_service_keyring_store::Store::new()?);
// macOS/Windows: set_default_store() also required — use platform store crate

let entry = Entry::new("dev.protosender.app", profile_name)?;
entry.set_password(&password)?;
let retrieved = entry.get_password()?;
entry.delete_credential()?;  // v1 API: delete_credential (not delete_password)
```

### useConnectionStore (Zustand)
```typescript
// Source: Phase 1 pattern (src/stores/useProtoStore.ts) — follow same pattern
import { create } from "zustand";

const INITIAL_STATE = {
  profiles: [] as ConnectionProfile[],
  activeProfileName: null as string | null,
  connectionStatus: "disconnected" as ConnectionStatus,
  connectionError: null as string | null,
  managementStatus: "unknown" as ManagementStatus,
  queues: [] as string[],
  exchanges: [] as string[],
} as const;

export const useConnectionStore = create<ConnectionStore>((set) => ({
  ...INITIAL_STATE,
  setConnectionStatus: (status, error = null) =>
    set({ connectionStatus: status, connectionError: error }),
  // ... other actions
}));
```

### ProfileManagementModal — pattern from IncludePathDialog
```typescript
// Reuse the IncludePathDialog structural pattern:
// - Dialog open/onOpenChange → onCancel
// - DialogContent with max-w-lg
// - Form state in local useState
// - Async action on confirm (save → test → feedback inline)
// Source: src/components/include-paths/IncludePathDialog.tsx (Phase 1)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `keyring` 3.x (library + store bundled) | `keyring-core` 1.x + separate store crates | 2025/2026 (v4 split) | Cargo.toml must use `keyring-core`, not `keyring = "4"` |
| `reqwest` 0.12 (native-tls default) | `reqwest` 0.13 (rustls default) | 2025 | CLAUDE.md references 0.12 — use 0.13.3; `features = ["json", "rustls-tls"]` unchanged |
| shadcn/ui `toast` + `useToast` | shadcn/ui `sonner` (recommended) | 2024 | Original `toast` deprecated; use `sonner` for D-13/D-14 |
| `Connection::connect_with_runtime` (lapin 3.x) | `Connection::connect` with Tokio feature | lapin 4.x | lapin 4.x with `features = ["tokio"]` uses the existing Tokio runtime; `connect_with_runtime` still exists but the simpler `connect` works in async context |

**Deprecated/outdated:**
- `keyring = "4"`: Now a CLI tool, not a library. Do NOT add to application Cargo.toml.
- `reqwest 0.12`: CLAUDE.md cited this version — current is 0.13.3. Update.
- shadcn `toast` component (legacy Radix-based): Deprecated in favor of `sonner`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `keyring-core` requires explicit `set_default_store()` call at Tauri startup for Linux | Standard Stack, Code Examples | If auto-selected on Linux, startup call is unnecessary but harmless |
| A2 | `keyring-core` 1.x macOS/Windows require `apple-native-keyring-store = "1"` and `windows-native-keyring-store = "1"` respectively | Standard Stack | [VERIFIED: cargo search 2026-05-17 — both crates exist at 1.0.0] |
| A3 | Service name `"dev.protosender.app"` is the right naming convention | Code Examples | Any consistent stable string works; changing it later orphans saved passwords |
| A4 | Sonner (not legacy `toast`) should be used for D-13/D-14 toasts | Standard Stack, Don't Hand-Roll | Legacy toast still installable; either works for v1 |
| A5 | `BasicProperties::with_content_type()` is a builder method returning `Self` | Code Examples | May be a non-chaining setter; check docs.rs/amq-protocol-types if compile fails |
| A6 | `dbus-secret-service-keyring-store` with `"crypto-rust"` feature is the correct dep name on Linux | Standard Stack | Crate naming from docs.rs 4.0.1 source Cargo.toml; verify exact name at compile time |

---

## Open Questions (RESOLVED)

1. **keyring-core Linux store initialization**
   - What we know: `keyring-core` requires calling `set_default_store()` at startup on ALL platforms. Crates confirmed: `apple-native-keyring-store = "1.0.0"` (macOS), `windows-native-keyring-store = "1.0.0"` (Windows), `dbus-secret-service-keyring-store = "1.0.0"` (Linux). [VERIFIED: cargo search 2026-05-17]
   - What's unclear: Exact function signature for registering each platform store (likely `set_default_store(Store::new()?)` or similar — verify in crate README during Wave 0).
   - Recommendation: Add explicit store init block using `#[cfg(target_os)]` conditional compilation in `lib.rs` `run()` function before `tauri::Builder` setup.
   - RESOLVED: Use `#[cfg(target_os = "...")]` conditional compilation blocks in `lib.rs` `run()` before `tauri::Builder` setup, calling `set_default_store(Store::new()?)` for each platform. The Recommendation above is the resolution.

2. **Sonner vs Legacy Toast**
   - What we know: CONTEXT D-13/D-14 says "existing Toaster infrastructure" but no toaster is currently installed. `sonner` is the current shadcn recommendation.
   - What's unclear: Whether user expects the Radix-based legacy `toast` or Sonner.
   - Recommendation: Install `sonner` (shadcn recommends it); it satisfies D-13/D-14 intent. `npx shadcn add sonner`.
   - RESOLVED: Install `sonner` via `npx shadcn add sonner`. Satisfies D-13/D-14. The legacy `toast` component is deprecated.

3. **reqwest error: connection refused vs timeout**
   - What we know: `reqwest::Error::is_connect()` returns true for connection-refused errors.
   - What's unclear: How to distinguish "port closed" from "plugin not installed" when Management port is 15672 but AMQP connects fine.
   - Recommendation: Treat any `is_connect() = true` as "management unavailable" → manual fallback. Treat 401 as credential error. Treat 404 as plugin-not-enabled → manual fallback.
   - RESOLVED: Treat `is_connect() = true` as "management unavailable" (fallback to manual input). Treat HTTP 401 as credential error (surface to user). Treat HTTP 404 as plugin-not-enabled (fallback to manual input).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust toolchain | All Rust crates | ✓ | (detected via cargo search) | — |
| `libdbus-1-dev` (Linux only) | `dbus-secret-service-keyring-store` | ✗ on dev machine (macOS) | — | macOS uses Keychain natively; Linux users need package install |
| RabbitMQ broker | CONN-03 (test), PUBL-01–03 | Not tested | — | Manual entry fallback for PUBL-03; CONN-03 can be tested with mock |

**Linux distribution note for CONN-04:** On Debian/Ubuntu, `libdbus-1-dev` must be installed for `dbus-secret-service-keyring-store` to compile. In Tauri's cross-compilation pipeline, the Tauri bundler handles most system deps, but this should be documented in distribution notes. [ASSUMED — based on dbus-secret-service crate requirements; verify on Linux build machine]

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 2 |
|-----------|------------------|
| Tauri 2.x + Rust + React — locked stack | All new code follows established patterns |
| `lapin` 4.x for AMQP | Use as specified; current version 4.7.4 confirmed |
| `reqwest` + Management API for queue listing | Use `reqwest` 0.13 (update from CLAUDE.md's 0.12 reference) |
| `keyring` crate for OS keychain | Use `keyring-core` (v4 split — do NOT use `keyring = "4"`) |
| `tauri-plugin-store` for profile storage | Already registered in `lib.rs` |
| `tauri::async_runtime::spawn` NOT `tokio::spawn` | Critical for Windows compatibility |
| Do NOT add `#[tokio::main]` to main.rs | Tauri manages the runtime |
| `tauri-plugin-*` must be v2 branch | All plugins already on v2 in Cargo.toml |
| Rust minimum 1.77.2+ | Required by Tauri 2 ecosystem |
| 80% test coverage minimum | Phase 2 tests: mock `invoke` for connection/publish commands, Zustand store unit tests |
| Code files max 800 lines | Split command modules into `connection.rs` + `publish.rs` |
| Immutable patterns in TypeScript | Zustand state updates use spread/immer pattern |

---

## Sources

### Primary (HIGH confidence)
- `lapin` 4.7.4 — cargo search verified; Connection::connect, basic_publish, AMQP URI format [VERIFIED: cargo search + docs.rs/lapin]
- `keyring-core` 1.0.0 — docs.rs/keyring-core; Entry API confirmed; platform split from keyring 4.x [VERIFIED: docs.rs/keyring-core + github.com/open-source-cooperative/keyring-core]
- `reqwest` 0.13.3 — cargo search verified; rustls default, json feature [VERIFIED: cargo search + seanmonstar.com/blog/reqwest-v013-rustls-default]
- Tauri 2 `async_runtime::spawn` requirement — GitHub issue #10289 [CITED: github.com/tauri-apps/tauri/issues/10289]
- AMQP default exchange = empty string — lapin README + AMQP 0-9-1 spec [VERIFIED: lapin GitHub]
- RabbitMQ vhost URL encoding requirement [CITED: docs.rs/lapin Connection docs]
- RabbitMQ Management API port 15672, `/api/queues/{vhost}` [CITED: www.rabbitmq.com/docs/management]

### Secondary (MEDIUM confidence)
- `dbus-secret-service-keyring-store` with `"crypto-rust"` feature for Linux [VERIFIED via docs.rs/crate/keyring/3.6.3 source Cargo.toml + web search]
- linux-keyutils does NOT persist across reboots [CITED: keyring-core docs (search result excerpt)]
- shadcn/ui `sonner` replaces legacy `toast` [CITED: ui.shadcn.com/docs/components/radix/sonner]
- `reqwest::Error::is_connect()` for connection-refused detection [CITED: docs.rs/reqwest]
- Management API exchange response includes `internal` field [CITED: RabbitMQ HTTP API reference + CloudAMQP docs]

### Tertiary (LOW confidence)
- `Entry::delete_credential()` method name in keyring-core 1.x (vs `delete_password` in 3.x) — confirm at compile time

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via cargo search; keyring split confirmed via docs.rs
- Architecture: HIGH — lapin/reqwest API patterns verified; ephemeral connection rationale is sound
- Pitfalls: HIGH — encoding pitfalls from official docs; keyring split from crate search; tokio/spawn from Tauri issue

**Research date:** 2026-05-17
**Valid until:** 2026-07-17 (30 days for stable crates; keyring-core is very new so verify before planning)
