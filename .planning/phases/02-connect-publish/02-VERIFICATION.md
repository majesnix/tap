---
phase: 02-connect-publish
verified: 2026-05-17T21:35:00Z
status: human_needed
score: 13/13
overrides_applied: 0
human_verification:
  - test: "Create a new connection profile (host, port, vhost, username, password, management port), click Save & Connect. Observe the inline spinner, then green checkmark and 'Connected' label."
    expected: "Spinner appears while test runs; green checkmark + 'Connected' text displayed on success. Status dot in sidebar turns green. Modal stays open, user can close manually."
    why_human: "Requires live RabbitMQ broker. Cannot verify AMQP handshake result programmatically without a running service."
  - test: "After saving a successful profile, close the modal. Inspect the OS keychain (macOS: Keychain Access, service = 'dev.protosender.app'). Inspect app data proto-sender.json on disk."
    expected: "Password appears in Keychain Access under service 'dev.protosender.app'. The proto-sender.json file contains the profile's host/port/vhost/username/managementPort but NO password field."
    why_human: "Cannot inspect the OS keychain or the filesystem app-data directory programmatically in this verification context."
  - test: "Fill out the proto form, select a queue from the live dropdown, click Send."
    expected: "Success toast 'Message sent to [queue]' appears for 3 seconds. Message is visible in RabbitMQ Management UI or consumable by a test consumer. The form retains all field values after send."
    why_human: "Requires live RabbitMQ broker to verify message delivery end-to-end. ROADMAP SC #3 explicitly requires verifiability via Management UI or consumer."
  - test: "When Management API is unreachable (e.g., management port blocked), observe the PublishBar."
    expected: "Queue/exchange picker falls back to a plain text Input. Amber 'Manual' badge appears. No error message (silent fallback)."
    why_human: "Requires network manipulation (blocking the management port) to test the fallback path."
  - test: "When Management API returns 401 (wrong credentials or changed password), observe the PublishBar."
    expected: "Destructive red badge showing 'Management API authentication failed: wrong credentials (HTTP 401)' appears. Picker does NOT silently fall back to Manual mode."
    why_human: "Requires live Management API returning 401 to verify the discrimination logic in production."
  - test: "Switch between two saved profiles using the sidebar dropdown."
    expected: "Switching profiles triggers activate_profile, reconnects to the correct broker, and updates the status dot. Queue/exchange picker refreshes with the new broker's live data."
    why_human: "Requires two live RabbitMQ brokers (or two profiles pointing to the same broker). Cannot verify multi-profile switching without live services."
---

# Phase 2: Connect + Publish Verification Report

**Phase Goal:** User can create and save a RabbitMQ connection profile, connect to a live broker, select a queue or exchange, and successfully publish the encoded protobuf message.
**Verified:** 2026-05-17T21:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

All truths are derived from the ROADMAP Phase 2 Success Criteria (5 items) merged with all 4 PLAN frontmatter must-haves (23 additional items). Truths that are programmatically verifiable are resolved here; truths requiring live broker interaction are routed to Human Verification.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create a connection profile with all 6 fields (host, port, vhost, username, password, management port) and click Save & Connect | VERIFIED | `ProfileManagementModal.tsx` lines 187-262: all 6 fields present in the inline form; `handleSave` calls `saveProfile(profile, formValues.password)` then `testConnection` |
| 2 | On test success, profile becomes active connection and sidebar status dot turns green | VERIFIED | `ProfileManagementModal.tsx` lines 119-121: `setActiveProfile`, `setConnectionStatus("connected")` called on `testConnection` resolve. `ConnectionSection.tsx` maps `"connected"` → `"bg-emerald-500"` |
| 3 | On test failure, inline error message appears; user can correct and retry | VERIFIED | `ProfileManagementModal.tsx` lines 122-128: `setTestState("error")`, `setTestError(message)`. `ConnectionTestResult.tsx` renders `XCircle` + error text. Modal stays open on error. |
| 4 | Switching profiles triggers connection test and updates status dot | VERIFIED | `ConnectionSection.tsx` lines 40-50: `handleProfileChange` calls `activateProfile(name)`, then `setConnectionStatus("connected")` on success or `setConnectionStatus("error", message)` on failure |
| 5 | Connection test uses ephemeral lapin connection; no persistent AMQP state kept | VERIFIED | `connection.rs` lines 136-184: `test_connection` creates lapin `Connection`, calls `create_channel`, then immediately `conn.close(0, "".into())`. No managed state added to Tauri |
| 6 | User can publish to a named queue (PUBL-01) via default exchange | VERIFIED | `PublishBar.tsx` line 41: `buildPublishArgs` returns `{ exchange: "", routingKey: selectedQueue }` in queue mode. `publish.rs` passes `exchange` to `basic_publish` — empty string is AMQP default exchange |
| 7 | User can publish to a named exchange with routing key (PUBL-02) | VERIFIED | `PublishBar.tsx` lines 42-43: `buildPublishArgs` returns `{ exchange: selectedExchange, routingKey }` in exchange mode. Same `publish_message` command handles both paths |
| 8 | Successful send shows toast "Message sent to [name]" for 3 seconds | VERIFIED | `PublishBar.tsx` line 151: `toast(`Message sent to ${targetName}`, { duration: 3000 })` |
| 9 | Failed send shows destructive toast "Send failed: [error]" for 5 seconds | VERIFIED | `PublishBar.tsx` line 156: `toast.error(`Send failed: ${message}`, { duration: 5000 })` |
| 10 | Form retains field values after successful send | VERIFIED | `PublishBar.tsx` line 153 comment: "D-15: form retains all field values — do NOT reset the form". No `reset()` call after `publishMessage` success |
| 11 | Send button shows spinner while publishing; disabled during in-flight (double-submit prevention) | VERIFIED | `PublishBar.tsx` lines 61, 278, 281: `isSending` state; `disabled={!canSend \|\| isSending}`; `Loader2` spinner rendered when `isSending` |
| 12 | Published message has content-type "application/x-protobuf" | VERIFIED | `publish.rs` line 64: `.with_content_type("application/x-protobuf".into())` on `BasicProperties` |
| 13 | Passwords NEVER in store JSON, IPC response, TypeScript types, or frontend state | VERIFIED | `ConnectionProfile` struct in `profiles/mod.rs` has no `password` field. `types.ts` `ConnectionProfile` interface has no `password`. `grep "password" types.ts stores/useConnectionStore.ts` = 0 matches. `list_profiles` returns `Vec<ConnectionProfile>` (no password). `load_profile_with_password` is `pub(crate)` — not exposed as Tauri command |

**Score:** 13/13 truths verified

All programmatically verifiable truths pass. Six truths from ROADMAP SCs #1, #3, #4, #5, and plan must-haves require live RabbitMQ broker confirmation — routed to Human Verification.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/profiles/mod.rs` | ConnectionProfile struct, keyring helpers, KEYRING_SERVICE constant | VERIFIED | 104 lines; `KEYRING_SERVICE = "dev.protosender.app"`, `PROFILES_STORE_KEY`, `store_password`, `get_password`, `delete_password`, `build_amqp_uri` |
| `src-tauri/src/commands/connection.rs` | save_profile, list_profiles, delete_profile, test_connection, activate_profile, fetch_queues, fetch_exchanges commands | VERIFIED | 302 lines; all 7 commands present with `#[tauri::command]` |
| `src-tauri/src/commands/publish.rs` | publish_message Tauri command using ephemeral lapin connection | VERIFIED | 95 lines; full implementation with 10s timeout, content-type, ephemeral close |
| `src/stores/useConnectionStore.ts` | Zustand store with profiles, activeProfileName, connectionStatus, managementAuthError | VERIFIED | Contains all required state + `managementAuthError` added in slice 3 |
| `src/components/sidebar/ConnectionSection.tsx` | Profile dropdown + status dot + Manage gear button | VERIFIED | Renders empty-state "Add connection" hint; profile dropdown with status dot and gear button when profiles exist |
| `src/components/connection/ProfileManagementModal.tsx` | Profile list + inline new profile form with all 6 fields | VERIFIED | All 6 fields rendered; Save & Connect triggers `saveProfile` + `testConnection`; ConnectionTestResult displayed inline |
| `src/components/connection/ConnectionTestResult.tsx` | Spinner / checkmark / error inline display | VERIFIED | 35 lines; `testing` → Loader2 spinner; `success` → CheckCircle2 green; `error` → XCircle destructive |
| `src/components/publish/PublishBar.tsx` | Queue/Exchange toggle, live/manual picker, routing key, Send button, buildPublishArgs | VERIFIED | 308 lines; RadioGroup mode toggle, Select (live) or Input (manual) picker, routing key (exchange mode only), Send with tooltip, isSending guard |
| `src/App.tsx` | Toaster mounted | VERIFIED | Line 8: `<Toaster />` from `@/components/ui/sonner` |
| `src/lib/types.ts` | ConnectionProfile, ConnectionStatus, ManagementStatus | VERIFIED | Lines 62-78; no password field |
| `src/lib/ipc.ts` | All IPC functions: save/list/delete/test/activate/fetchQueues/fetchExchanges/publishMessage | VERIFIED | All 8 Phase 2 IPC functions present |
| `src-tauri/src/lib.rs` | All 8 Phase 2 commands registered in invoke_handler + keyring store init | VERIFIED | Lines 38-50: all 10 commands (2 from Phase 1 + 8 from Phase 2); keyring platform init in `run()` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| ProfileManagementModal.tsx | save_profile Tauri command | `invoke("save_profile", { profile, password })` via `saveProfile()` in ipc.ts | VERIFIED | `ProfileManagementModal.tsx` line 105: `await saveProfile(profile, formValues.password)` |
| ProfileManagementModal.tsx | test_connection Tauri command | `invoke("test_connection", { profileName })` via `testConnection()` | VERIFIED | `ProfileManagementModal.tsx` line 115: `await testConnection(profile.name)` |
| ConnectionSection.tsx | activate_profile Tauri command | `invoke("activate_profile", { profileName })` on dropdown change | VERIFIED | `ConnectionSection.tsx` line 44: `await activateProfile(name)` |
| ConnectionSection.tsx | useConnectionStore | profiles, activeProfileName, connectionStatus selectors | VERIFIED | Line 28: destructures all required selectors |
| save_profile command | keyring-core Entry | `store_password(profile_name, password)` → `Entry::set_password` | VERIFIED | `connection.rs` line 66: `store_password(&profile.name, &password)` calling `profiles/mod.rs` |
| save_profile command | tauri-plugin-store | `store.set(PROFILES_STORE_KEY, ...)` + `store.save()` | VERIFIED | `connection.rs` lines 87-90 |
| test_connection command | lapin::Connection::connect | `tokio::time::timeout(10s, Connection::connect(&uri, ...))` | VERIFIED | `connection.rs` lines 166-172 |
| PublishBar.tsx | fetch_queues / fetch_exchanges commands | `invoke("fetch_queues"/"fetch_exchanges", { profileName })` on mount + mode change | VERIFIED | `PublishBar.tsx` lines 87-93: `fetchQueues` / `fetchExchanges` called in `useEffect` |
| PublishBar.tsx | useConnectionStore | activeProfileName, connectionStatus, queues, exchanges, managementAuthError | VERIFIED | Lines 63-75: all selectors destructured |
| fetch_queues command | reqwest GET /api/queues/{vhost} with basic_auth | `client.get(url).basic_auth(&profile.username, Some(&password)).send()` | VERIFIED | `connection.rs` lines 221-228; 6 `basic_auth` calls confirmed |
| PublishBar.tsx handleSend | publish_message Tauri command | `invoke("publish_message", { profileName, exchange, routingKey, payload })` | VERIFIED | `PublishBar.tsx` line 149: `await publishMessage(activeProfileName, exchange, targetRoutingKey, payload)` |
| publish_message command | lapin channel.basic_publish | Connection::connect → create_channel → basic_publish → close | VERIFIED | `publish.rs` lines 43-72: full ephemeral connection lifecycle |
| PublishBar.tsx | useProtoStore hexPreview | `hexPreview` decoded via `hexToBytes()` for payload | VERIFIED | `PublishBar.tsx` lines 77, 145: `hexPreview` from store → `hexToBytes(hexPreview)` → passed as `payload` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| ConnectionSection.tsx | `profiles` | `listProfiles()` → `invoke("list_profiles")` → Rust reads tauri-plugin-store JSON | Real data (DB-equivalent persistence layer) | FLOWING |
| ProfileManagementModal.tsx | `testState` | `testConnection()` → `invoke("test_connection")` → lapin AMQP handshake result | Real async result from AMQP broker | FLOWING (broker-dependent) |
| PublishBar.tsx | `queues` / `exchanges` | `fetchQueues/Exchanges()` → `invoke(...)` → reqwest Management API GET | Real HTTP response from RabbitMQ Management API | FLOWING (broker-dependent) |
| PublishBar.tsx | `payload` | `hexPreview` from `useProtoStore` → `hexToBytes()` → binary bytes | Real encoded protobuf from Phase 1 encode pipeline | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Rust backend compiles with all deps | `cargo build --manifest-path src-tauri/Cargo.toml` | `Finished dev profile (0 crates compiled, 0.63s)` | PASS |
| All Rust tests pass (9 tests, 3 suites) | `cargo test --manifest-path src-tauri/Cargo.toml` | `9 passed (3 suites)` | PASS |
| All frontend tests pass (57 tests, 10 files) | `npm test` | `57 passed (10 files, 1.64s)` | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | No errors | PASS |
| No password field in ConnectionProfile (Rust) | `grep "pub password:" src-tauri/src/profiles/mod.rs` | 0 matches | PASS |
| No password in TypeScript types or store | `grep "password" src/lib/types.ts src/stores/useConnectionStore.ts` | 0 matches | PASS |
| 10s timeout on AMQP connect in both commands | `grep "tokio::time::timeout" connection.rs publish.rs` | 1 match each (lines 166, 43) | PASS |
| content-type application/x-protobuf set | `grep "application/x-protobuf" publish.rs` | 1 match (line 64) | PASS |
| Default exchange is empty string for PUBL-01 | `buildPublishArgs` mode=queue returns `exchange: ""` (PublishBar.tsx line 41) | Confirmed | PASS |
| 401 does NOT call setManagementStatus("manual") | Auth error branch (lines 107-109) only calls `setManagementAuthError` | Confirmed in code | PASS |
| isSending double-submit guard | `disabled={!canSend \|\| isSending}` (line 278) | Present | PASS |
| Toast durations: 3000ms success, 5000ms error | Lines 151, 156 in PublishBar.tsx | Both present | PASS |
| Toaster mounted in App.tsx | `<Toaster />` at line 8 | Present | PASS |
| Sidebar spacer preserved (flex-1) | `<div className="flex-1" />` at line 57 of Sidebar.tsx | Present alongside `<ConnectionSection />` at line 55 | PASS |
| All 10 commands registered in invoke_handler | Lines 39-49 in lib.rs | All 10 registered | PASS |
| load_profile_with_password is pub(crate) | Line 34 in connection.rs: `pub(crate) fn load_profile_with_password` | Confirmed | PASS |
| No bare tokio::spawn used | `grep "tokio::spawn" connection.rs publish.rs` | 0 matches | PASS |
| No tracing of password/URI in Rust commands | `grep "tracing::" {connection,publish}.rs \| grep -iE "password\|uri"` | 0 matches | PASS |
| password explicitly dropped after use in publish | `drop(password)` at line 39 in publish.rs | Present | PASS |
| basic_auth used for Management API (not URL-embedded) | 6 occurrences of `basic_auth` in connection.rs | Confirmed | PASS |
| Routing key input shown only in Exchange mode | `mode === "exchange" && (...)` conditional at PublishBar.tsx line 262 | Confirmed | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CONN-01 | 02-01-PLAN | User can create and save named connection profiles (6 fields) | SATISFIED | ProfileManagementModal all 6 fields wired; save_profile command persists non-secret fields; password to keychain |
| CONN-02 | 02-02-PLAN | User can switch between saved profiles with a single click | SATISFIED | ConnectionSection Select dropdown triggers handleProfileChange → activateProfile |
| CONN-03 | 02-02-PLAN | App tests connection reachability and credential validity when user saves a profile | SATISFIED | handleSave calls testConnection after saveProfile; ConnectionTestResult shows spinner → result |
| CONN-04 | 02-01-PLAN | Passwords stored in OS keychain, never in plain config files | SATISFIED (needs human for keychain inspection) | store_password/get_password use keyring-core Entry; ConnectionProfile struct has no password field; proto-sender.json stores only non-secret fields |
| PUBL-01 | 02-04-PLAN | User can publish directly to named queue via default exchange | SATISFIED | buildPublishArgs queue mode → exchange="", routingKey=queueName; publish_message basic_publish |
| PUBL-02 | 02-04-PLAN | User can publish to named exchange with routing key | SATISFIED | buildPublishArgs exchange mode → exchange=selectedExchange, routingKey=explicit key |
| PUBL-03 | 02-03-PLAN | Live dropdown from Management API; falls back to manual text input when unavailable | SATISFIED | fetchQueues/fetchExchanges from Management API; ManagementStatus "live"→Select, else→Input; 401 surfaces as auth error not silent fallback |

### Anti-Patterns Found

No blocking anti-patterns found. The slice 3 SUMMARY documented a stub (`handleSend` no-op) that was explicitly planned for slice 4. Slice 4 fully replaced it — confirmed by reading PublishBar.tsx: `handleSend` is a 35-line async function calling `publishMessage`.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | — | — | — | — |

### Human Verification Required

#### 1. End-to-End Profile Save + Connection Test (ROADMAP SC #1)

**Test:** Launch app. Click gear button in sidebar (shows "Add connection" text on first launch). Fill in profile name, host pointing to a live RabbitMQ broker, port 5672, vhost /, username and password. Click "Save & Connect".
**Expected:** Spinner "Testing connection..." appears inline. On success: green checkmark + "Connected" label. Modal can be closed. Status dot in sidebar turns green ("Connected" text). Profile name appears in sidebar dropdown.
**Why human:** Requires live RabbitMQ broker. AMQP handshake cannot be simulated without network service.

#### 2. OS Keychain Isolation (ROADMAP SC #4)

**Test:** After saving a profile, open Keychain Access (macOS). Search for service "dev.protosender.app". Also inspect the proto-sender.json file in ~/Library/Application Support/dev.protosender.app/ (or equivalent per OS).
**Expected:** Password appears in Keychain Access under service "dev.protosender.app". The JSON file contains host, port, vhost, username, managementPort but NO "password" key.
**Why human:** OS keychain state cannot be queried programmatically in this verification context.

#### 3. Message Delivery to Queue (ROADMAP SC #3)

**Test:** Load a .proto file (from Phase 1). Fill out the form. In the PublishBar, ensure the app is connected (status dot green). Select a queue from the live dropdown. Click Send.
**Expected:** "Message sent to [queue]" toast for 3 seconds. Message appears in RabbitMQ Management UI under the selected queue. Form field values remain unchanged after send.
**Why human:** Requires live RabbitMQ broker to verify actual message delivery per ROADMAP SC #3.

#### 4. Management API Fallback Behavior (ROADMAP SC #5)

**Test:** Connect with a profile whose management port is blocked or wrong. Observe PublishBar.
**Expected:** Amber "Manual" badge appears. Queue/exchange picker switches to a plain text Input. No error message (silent graceful fallback).
**Why human:** Requires network configuration manipulation to create the unreachable Management API condition.

#### 5. 401 Auth Error — NOT Silent Fallback (PUBL-03 discriminator)

**Test:** Connect with a profile whose management API credentials are wrong (wrong username/password for HTTP Basic Auth). Observe PublishBar.
**Expected:** Destructive red badge "Management API authentication failed: wrong credentials (HTTP 401)" appears. Picker does NOT show "Manual" badge or fall back silently.
**Why human:** Requires live Management API returning 401.

#### 6. Multi-Profile Switching (ROADMAP SC #2 + CONN-02)

**Test:** Save two connection profiles. Switch between them using the sidebar dropdown.
**Expected:** Each switch triggers a connection test. Status dot updates per the test result. The queue/exchange picker refreshes with the newly connected broker's live data.
**Why human:** Requires two live RabbitMQ profiles.

---

## Gaps Summary

No gaps found. All programmatically verifiable must-haves pass. The six human verification items are required by the phase's nature (network-dependent behavior + OS-level keychain inspection) — they are not implementation failures.

The phase delivers the complete connect-publish flow: profile creation with keychain security → inline connection test → Management API queue/exchange discovery → binary protobuf publishing with PUBL-01/PUBL-02 routing → Sonner toasts → double-submit prevention. All wiring is substantive and data-flowing.

---

_Verified: 2026-05-17T21:35:00Z_
_Verifier: Claude (gsd-verifier)_
