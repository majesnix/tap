---
phase: 260610-vmn
plan: "01"
type: execute
wave: 1
depends_on: []
files_modified:
  - src-tauri/src/commands/encode.rs
  - src-tauri/src/commands/subscribe.rs
  - src-tauri/src/commands/proto.rs
  - src/lib/ipc.ts
  - src/components/sidebar/FileSection.tsx
  - src/components/history/MessageHistoryPanel.tsx
  - src/components/form/FormPanel.tsx
  - src/lib/randomizer.ts
  - src/components/publish/PublishBar.tsx
autonomous: true
requirements: [BUG-1, BUG-2, BUG-3, BUG-4, BUG-5, BUG-6, BUG-7]

must_haves:
  truths:
    - "BUG-1: Timestamp encoding for 2025-06-10 returns the correct Unix epoch (>1749513600); fractional seconds parsed into nanos; timezone offset applied; malformed/multi-byte input returns 0 without panicking"
    - "BUG-2: Subscribe slot is cleared on every consumer exit path (ack failure, delivery error, broker stream close) so start_subscribe never returns 'Already running' after a self-termination"
    - "BUG-3: reload_proto returns Vec<ProtoSchema> aligned with file_paths; FileSection applies each schema to its own file, not all to activeFile"
    - "BUG-4: History replay/resend sets selectedMessageType to entry.messageTypeName; aborts with toast if the type is missing from schema; setActiveIndex no-ops when index unchanged"
    - "BUG-5: Draft save effect tags debouncedValues with (filePath, messageType) captured at watch time and skips save when tag mismatches current selection (type-switch stale-value contamination eliminated)"
    - "BUG-6: Randomize merges random values over current values (dirty fields preserved); randomBytes generates base64 not hex; Timestamp random generates datetime-local-compatible string (no Z suffix)"
    - "BUG-7: handleSend re-encodes from current latestValues synchronously before publish so stale hexPreview cannot be sent; history fieldValues match actually-published bytes"
  artifacts:
    - path: "src-tauri/src/commands/encode.rs"
      provides: "Corrected parse_datetime_to_epoch using days_from_civil algorithm, safe byte-slicing with .get(), fractional seconds, timezone offset"
    - path: "src-tauri/src/commands/subscribe.rs"
      provides: "Slot cleared on all non-cancellation exit paths; conn.close() on all exit paths"
    - path: "src-tauri/src/commands/proto.rs"
      provides: "reload_proto returns Vec<ProtoSchema>"
    - path: "src/lib/ipc.ts"
      provides: "reloadProto returns Promise<ProtoSchema[]>"
    - path: "src/components/sidebar/FileSection.tsx"
      provides: "handleReload applies each schema to its own filePath"
    - path: "src/components/history/MessageHistoryPanel.tsx"
      provides: "setSelectedType called with entry.messageTypeName after setActiveIndex"
    - path: "src/components/form/FormPanel.tsx"
      provides: "Draft save effect uses tagged value { filePath, messageType, values }; setActiveIndex no-op when index unchanged"
    - path: "src/lib/randomizer.ts"
      provides: "generateRandomValues merges over currentValues; randomBytes returns base64; randomWellKnown Timestamp omits Z"
    - path: "src/components/publish/PublishBar.tsx"
      provides: "handleSend calls encodeMessage(latestValues) before publish; history records those bytes"
  key_links:
    - from: "src/lib/ipc.ts reloadProto"
      to: "src-tauri/src/commands/proto.rs reload_proto"
      via: "invoke return type changed Vec<ProtoSchema>"
      pattern: "Promise<ProtoSchema\\[\\]>"
    - from: "src/components/publish/PublishBar.tsx handleSend"
      to: "src/lib/ipc.ts encodeMessage"
      via: "re-encode before publish"
      pattern: "encodeMessage.*latestValues"
---

<objective>
Fix all 7 HIGH-severity correctness bugs confirmed by full app review. The bugs span Rust backend (timestamp math, subscribe slot leak, reload_proto return type) and React frontend (history replay type selection, draft cross-contamination, randomizer merge, send-stale-bytes race).

Purpose: Each bug silently produces incorrect behavior: wrong bytes sent, permanent UI wedge, wrong form populated, values lost, stale encoding published. All must be fixed before v1.8 milestone work proceeds.
Output: Green `cargo test` (27+), green `pnpm test` (629+), `cargo clippy -- -D warnings` clean, `pnpm build` (tsc) clean.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@src-tauri/src/commands/encode.rs
@src-tauri/src/commands/subscribe.rs
@src-tauri/src/commands/proto.rs
@src/lib/ipc.ts
@src/components/sidebar/FileSection.tsx
@src/components/history/MessageHistoryPanel.tsx
@src/components/form/FormPanel.tsx
@src/lib/randomizer.ts
@src/components/publish/PublishBar.tsx
@src/stores/useProtoStore.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Fix Rust backend bugs — timestamp epoch math, subscribe slot leak, reload_proto return type</name>
  <files>
    src-tauri/src/commands/encode.rs,
    src-tauri/src/commands/subscribe.rs,
    src-tauri/src/commands/proto.rs
  </files>
  <behavior>
    Timestamp unit tests (add inside encode.rs under #[cfg(test)]):
    - parse_datetime_to_epoch("1970-01-01T00:00:00Z") == 0
    - parse_datetime_to_epoch("1972-02-29T00:00:00Z") == known epoch (leap day adjacency)
    - parse_datetime_to_epoch("1972-03-01T00:00:00Z") == 1972-02-29 + 86400
    - parse_datetime_to_epoch("2025-06-10T00:00:00Z") == 1749513600 (verify with known value)
    - parse_datetime_to_epoch("2024-02-29T00:00:00Z") correctly handles 2024 leap year
    - parse_datetime_to_epoch("2025-06-10T12:30:45.123456789Z") returns correct secs + nanos = 123456789
    - parse_datetime_to_epoch("2025-06-10T14:30:00+02:00") == same as 2025-06-10T12:30:00Z
    - parse_datetime_to_epoch("2025-06-10T10:30:00-02:00") == same as 2025-06-10T12:30:00Z
    - parse_datetime_to_epoch("not-a-date") == 0 (no panic)
    - parse_datetime_to_epoch("2025-éé-10T00:00:00Z") == 0 (multi-byte UTF-8 no panic)
    - parse_datetime_to_epoch("short") == 0 (no panic)
  </behavior>
  <action>
    **encode.rs — replace parse_datetime_to_epoch:**

    The function must return `(i64, i32)` (seconds, nanos) so the caller at line ~342 can set both fields. Update the call site to use the tuple: `let (secs, nanos) = parse_datetime_to_epoch(s); ts_msg.set_field(&nanos_field, Value::I32(nanos));`.

    Implement `parse_datetime_to_epoch(s: &str) -> (i64, i32)` using Howard Hinnant's days_from_civil algorithm — no new crate:

    ```
    days_from_civil(y, m, d):
      if m <= 2: y -= 1; era_m = m + 9; else era_m = m - 3
      era = y / 400 (floor for negative)
      yoe = y - era * 400           (0..=399)
      doy = (153 * era_m + 2) / 5 + d - 1   (0..=365)
      doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
      return era * 146097 + doe - 719468
    ```

    Steps for parsing:
    1. Try `s.parse::<i64>()` first — return `(n, 0)`.
    2. Validate the string is ASCII-only (reject with `(0,0)` if not — prevents multi-byte UTF-8 panic).
    3. Require `s.len() >= 19`; otherwise return `(0, 0)`.
    4. Use `s.get(0..4)`, `s.get(5..7)`, `s.get(8..10)`, `s.get(11..13)`, `s.get(14..16)`, `s.get(17..19)` — all `.unwrap_or("0")`, parse each with `.parse::<i64>().unwrap_or(0)`.
    5. Apply days_from_civil(year, month, day) for total days from epoch.
    6. Fractional seconds: if `s.len() > 19` and `s.as_bytes().get(19) == Some(&b'.')`, parse the digits after the dot up to the next non-digit as nanos (left-pad to 9 digits: e.g. ".123" → 123000000, ".123456789" → 123456789). Store remainder after fractional for timezone parsing.
    7. Timezone: scan the remaining suffix for `Z` (offset=0), `+HH:MM` or `-HH:MM`. Parse offset as `sign * (hh*3600 + mm*60)` and subtract from computed seconds (UTC = local - offset).
    8. Return `(total_seconds, nanos_i32)`.

    The nanos field in the Timestamp proto is `int32` — cast nanos to `i32` with `nanos as i32` (safe: 0..=999_999_999 fits i32).

    **subscribe.rs — clear slot on all exit paths:**

    The spawned task at line ~196 must clear the `subscribe_state` slot on every `break` that is NOT the cancellation arm (which is already handled by `stop_subscribe` via `guard.take()`). The task receives `app: tauri::AppHandle` which is already available as a function parameter — clone it into the spawn closure.

    Inside the spawn closure, before the loop, extract a helper: capture `subscribe_state_clone` as `Arc<Mutex<Option<SubscribeState>>>`. But since the state is a Tauri managed state (`tauri::State<'_, ...>`), it cannot be moved into the closure. Instead, use `app.state::<Mutex<Option<SubscribeState>>>()` inside the closure to re-acquire the managed state — `app` is `Clone` and `AppHandle: Send + Sync`.

    Add a `clear_state` closure inside the spawn block:
    ```rust
    let clear_state = || {
        if let Ok(mut g) = app_handle_clone.state::<Mutex<Option<SubscribeState>>>().lock() {
            *g = None;
        }
    };
    ```

    Call `clear_state()` on every `break` that is not the cancellation arm:
    - ack failure break (~:258): add `clear_state();` before `break`
    - delivery error break (~:333): add `clear_state();` before `break`
    - None (broker closed stream) break (~:341): add `clear_state();` before `break`

    Also add `conn.close(0, "".into()).await;` on the ack failure and delivery error break paths (currently only None and cancellation close the connection).

    The cancellation arm MUST NOT call `clear_state()` — `stop_subscribe` already calls `guard.take()` before cancelling.

    Rename the `app` parameter clone for capture as `app_handle_clone` to avoid confusion.

    **proto.rs — return Vec<ProtoSchema>:**

    Change the return type of `reload_proto` from `Ok(first_schema.unwrap())` to `Ok(schemas)` where `schemas: Vec<ProtoSchema>` is populated as `schemas.push(extractor::extract_schema(&pool))` for each `i`. Remove the `if i == 0 { first_schema = ... }` special case; push for every file. Update the function signature return type to `Result<Vec<ProtoSchema>, AppError>`. The AppError type is already in scope via `use crate::error::AppError`.
  </action>
  <verify>
    <automated>cd /Users/majesnix/gits/proto-sender/src-tauri && cargo test -- --nocapture 2>&1 | tail -20 && cargo clippy -- -D warnings 2>&1 | tail -10</automated>
  </verify>
  <done>
    cargo test passes (27+ tests); new timestamp unit tests pass; cargo clippy reports zero warnings; parse_datetime_to_epoch("2025-06-10T00:00:00Z") returns (1749513600, 0); subscribe.rs clears slot on all 3 non-cancellation exit paths; proto.rs returns Vec&lt;ProtoSchema&gt;.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fix frontend bugs — IPC type, FileSection reload, history replay type, draft contamination, randomizer merge, send-fresh-encode</name>
  <files>
    src/lib/ipc.ts,
    src/components/sidebar/FileSection.tsx,
    src/components/history/MessageHistoryPanel.tsx,
    src/stores/useProtoStore.ts,
    src/components/form/FormPanel.tsx,
    src/lib/randomizer.ts,
    src/components/publish/PublishBar.tsx
  </files>
  <behavior>
    BUG-3 (ipc.ts + FileSection):
    - reloadProto returns Promise&lt;ProtoSchema[]&gt;
    - handleReload iterates schemas and calls updateFileSchema(openFiles[i].filePath, schemas[i]) for each

    BUG-4 (MessageHistoryPanel):
    - handleReplay: if tabIndex === activeIndex, no setActiveIndex call (no-op guard); always call setSelectedType(entry.messageTypeName) after; abort with toast if type not in schema
    - handleResend: same type-select logic

    BUG-4 (useProtoStore.setActiveIndex):
    - When new index === current activeIndex, return current state unchanged (no-op)

    BUG-5 (FormPanel draft save):
    - Tagged value type: { filePath: string; messageType: string; values: Record&lt;string, unknown&gt; }
    - saveDraft effect only fires when taggedValue.filePath === activeFilePath and taggedValue.messageType === selectedMessageType
    - No cross-contamination when switching types with dirty form

    BUG-6 (randomizer):
    - generateRandomValues(msg, messageMap, dirtyFields, currentValues?) merges: result includes dirty fields from currentValues
    - randomBytes() returns btoa(binaryString) — valid base64 string
    - randomWellKnown("Timestamp") returns new Date(...).toISOString().slice(0, 19) (no Z, no timezone, datetime-local compatible)
    - FormPanel handleRandomize passes current form values as currentValues arg
    - StepFieldEditor caller updated if it calls generateRandomValues

    BUG-7 (PublishBar):
    - handleSend calls encodeMessage(selectedMessageType, latestValues) to get fresh bytes
    - history entry fieldValues === latestValues used to encode
    - If encodeMessage rejects, show toast and abort send
  </behavior>
  <action>
    **src/lib/ipc.ts — BUG-3:**
    Change `reloadProto` return type from `Promise<ProtoSchema>` to `Promise<ProtoSchema[]>` by updating the `invoke` call: `return invoke<ProtoSchema[]>("reload_proto", { filePaths, includePaths });`.

    **src/components/sidebar/FileSection.tsx — BUG-3:**
    In `handleReload`, after `const schema = await reloadProto(allFilePaths, allIncludePaths);` rename to `const schemas`:
    ```
    const schemas = await reloadProto(allFilePaths, allIncludePaths);
    schemas.forEach((schema, i) => {
      const file = openFiles[i];
      if (file) updateFileSchema(file.filePath, schema);
    });
    ```
    Remove the single `updateFileSchema(activeFile.filePath, schema)` call.

    **src/stores/useProtoStore.ts — BUG-4 (no-op guard):**
    In `setActiveIndex`, add early return guard at the top:
    ```typescript
    setActiveIndex: (index) =>
      set((s) => {
        if (s.activeIndex === index) return s; // no-op: already on this tab
        const entry = s.openFiles[index];
        return { ... }; // existing body unchanged
      }),
    ```

    **src/components/history/MessageHistoryPanel.tsx — BUG-4:**
    In `handleReplay` and `handleResend`, after the tabIndex check:
    1. Call `setActiveIndex(tabIndex)` only when `tabIndex !== useProtoStore.getState().activeIndex`.
    2. After (or unconditionally), get the current schema for the target file: `const targetFile = openFiles[tabIndex]; const schema = targetFile?.schema;`.
    3. Check that `entry.messageTypeName` exists in `schema?.message_map`. If not: `toast.error("Replay failed: message type not found in schema."); return;`.
    4. Call `useProtoStore.getState().setSelectedType(entry.messageTypeName)`.
    5. Then `setPendingReplayValues(entry.fieldValues)` as before.

    **src/components/form/FormPanel.tsx — BUG-5 (draft contamination):**

    Replace the scalar `debouncedValues` (which is just the values object) with a tagged version. Introduce a new local state `taggedValues` that captures the (filePath, messageType) at watch time:

    In the `handleValuesChange` callback (line ~129), change the store update to also capture the tag:
    ```typescript
    const handleValuesChange = useCallback((values: unknown) => {
      const { activeFilePath: fp, selectedMessageType: mt } = useProtoStore.getState();
      useProtoStore.getState().setLatestValues(values as Record<string, unknown>);
      setTaggedValues({ filePath: fp ?? "", messageType: mt ?? "", values: values as Record<string, unknown> });
    }, []);
    ```
    Add `const [taggedValues, setTaggedValues] = useState<{ filePath: string; messageType: string; values: Record<string, unknown> } | null>(null);` near the top of FormPanel.

    Debounce the tagged object: `const debouncedTagged = useDebounce(taggedValues, 200);`

    Update the encode effect to use `debouncedTagged?.values` (same 200ms debounce, same behavior).

    Update the draft save effect:
    ```typescript
    useEffect(() => {
      if (!draftsLoaded || !activeFilePath || !selectedMessageType || !debouncedTagged) return;
      if (isRestoringRef.current) return;
      // BUG-5 fix: skip if tag doesn't match current selection (stale debounce after type switch)
      if (debouncedTagged.filePath !== activeFilePath || debouncedTagged.messageType !== selectedMessageType) return;
      const msg = schema?.message_map[selectedMessageType];
      if (!msg) return;
      const defaults = buildDefaultValues(msg);
      if (JSON.stringify(debouncedTagged.values) === JSON.stringify(defaults)) return;
      void saveDraft(activeFilePath, selectedMessageType, debouncedTagged.values);
    }, [debouncedTagged, selectedMessageType, activeFilePath, draftsLoaded, schema, saveDraft]);
    ```

    **src/lib/randomizer.ts — BUG-6:**

    (a) `randomBytes()`: change to return base64. Replace the hex map+join with:
    ```typescript
    function randomBytes(): string {
      const len = randomInt(4, 16);
      const bytes = new Uint8Array(len);
      crypto.getRandomValues(bytes);
      return btoa(String.fromCharCode(...bytes));
    }
    ```

    (b) `randomWellKnown("Timestamp")`: change `return new Date(now + offset).toISOString()` to `return new Date(now + offset).toISOString().slice(0, 19)` to strip the Z and fractional seconds, producing a datetime-local compatible value (e.g. "2025-06-10T14:23:11").

    (c) `generateRandomValues` — add optional `currentValues` parameter and merge:
    ```typescript
    export function generateRandomValues(
      message: MessageSchema,
      messageMap: Record<string, MessageSchema>,
      dirtyFields?: Record<string, boolean>,
      currentValues?: Record<string, unknown>
    ): Record<string, unknown> {
      const values: Record<string, unknown> = {};
      for (const field of message.fields) {
        if (dirtyFields?.[field.name]) {
          // preserve dirty field value from currentValues (immutable: read, don't mutate)
          values[field.name] = currentValues?.[field.name];
          continue;
        }
        // ... existing random generation logic unchanged ...
      }
      return values;
    }
    ```

    (d) In `FormPanel.tsx handleRandomize`, pass current form values to `generateRandomValues`:
    ```typescript
    const handleRandomize = useCallback(() => {
      if (!schema || !selectedMessageType) return;
      const msg = schema.message_map[selectedMessageType];
      if (!msg) return;
      if (isJsonMode) setIsJsonMode(false);
      const dirtyFields = getDirtyFieldsRef.current?.() ?? {};
      const currentValues = latestValues ?? {};
      const randomValues = generateRandomValues(msg, schema.message_map, dirtyFields, currentValues);
      setPendingReplayValues(randomValues);
    }, [schema, selectedMessageType, isJsonMode, setPendingReplayValues, latestValues]);
    ```

    If `StepFieldEditor.tsx` also calls `generateRandomValues`, update its call site to pass current field values as the fourth argument (check src/components/form/StepFieldEditor.tsx line ~671-680 and add current values if the call is there).

    **src/components/publish/PublishBar.tsx — BUG-7:**

    In `handleSend`, replace the `hexPreview` branch with a fresh encode:
    ```typescript
    // BUG-7: re-encode from current latestValues to prevent stale-bytes race
    const { latestValues, selectedMessageType, activeFilePath } = useProtoStore.getState();
    if (!selectedMessageType || !latestValues) {
      toast.error("Send failed: No form values. Fill out the form first.");
      return;
    }
    let freshPayload: number[];
    try {
      freshPayload = await encodeMessage(selectedMessageType, latestValues);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Send failed: encoding error — ${msg}`);
      return;
    }
    ```
    Remove the `if (!hexPreview)` guard and the `const payload = hexToBytes(hexPreview)` lines. Use `freshPayload` wherever `payload` was used below. Remove the duplicate `const { latestValues, selectedMessageType, activeFilePath } = useProtoStore.getState()` line that appears after the old guard (line ~266) since it's now captured before the encode call.

    The history entry must use `freshPayload` as `payloadBytes` and `latestValues` as `fieldValues` — verify the `appendEntry` call uses these (it should after the above).

    Import `encodeMessage` at the top of PublishBar.tsx if not already imported (check existing imports).

    All changes must follow the immutable-patterns rule: no in-place mutation of state objects. All TypeScript changes must have explicit types on new variables (no implicit `any`).
  </action>
  <verify>
    <automated>cd /Users/majesnix/gits/proto-sender && pnpm test --run 2>&1 | tail -30 && pnpm build 2>&1 | tail -20</automated>
  </verify>
  <done>
    pnpm test passes (629+ tests); pnpm build (tsc) exits 0; reloadProto IPC signature updated; FileSection applies per-file schemas; history replay selects correct message type; FormPanel draft save skips on type-switch stale values; randomizer preserves dirty fields by merging; randomBytes returns valid base64; Timestamp random is datetime-local safe; handleSend encodes from latestValues before publish.
  </done>
</task>

<task type="auto">
  <name>Task 3: Verify full test suite, clippy, and tsc all green</name>
  <files></files>
  <action>
    Run all verification commands in sequence. If any fail, read the error output, apply targeted fixes to the files in Task 1 or Task 2, and re-run until all pass. Do not widen scope beyond the 7 bugs.

    Commands to run:
    1. `cd /Users/majesnix/gits/proto-sender/src-tauri && cargo test 2>&1`
    2. `cd /Users/majesnix/gits/proto-sender/src-tauri && cargo clippy -- -D warnings 2>&1`
    3. `cd /Users/majesnix/gits/proto-sender && pnpm test --run 2>&1`
    4. `cd /Users/majesnix/gits/proto-sender && pnpm build 2>&1`

    For cargo test: confirm the new timestamp tests exist and pass, and existing 27 tests still pass.
    For pnpm test: confirm baseline 629 tests pass plus any new tests added.
  </action>
  <verify>
    <automated>cd /Users/majesnix/gits/proto-sender/src-tauri && cargo test 2>&1 | grep -E "^test result" && cd /Users/majesnix/gits/proto-sender && pnpm test --run 2>&1 | grep -E "(Tests|passed|failed)" | tail -5</automated>
  </verify>
  <done>
    cargo test: "test result: ok" with 0 failed; pnpm test: all tests passed with 0 failures; cargo clippy: no warnings; pnpm build: exits 0.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| form values → encode_message | User-controlled form values cross IPC into Rust encoder |
| history entry → replay | Stored field values from history re-enter the form and IPC |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-vmn-01 | Tampering | encode.rs parse_datetime_to_epoch | mitigate | ASCII-only validation + .get() bounds checks prevent panic on malformed/multi-byte input |
| T-vmn-02 | Denial of Service | subscribe.rs wedged slot | mitigate | Clear slot on all exit paths prevents permanent "Already running" lockout |
| T-vmn-03 | Information Disclosure | PublishBar stale bytes | mitigate | Re-encode from latestValues ensures published bytes match user intent; history accurately records what was sent |
| T-vmn-SC | Tampering | npm/pip/cargo installs | accept | No new dependencies introduced in this plan; existing audit covers all packages |
</threat_model>

<verification>
All 7 bugs fixed, verified by:
1. `cargo test` — 27+ tests pass including new timestamp unit tests
2. `cargo clippy -- -D warnings` — zero warnings
3. `pnpm test --run` — 629+ tests pass
4. `pnpm build` — tsc exits 0

Behavioral checks:
- parse_datetime_to_epoch("2025-06-10T00:00:00Z") == 1749513600
- parse_datetime_to_epoch with multi-byte input does not panic
- start_subscribe after consumer self-termination does not return "Already running"
- reloadProto with 2 open files applies both schemas to their respective files
- History replay with non-first tab selects correct message type
- Type-switch with dirty form does not contaminate new type's draft
- Randomize with dirty fields preserves dirty field values
- Send immediately after typing uses freshly encoded bytes
</verification>

<success_criteria>
- All 7 bugs resolved per bug description — no scope beyond these 7
- cargo test: ok, 0 failed (new timestamp tests passing)
- cargo clippy -- -D warnings: clean
- pnpm test --run: all passing
- pnpm build: exits 0
- Commit: `fix: resolve 7 high-severity correctness bugs (timestamp epoch, subscribe slot leak, reload_proto schema alignment, history replay type, draft contamination, randomizer merge, stale-bytes send)`
</success_criteria>

<output>
Create `.planning/quick/260610-vmn-fix-7-high-severity-correctness-bugs-fro/260610-vmn-SUMMARY.md` when done
</output>
