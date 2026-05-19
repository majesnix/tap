---
phase: 10-publisher-confirms-badge
verified: 2026-05-19T19:31:44Z
status: human_needed
score: 10/10 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Send a message to a queue with a known binding and observe that the green ACK badge appears in the publish bar within 1 second and disappears automatically after 3 seconds"
    expected: "Green badge labeled 'ACK' appears inline left of the Send button, then vanishes after 3 seconds without user interaction"
    why_human: "Tests mock the IPC return value; only real broker interaction via lapin's publisher confirms protocol can confirm that Confirmation::Ack(None) is correctly produced when the broker acknowledges delivery"
  - test: "Send a message to a named exchange with mandatory=true and no binding match (unroutable), observe the amber Returned badge"
    expected: "Amber badge labeled 'Returned' appears and disappears automatically after 5 seconds; no silent message drop"
    why_human: "The Returned path requires the real AMQP broker to emit a basic.return frame followed by an Ack; this broker behavior cannot be verified without a live RabbitMQ instance; tests mock the IPC return value"
  - test: "Simulate broker NACK (if possible with RabbitMQ test setup) and observe the red NACK badge"
    expected: "Red badge labeled 'NACK' appears and disappears automatically after 5 seconds"
    why_human: "Confirmation::Nack from a real broker is rare; confirming the match arm fires correctly requires a broker that supports negative acknowledgments or a test harness"
  - test: "Send a message and prevent the broker from responding within 5 seconds (network partition or test queue config), observe the gray Timeout badge"
    expected: "Gray badge labeled 'Timeout' appears and persists indefinitely; an X dismiss button is visible; clicking it removes the badge"
    why_human: "The 5-second tokio::time::timeout logic is only exercised by a real broker that fails to respond; tests mock the IPC layer; confirming the dismiss button functions in production UI requires manual UAT"
---

# Phase 10: Publisher Confirms Badge Verification Report

**Phase Goal:** Implement a publisher confirms badge — the UI displays an ephemeral per-send delivery outcome (ACK, NACK, Returned, Timeout) as a badge after each RabbitMQ publish, using lapin's publisher confirms API.
**Verified:** 2026-05-19T19:31:44Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | publish_message Rust command returns Result<PublishOutcome, AppError> instead of Result<(), AppError> (D-01) | VERIFIED | publish.rs line 42: `pub async fn publish_message(...) -> Result<PublishOutcome, AppError>` |
| 2 | PublishOutcome is a flat serde-serializable struct with a status: String field (D-02) | VERIFIED | publish.rs lines 14-17: `#[derive(Debug, serde::Serialize)] pub struct PublishOutcome { pub status: String }` |
| 3 | mandatory=true is set on every BasicPublishOptions call (D-04) | VERIFIED | publish.rs line 146: `BasicPublishOptions { mandatory: true, ..Default::default() }` — one call site, grep count=1 |
| 4 | Confirmation::Ack(None) maps to status "ack" | VERIFIED | publish.rs line 182: `Ok(Ok(Confirmation::Ack(None))) => PublishOutcome { status: "ack".to_string() }` |
| 5 | Confirmation::Ack(Some(_)) maps to status "returned" (D-05) | VERIFIED | publish.rs line 184: `Ok(Ok(Confirmation::Ack(Some(_returned)))) => PublishOutcome { status: "returned".to_string() }` |
| 6 | Confirmation::Nack(_) maps to status "nack" | VERIFIED | publish.rs line 185: `Ok(Ok(Confirmation::Nack(_))) => PublishOutcome { status: "nack".to_string() }` |
| 7 | A 5-second tokio::time::timeout wraps confirm_future.await; elapsed maps to status "timeout" (D-03) | VERIFIED | publish.rs lines 163-166: `tokio::time::timeout(Duration::from_secs(5), confirm_future).await`; Err(_elapsed) branch returns `Ok(PublishOutcome { status: "timeout" })`. grep count=2 (one for connect 10s, one for confirm 5s). |
| 8 | The connection is closed in the timeout branch before returning the timeout outcome | VERIFIED | publish.rs line 173: `let _ = conn.close(0, "".into()).await;` inside the `Err(_elapsed)` match arm, before the `return Ok(PublishOutcome { status: "timeout" })` on line 174 |
| 9 | PublishOutcome TypeScript interface exists in src/lib/types.ts with status as a string literal union | VERIFIED | types.ts lines 110-112: `export interface PublishOutcome { status: "ack" \| "nack" \| "returned" \| "timeout"; }` — uses interface keyword, string literal union |
| 10 | publishMessage IPC wrapper returns Promise<PublishOutcome> instead of Promise<void> | VERIFIED | ipc.ts line 89: `): Promise<PublishOutcome>` and line 90: `return invoke<PublishOutcome>("publish_message", {...})`. Import includes PublishOutcome (line 2). |

**Score:** 10/10 truths verified

### Roadmap Success Criteria Verification

| # | Success Criterion | Status | Evidence |
|---|------------------|--------|----------|
| SC-1 | User sends message broker confirms → green ACK badge; auto-dismisses after 3 seconds | VERIFIED (code) / NEEDS HUMAN (real broker) | PublishBar.tsx: setOutcome(result) + delay=3000 for ack + setTimeout; badge JSX with bg-emerald-500/10 + text "ACK"; test PUBL-05 passes |
| SC-2 | User sends unroutable message (mandatory=true, no binding) → amber Returned badge; auto-dismisses after 5 seconds | VERIFIED (code) / NEEDS HUMAN (real broker) | mandatory=true in publish.rs; Ack(Some(_))→"returned"; PublishBar badge with bg-amber-500/10 + "Returned"; delay=5000; test PUBL-06 passes |
| SC-3 | User sends message broker NACKs → red NACK badge; auto-dismisses after 5 seconds | VERIFIED (code) / NEEDS HUMAN (real broker) | Nack(_)→"nack" in publish.rs; PublishBar badge with bg-destructive/10 + "NACK"; delay=5000; test PUBL-07 passes |
| SC-4 | Broker confirmation does not arrive within 5 seconds → gray Timeout badge; stays until manually dismissed | VERIFIED (code) / NEEDS HUMAN (real broker) | tokio timeout 5s in publish.rs; PublishBar: no auto-dismiss timer for timeout; Dismiss timeout badge button present; test PUBL-08 passes |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/commands/publish.rs` | PublishOutcome struct + updated publish_message command | VERIFIED | pub struct PublishOutcome present (line 15); function signature returns Result<PublishOutcome, AppError>; all 4 Confirmation match arms present; mandatory=true set; 5-second timeout wraps confirm_future |
| `src/lib/types.ts` | PublishOutcome TypeScript interface | VERIFIED | interface PublishOutcome exported at lines 110-112 with status string literal union |
| `src/lib/ipc.ts` | Updated publishMessage return type | VERIFIED | Promise<PublishOutcome> return type; invoke<PublishOutcome>; PublishOutcome imported from ./types |
| `src/components/publish/PublishBar.tsx` | Badge state, dismiss timer, badge JSX | VERIFIED | outcome state, dismissTimerRef (7 occurrences), D-09 prologue, unmount cleanup useEffect, badge JSX with 4 status variants, Timeout-only dismiss button |
| `src/components/publish/__tests__/PublishBar.test.tsx` | Phase 10 test coverage | VERIFIED | Phase 10 — Publisher Confirms Badge describe block with 7 test cases; vi.useFakeTimers({ shouldAdvanceTime: true }); hexPreview seeded in beforeEach |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `lapin::Confirmation` | `PublishOutcome.status` | match confirm_result in publish_message | WIRED | All 4 variants matched: Ack(None)→ack, Ack(Some(_))→returned, Nack(_)→nack, NotRequested→ack |
| `src/lib/ipc.ts publishMessage` | `src/components/publish/PublishBar.tsx handleSend` | `const result = await publishMessage(...)` | WIRED | Line 245 in PublishBar.tsx: `const result = await publishMessage(...)` followed by `setOutcome(result)` on line 246 |
| `dismissTimerRef` | outcome auto-dismiss | `setTimeout(() => setOutcome(null), delay)` | WIRED | Line 256: `dismissTimerRef.current = setTimeout(() => setOutcome(null), delay)` — delay=3000 ACK, 5000 Returned/NACK, null for Timeout |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `PublishBar.tsx` (badge JSX) | `outcome` (useState<PublishOutcome \| null>) | `setOutcome(result)` after `await publishMessage(...)` in handleSend; IPC invokes Rust publish_message which returns PublishOutcome from Confirmation match | Yes — Rust constructs PublishOutcome from real lapin Confirmation enum value from broker | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Rust unit tests pass (4 in publish.rs + 17 others) | `cargo test --manifest-path src-tauri/Cargo.toml` | 21 passed (3 suites, 0.00s) | PASS |
| Frontend test suite passes (includes 7 Phase 10 cases + 197 others) | `npm test` | 204 passed (24 files) | PASS |
| TypeScript type check passes | `npx tsc --noEmit` | No errors found | PASS |
| publish_message returns PublishOutcome | `grep -c "Result<PublishOutcome" publish.rs` | 1 | PASS |
| PublishOutcome interface exported | `grep -c "interface PublishOutcome" types.ts` | 1 | PASS |
| dismissTimerRef wired | `grep -c "dismissTimerRef" PublishBar.tsx` | 7 | PASS |
| Success toast removed | `grep -c "Message sent to" PublishBar.tsx` | 0 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PUBL-05 | 10-01, 10-02 | User sees green ACK badge after broker confirms delivery; auto-dismisses after 3 seconds | SATISFIED | Confirmation::Ack(None)→"ack"; PublishBar ACK badge with emerald class; delay=3000; test passes |
| PUBL-06 | 10-01, 10-02 | User sees amber Returned badge when message has no route (mandatory=true); auto-dismisses after 5 seconds | SATISFIED | mandatory=true set; Confirmation::Ack(Some(_))→"returned"; PublishBar Returned badge with amber class; delay=5000; test passes |
| PUBL-07 | 10-01, 10-02 | User sees red NACK badge on broker negative ack; auto-dismisses after 5 seconds | SATISFIED | Confirmation::Nack(_)→"nack"; PublishBar NACK badge with destructive class; delay=5000; test passes |
| PUBL-08 | 10-01, 10-02 | User sees gray Timeout badge when broker confirmation does not arrive within 5 seconds; badge requires manual dismiss | SATISFIED | tokio timeout 5s; Timeout outcome; no auto-dismiss timer (delay=null); dismiss button with aria-label present; test passes |

All 4 requirements claimed in plan frontmatter (PUBL-05, PUBL-06, PUBL-07, PUBL-08) are accounted for. No orphaned requirements. REQUIREMENTS.md traceability table confirms all four map to Phase 10.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| PublishBar.tsx | 352, 380, 423 | `placeholder=` attribute on Select/Input UI components | Info | These are legitimate UI placeholder text for empty fields — not implementation stubs; no impact |

No TODOs, FIXMEs, XXX, HACK, empty return stubs, hardcoded empty data, or console.log statements found in any of the 5 modified files.

### Human Verification Required

The static code verification and automated test suite confirm all code paths are correct. The following scenarios require a live RabbitMQ broker to confirm end-to-end behavior:

#### 1. ACK badge from real broker delivery

**Test:** Connect to a local RabbitMQ instance, load a proto file, fill in message fields, select an existing queue, click Send.
**Expected:** Green "ACK" badge appears inline left of the Send button within 1 second and automatically disappears after 3 seconds.
**Why human:** Tests mock `invoke("publish_message")` to return `{ status: "ack" }`. The real IPC path (lapin Confirmation::Ack from broker → Rust PublishOutcome → Tauri serialization → React state) is not exercised by unit tests.

#### 2. Returned badge from unroutable message (mandatory=true)

**Test:** Connect to RabbitMQ, select an exchange with no bindings (or use a routing key that has no binding match), click Send.
**Expected:** Amber "Returned" badge appears and disappears automatically after 5 seconds. Verify that a message with no binding match is NOT silently dropped (the pre-Phase 10 behavior).
**Why human:** The Returned path depends on the broker emitting a basic.return frame before the confirm ACK. This broker-level behavior requires a live AMQP connection with mandatory=true semantics verified against real lapin 4.x Confirmation::Ack(Some(_)) production.

#### 3. Timeout badge from non-responding broker

**Test:** Send a message while blocking the broker response (e.g., pause the RabbitMQ container, or configure a test with network packet drop). Observe behavior after 5 seconds.
**Expected:** Gray "Timeout" badge appears; a small X dismiss button is visible next to it. Clicking X removes the badge. The badge does not disappear on its own.
**Why human:** The 5-second tokio::time::timeout is unit-tested via mocked IPC. Real timeout behavior (connection cleanup, TCP socket state after `conn.close()`) must be verified end-to-end to confirm no resource leak.

#### 4. Badge replacement on rapid send-over-send (D-09)

**Test:** Click Send twice in rapid succession (second click before the first badge appears). Observe that only one badge is shown (the second send's outcome), not two stacked badges.
**Expected:** Only the most recent send's badge is visible at any time. No duplicate badges. No timer race condition where first badge dismisses second badge.
**Why human:** While the D-09 prologue (clearTimeout + setOutcome(null)) is unit-tested, the visual timing in a real browser environment with real async I/O is best confirmed by a human clicking the button at realistic speed.

---

## Gaps Summary

No gaps found. All 10 must-haves are verified in the codebase. All 4 roadmap success criteria are implemented correctly in code. All 4 requirements (PUBL-05 through PUBL-08) are satisfied per static analysis and automated tests.

Human verification items above are required to confirm the real-broker AMQP interactions that cannot be unit-tested without a live RabbitMQ instance.

---

_Verified: 2026-05-19T19:31:44Z_
_Verifier: Claude (gsd-verifier)_
