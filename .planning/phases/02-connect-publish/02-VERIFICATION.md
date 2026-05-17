---
phase: 02-connect-publish
verified: 2026-05-18T00:10:00Z
status: human_needed
score: 24/24
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 19/19
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  note: "Supersedes 2026-05-17T23:35:00Z report. GAP2 plan (02-GAP2-PLAN) executed after prior report; 5 scroll-layout truths added. Test count moved from 72 to 74."
human_verification:
  - test: "Create a new connection profile (host, port, vhost, username, password, management port), click Save & Connect. Observe the inline spinner, then green checkmark and 'Connected' label."
    expected: "Spinner appears while test runs; green checkmark + 'Connected' text displayed on success. Status dot in sidebar turns green. Modal stays open, user can close manually."
    why_human: "Requires live RabbitMQ broker. Cannot verify AMQP handshake result programmatically without a running service."
  - test: "After saving a successful profile, close the modal. Inspect the OS keychain (macOS: Keychain Access, service = 'dev.protosender.app'). Inspect app data proto-sender.json on disk."
    expected: "Password appears in Keychain Access under service 'dev.protosender.app'. The proto-sender.json file contains the profile's host/port/vhost/username/managementPort but NO password field."
    why_human: "Cannot inspect the OS keychain or the filesystem app-data directory programmatically in this verification context."
  - test: "Fill out the proto form, select a queue from the live dropdown, click Send."
    expected: "Success toast 'Message sent to [queue]' appears for 3 seconds. Message is visible in RabbitMQ Management UI or consumable by a test consumer. The form retains all field values after send."
    why_human: "Requires live RabbitMQ broker to verify message delivery end-to-end."
  - test: "When Management API is unreachable (e.g., management port blocked), observe the PublishBar."
    expected: "Queue/exchange picker falls back to a plain text Input. Amber 'Manual' badge appears. No error message (silent fallback)."
    why_human: "Requires network manipulation (blocking the management port) to test the fallback path."
  - test: "When Management API returns 401 (wrong credentials or changed password), observe the PublishBar."
    expected: "Destructive red badge showing 'Management API authentication failed: wrong credentials (HTTP 401)' appears. Picker does NOT silently fall back to Manual mode."
    why_human: "Requires live Management API returning 401 to verify the discrimination logic in production."
  - test: "Switch between two saved profiles using the sidebar dropdown."
    expected: "Switching profiles triggers activate_profile, reconnects to the correct broker, and updates the status dot. Queue/exchange picker refreshes with the new broker's live data."
    why_human: "Requires two live RabbitMQ brokers (or two profiles). Cannot verify multi-profile switching without live services."
---

# Phase 2: Connect + Publish Verification Report

**Phase Goal:** Users can connect to RabbitMQ using saved profiles and publish binary-encoded protobuf messages — the full end-to-end path (connect -> select queue/exchange -> send message) works and gives clear feedback at each step.
**Verified:** 2026-05-18T00:10:00Z
**Status:** human_needed
**Re-verification:** Yes — supersedes 2026-05-17T23:35:00Z report (GAP2 plan executed after prior report; 5 scroll-layout truths added; score updated from 19/19 to 24/24; test count moved from 72 to 74)

## Goal Achievement

### Observable Truths

Truths 1-13 from plans 02-01 through 02-04. Truths 14-19 from 02-GAP-PLAN. Truths 20-24 from 02-GAP2-PLAN. All 24 truths verified against current codebase.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can create a connection profile with all 6 fields (host, port, vhost, username, password, management port) and click Save & Connect | VERIFIED | `ProfileManagementModal.tsx` lines 280-345: all 6 fields present; `handleSave` calls `saveProfile(profile, formValues.password)` then `testConnection` |
| 2 | On test success, profile becomes active connection and sidebar status dot turns green | VERIFIED | `ProfileManagementModal.tsx` lines 196-200: `setActiveProfile`, `setConnectionStatus("connected")` called on resolve. `ConnectionSection.tsx` maps "connected" to bg-emerald-500 |
| 3 | On test failure, inline error message appears; user can correct and retry | VERIFIED | `ProfileManagementModal.tsx` lines 201-206: `setTestState("error")`, `setTestError(message)`. `ConnectionTestResult.tsx` renders XCircle + error text. Modal stays open on error (no onClose call) |
| 4 | Switching profiles triggers connection test and updates status dot | VERIFIED | `ConnectionSection.tsx` lines 44-53: `handleProfileChange` calls `activateProfile(name)`, then `setConnectionStatus("connected")` on success or `setConnectionStatus("error", message)` on failure |
| 5 | Connection test uses ephemeral lapin connection; no persistent AMQP state kept | VERIFIED | `connection.rs` lines 170-187: `test_connection` creates lapin Connection, calls `create_channel`, then immediately `conn.close(0, "".into())`. No managed state added to Tauri |
| 6 | User can publish to a named queue (PUBL-01) via default exchange | VERIFIED | `PublishBar.tsx` line 41: `buildPublishArgs` returns `{ exchange: "", routingKey: selectedQueue }` in queue mode. `publish.rs` passes exchange (empty string) to `basic_publish` |
| 7 | User can publish to a named exchange with routing key (PUBL-02) | VERIFIED | `PublishBar.tsx` lines 42-43: `buildPublishArgs` returns `{ exchange: selectedExchange, routingKey }` in exchange mode. Same `publish_message` command handles both paths |
| 8 | Successful send shows toast "Message sent to [name]" for 3 seconds | VERIFIED | `PublishBar.tsx` line 152: `toast(\`Message sent to ${targetName}\`, { duration: 3000 })` |
| 9 | Failed send shows destructive toast "Send failed: [error]" for 5 seconds | VERIFIED | `PublishBar.tsx` line 157: `toast.error(\`Send failed: ${message}\`, { duration: 5000 })` |
| 10 | Form retains field values after successful send | VERIFIED | `PublishBar.tsx` line 153 comment: "D-15: form retains all field values — do NOT reset the form". No `reset()` call after publishMessage success |
| 11 | Send button shows spinner while publishing; disabled during in-flight (double-submit prevention) | VERIFIED | `PublishBar.tsx` lines 62, 279, 282: `isSending` state; `disabled={!canSend \|\| isSending}`; Loader2 spinner rendered when `isSending` |
| 12 | Published message has content-type "application/x-protobuf" | VERIFIED | `publish.rs` line 64: `.with_content_type("application/x-protobuf".into())` on BasicProperties |
| 13 | Passwords NEVER in store JSON, IPC response, TypeScript types, or frontend state | VERIFIED | `ConnectionProfile` struct in `profiles/mod.rs` has no password field. `types.ts` ConnectionProfile interface has no password field. `list_profiles` returns `Vec<ConnectionProfile>`. `load_profile_with_password` is `pub(crate)` — not a Tauri command |
| 14 | A "Test Connection" button is visible in the new-profile form, independently of the "Save & Connect" button | VERIFIED | `ProfileManagementModal.tsx` lines 367-375: "Test Connection" button renders only when `formMode === "create"`, positioned between Cancel and "Save & Connect" buttons |
| 15 | Clicking "Test Connection" saves the profile and runs the connection test without activating the profile or closing the modal | VERIFIED | `ProfileManagementModal.tsx` lines 101-150 (handleTestOnly): calls `saveProfile` then `testConnection`. Does NOT call `setActiveProfile`, `setConnectionStatus`, or `onClose`. Modal remains open on both success and failure |
| 16 | The ConnectionTestResult component appears inline after clicking "Test Connection" | VERIFIED | `ProfileManagementModal.tsx` line 361: `<ConnectionTestResult state={testState} errorMessage={testError} />` rendered in form; `handleTestOnly` sets `testState` to "testing" then "success"/"error" |
| 17 | A Re-test button is visible in ConnectionSection when a profile is selected | VERIFIED | `ConnectionSection.tsx` lines 119-129: "Re-test" button renders in the non-empty profiles branch, disabled when `testState === "testing"` or `!activeProfileName` |
| 18 | Re-test button calls testConnection and shows the result inline without changing the selected profile | VERIFIED | `ConnectionSection.tsx` lines 56-70 (handleRetest): calls `testConnection(activeProfileName)`, sets `testState` + `testError`, updates `connectionStatus`. Does NOT change `activeProfileName` |
| 19 | An existing saved profile can be opened for editing with all fields pre-populated, name field read-only, and blank password blocks save | VERIFIED | `ProfileManagementModal.tsx` lines 73-88 (handleShowEditForm): all fields pre-populated using snake_case fields. Line 287: `readOnly={formMode === "edit"}`. Lines 175-180: blank-password guard shows error "Password is required to save changes..." |
| 20 | The modal dialog itself never exceeds 85% of viewport height (max-h-[85vh]) | VERIFIED | `ProfileManagementModal.tsx` line 227: `DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden"` |
| 21 | When many profiles are listed, the content area scrolls vertically instead of overflowing off-screen | VERIFIED | `ProfileManagementModal.tsx` line 232: `<div className="flex-1 min-h-0 overflow-y-auto" data-testid="profile-modal-scroll">` — overflow-y-auto enables scroll within the bounded flex container |
| 22 | The DialogHeader (title) is always visible at the top — it does not scroll away | VERIFIED | `ProfileManagementModal.tsx` lines 228-230: DialogHeader rendered BEFORE the scroll div at line 232. Header is a flex sibling above the scrollable area, not inside it |
| 23 | The scrollable content area has overflow-y-auto and min-h-0 so it actually scrolls under flexbox | VERIFIED | `ProfileManagementModal.tsx` line 232: `className="flex-1 min-h-0 overflow-y-auto"` — min-h-0 overrides flexbox's default min-height:auto which would otherwise prevent overflow from triggering |
| 24 | The inline create/edit form also scrolls inside the same container if it is taller than the available space | VERIFIED | The create/edit form is conditionally rendered inside the scroll div (line 232's container). No separate scroll wrapper isolates the form — it shares the parent's overflow-y-auto context |

**Score:** 24/24 truths verified

All programmatically verifiable truths pass. Six truths from ROADMAP SCs and plan must-haves require live RabbitMQ broker confirmation — routed to Human Verification.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/profiles/mod.rs` | ConnectionProfile struct, keyring helpers, KEYRING_SERVICE constant | VERIFIED | 111 lines; `KEYRING_SERVICE = "dev.protosender.app"`, `PROFILES_STORE_KEY`, `store_password`, `get_password`, `delete_password`, `build_amqp_uri` |
| `src-tauri/src/commands/connection.rs` | save_profile, list_profiles, delete_profile, test_connection, activate_profile, fetch_queues, fetch_exchanges commands | VERIFIED | 307 lines; all 7 commands with `#[tauri::command]`; `load_profile_with_password` is `pub(crate)` |
| `src-tauri/src/commands/publish.rs` | publish_message Tauri command using ephemeral lapin connection | VERIFIED | 94 lines; full implementation with 10s timeout, content-type, ephemeral close |
| `src/stores/useConnectionStore.ts` | Zustand store with profiles, activeProfileName, connectionStatus, managementAuthError | VERIFIED | All required state + `managementAuthError` + `setManagementAuthError` action present |
| `src/components/sidebar/ConnectionSection.tsx` | Profile dropdown + status dot + Manage gear button + Re-test button | VERIFIED | Empty-state "Add connection" hint; profile dropdown with status dot, gear button, Re-test button, ConnectionTestResult inline |
| `src/components/connection/ProfileManagementModal.tsx` | Profile list + inline create/edit form + Test Connection button + Edit button per row + scroll layout (GAP2) | VERIFIED | 407 lines; all 6 fields; handleSave, handleTestOnly, handleShowEditForm, edit mode, blank-password guard; max-h-[85vh] DialogContent; overflow-y-auto scroll container; DialogHeader outside scroll div |
| `src/components/connection/ConnectionTestResult.tsx` | Spinner / checkmark / error inline display | VERIFIED | 35 lines; testing -> Loader2 spinner; success -> CheckCircle2 green; error -> XCircle destructive |
| `src/components/publish/PublishBar.tsx` | Queue/Exchange toggle, live/manual picker, routing key, Send button, buildPublishArgs | VERIFIED | 308 lines; RadioGroup mode toggle, Select (live) or Input (manual), routing key (exchange mode only), Send with tooltip, isSending guard |
| `src/components/connection/__tests__/ProfileManagementModal.test.tsx` | Tests for handleTestOnly, edit mode, scroll layout (GAP2) | VERIFIED | 14 tests; handleTestOnly suite, edit mode suite, scroll layout tests (2 new GAP2 tests) |
| `src/App.tsx` | Toaster mounted | VERIFIED | `<Toaster />` from `@/components/ui/sonner` present |
| `src/lib/types.ts` | ConnectionProfile, ConnectionStatus, ManagementStatus — no password field | VERIFIED | Lines 62-78; no password field |
| `src/lib/ipc.ts` | All IPC functions: save/list/delete/test/activate/fetchQueues/fetchExchanges/publishMessage | VERIFIED | All 8 Phase 2 IPC functions present; 62 lines |
| `src-tauri/src/lib.rs` | All 10 commands registered in invoke_handler + keyring store init | VERIFIED | Lines 38-49: all 10 commands registered; platform keyring init before Builder |
| `src-tauri/src/error.rs` | All error variants including ManagementApiAuthFailed with exact display message | VERIFIED | 35 lines; `ManagementApiAuthFailed` display: "Management API authentication failed: wrong credentials (HTTP 401)" |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| ProfileManagementModal.tsx handleSave | save_profile Tauri command | `invoke("save_profile", { profile, password })` via saveProfile() in ipc.ts | VERIFIED | `ProfileManagementModal.tsx` line 184: `await saveProfile(profile, formValues.password)` |
| ProfileManagementModal.tsx handleSave | test_connection Tauri command | `invoke("test_connection", { profileName })` via testConnection() | VERIFIED | `ProfileManagementModal.tsx` line 194: `await testConnection(profile.name)` |
| ProfileManagementModal.tsx handleTestOnly | save_profile then testConnection without setActiveProfile/onClose | saveProfile then testConnection | VERIFIED | Lines 126, 139: `await saveProfile(...)` then `await testConnection(...)` — no setActiveProfile, no onClose |
| ConnectionSection.tsx handleRetest | testConnection Tauri command | `invoke("test_connection", { profileName })` | VERIFIED | `ConnectionSection.tsx` line 61: `await testConnection(activeProfileName)` |
| ConnectionSection.tsx handleProfileChange | activate_profile Tauri command | `invoke("activate_profile", { profileName })` on dropdown change | VERIFIED | `ConnectionSection.tsx` line 48: `await activateProfile(name)` |
| ConnectionSection.tsx | useConnectionStore | profiles, activeProfileName, connectionStatus selectors | VERIFIED | Line 29: destructures all required selectors + setConnectionStatus |
| save_profile command | keyring-core Entry | `store_password(profile_name, password)` -> `Entry::set_password` | VERIFIED | `connection.rs` line 66: `store_password(&profile.name, &password)` |
| save_profile command | tauri-plugin-store | `store.set(PROFILES_STORE_KEY, ...)` + `store.save()` | VERIFIED | `connection.rs` lines 87-92 |
| test_connection command | lapin::Connection::connect | `tokio::time::timeout(10s, Connection::connect(&uri, ...))` | VERIFIED | `connection.rs` lines 170-176 |
| PublishBar.tsx | fetch_queues / fetch_exchanges commands | `invoke("fetch_queues"/"fetch_exchanges", { profileName })` on mount + mode change | VERIFIED | `PublishBar.tsx` lines 87-98: fetchQueues / fetchExchanges in `useEffect([activeProfileName, mode])` |
| fetch_queues command | reqwest GET /api/queues/{vhost} with basic_auth | `client.get(url).basic_auth(&profile.username, Some(&password)).send()` | VERIFIED | `connection.rs` lines 226-232; basic_auth used (not URL-embedded credentials) |
| PublishBar.tsx handleSend | publish_message Tauri command | `invoke("publish_message", { profileName, exchange, routingKey, payload })` | VERIFIED | `PublishBar.tsx` line 150: `await publishMessage(activeProfileName, exchange, targetRoutingKey, payload)` |
| publish_message command | lapin channel.basic_publish | Connection::connect -> create_channel -> basic_publish -> close | VERIFIED | `publish.rs` lines 43-72: full ephemeral connection lifecycle |
| PublishBar.tsx | useProtoStore hexPreview | `hexPreview` decoded via `hexToBytes()` for payload | VERIFIED | `PublishBar.tsx` lines 78, 146: hexPreview from store -> hexToBytes(hexPreview) -> passed as payload |
| ProfileManagementModal.tsx DialogContent | max-h-[85vh] flex flex-col overflow-hidden | CSS classes on DialogContent (GAP2) | VERIFIED | `ProfileManagementModal.tsx` line 227: exact classes present |
| ProfileManagementModal.tsx scroll div | overflow-y-auto min-h-0 flex-1 (GAP2) | CSS classes on scroll container div | VERIFIED | Line 232: `className="flex-1 min-h-0 overflow-y-auto"` + `data-testid="profile-modal-scroll"` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| ConnectionSection.tsx | `profiles` | `listProfiles()` -> `invoke("list_profiles")` -> Rust reads tauri-plugin-store JSON | Real data (persistence layer) | FLOWING |
| ProfileManagementModal.tsx | `testState` | `testConnection()` -> `invoke("test_connection")` -> lapin AMQP handshake result | Real async result from AMQP broker | FLOWING (broker-dependent) |
| PublishBar.tsx | `queues` / `exchanges` | `fetchQueues/Exchanges()` -> `invoke(...)` -> reqwest Management API GET | Real HTTP response from RabbitMQ Management API | FLOWING (broker-dependent) |
| PublishBar.tsx | `payload` | `hexPreview` from `useProtoStore` -> `hexToBytes()` -> binary bytes | Real encoded protobuf from Phase 1 encode pipeline | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Rust backend compiles with all deps | `cargo build --manifest-path src-tauri/Cargo.toml` | Finished dev profile (0 crates compiled, 0.67s) | PASS |
| All Rust tests pass (10 tests, 3 suites) | `cargo test --manifest-path src-tauri/Cargo.toml` | 10 passed (3 suites) | PASS |
| All frontend tests pass (74 tests, 11 files) | `npm test` | 74 passed (11 files, 2.16s) | PASS |
| TypeScript compiles clean | `npx tsc --noEmit` | No errors | PASS |
| No password field in ConnectionProfile (Rust) | `grep "pub password:" src-tauri/src/profiles/mod.rs` | 0 matches | PASS |
| No password in TypeScript types or store | `grep "password" src/lib/types.ts` | 0 matches | PASS |
| 10s timeout on AMQP connect in both commands | `grep "tokio::time::timeout" connection.rs publish.rs` | 1 match each | PASS |
| content-type application/x-protobuf set | `grep "application/x-protobuf" publish.rs` | 1 match (line 64) | PASS |
| PUBL-01: default exchange is empty string | `buildPublishArgs` mode=queue returns `exchange: ""` (PublishBar.tsx line 41) | Confirmed | PASS |
| 401 does NOT call setManagementStatus("manual") | Auth error branch (lines 107-109) only calls `setManagementAuthError` | Confirmed in code | PASS |
| isSending double-submit guard | `disabled={!canSend \|\| isSending}` (line 279) | Present | PASS |
| Toast durations: 3000ms success, 5000ms error | Lines 152, 157 in PublishBar.tsx | Both present | PASS |
| Toaster mounted in App.tsx | `<Toaster />` at line 8 | Present | PASS |
| Sidebar spacer preserved (flex-1) | `<div className="flex-1" />` at line 57 of Sidebar.tsx | Present alongside ConnectionSection at line 55 | PASS |
| All 10 commands registered in invoke_handler | Lines 38-49 in lib.rs | All 10 registered | PASS |
| load_profile_with_password is pub(crate) | Line 34 in connection.rs | Confirmed | PASS |
| No bare tokio::spawn used | `grep "tokio::spawn" connection.rs publish.rs` | 0 matches | PASS |
| No tracing of password/URI in Rust commands | Tracing calls in connection.rs use only profile.name | Confirmed | PASS |
| password explicitly dropped after use in publish | `drop(password)` at line 39 in publish.rs | Present | PASS |
| basic_auth used for Management API (not URL-embedded) | `grep "basic_auth" connection.rs` | 4 matches (fetch_queues + fetch_exchanges each have .basic_auth call) | PASS |
| Routing key input shown only in Exchange mode | `mode === "exchange" && (...)` conditional at PublishBar.tsx line 263 | Confirmed | PASS |
| handleTestOnly omits setActiveProfile and onClose | `ProfileManagementModal.tsx` lines 101-150 | Neither setActiveProfile nor onClose appears in handleTestOnly | PASS |
| Edit button renders per profile row | `ProfileManagementModal.tsx` lines 242-249 | Pencil icon Button with `aria-label="Edit profile {name}"` per row | PASS |
| Name field is readOnly in edit mode | `ProfileManagementModal.tsx` line 287 | `readOnly={formMode === "edit"}` | PASS |
| Blank password guard in edit mode | `ProfileManagementModal.tsx` lines 175-180 | `formMode === "edit" && formValues.password.trim() === ""` blocks save | PASS |
| handleShowEditForm uses snake_case fields | `ProfileManagementModal.tsx` lines 81-83 | `profile.management_port`, `profile.management_ssl` (correct) | PASS |
| GAP2: max-h-[85vh] on DialogContent | `ProfileManagementModal.tsx` line 227 | `max-h-[85vh] flex flex-col overflow-hidden` present | PASS |
| GAP2: scroll container has overflow-y-auto min-h-0 | `ProfileManagementModal.tsx` line 232 | `flex-1 min-h-0 overflow-y-auto` + data-testid="profile-modal-scroll" | PASS |
| GAP2: DialogHeader is outside scroll container | `ProfileManagementModal.tsx` lines 228-230 vs line 232 | DialogHeader precedes scroll div; header is never inside overflow-y-auto | PASS |
| GAP2: scroll layout tests pass | `npm test` | 2 new ProfileManagementModal.test.tsx tests for scroll layout pass | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CONN-01 | 02-01-PLAN, 02-GAP-PLAN, 02-GAP2-PLAN | User can create and save named connection profiles (6 fields); test independently via "Test Connection" button; modal does not overflow viewport | SATISFIED | ProfileManagementModal all 6 fields wired; save_profile persists non-secret fields; password to keychain; standalone Test Connection button present; max-h-[85vh] scroll layout implemented |
| CONN-02 | 02-02-PLAN | User can switch between saved profiles with a single click | SATISFIED | ConnectionSection Select dropdown triggers handleProfileChange -> activateProfile |
| CONN-03 | 02-02-PLAN | App tests connection reachability and credential validity when user saves a profile | SATISFIED | handleSave calls testConnection after saveProfile; ConnectionTestResult shows spinner -> result; handleTestOnly provides standalone test path |
| CONN-04 | 02-01-PLAN | Passwords stored in OS keychain, never in plain config files | SATISFIED (needs human for keychain inspection) | store_password/get_password use keyring-core Entry; ConnectionProfile struct has no password field; proto-sender.json stores only non-secret fields |
| PUBL-01 | 02-04-PLAN | User can publish directly to named queue via default exchange | SATISFIED | buildPublishArgs queue mode -> exchange="", routingKey=queueName; publish_message basic_publish |
| PUBL-02 | 02-04-PLAN | User can publish to named exchange with routing key | SATISFIED | buildPublishArgs exchange mode -> exchange=selectedExchange, routingKey=explicit key |
| PUBL-03 | 02-03-PLAN | Live dropdown from Management API; falls back to manual text input when unavailable | SATISFIED | fetchQueues/fetchExchanges from Management API; ManagementStatus "live"->Select, else->Input; 401 surfaces as auth error, not silent fallback |

### Anti-Patterns Found

No blocking anti-patterns found.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/components/publish/PublishBar.tsx` | hexToBytes fn | `hexToBytes` silently drops malformed hex pairs instead of erroring | INFO | Malformed hex input (odd-length or invalid chars) produces a truncated payload; success toast still fires. Not a Phase 2 blocker — the payload is always proto-encoded output from Phase 1 (trustworthy source). Worth a future defensive error. |

### Human Verification Required

#### 1. End-to-End Profile Save + Connection Test (ROADMAP SC #1)

**Test:** Launch app. Click gear button in sidebar (shows "Add connection" on first launch). Fill in profile name, host pointing to a live RabbitMQ broker, port 5672, vhost /, username and password. Click "Save & Connect".
**Expected:** Spinner "Testing connection..." appears inline. On success: green checkmark + "Connected" label. Modal can be closed. Status dot in sidebar turns green. Profile name appears in sidebar dropdown.
**Why human:** Requires live RabbitMQ broker. AMQP handshake cannot be simulated without network service.

#### 2. Standalone "Test Connection" (GAP UAT scenario)

**Test:** Click gear -> "+ New Profile" -> fill all fields -> click "Test Connection" (button between Cancel and "Save & Connect").
**Expected:** Spinner appears inline, then green checkmark "Connected". Modal stays open. Profile IS visible in sidebar profile list. Profile is NOT yet active (status dot stays gray, no profile selected in dropdown).
**Why human:** Requires live RabbitMQ broker to verify the AMQP handshake result; and requires observing UI state split between "profile saved" vs "profile not activated."

#### 3. OS Keychain Isolation (ROADMAP SC #4)

**Test:** After saving a profile, open Keychain Access (macOS). Search for service "dev.protosender.app". Also inspect the proto-sender.json file in ~/Library/Application Support/dev.protosender.app/.
**Expected:** Password appears in Keychain Access under service "dev.protosender.app". The JSON file contains host, port, vhost, username, managementPort but NO "password" key.
**Why human:** OS keychain state cannot be queried programmatically in this verification context.

#### 4. Message Delivery to Queue (ROADMAP SC #3)

**Test:** Load a .proto file (from Phase 1). Fill out the form. Connect a profile (status dot green). Select a queue from the live dropdown. Click Send.
**Expected:** "Message sent to [queue]" toast for 3 seconds. Message appears in RabbitMQ Management UI under the selected queue. Form field values remain unchanged after send.
**Why human:** Requires live RabbitMQ broker to verify actual message delivery per ROADMAP SC #3.

#### 5. Management API Fallback Behavior (ROADMAP SC #5)

**Test:** Connect with a profile whose management port is blocked or wrong. Observe PublishBar.
**Expected:** Amber "Manual" badge appears. Queue/exchange picker switches to a plain text Input. No error message (silent graceful fallback).
**Why human:** Requires network configuration manipulation to create the unreachable Management API condition.

#### 6. 401 Auth Error — NOT Silent Fallback (PUBL-03 discriminator)

**Test:** Connect with a profile whose management API credentials are wrong. Observe PublishBar.
**Expected:** Destructive red badge "Management API authentication failed: wrong credentials (HTTP 401)" appears. Picker does NOT show "Manual" badge or fall back silently.
**Why human:** Requires live Management API returning 401.

---

## Gaps Summary

No gaps found. All 24 programmatically verifiable must-haves pass across plans 02-01 through 02-04, 02-GAP-PLAN, and 02-GAP2-PLAN. The six human verification items are required by the phase's nature (network-dependent behavior + OS-level keychain inspection) — they are not implementation failures.

The phase delivers the complete connect-publish flow including all gap plan fixes:

- Profile creation with keychain security -> inline connection test (via "Save & Connect" OR standalone "Test Connection") -> Management API queue/exchange discovery -> binary protobuf publishing with PUBL-01/PUBL-02 routing -> Sonner toasts -> double-submit prevention
- GAP additions: standalone Test Connection button, sidebar Re-test button, edit mode with pre-populated fields and blank-password guard
- GAP2 additions: max-h-[85vh] modal with flex scroll layout; DialogHeader pinned above scroll container; form and profile list both scroll inside same overflow-y-auto container
- All wiring is substantive and data-flowing. Build clean, 74 frontend tests pass, 10 Rust tests pass, TypeScript clean.

---

_Verified: 2026-05-18T00:10:00Z_
_Verifier: Claude (gsd-verifier)_
