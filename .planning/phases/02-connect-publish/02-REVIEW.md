---
phase: 02-connect-publish
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - package.json
  - src-tauri/Cargo.toml
  - src-tauri/src/commands/connection.rs
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/commands/publish.rs
  - src-tauri/src/error.rs
  - src-tauri/src/lib.rs
  - src-tauri/src/profiles/mod.rs
  - src/App.tsx
  - src/components/connection/ConnectionTestResult.tsx
  - src/components/connection/ProfileManagementModal.tsx
  - src/components/connection/__tests__/ConnectionSection.test.tsx
  - src/components/layout/AppLayout.tsx
  - src/components/publish/PublishBar.tsx
  - src/components/publish/__tests__/PublishBar.test.tsx
  - src/components/sidebar/ConnectionSection.tsx
  - src/components/sidebar/Sidebar.tsx
  - src/lib/ipc.ts
  - src/lib/types.ts
  - src/stores/useConnectionStore.ts
findings:
  critical: 5
  warning: 6
  info: 0
  total: 11
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-17
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

This phase implements RabbitMQ connection profiles (AMQP + Management API), a profile management modal, publish bar with queue/exchange selection, and Zustand-based connection state. The architecture is generally sound: password-to-keychain separation is correct, the ephemeral connection pattern is appropriate for a dev tool, and the 401-vs-unavailability discrimination is well-thought-out.

Five blockers require fixes before this ships. Two are security issues (credentials sent over HTTP, username not percent-encoded in AMQP URI). Two are correctness bugs (reqwest TLS feature name is wrong; `hexToBytes` silently produces `NaN` bytes). One is a panic path that bypasses the error type system. Six warnings cover race conditions, misleading safety claims, missing input validation, and test reliability gaps.

---

## Critical Issues (BLOCKER)

### CR-01: Basic Auth Credentials Sent Over Plaintext HTTP to Management API

**File:** `src-tauri/src/commands/connection.rs:217` and `:267`

**Issue:** Both `fetch_queues` and `fetch_exchanges` build Management API URLs using the `http://` scheme unconditionally. The `reqwest` call then attaches credentials via `.basic_auth()`, which sets an `Authorization: Basic <base64>` header. Base64 is not encryption — credentials (including the keychain-retrieved password) are transmitted in cleartext on the wire whenever the Management API host is not `localhost`. For a team tool where profiles point to staging or remote brokers, this exposes RabbitMQ credentials to any network observer on the path.

**Fix:** Add a `management_tls: bool` field to `ConnectionProfile` (default `false`, user-opt-in) and select the scheme at URL-build time, or default to `https` and let users opt down to `http` for local dev:

```rust
// In profiles/mod.rs — extend ConnectionProfile
pub management_tls: bool,  // default false; user opts in for remote brokers

// In connection.rs fetch_queues / fetch_exchanges
let scheme = if profile.management_tls { "https" } else { "http" };
let url = format!(
    "{}://{}:{}/api/queues/{}",
    scheme, profile.host, profile.management_port, encoded_vhost
);
```

Add the corresponding field to `ConnectionProfile` in `src/lib/types.ts` and a checkbox to `ProfileManagementModal.tsx`. Until then, document clearly in the UI that credentials travel unencrypted.

---

### CR-02: Username Not Percent-Encoded in AMQP URI

**File:** `src-tauri/src/profiles/mod.rs:48-50`

**Issue:** `build_amqp_uri` encodes `vhost` and `pass` with `utf8_percent_encode` but interpolates `user` raw:

```rust
format!("amqp://{}:{}@{}:{}/{}", user, enc_pass, host, port, enc_vhost)
//                ^^^^ raw — no encoding
```

A username containing `@`, `:`, or `/` (e.g., `admin@corp.com`, or usernames provisioned with LDAP-style values) produces a malformed URI. `lapin` will parse the wrong host/user fields, causing a confusing authentication failure rather than a clear error. The existing unit test only verifies password encoding; username is untested.

**Fix:**

```rust
pub fn build_amqp_uri(host: &str, port: u16, vhost: &str, user: &str, pass: &str) -> String {
    let enc_vhost = utf8_percent_encode(vhost, NON_ALPHANUMERIC);
    let enc_user  = utf8_percent_encode(user,  NON_ALPHANUMERIC);
    let enc_pass  = utf8_percent_encode(pass,  NON_ALPHANUMERIC);
    format!("amqp://{}:{}@{}:{}/{}", enc_user, enc_pass, host, port, enc_vhost)
}
```

Add a unit test for a username with `@`:

```rust
#[test]
fn at_sign_in_username_encoded() {
    let uri = build_amqp_uri("localhost", 5672, "/", "user@corp.com", "pass");
    // bare "@" in username would cause the host parser to read "corp.com" as the host
    assert!(!uri.contains("@corp.com"), "unencoded '@' in username breaks URI parsing");
}
```

---

### CR-03: `reqwest` Cargo Feature `"rustls"` Is Not a Valid Feature Name

**File:** `src-tauri/Cargo.toml:37`

**Issue:**

```toml
reqwest = { version = "0.13", features = ["json", "rustls"] }
```

The correct feature for TLS via rustls in `reqwest` 0.12/0.13 is `rustls-tls` (or `rustls-tls-native-roots`, `rustls-tls-webpki-roots`). The bare feature `"rustls"` does not exist in reqwest's feature set. Cargo silently ignores unknown features — it does not error. The result is that TLS support may fall back to the default (OpenSSL on Linux, system native TLS on macOS/Windows) or not be enabled at all, depending on the platform and build environment. The CLAUDE.md explicitly calls out `features = ["json", "rustls-tls"]` as the correct form for cross-platform builds.

**Fix:**

```toml
reqwest = { version = "0.13", features = ["json", "rustls-tls"] }
```

Verify at build time that no OpenSSL dependency appears in `cargo tree --package reqwest` output on Linux.

---

### CR-04: `hexToBytes` Produces Silent `NaN` Bytes — Corrupts Payload

**File:** `src/components/publish/PublishBar.tsx:47-54`

**Issue:** `hexToBytes` is called with `hexPreview`, which comes from the proto encoder. Each hex pair is parsed via `parseInt(h, 16)`. If any token is malformed, `parseInt` returns `NaN`. `NaN` is included in the output array without filtering:

```typescript
function hexToBytes(hex: string): number[] {
  return hex
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((h) => parseInt(h, 16)); // NaN silently included
}
```

When `payload` (a `number[]`) is passed over IPC as JSON and Rust deserializes it to `Vec<u8>`, a JSON `null` (how `NaN` serializes) fails deserialization and returns an IPC error; but the user sees a generic "Send failed" rather than an actionable message about a corrupted payload. Worse, some JSON serializers serialize `NaN` as `null` and Rust's serde treats `null` as a deserialization error for `u8`, meaning the error surfaces as a cryptic serde message rather than an encoding error.

**Fix:** Filter or reject `NaN` values, and guard against sending:

```typescript
function hexToBytes(hex: string): number[] {
  return hex
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((h) => {
      const byte = parseInt(h, 16);
      if (Number.isNaN(byte) || byte < 0 || byte > 255) {
        throw new Error(`Invalid hex byte: "${h}"`);
      }
      return byte;
    });
}
```

Wrap the call in `handleSend` with an early return on error:

```typescript
let payload: number[];
try {
  payload = hexToBytes(hexPreview);
} catch (e: unknown) {
  toast.error(`Payload encoding error: ${e instanceof Error ? e.message : String(e)}`);
  return;
}
```

---

### CR-05: `serde_json::to_value(...).unwrap()` — Panic in Error Path

**File:** `src-tauri/src/commands/connection.rs:87` and `:125`

**Issue:** Both `save_profile` and `delete_profile` call:

```rust
store.set(PROFILES_STORE_KEY, serde_json::to_value(&profiles).unwrap());
```

`serde_json::to_value` can theoretically fail (e.g., if a `ConnectionProfile` field contains a value that `serde_json` cannot represent). While the current struct only contains `String` and `u16` fields that serialize cleanly, using `.unwrap()` bypasses the `AppError` type system. Any future addition of a field type that fails serialization will cause a panic in a Tauri command instead of returning a structured `AppError` to the frontend. This is a reliability defect — panics in Tauri commands crash the command handler.

**Fix:**

```rust
let value = serde_json::to_value(&profiles)
    .map_err(|e| AppError::StoreError(format!("Failed to serialize profiles: {e}")))?;
store.set(PROFILES_STORE_KEY, value);
```

Apply to both `save_profile` (line 87) and `delete_profile` (line 125).

---

## Warnings

### WR-01: Race Condition in `PublishBar` Fetch Effect — Stale Response Overwrites Store

**File:** `src/components/publish/PublishBar.tsx:81-120`

**Issue:** The `useEffect` fetches queues or exchanges when `activeProfileName` or `mode` changes, but has no cancellation guard. If the user switches profiles rapidly, or if a slow network response arrives after a subsequent profile switch, the older response (from the previously active profile) resolves last and overwrites the store with the wrong profile's queues/exchanges. The user then sees stale data without any indication.

**Fix:** Use an `isCancelled` flag pattern (or `AbortController` for future fetch migration) to discard results from superseded requests:

```typescript
useEffect(() => {
  if (!activeProfileName) return;
  let cancelled = false;

  const fetchTargets = async () => {
    try {
      if (mode === "queue") {
        const qs = await fetchQueues(activeProfileName);
        if (cancelled) return;
        setManagementAuthError(null);
        setQueues(qs);
        setManagementStatus("live");
      } else {
        const exs = await fetchExchanges(activeProfileName);
        if (cancelled) return;
        setManagementAuthError(null);
        setExchanges(exs);
        setManagementStatus("live");
      }
    } catch (err: unknown) {
      if (cancelled) return;
      // ... existing error handling
    }
  };

  fetchTargets();
  return () => { cancelled = true; };
}, [activeProfileName, mode]);
```

---

### WR-02: `drop(password)` Is Security Theater — `uri` Retains the Password

**File:** `src-tauri/src/commands/publish.rs:38-39`

**Issue:** After building `uri` from `password`, the code calls `drop(password)`. The comment says "password is no longer needed — drop it". However, the `uri` `String` still contains the cleartext password in its bytes until `uri` goes out of scope at the end of the function. Dropping `password` gives a false sense of security: the sensitive bytes remain alive in `uri` for the entire duration of the async connection (up to 10 seconds for timeout). Any future logging added to the function that logs the error message (which might include `uri` as context from `lapin`) would still expose the password.

**Fix:** Remove the misleading `drop(password)` call and replace the comment with an accurate one. Alternatively, zero-out the `uri` buffer after use (though Rust's ownership means it drops at function end anyway):

```rust
// uri contains cleartext password — do NOT log uri or any error that includes it
let conn = tokio::time::timeout(
    Duration::from_secs(10),
    Connection::connect(&uri, ConnectionProperties::default()),
)
// ... uri drops at end of function naturally
```

Also remove the misleading comment that implies `password` is the only remaining sensitive material.

---

### WR-03: Missing Input Validation for Username and Password Fields

**File:** `src/components/connection/ProfileManagementModal.tsx:93-101`

**Issue:** `handleSave` validates that `profile.name` and `profile.host` are non-empty, but does not validate `formValues.username` or `formValues.password`. A profile saved without a username results in an AMQP URI like `amqp://:password@host:5672/%2F`, which will fail at connection time with a cryptic AMQP error rather than a clear user-facing message. Similarly, an empty password is accepted and stored in the OS keychain as an empty string.

**Fix:** Add explicit validation before saving:

```typescript
if (!profile.username) {
  setError("Username is required.");
  return;
}
// Password can be empty for brokers configured without auth, but warn if unexpected:
// if (!formValues.password) { setError("Password is required."); return; }
```

Also add port range validation:

```typescript
const port = Number(formValues.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  setError("Port must be a number between 1 and 65535.");
  return;
}
```

---

### WR-04: Profile Overwrite Silently Replaces Credentials Without Warning

**File:** `src-tauri/src/commands/connection.rs:79-84`

**Issue:** `save_profile` performs an upsert by name — if a profile with the same name already exists, it is silently replaced (including its keychain password). The frontend `ProfileManagementModal` only has a "New Profile" form with no edit flow. If a user creates a profile named "Production" twice (e.g., accidentally opens the new profile form again), the second save silently overwrites the first profile's credentials. There is no overwrite warning or confirmation.

**Fix:** Either (a) enforce uniqueness in the frontend by checking `profiles.some(p => p.name === formValues.name.trim())` before calling `saveProfile` and showing an error, or (b) rename the form action to make the intent clear (e.g., add an edit mode). Minimum viable fix is a frontend guard:

```typescript
if (profiles.some((p) => p.name === profile.name)) {
  setError(`A profile named "${profile.name}" already exists. Choose a different name.`);
  return;
}
```

---

### WR-05: `ConnectionSection.test.tsx` — `setState` Omits `managementAuthError`

**File:** `src/components/connection/__tests__/ConnectionSection.test.tsx:46-54`

**Issue:** The `beforeEach` reset in `ConnectionSection.test.tsx` sets store state without `managementAuthError`:

```typescript
useConnectionStore.setState({
  profiles: [],
  activeProfileName: null,
  connectionStatus: "disconnected",
  connectionError: null,
  managementStatus: "unknown",
  queues: [],
  exchanges: [],
  // managementAuthError: null  ← MISSING
});
```

The `useConnectionStore` initial state includes `managementAuthError: null`. Omitting it in `beforeEach` means any test that sets `managementAuthError` in the store will bleed that value into subsequent tests. The `PublishBar.test.tsx` `beforeEach` correctly includes `managementAuthError: null`. This inconsistency makes the connection test suite order-dependent.

**Fix:**

```typescript
useConnectionStore.setState({
  profiles: [],
  activeProfileName: null,
  connectionStatus: "disconnected",
  connectionError: null,
  managementStatus: "unknown",
  managementAuthError: null,  // add this
  queues: [],
  exchanges: [],
});
```

---

### WR-06: Publisher Confirm Awaited Without `confirm_select` — Misleading Code Comment

**File:** `src-tauri/src/commands/publish.rs:67-69`

**Issue:** The code awaits `basic_publish(...).await.await` with the comment `// await the publisher-confirm future`. In lapin, `basic_publish` returns a `PublisherConfirm` future, but publisher confirms only work after calling `channel.confirm_select()` first. Without `confirm_select()`, the inner `.await` on the `PublisherConfirm` completes immediately as a no-op (it resolves as a "not confirmed" confirmation mode). The code does not error, but the second `.await` does not provide delivery confirmation — it silently succeeds regardless of whether the broker actually received the message. The comment misleads maintainers into thinking delivery confirmation is active.

**Fix — Option A (keep current behavior, fix comment):**

```rust
channel
    .basic_publish(
        exchange.as_str().into(),
        routing_key.as_str().into(),
        BasicPublishOptions::default(),
        &payload,
        BasicProperties::default()
            .with_content_type("application/x-protobuf".into()),
    )
    .await
    .map_err(|e| AppError::AmqpError(e.to_string()))?;
// NOTE: publisher confirms not enabled (no channel.confirm_select()).
// basic_publish is fire-and-forget at the AMQP level.
```

**Fix — Option B (enable real publisher confirms):**

```rust
channel.confirm_select(ConfirmSelectOptions::default())
    .await
    .map_err(|e| AppError::AmqpError(e.to_string()))?;

channel
    .basic_publish(/* ... */)
    .await
    .map_err(|e| AppError::AmqpError(e.to_string()))?
    .await  // now a real publisher confirm
    .map_err(|e| AppError::AmqpError(e.to_string()))?;
```

For a dev tool where the user wants to know if the message was enqueued, Option B is preferable.

---

_Reviewed: 2026-05-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
