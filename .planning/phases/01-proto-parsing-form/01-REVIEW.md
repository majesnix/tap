---
phase: 01-proto-parsing-form
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 41
files_reviewed_list:
  - components.json
  - package.json
  - src-tauri/capabilities/default.json
  - src-tauri/Cargo.toml
  - src-tauri/Entitlements.plist
  - src-tauri/src/commands/encode.rs
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/commands/proto.rs
  - src-tauri/src/error.rs
  - src-tauri/src/lib.rs
  - src-tauri/src/main.rs
  - src-tauri/src/schema/extractor.rs
  - src-tauri/src/schema/mod.rs
  - src-tauri/src/schema/types.rs
  - src-tauri/tauri.conf.json
  - src/components/form/__tests__/EnumField.test.tsx
  - src/components/form/__tests__/NestedMessageField.test.tsx
  - src/components/form/__tests__/OneofField.test.tsx
  - src/components/form/__tests__/ProtoFormRenderer.test.tsx
  - src/components/form/__tests__/RepeatedField.test.tsx
  - src/components/form/__tests__/ScalarField.test.tsx
  - src/components/form/__tests__/WellKnownTypeField.test.tsx
  - src/components/form/fields/DepthCapPlaceholder.tsx
  - src/components/form/fields/EnumField.tsx
  - src/components/form/fields/NestedMessageField.tsx
  - src/components/form/fields/OneofField.tsx
  - src/components/form/fields/RepeatedField.tsx
  - src/components/form/fields/ScalarField.tsx
  - src/components/form/fields/WellKnownTypeField.tsx
  - src/components/form/FormPanel.tsx
  - src/components/form/ProtoFormRenderer.tsx
  - src/components/include-paths/IncludePathDialog.tsx
  - src/components/layout/AppLayout.tsx
  - src/components/preview/HexPreviewPanel.tsx
  - src/components/sidebar/FileSection.tsx
  - src/components/sidebar/Sidebar.tsx
  - src/hooks/useDebounce.ts
  - src/lib/ipc.ts
  - src/lib/types.ts
  - src/stores/useProtoStore.ts
  - src/test/setup.ts
  - tsconfig.json
  - vite.config.ts
findings:
  critical: 6
  warning: 8
  info: 4
  total: 18
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 41
**Status:** issues_found

## Summary

This phase implements runtime `.proto` file parsing, schema extraction, dynamic form generation, and binary protobuf encoding for the Proto Sender application. The overall architecture is sound — the Tauri IPC boundary, schema type system, and field component hierarchy are well-structured. However, there are six blocker-level defects: a Timestamp field that always encodes to epoch 0, a leap-year calculation error in date parsing, a React hooks ordering violation, Windows path-handling bugs, incomplete handling of wrapper WKTs, and a character-indexed string slice that can panic on Unicode input.

---

## Critical Issues

### CR-01: Timestamp always encodes to epoch 0 due to `datetime-local` format mismatch

**File:** `src/components/form/fields/WellKnownTypeField.tsx:58`

**Issue:** `<input type="datetime-local">` without a `step="1"` attribute emits a 16-character string `"YYYY-MM-DDTHH:MM"` (no seconds, no `Z`). The Rust parser in `encode.rs:280` requires `s.len() >= 19` to attempt any parsing. Every Timestamp field submitted from the form therefore falls through to the `return 0` branch, silently encoding the epoch timestamp `1970-01-01T00:00:00Z` regardless of the user's input.

**Fix:**
```tsx
// WellKnownTypeField.tsx — add step="1" so the browser emits seconds
<input
  id={path}
  type="datetime-local"
  step="1"        // <-- forces HH:MM:SS format (19 chars minimum)
  value={rhfField.value as string}
  onChange={rhfField.onChange}
  onBlur={rhfField.onBlur}
  className="..."
/>
```
Also update `parse_datetime_to_epoch` to handle both 16-char (no-seconds) and 19-char inputs by defaulting `sec` to 0 when absent.

---

### CR-02: Leap-year off-by-one in `parse_datetime_to_epoch`

**File:** `src-tauri/src/commands/encode.rs:289-295`

**Issue:** The `leap_days` calculation counts all leap days from 1970 up to but not including the *current* year (`y = year - 1970`). For a date in March–December of a leap year (e.g. 2024-03-01), February 29 has already passed but is not counted in `days_in_months` (which hard-codes 28 days for February). The result is a day count that is one less than correct for all post-February dates in every leap year, producing a Timestamp that is 86400 seconds earlier than the intended time.

**Fix:**
```rust
// Determine whether the current year is itself a leap year
let is_leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
let days_in_months: [i64; 12] = [
    31, if is_leap { 29 } else { 28 }, 31, 30, 31, 30,
    31, 31, 30, 31, 30, 31,
];
// Leap-day count now only covers years before the current one
let leap_days = ((y - 1) / 4) - ((y - 1) / 100) + ((y - 1) / 400) + if y > 0 { 1 } else { 0 };
```
Or, if the dependency budget allows, use the `chrono` crate and eliminate this hand-rolled calculation entirely.

---

### CR-03: Rules of Hooks violation in `OneofField.tsx`

**File:** `src/components/form/fields/OneofField.tsx:28-50`

**Issue:** `useFormContext()` is called on line 28, then a conditional early return fires on line 30 (`if (field.kind.type !== "oneof") return null`), and then `useMemo`, `useWatch`, and `useEffect` are called on lines 36, 43, and 50. React requires all hooks to be called unconditionally on every render. If the component ever renders with a non-oneof field kind (which is guarded at the callsite but not at the type level), React will throw an error about changing the number of hooks between renders. Every other field component (`ScalarField`, `EnumField`, `NestedMessageField`, `WellKnownTypeField`) correctly returns early *before* the first hook call.

**Fix:**
```tsx
export function OneofField({ field, path, depth, renderBranchField }: OneofFieldProps) {
  const { control, unregister } = useFormContext();

  // Compute branches — hooks must come before any early returns
  const branches = field.kind.type === "oneof" ? field.kind.branches : [];
  const branchNames = useMemo(
    () => branches.map((branch) => branch[0]?.name ?? "unknown"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const firstBranch = branchNames[0] ?? "";
  const selected = useWatch({ control, name: `${path}._selected`, defaultValue: firstBranch });

  useEffect(() => {
    branchNames.forEach((name) => {
      if (name !== selected) unregister(`${path}.${name}`);
    });
  }, [selected, path, unregister, branchNames]);

  // Guard after all hooks
  if (field.kind.type !== "oneof") return null;
  // ... rest of render
}
```

---

### CR-04: Windows path-handling breaks file parsing and include-path persistence

**File:** `src/components/sidebar/FileSection.tsx:43-45, 96`

**Issue:** Path strings from the Tauri dialog on Windows use backslash separators (`C:\Users\...`). The code uses `selected.split("/")` to derive the parent directory and `activeFilePath.split("/").pop()` to display the filename. On Windows, `split("/")` does not split at backslashes, so `pathParts.pop()` removes the entire path string (the single element), `parentDir` becomes `""` (coerced to `"/"`), and the persistence key under `INCLUDE_PATH_KEY_PREFIX` differs between operating systems for the same file. The CLAUDE.md specification explicitly lists Windows as a target platform.

**Fix:**
```tsx
// Replace all path splitting with the platform-aware helper
function getParentDir(filePath: string): string {
  // Handles both "/" (macOS/Linux) and "\" (Windows)
  const sep = filePath.includes("\\") ? "\\" : "/";
  const parts = filePath.split(sep);
  parts.pop();
  return parts.join(sep) || sep;
}

function getFileName(filePath: string): string {
  const sep = filePath.includes("\\") ? "\\" : "/";
  return filePath.split(sep).pop() ?? filePath;
}
```
Use `getParentDir(selected)` and `getFileName(activeFilePath)` in place of the current inline splits.

---

### CR-05: Incomplete WKT encoding — wrapper types silently encode as empty messages

**File:** `src-tauri/src/commands/encode.rs:236-242`

**Issue:** `extractor.rs` marks 16 types as `FieldKind::WellKnown`, including `google.protobuf.StringValue`, `google.protobuf.Int32Value`, `google.protobuf.BoolValue`, and 11 others. The frontend `WellKnownTypeField` renders these as plain text inputs and sends a string to the encoder. In `encode.rs`, the `Kind::Message` arm only special-cases `Timestamp` and `Duration`; all other WKTs fall to the generic nested-message branch, which calls `populate_message`. `populate_message` calls `values.as_object()` on the string value — gets `None` — and returns `Ok(())` without setting any field. The wrapper message is created but empty, producing wire bytes for a message with no `value` field set. The user's input is silently discarded.

**Fix:** Add handlers for the wrapper types that extract the `value` field:
```rust
"google.protobuf.StringValue" => {
    let s = json_val.as_str().unwrap_or("").to_string();
    let mut msg = DynamicMessage::new(msg_desc.clone());
    if let Some(f) = msg_desc.get_field_by_name("value") {
        msg.set_field(&f, Value::String(s));
    }
    Some(Value::Message(msg))
}
"google.protobuf.Int32Value" => { /* similar pattern */ }
// ... etc. for all wrapper types listed in extractor.rs::WELL_KNOWN_TYPES
```
Alternatively, unify the approach by encoding wrapper WKTs using their `value` field and keeping a mapping from WKT name to the expected Rust `Value` variant.

---

### CR-06: Byte-index slicing on `&str` panics on non-ASCII datetime input

**File:** `src-tauri/src/commands/encode.rs:281-286`

**Issue:** `parse_datetime_to_epoch` slices `s[0..4]`, `s[5..7]`, `s[8..10]`, `s[11..13]`, `s[14..16]`, `s[17..19]` as byte-index ranges on a Rust `&str`. Rust string slicing by byte index panics if the range boundary falls in the middle of a multi-byte UTF-8 character. If a user pastes a datetime string containing non-ASCII characters (e.g., full-width digits `０１２３`), the Tauri command will panic and crash the command thread. While datetime inputs from `<input type="datetime-local">` are constrained to ASCII by the browser, the `parse_datetime_to_epoch` function accepts arbitrary `&str` and is also called when the raw form value is an integer-parseable string (line 207-210 accepts `json_val.as_i64()` or `json_val.as_str()`).

**Fix:**
```rust
fn parse_datetime_to_epoch(s: &str) -> i64 {
    if let Ok(n) = s.parse::<i64>() {
        return n;
    }
    // Use char-boundary-safe slicing
    let bytes = s.as_bytes();
    if bytes.len() < 19 {
        return 0;
    }
    let parse_ascii = |range: std::ops::Range<usize>| -> i64 {
        std::str::from_utf8(&bytes[range]).ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(0)
    };
    let year  = parse_ascii(0..4);
    let month = parse_ascii(5..7);
    // ... etc.
}
```

---

## Warnings

### WR-01: Depth-cap logic is duplicated and inconsistent between two components

**File:** `src/components/form/ProtoFormRenderer.tsx:11,109` and `src/components/form/fields/NestedMessageField.tsx:30`

**Issue:** `ProtoFormRenderer` defines `MAX_DEPTH = 5` and guards at `depth > MAX_DEPTH` (triggers at depth 6). `NestedMessageField` independently guards at `depth >= 5` (triggers at depth 5). `NestedMessageField` always fires first in the call chain, so the `ProtoFormRenderer` guard is never reached. Two sources of truth for the same constant, with different operators, one of which is dead code.

**Fix:** Export `MAX_DEPTH` from a shared constants file. Replace `NestedMessageField`'s guard with `depth >= MAX_DEPTH` and remove the dead guard from `ProtoFormRenderer`'s `renderField` function, or vice versa — pick one location. Also import the `DepthCapPlaceholder` in `ProtoFormRenderer` for consistency.

---

### WR-02: `useDebounce` import and call in `FormPanel.tsx` are dead code

**File:** `src/components/form/FormPanel.tsx:4, 21, 22, 45`

**Issue:** `useDebounce` is imported and called with `latestValues.current` (a ref). Because `useRef` mutations do not trigger re-renders, `latestValues.current` is always `null` when `useDebounce` observes it. The hook returns `null` unconditionally. The `void debouncedValues` on line 45 explicitly suppresses the unused-variable warning, but it also signals the author knows this value is unused. Additionally, `handleValuesChange` does not debounce — it fires the IPC call on every change, which can produce rapid fire invocations and a potentially confusing `isEncoding` state race.

**Fix:** Either implement debouncing properly (update a ref, schedule a timeout that reads the ref and fires the IPC call) or remove `useDebounce`, `latestValues`, and `debouncedValues` until the optimization is needed. The dead hook invocation should not be silenced with `void`.

---

### WR-03: Mutex lock `.unwrap()` in async Tauri commands can panic the command thread

**File:** `src-tauri/src/commands/encode.rs:13` and `src-tauri/src/commands/proto.rs:20`

**Issue:** `pool_state.lock().unwrap()` panics if the mutex is poisoned (which happens when a previous holder panicked while holding the lock). In a Tauri application this terminates the command thread with an unrecoverable panic instead of returning a proper `AppError` to the frontend.

**Fix:**
```rust
let pool_guard = pool_state.lock().map_err(|_| AppError::EncodeError {
    field: "<root>".to_string(),
    message: "Internal state lock poisoned".to_string(),
})?;
```

---

### WR-04: `fs:scope` grants filesystem read access to all paths (`**/*`)

**File:** `src-tauri/capabilities/default.json:12`

**Issue:** `{ "identifier": "fs:scope", "allow": [{ "path": "**/*" }] }` grants the Tauri frontend read access to every file on the system via the `fs:allow-read-text-file` permission. While the app currently only reads `.proto` files selected by the user, this scope means any future IPC call that accepts a user-provided path could read arbitrary files. It also means a supply-chain compromise of a JS dependency could exfiltrate any local file.

**Fix:** Scope access to directories the user explicitly opens. The Tauri `dialog:allow-open` permission already limits what the user *sees*, but the fs scope controls what the backend *allows*. Consider using `$APPDATA/**` for store files and relying on the dialog plugin scope for user-selected proto files:
```json
{ "identifier": "fs:scope", "allow": [{ "path": "$APPDATA/**" }] }
```

---

### WR-05: CSP is disabled (`"csp": null`) in production

**File:** `src-tauri/tauri.conf.json:21`

**Issue:** `"csp": null` disables Content Security Policy entirely. For a dev tool that loads and executes form schemas derived from parsed `.proto` files, a CSP misconfiguration could allow script injection if schema strings are ever rendered as HTML. Even though proto field names and values are not currently injected as HTML, the absence of any CSP removes a meaningful defense layer.

**Fix:** Set a restrictive CSP:
```json
"security": {
  "csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'"
}
```

---

### WR-06: macOS entitlements grant root-level filesystem r/w with sandbox disabled

**File:** `src-tauri/Entitlements.plist:6-11`

**Issue:** `com.apple.security.app-sandbox` is `false` and `com.apple.security.temporary-exception.files.absolute-path.read-write` grants `"/"`. This is the broadest possible entitlement: the app can read and write any file on the macOS filesystem. On macOS, a sandboxed app with a narrower exception (e.g., the user's Documents folder or a resolved bookmark) would be safer and still permit `.proto` file loading.

**Fix:** Enable the sandbox and replace the root exception with a narrower permission, or at minimum document the rationale in a comment.

---

### WR-07: Shared temp directory across test runs causes non-isolation

**File:** `src-tauri/src/commands/encode.rs:335-346`

**Issue:** `std::env::temp_dir().join("proto_sender_tests")` is used across all unit tests in the module. Different proto files are written to the same directory with fixed filenames (e.g. `"flat.proto"`). If tests run in parallel (the Rust default), the `std::fs::write` calls race and one test can read the proto written by another, causing false passes or mysterious failures.

**Fix:** Use a unique subdirectory per test invocation, or use the `tempfile` crate:
```rust
// Add tempfile = "3" to [dev-dependencies] in Cargo.toml
let tmp_dir = tempfile::tempdir().unwrap();
let proto_path = tmp_dir.path().join(file_name);
```

---

### WR-08: Path mutation violates immutability convention

**File:** `src/components/sidebar/FileSection.tsx:43-44`

**Issue:** `const pathParts = selected.split("/"); pathParts.pop();` mutates `pathParts` in place. The project CLAUDE.md immutability rule requires creating new objects rather than mutating existing ones.

**Fix:**
```ts
const parts = selected.split("/");
const parentDir = parts.slice(0, -1).join("/") || "/";
```

---

## Info

### IN-01: `let _ = oneof_names;` is dead code

**File:** `src-tauri/src/schema/extractor.rs:96`

**Issue:** `oneof_names` is built on line 47-50 and then suppressed with `let _ = oneof_names;`. The comment says it was "used for doc purposes". It is never used.

**Fix:** Delete the `oneof_names` variable and the `let _ = oneof_names;` suppression.

---

### IN-02: `lucide-react` version `^1.16.0` appears erroneous

**File:** `package.json:22`

**Issue:** `lucide-react` uses a `0.x.y` versioning scheme; there is no published `1.x` major. The `^1.16.0` pin will likely resolve to whatever npm finds under `1.x`, which may be an unexpected package or fail to resolve. The correct reference for the 0.4xx-era library would be something like `"^0.469.0"`.

**Fix:** Run `npm install lucide-react@latest` and lock to the resolved version. Verify the installed version matches expectations.

---

### IN-03: `DepthCapPlaceholder` test in `ProtoFormRenderer.test.tsx` does not actually test depth cap

**File:** `src/components/form/__tests__/ProtoFormRenderer.test.tsx:19-55`

**Issue:** The test named "renders depth cap placeholder when MAX_DEPTH is exceeded" only renders a scalar string field at depth 0 and asserts a textbox is present. It does not exercise the depth cap code path at all. The comment acknowledges this ("this test guards that the placeholder copy text is correct") but the guard is toothless — renaming or deleting `DepthCapPlaceholder`'s text would not be caught by this test.

**Fix:** Test the actual depth cap via `NestedMessageField` (already done in `NestedMessageField.test.tsx`). Either rename this test to accurately describe what it checks or add a proper depth-cap integration test through `ProtoFormRenderer` with a recursive schema.

---

### IN-04: `INITIAL_STATE` spread in `useProtoStore.reset()` spreads a `const` object with `as const`

**File:** `src/stores/useProtoStore.ts:20-27, 51`

**Issue:** `INITIAL_STATE` is declared `as const`, which makes its values readonly. Spreading it into `set({ ...INITIAL_STATE })` on line 51 works at runtime because Zustand only reads the values, but TypeScript may emit type errors depending on how strictly `as const` interacts with the `set` function's type parameter. This is a low-severity type-system concern but worth verifying with `tsc --strict`.

**Fix:** If `tsc` reports an error, remove `as const` and replace it with `satisfies ProtoStore` or `as Omit<ProtoStore, keyof ProtoStore extends string ? ...>` to get type checking without making values `readonly`. Alternatively, cast the spread: `set({ ...(INITIAL_STATE as typeof INITIAL_STATE) })` is redundant; the real fix is an explicit type annotation: `const INITIAL_STATE: Omit<ProtoStore, 'setFile' | 'setSelectedType' | ...> = { ... }`.

---

_Reviewed: 2026-05-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
