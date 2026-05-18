---
phase: 03-full-feature-set
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - src-tauri/src/commands/publish.rs
  - src-tauri/src/error.rs
  - src/components/form/__tests__/FormPanel.test.tsx
  - src/components/form/fields/WellKnownTypeField.tsx
  - src/components/form/FormPanel.tsx
  - src/components/form/ProtoFormRenderer.tsx
  - src/components/history/HexViewDialog.tsx
  - src/components/history/HistoryFilterBar.tsx
  - src/components/history/historyHelpers.test.ts
  - src/components/history/historyHelpers.ts
  - src/components/history/HistoryTable.tsx
  - src/components/history/MessageHistoryPanel.tsx
  - src/components/layout/AppLayout.tsx
  - src/components/layout/RightPanel.tsx
  - src/components/publish/AmqpPropertiesSheet.tsx
  - src/components/publish/PublishBar.tsx
  - src/components/sidebar/FileSection.tsx
  - src/components/ui/popover.tsx
  - src/components/ui/sheet.tsx
  - src/components/ui/switch.tsx
  - src/components/ui/tabs.tsx
  - src/components/ui/textarea.tsx
  - src/lib/ipc.ts
  - src/stores/useAmqpStore.test.ts
  - src/stores/useAmqpStore.ts
  - src/stores/useHistoryStore.test.ts
  - src/stores/useHistoryStore.ts
  - src/stores/useProtoStore.test.ts
  - src/stores/useProtoStore.ts
findings:
  critical: 3
  warning: 5
  info: 2
  total: 10
status: fixed
---

# Phase 03: Code Review Report

**Reviewed:** 2026-05-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 29
**Status:** issues_found

## Summary

This phase implements a full publish-to-RabbitMQ feature set: a Rust `publish_message` Tauri command, React stores for AMQP properties and message history, a dynamic proto form renderer, a message history panel with replay/resend, and supporting UI components. The overall structure is sound and consistent, and the test suites for the Zustand stores and helper functions are well-written.

Three blockers were found: (1) publisher confirms are awaited without first enabling confirm mode on the channel, which means the confirm future always resolves immediately without any broker acknowledgement; (2) the AMQP connection is not closed on error paths before the function returns, leaking TCP connections; and (3) the `AmqpPropertiesSheet` local draft state is not subject to the 20-header cap enforced by the store, allowing unlimited headers to accumulate in the draft before being committed.

Five warnings cover: AMQP password exposed in Rust stack traces via `?` early-returns; the `handleResend` success path calling `appendEntry` inside a catch block that swallows append failures silently; the `resetRef` wiring running on every render without a cleanup; the `HexViewDialog` not sanitising `payloadBytes` before rendering; and the `FileSection` path splitting using `/` hard-coded, breaking on Windows.

---

## Critical Issues

### CR-01: Publisher confirms awaited without enabling confirm mode — `basic_publish` ack is meaningless

**File:** `src-tauri/src/commands/publish.rs:107-117`

**Issue:** The code calls `.await` on the `Confirmation` future returned by `basic_publish` (line 116, the second `.await`), which is intended to wait for a broker acknowledgement. However, AMQP publisher confirms require the channel to be put into confirm mode first by calling `channel.confirm_select(ConfirmSelectOptions::default()).await` before any publish. Without this call the channel is in normal mode, and `lapin`'s `basic_publish` still returns a `Confirmation` but it resolves immediately with a synthetic ack rather than waiting for the broker. The result is that the function reports success even when the broker has not acknowledged the message, e.g. when the target queue or exchange does not exist and the broker would reject or drop the message.

**Fix:**
```rust
// After creating the channel, enable publisher confirms:
channel
    .confirm_select(lapin::options::ConfirmSelectOptions::default())
    .await
    .map_err(|e| AppError::AmqpError(e.to_string()))?;

// Now the .await on basic_publish's Confirmation future is a real broker ack.
```

---

### CR-02: AMQP connection leaked on error paths in `publish_message`

**File:** `src-tauri/src/commands/publish.rs:67-117`

**Issue:** The connection is closed only on the happy path (line 120, after a successful publish). If `create_channel()` (line 67-70) or `basic_publish` (line 107-117) returns an error, the function returns early via `?` or `map_err(...)?` without closing the connection. Each failed publish attempt leaks an open TCP connection to the RabbitMQ broker until the OS times it out. In a dev tool used frequently (especially when queues/exchanges are mistyped), this accumulates open connections.

**Fix:**
```rust
// Use a guard or restructure so conn.close() is called on all paths.
// Simplest approach: close before returning the error.

let channel = match conn.create_channel().await {
    Ok(ch) => ch,
    Err(e) => {
        let _ = conn.close(0, "".into()).await;
        return Err(AppError::AmqpError(e.to_string()));
    }
};

// Similarly wrap the publish call, or use a drop guard / defer pattern.
```

---

### CR-03: `AmqpPropertiesSheet` local draft has no header count cap — bypasses `MAX_HEADERS` guard

**File:** `src/components/publish/AmqpPropertiesSheet.tsx:242-258`

**Issue:** The "Add Header" button in the properties sheet works against a local `draft` state, not directly against `useAmqpStore`. The `useAmqpStore.addHeader` enforcer that caps at `MAX_HEADERS = 20` is not called; instead, the component directly spreads into `draft.headers` with no length check. A user can add an arbitrary number of headers in the draft, and when "Apply Properties" is clicked `setHeaders(draft.headers)` commits the entire unchecked array to the store, bypassing the `T-03-02-02` cap entirely.

**Fix:**
```typescript
// In the "Add Header" onClick handler, enforce the cap before updating draft:
onClick={() => {
  if (!newHeaderKey.trim()) return;
  if (draft.headers.length >= 20) {
    toast.error("Maximum 20 custom headers reached");
    return;
  }
  setDraft((d) => ({
    ...d,
    headers: [
      ...d.headers,
      { key: newHeaderKey.trim(), value: newHeaderValue.trim() },
    ],
  }));
  setNewHeaderKey("");
  setNewHeaderValue("");
  setHeaderPopoverOpen(false);
}}
```

---

## Warnings

### WR-01: AMQP password may appear in Rust error messages / stack traces via `load_profile_with_password`

**File:** `src-tauri/src/commands/publish.rs:43-45`

**Issue:** `load_profile_with_password` returns `(profile, password)`. If that call fails (the `?` on line 45), the error propagates up as an `AppError` whose `Display` impl passes through whatever the underlying store/keyring error says. That error is serialized and sent to the JS frontend. More critically, `build_amqp_uri` constructs a URI containing the cleartext password (line 47-53). The comment on line 55 correctly drops `password`, but the `uri` local variable lives until the end of the function. Any error after line 53 and before the function returns — specifically an error from `Connection::connect` that embeds the URI in its error payload — would include the password in the `AppError::AmqpError` string sent back to the frontend and potentially logged by `tracing`.

**Fix:**
```rust
// Immediately after the connect attempt, whether it succeeds or fails, ensure
// the uri is zeroed/dropped before error propagation. Use a block to limit scope:
let conn = {
    let uri = build_amqp_uri(...);
    let result = tokio::time::timeout(
        Duration::from_secs(10),
        Connection::connect(&uri, ConnectionProperties::default()),
    ).await;
    // uri is dropped here, before result is mapped
    result
        .map_err(|_| AppError::AmqpError("Publish connection timed out (10s)".to_string()))?
        .map_err(|e| {
            // Do NOT use e.to_string() if it embeds the URI.
            // Sanitize to a generic message:
            AppError::AmqpError("AMQP connection failed".to_string())
        })?
};
```

---

### WR-02: `handleResend` in `MessageHistoryPanel` — append-entry failure is silently swallowed

**File:** `src/components/history/MessageHistoryPanel.tsx:75-84`

**Issue:** After a successful resend, `appendEntry` is awaited inside the `try` block (line 75). If `appendEntry` throws (e.g. the `tauri-plugin-store` write fails), the error falls into the `catch` block at line 85 which displays a generic `Resend failed:` toast. This is misleading: the message was already sent to RabbitMQ successfully but the history record was not saved — the user sees "Resend failed" when it actually succeeded. Additionally, the resend failure path (line 86-88) does not add a failed entry to history, so there is no audit trail of the attempted resend.

**Fix:**
```typescript
// Separate the publish from the history write. Only show "Resend failed" for publish errors.
try {
  await publishMessage(activeProfileName, entry.exchange, entry.routingKey, entry.payloadBytes);
  toast(`Message resent to ${target}`, { duration: 3000 });
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  toast.error(`Resend failed: ${message}`, { duration: 5000 });
  return;
}

// History write: best-effort, separate error handling
try {
  await useHistoryStore.getState().appendEntry({ ... status: "sent" ... });
} catch {
  // Non-fatal: message was sent; log silently or show a secondary warning
}
```

---

### WR-03: `resetRef` wired on every render in `ProtoFormRenderer` — missing cleanup and unnecessary churn

**File:** `src/components/form/ProtoFormRenderer.tsx:110-118`

**Issue:** The `useEffect` that wires `resetRefInternal.current.current = ...` has no dependency array (line 112 runs after every render). This is intentional per the comment, but it means the ref is re-assigned on every render cycle of `ProtoFormRenderer`. More importantly, there is no cleanup: if the component unmounts while `FormPanel` still holds a reference via `resetRef`, a stale callback pointing to a now-unmounted form will remain accessible via `resetRef.current`. Calling it would call `methods.reset()` on an unmounted react-hook-form instance, which can cause "Warning: Can't perform a React state update on an unmounted component" in development and silent no-ops in production, masking replay failures.

**Fix:**
```typescript
useEffect(() => {
  if (resetRefInternal.current) {
    resetRefInternal.current.current = (values: Record<string, unknown>) => {
      methods.reset(values);
    };
  }
  // Cleanup: nullify the ref when the form unmounts
  return () => {
    if (resetRefInternal.current) {
      resetRefInternal.current.current = null;
    }
  };
}); // intentionally no deps — runs after every render
```

---

### WR-04: `FileSection` path splitting uses `/` — breaks on Windows

**File:** `src/components/sidebar/FileSection.tsx:47-49`

**Issue:** The parent directory is derived by splitting on `"/"` and rejoining:
```typescript
const pathParts = selected.split("/");
pathParts.pop();
const parentDir = pathParts.join("/") || "/";
```
On Windows, Tauri's dialog returns native paths using `\` as the separator. Splitting on `"/"` would leave the entire path as a single element after `pop()`, yielding `""` which then becomes `"/"` — a Linux root path that is meaningless and does not exist on Windows. The include-path dialog would then be pre-populated with an invalid path.

**Fix:**
```typescript
// Use a cross-platform approach. Tauri's path API or a simple regex:
const sep = selected.includes("\\") ? "\\" : "/";
const pathParts = selected.split(sep);
pathParts.pop();
const parentDir = pathParts.join(sep) || sep;
// Or: use @tauri-apps/api/path's `dirname` if available.
```

---

### WR-05: `HexViewDialog` renders arbitrary `payloadBytes` without bounds check

**File:** `src/components/history/HexViewDialog.tsx:21-23`

**Issue:** `entry.payloadBytes` is mapped directly to hex without any validation:
```typescript
const hex = entry.payloadBytes
  .map((b) => b.toString(16).padStart(2, "0"))
  .join(" ");
```
`payloadBytes` is typed as `number[]` but entries loaded from `tauri-plugin-store` are deserialized from JSON — if the persisted data is corrupted or manually edited, values outside `[0, 255]` (or `NaN`, negative numbers, floats) will produce invalid hex strings like `"-1"`, `"nan"`, or multi-character hex for values > 255. These would render incorrectly in the `<pre>` block. While not a security issue (content is read from local storage, not remote), the incorrect rendering is a correctness issue.

**Fix:**
```typescript
const hex = entry.payloadBytes
  .filter((b) => Number.isInteger(b) && b >= 0 && b <= 255)
  .map((b) => b.toString(16).padStart(2, "0"))
  .join(" ");
```

---

## Info

### IN-01: `use client` directive in `popover.tsx` — not applicable in Tauri/Vite context

**File:** `src/components/ui/popover.tsx:1`

**Issue:** The file starts with `"use client"` on line 1. This directive is a Next.js/React Server Components convention and has no meaning in a Tauri + Vite application. It is not harmful but is misleading noise in a non-Next.js project and could confuse future maintainers.

**Fix:** Remove the `"use client"` directive from `src/components/ui/popover.tsx`.

---

### IN-02: `AmqpPropertiesSheet` duplicates `INITIAL_PROPERTIES` constant already defined in `useAmqpStore.ts`

**File:** `src/components/publish/AmqpPropertiesSheet.tsx:25-32`

**Issue:** `INITIAL_PROPERTIES` is defined identically in both `useAmqpStore.ts` (as the module-level constant) and `AmqpPropertiesSheet.tsx` (lines 25-32). If the defaults change in the store (e.g. a new field is added), the sheet's reset behavior will silently diverge. This violates DRY.

**Fix:** Export `INITIAL_PROPERTIES` from `useAmqpStore.ts` and import it in `AmqpPropertiesSheet.tsx`:
```typescript
// useAmqpStore.ts — change from const to export const:
export const INITIAL_PROPERTIES: AmqpProperties = { ... };

// AmqpPropertiesSheet.tsx — remove local definition, import instead:
import { useAmqpStore, type AmqpProperties, INITIAL_PROPERTIES } from "@/stores/useAmqpStore";
```

---

_Reviewed: 2026-05-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
