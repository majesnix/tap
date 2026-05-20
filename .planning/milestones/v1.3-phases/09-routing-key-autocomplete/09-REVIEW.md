---
phase: 09-routing-key-autocomplete
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 12
files_reviewed_list:
  - src-tauri/src/commands/connection.rs
  - src-tauri/src/lib.rs
  - src/lib/types.ts
  - src/lib/ipc.ts
  - src/stores/useConnectionStore.ts
  - src/components/ui/command.tsx
  - src/components/ui/input-group.tsx
  - src/components/ui/dialog.tsx
  - src/components/publish/RoutingKeyCombobox.tsx
  - src/components/publish/PublishBar.tsx
  - src/components/publish/__tests__/RoutingKeyCombobox.test.tsx
  - src/components/publish/__tests__/PublishBar.test.tsx
findings:
  critical: 3
  warning: 2
  info: 1
  total: 6
status: issues_found
---

# Phase 9: Code Review Report

**Reviewed:** 2026-05-19
**Depth:** standard
**Files Reviewed:** 12
**Status:** issues_found

## Summary

Phase 9 claims to add `ExchangeSummary` typed exchange data from the Rust backend and a `fetch_bindings` Tauri command for routing key autocomplete. The frontend is fully wired for both features. Neither was implemented in Rust. The entire Phase 9 autocomplete feature is non-functional at runtime — every `fetch_bindings` invocation will be rejected by Tauri with a "command not found" error (silently caught per D-10), and every `fetch_exchanges` call returns `Vec<String>` while the frontend expects `Vec<ExchangeSummary>`, breaking exchange type badges and fanout/headers hint text.

The three critical findings are causally linked: the missing struct drives the return-type mismatch, and the missing command makes autocomplete a no-op. They must be fixed together.

## Critical Issues

### CR-01: `fetch_bindings` Tauri command does not exist

**File:** `src/lib/ipc.ts:67-72` / `src-tauri/src/lib.rs:38-51`
**Issue:** `fetchBindings()` calls `invoke('fetch_bindings', ...)`. No Rust function named `fetch_bindings` exists anywhere in `src-tauri/` and it is not registered in the `invoke_handler!` macro in `lib.rs`. At runtime Tauri returns an error for every call. The D-10 catch silently discards it, `useCombobox` is set to `false`, and the `RoutingKeyCombobox` is never shown. The entire routing key autocomplete feature silently does nothing.

**Fix:** Implement the command in `src-tauri/src/commands/connection.rs` and register it:

```rust
// In connection.rs — add a BindingApiInfo deserialization struct:
#[derive(Deserialize)]
struct BindingApiInfo {
    routing_key: String,
    destination_type: String,
}

/// Fetch routing keys bound to a named exchange via the Management API.
/// Returns deduplicated, non-empty routing key strings.
/// Same error disambiguation as fetch_queues.
#[tauri::command]
pub async fn fetch_bindings(
    app: AppHandle,
    profile_name: String,
    exchange_name: String,
) -> Result<Vec<String>, AppError> {
    let (profile, password) = load_profile_with_password(&app, &profile_name)?;

    let encoded_vhost = percent_encoding::utf8_percent_encode(
        &profile.vhost,
        percent_encoding::NON_ALPHANUMERIC,
    );
    let encoded_exchange = percent_encoding::utf8_percent_encode(
        &exchange_name,
        percent_encoding::NON_ALPHANUMERIC,
    );
    let scheme = if profile.management_ssl { "https" } else { "http" };
    let url = format!(
        "{}://{}:{}/api/bindings/{}/e/{}/q",
        scheme, profile.host, profile.management_port, encoded_vhost, encoded_exchange
    );

    let client = Client::new();
    let resp = client
        .get(&url)
        .basic_auth(&profile.username, Some(&password))
        .send()
        .await
        .map_err(|e| {
            if e.is_connect() {
                AppError::ManagementApiUnavailable(0)
            } else {
                AppError::ManagementApiError(e.to_string())
            }
        })?;

    match resp.status().as_u16() {
        200 => {
            let bindings: Vec<BindingApiInfo> = resp
                .json()
                .await
                .map_err(|e| AppError::ManagementApiError(e.to_string()))?;
            let mut keys: Vec<String> = bindings
                .into_iter()
                .filter(|b| b.destination_type == "queue" && !b.routing_key.is_empty())
                .map(|b| b.routing_key)
                .collect::<std::collections::HashSet<_>>()
                .into_iter()
                .collect();
            keys.sort();
            Ok(keys)
        }
        401 => Err(AppError::ManagementApiAuthFailed),
        404 => Err(AppError::ManagementApiUnavailable(404)),
        other => Err(AppError::ManagementApiUnavailable(other)),
    }
}
```

Then register it in `lib.rs`:
```rust
commands::connection::fetch_bindings,  // add after fetch_exchanges
```

---

### CR-02: `fetch_exchanges` returns `Vec<String>` but frontend expects `Vec<ExchangeSummary>`

**File:** `src-tauri/src/commands/connection.rs:324` / `src/lib/ipc.ts:58-60`
**Issue:** The Rust `fetch_exchanges` command has return type `Result<Vec<String>, AppError>` and maps `|e| e.name` (line 360), discarding the `exchange_type` field. The TypeScript IPC wrapper declares `Promise<ExchangeSummary[]>`. The Zustand store holds `ExchangeSummary[]`. At runtime the store receives plain strings. Calling `.name` or `.exchange_type` on a string yields `undefined`. Consequences:
- Exchange type badges in the Select dropdown render `[undefined]` instead of `[direct]`, `[topic]`, etc.
- `selectedExchangeObj?.exchange_type` is always `undefined` → `isHintExchange` is always `false` → fanout and headers hint text never appears.
- `isEligibleForCombobox` treats all exchanges (including fanout/headers) as eligible, triggering unnecessary `fetch_bindings` calls for exchange types where autocomplete is useless.

**Fix:** Define and serialize `ExchangeSummary` in Rust, then return it:

```rust
// In connection.rs — replace Vec<String> return with Vec<ExchangeSummary>
use serde::Serialize;  // add to existing `use serde::Deserialize;`

#[derive(Serialize)]
pub struct ExchangeSummary {
    pub name: String,
    pub exchange_type: String,
}

#[tauri::command]
pub async fn fetch_exchanges(
    app: AppHandle,
    profile_name: String,
) -> Result<Vec<ExchangeSummary>, AppError> {
    // ... (same HTTP setup) ...
    match resp.status().as_u16() {
        200 => {
            let exchanges: Vec<ExchangeApiInfo> = resp
                .json()
                .await
                .map_err(|e| AppError::ManagementApiError(e.to_string()))?;
            Ok(exchanges
                .into_iter()
                .filter(|e| !e.internal && !e.name.starts_with("amq.") && !e.name.is_empty())
                .map(|e| ExchangeSummary {
                    name: e.name,
                    exchange_type: e.exchange_type,
                })
                .collect())
        }
        // ... error arms unchanged
    }
}
```

With this fix, the `#[allow(dead_code)]` on `ExchangeApiInfo.exchange_type` (line 32) must also be removed since it is now used.

---

### CR-03: `ExchangeApiInfo.exchange_type` is dead code due to incomplete implementation

**File:** `src-tauri/src/commands/connection.rs:32-34`
**Issue:** The `exchange_type` field is captured with `#[allow(dead_code)]` and never used. This is a direct consequence of CR-02 — the field was needed for the `ExchangeSummary` mapping but the mapping was never written. The `#[allow(dead_code)]` is a suppressed compile warning masking an incomplete implementation. Combined with CR-01 and CR-02, this confirms the Rust side of Phase 9 was not implemented.

**Fix:** Remove `#[allow(dead_code)]` and use `exchange_type` in the `ExchangeSummary` mapping as shown in CR-02's fix. Once used, the annotation is no longer needed and its removal will verify the field is genuinely referenced.

---

## Warnings

### WR-01: `isLoadingBindings` stuck at `true` when eligibility is revoked mid-fetch

**File:** `src/components/publish/PublishBar.tsx:141-146`
**Issue:** When `isEligibleForCombobox` becomes `false` while a `fetch_bindings` call is in flight (e.g., user switches exchanges rapidly), the early-return branch resets `bindingKeys` and `useCombobox` but does not reset `isLoadingBindings`:

```typescript
if (!activeProfileName || !isEligibleForCombobox) {
  setBindingKeys([]);
  setUseCombobox(false);
  return;  // ← isLoadingBindings is not reset here
}
```

The pending `.then`/`.catch` is gated on `!cancelled` (correctly), so neither branch resets the flag either. `isLoadingBindings` stays `true` until the next eligible exchange is selected and its fetch completes or fails. While `useCombobox` is `false` during this stuck period so the spinner is not visible, the state is incorrect and could cause unexpected behavior if eligibility returns before the previous fetch resolves.

**Fix:**
```typescript
if (!activeProfileName || !isEligibleForCombobox) {
  setBindingKeys([]);
  setUseCombobox(false);
  setIsLoadingBindings(false);  // add this line
  return;
}
```

---

### WR-02: Missing `React` import in test mock type annotations

**File:** `src/components/publish/__tests__/RoutingKeyCombobox.test.tsx:7` / `src/components/publish/__tests__/PublishBar.test.tsx:27`
**Issue:** Both test files use `React.ReactNode` in mock factory type annotations (e.g., `{ children: React.ReactNode }`) without importing React. With `jsx: react-jsx` transform, React is injected for JSX elements but is not placed in scope as a named identifier. TypeScript in strict mode requires an explicit import for `React.ReactNode` type references. This causes a type error at compile time (`Cannot find name 'React'`), which means `tsc --noEmit` fails on these files.

**Fix:** Add to both test files:
```typescript
import type React from "react";
```

---

## Info

### IN-01: Mode switch does not reset `selectedExchange` or `routingKey`

**File:** `src/components/publish/PublishBar.tsx:265`
**Issue:** The `RadioGroup` `onValueChange` handler only calls `setMode(v as Mode)`. When the user toggles queue → exchange → queue → exchange, `selectedExchange` and `routingKey` from the previous exchange-mode session are retained. This can result in stale bindings being fetched for an exchange the user previously selected but may not intend to use. It also means a user who clears their routing key and switches modes has it restored on return.

**Fix:** Reset exchange/routing-key state on mode transitions to queue:
```typescript
onValueChange={(v) => {
  setMode(v as Mode);
  if (v === "queue") {
    setSelectedExchange("");
    setRoutingKey("");
  }
}}
```

Whether to reset on exchange→queue vs. queue→exchange is a product decision; at minimum resetting on queue→exchange prevents stale bindings fetches.

---

_Reviewed: 2026-05-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
