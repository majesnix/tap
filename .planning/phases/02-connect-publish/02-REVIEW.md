---
phase: 02-connect-publish
reviewed: 2026-05-17T12:00:00Z
depth: standard
files_reviewed: 23
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
  - src/components/connection/__tests__/ConnectionSection.test.tsx
  - src/components/connection/__tests__/ProfileManagementModal.test.tsx
  - src/components/connection/ConnectionTestResult.tsx
  - src/components/connection/ProfileManagementModal.tsx
  - src/components/layout/AppLayout.tsx
  - src/components/publish/__tests__/PublishBar.test.tsx
  - src/components/publish/PublishBar.tsx
  - src/components/sidebar/ConnectionSection.tsx
  - src/components/sidebar/Sidebar.tsx
  - src/components/ui/alert-dialog.tsx
  - src/components/ui/sonner.tsx
  - src/components/ui/tooltip.tsx
  - src/lib/ipc.ts
  - src/lib/types.ts
  - src/stores/useConnectionStore.ts
findings:
  critical: 3
  warning: 6
  info: 0
  total: 9
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-17T12:00:00Z
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

This phase implements RabbitMQ connection profiles (AMQP + Management API), a profile management modal, a publish bar with queue/exchange selection, and Zustand-based connection state. The overall architecture is sound: password-to-keychain separation is correctly implemented, AMQP URI components are percent-encoded (including username), and the Management API correctly supports HTTPS via `management_ssl`. The 401-vs-unavailability discrimination logic is well-designed.

Three blockers require fixes before this ships: deleting the active profile leaves dangling state that causes subsequent operations to fail with misleading errors; `hexToBytes` silently corrupts partial-parse hex tokens rather than rejecting them; and `handleTestOnly` in the create form has an unhandled rejection on `listProfiles`. Six warnings cover a race condition with stale management UI state on profile switch, misleading `drop(password)` security comment, missing username validation, publisher-confirm semantics mismatch, fragile error string coupling, and a missing test reset field.

---

## Critical Issues (BLOCKER)

### CR-01: Deleting the Active Profile Leaves Dangling `activeProfileName` in Store

**File:** `src/components/connection/ProfileManagementModal.tsx:210-222`

**Issue:** `handleDeleteConfirm` calls `deleteProfile(deleteTarget)` then updates `profiles` in the store via `setProfiles(updated)`. It never checks whether `deleteTarget === activeProfileName` and never calls `setActiveProfile(null)` or `setConnectionStatus("disconnected")`.

After deleting the active profile:
1. `ConnectionSection` still renders the deleted profile name as the selected dropdown value.
2. The Re-test button calls `testConnection(activeProfileName)` — the Rust backend returns `AppError::ProfileNotFound`, which the frontend surfaces as a misleading "Profile not found" rather than "profile was deleted".
3. `PublishBar` re-fetches on the next render and calls `fetchQueues(activeProfileName)` — same failure.
4. Any subsequent `handleRetest` or publish attempt fails nondeterministically until the user manually picks a different profile.

```typescript
// Current — does not clear active profile
const handleDeleteConfirm = async () => {
  if (!deleteTarget) return;
  try {
    await deleteProfile(deleteTarget);
    const updated = await listProfiles();
    setProfiles(updated);
  } catch (err: unknown) { ... }
  finally { setDeleteTarget(null); }
};
```

**Fix:** Read `activeProfileName` from the store and clear state when the active profile is deleted:

```typescript
const { profiles, setProfiles, setActiveProfile, setConnectionStatus, activeProfileName } =
  useConnectionStore();

const handleDeleteConfirm = async () => {
  if (!deleteTarget) return;
  try {
    await deleteProfile(deleteTarget);
    const updated = await listProfiles();
    setProfiles(updated);
    // Clear active profile state if the deleted profile was active
    if (deleteTarget === activeProfileName) {
      setActiveProfile(null);
      setConnectionStatus("disconnected");
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    setError(message);
  } finally {
    setDeleteTarget(null);
  }
};
```

---

### CR-02: `hexToBytes` Silently Corrupts Payload on Partial-Parse Hex Tokens

**File:** `src/components/publish/PublishBar.tsx:47-54`

**Issue:** Each hex token is parsed with `parseInt(h, 16)`. The existing `.filter((b) => Number.isInteger(b) && b >= 0 && b <= 255)` correctly removes full `NaN` results, but `parseInt` stops at the first non-hex character and returns the partial value. For example, `parseInt("0g", 16)` returns `0`, not `NaN`. Any malformed hex token (e.g., from a display glitch or encoding bug in `hexPreview`) silently becomes byte `0x00` and passes the filter unchanged.

```typescript
function hexToBytes(hex: string): number[] {
  return hex
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((h) => parseInt(h, 16))           // "0g" → 0; "1z" → 1 — silently wrong
    .filter((b) => Number.isInteger(b) && b >= 0 && b <= 255);
}
```

This is a data-corruption bug: the payload sent to the broker will contain wrong bytes with no error raised. For a tool whose core value is sending exactly the encoded protobuf bytes, silent corruption is a correctness failure.

**Fix:** Reject any token that does not parse as a complete two-character hex value:

```typescript
function hexToBytes(hex: string): number[] {
  const tokens = hex.trim().split(/\s+/).filter(Boolean);
  return tokens.map((h) => {
    if (!/^[0-9a-fA-F]{1,2}$/.test(h)) {
      throw new Error(`Invalid hex token: "${h}"`);
    }
    return parseInt(h, 16);
  });
}
```

Wrap the call in `handleSend` with an early error toast:

```typescript
let payload: number[];
try {
  payload = hexToBytes(hexPreview);
} catch (e: unknown) {
  toast.error(`Payload error: ${e instanceof Error ? e.message : String(e)}`);
  return;
}
```

---

### CR-03: `handleTestOnly` Has an Unhandled Rejection on `listProfiles`

**File:** `src/components/connection/ProfileManagementModal.tsx:133-136`

**Issue:** In `handleTestOnly`, after `saveProfile` succeeds, `listProfiles()` is awaited outside any try-catch:

```typescript
try {
  await saveProfile(profile, formValues.password);
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  setError(message);
  return;
}

// NO try-catch around this:
const updated = await listProfiles();
setProfiles(updated);

setTestState("testing");
try {
  await testConnection(profile.name);
  ...
}
```

If `listProfiles()` rejects (e.g., the store is locked, the Tauri IPC layer errors, or the app is shutting down), the rejection propagates as an unhandled promise rejection. The component does not surface an error to the user; the UI silently stops responding (test spinner never appears, no error message shown). In the test environment this is caught as an unhandled promise rejection warning that can mask test failures.

**Fix:** Wrap `listProfiles()` in the same try-catch or in its own:

```typescript
try {
  await saveProfile(profile, formValues.password);
  const updated = await listProfiles();
  setProfiles(updated);
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  setError(message);
  return;
}
```

---

## Warnings

### WR-01: Stale Management UI State Not Cleared on Profile Switch

**File:** `src/components/sidebar/ConnectionSection.tsx:44-54`

**Issue:** `handleProfileChange` calls `setActiveProfile(name)` and `setConnectionStatus("disconnected")` but does not reset `managementStatus`, `managementAuthError`, `queues`, or `exchanges`. The `PublishBar` `useEffect` watches `activeProfileName` and will re-fetch for the new profile, but until that async fetch resolves, the previous profile's data remains in the store and is rendered.

Concretely: if the previous profile produced a 401 `managementAuthError`, the destructive red badge from profile A remains visible while the user is working with profile B. If the previous profile had `managementStatus: "live"` with a populated queue list, the wrong queue dropdown appears for the new profile until the fetch completes.

**Fix:** Reset management state synchronously in `handleProfileChange` before the `activateProfile` call:

```typescript
const handleProfileChange = async (name: string) => {
  setActiveProfile(name);
  setConnectionStatus("disconnected");
  setManagementStatus("unknown");
  setManagementAuthError(null);
  setQueues([]);
  setExchanges([]);
  try {
    await activateProfile(name);
    setConnectionStatus("connected");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    setConnectionStatus("error", message);
  }
};
```

This requires adding `setManagementStatus`, `setManagementAuthError`, `setQueues`, `setExchanges` to the destructured store values in `ConnectionSection`.

---

### WR-02: Race Condition in `PublishBar` Fetch Effect — Stale Response Can Overwrite New Profile's State

**File:** `src/components/publish/PublishBar.tsx:81-121`

**Issue:** The `useEffect` that fetches queues/exchanges has no cancellation guard. If the user switches profiles rapidly — profile A fetch takes 3 seconds, profile B fetch takes 1 second — profile B's fetch resolves first and populates the store correctly, then profile A's stale response resolves and overwrites the store with profile A's queues. The user sees the wrong queue list.

**Fix:** Add an `isCancelled` flag:

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
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes("authentication failed")) {
        setManagementAuthError(errMsg);
      } else {
        setManagementAuthError(null);
        setManagementStatus("manual");
      }
    }
  };

  fetchTargets();
  return () => { cancelled = true; };
}, [activeProfileName, mode]);
```

---

### WR-03: `drop(password)` Is Misleading — URI Retains the Cleartext Password

**File:** `src-tauri/src/commands/publish.rs:38-39`

**Issue:** After building `uri` from `password`, the code calls `drop(password)` with the comment "password is no longer needed — drop it". This implies sensitive material has been removed, but `uri` still contains the cleartext password encoded in its bytes. The password lives in `uri` for the full duration of the async function — up to 10 seconds for the timeout. Any future code path that logs `uri` or logs error context derived from `uri` (e.g., if `lapin` includes the URI in its `Display` impl for connection errors) would leak the password.

**Fix:** Remove the `drop(password)` call and replace the misleading comment with an accurate one:

```rust
// uri contains the cleartext password — do NOT log uri or errors that may include it.
// uri is dropped naturally at function end.
let conn = tokio::time::timeout(
    Duration::from_secs(10),
    Connection::connect(&uri, ConnectionProperties::default()),
)
```

---

### WR-04: Missing Username Validation in Profile Form

**File:** `src/components/connection/ProfileManagementModal.tsx:116-123`

**Issue:** `handleSave` and `handleTestOnly` validate that `profile.name` and `profile.host` are non-empty, but `profile.username` is never validated. An empty username produces an AMQP URI of the form `amqp://:password@host:5672/%2F`. `lapin` will either reject the URI immediately or send an empty username to the broker, producing a cryptic AMQP 403 or 530 error (not found/access refused) rather than a clear "username is required" message.

**Fix:** Add username validation alongside the existing checks in both `handleSave` and `handleTestOnly`:

```typescript
if (!profile.username) {
  setError("Username is required.");
  return;
}
```

---

### WR-05: Publisher Confirm Awaited Without `confirm_select` — Comment Is Misleading

**File:** `src-tauri/src/commands/publish.rs:67-69`

**Issue:** The code double-awaits `basic_publish`:

```rust
channel
    .basic_publish(...)
    .await
    .map_err(|e| AppError::AmqpError(e.to_string()))?
    .await  // await the publisher-confirm future
    .map_err(|e| AppError::AmqpError(e.to_string()))?;
```

The comment says "await the publisher-confirm future". In lapin, publisher confirms only work after calling `channel.confirm_select()`. Without it, the inner `.await` resolves immediately as a no-op — it does NOT confirm broker delivery. The comment misleads maintainers into believing delivery is confirmed. For a dev tool where the user expects to know if the message was accepted, this is a correctness gap.

**Fix — Option A (correct the comment, keep fire-and-forget):**

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
// NOTE: publisher confirms not enabled (no confirm_select). This is fire-and-forget.
```

**Fix — Option B (enable real publisher confirms):**

```rust
use lapin::options::ConfirmSelectOptions;
channel
    .confirm_select(ConfirmSelectOptions::default())
    .await
    .map_err(|e| AppError::AmqpError(e.to_string()))?;
channel
    .basic_publish(...)
    .await
    .map_err(|e| AppError::AmqpError(e.to_string()))?
    .await  // now a real confirmed delivery
    .map_err(|e| AppError::AmqpError(e.to_string()))?;
```

Option B is preferable for a dev tool where the send result is shown to the user.

---

### WR-06: `ConnectionSection.test.tsx` `beforeEach` Omits `managementAuthError` Reset

**File:** `src/components/connection/__tests__/ConnectionSection.test.tsx:46-54`

**Issue:** The `beforeEach` store reset omits `managementAuthError`:

```typescript
useConnectionStore.setState({
  profiles: [],
  activeProfileName: null,
  connectionStatus: "disconnected",
  connectionError: null,
  managementStatus: "unknown",
  queues: [],
  exchanges: [],
  // managementAuthError is missing
});
```

`useConnectionStore`'s `INITIAL_STATE` includes `managementAuthError: null`. Any test that sets `managementAuthError` in the store will leak that value into subsequent tests because the partial `setState` call does not override it. The `PublishBar.test.tsx` `beforeEach` correctly includes `managementAuthError: null`. This inconsistency makes the connection test suite order-dependent.

**Fix:**

```typescript
useConnectionStore.setState({
  profiles: [],
  activeProfileName: null,
  connectionStatus: "disconnected",
  connectionError: null,
  managementStatus: "unknown",
  managementAuthError: null,  // add this field
  queues: [],
  exchanges: [],
});
```

---

_Reviewed: 2026-05-17T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
