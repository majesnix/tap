# SECURITY.md — Phase 03 (full-feature-set)

**Audit Date:** 2026-05-18
**Phase:** 03 — full-feature-set
**ASVS Level:** 1
**Threats Closed:** 20/20
**Threats Open:** 0/20

---

## Threat Verification

### Accepted Risks (no code verification required)

| Threat ID | Category | Component | Disposition | Status |
|-----------|----------|-----------|-------------|--------|
| T-03-01-01 | Tampering | useProtoStore addOrActivateFile | accept | CLOSED — Input from Tauri parse_proto, already sanitized in Rust |
| T-03-01-02 | Info Disclosure | useProtoStore latestValues | accept | CLOSED — Values stay in-process, never serialized |
| T-03-01-04 | Spoofing | FileSection tab close button | accept | CLOSED — Index bounded by openFiles.length |
| T-03-02-03 | Info Disclosure | AMQP correlation ID / reply-to | accept | CLOSED — User-supplied metadata, intentional |
| T-03-03-01 | Info Disclosure | history.json | accept | CLOSED — Intentional local dev tool storage |
| T-03-03-03 | Tampering | HexViewDialog payloadBytes | accept | CLOSED — Read-only hex display, no eval |
| T-03-03-04 | Info Disclosure | fieldValues in history entry | accept | CLOSED — Local disk only, no network transmission |
| T-03-03-05 | DoS | HistoryTable 100 rows | accept | CLOSED — 100 rows, simple text cells, acceptable |
| T-03-04-01 | Tampering | handleReplay fieldValues | accept | CLOSED — User's own prior data |
| T-03-04-02 | Tampering | handleResend payloadBytes | accept | CLOSED — App-encoded bytes stored locally |
| T-03-04-03 | Spoofing | handleResend target | accept | CLOSED — User-selected in prior session |
| T-03-04-04 | DoS | HistoryFilterBar substring match | accept | CLOSED — 100 entries max, O(n) negligible |

### Mitigations Verified in Code

| Threat ID | Category | Component | Expected Mitigation | Status | Evidence |
|-----------|----------|-----------|---------------------|--------|----------|
| T-03-01-03 | DoS | useProtoStore addOrActivateFile | Cap openFiles at 20 | CLOSED | `useProtoStore.ts:89-92` — `if (s.openFiles.length >= MAX_OPEN_FILES) { toast.error(...); return s; }` where `MAX_OPEN_FILES = 20` |
| T-03-02-01 | Tampering | AmqpPropertiesSheet / useAmqpStore addHeader | Validate header key non-empty; trim; inline error | CLOSED | `useAmqpStore.ts:51-53` — `if (!header.key.trim()) { return s; }` (store guard); `AmqpPropertiesSheet.tsx:239,241` — Add button `disabled={!newHeaderKey.trim()}` with double guard in onClick |
| T-03-02-02 | DoS | useAmqpStore addHeader | Cap headers at 20 | CLOSED | `useAmqpStore.ts:55-58` — `if (s.properties.headers.length >= MAX_HEADERS) { toast.error("Maximum 20 custom headers reached"); return s; }` |
| T-03-02-04 | Tampering | TTL input / useAmqpStore | Validate TTL >= 0 and integer; reject negative/non-integer | CLOSED | `AmqpPropertiesSheet.tsx:64-68` — `if (!Number.isInteger(parsed) || parsed < 0) { setTtlError("TTL must be a non-negative integer (ms)"); return; }` with inline error rendered at line 147-149 |
| T-03-02-05 | EoP | Rust publish command delivery_mode | Rust validates delivery_mode is 1 or 2 if Some | CLOSED | `publish.rs:36-43` — `if let Some(dm) = delivery_mode { if dm != 1 && dm != 2 { return Err(AppError::InvalidInput(...)); } }` |
| T-03-03-02 | DoS | useHistoryStore appendEntry | 100-entry FIFO cap enforced | CLOSED | `useHistoryStore.ts:53` — `const updated = [entry, ...current].slice(0, MAX_ENTRIES);` where `MAX_ENTRIES = 100` |
| T-03-03-06 | Tampering | useHistoryStore appendEntry | historyLoaded guard — early return if false | CLOSED | `useHistoryStore.ts:50` — `if (!get().historyLoaded) return;` |
| T-03-04-05 | EoP | handleReplay setActiveIndex | -1 check guards against invalid tab index | CLOSED | `MessageHistoryPanel.tsx:34-37` — `if (tabIndex === -1) { toast.error("Replay failed: ..."); return; }` (also present for handleResend at lines 55-58) |

---

## Unregistered Flags

None. All SUMMARY.md threat flags map to existing threat IDs in the register.

---

## Accepted Risks Log

All accepted risks are intentional by design for a local developer tool with no network-exposed surface. No accepted risk involves credential storage, remote code execution, or network transmission of sensitive data.
