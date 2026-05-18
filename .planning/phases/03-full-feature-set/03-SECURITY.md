---
phase: 03
slug: full-feature-set
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-18
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| file-system → app | .proto file content read by Tauri fs plugin; paths come from native file picker (trusted OS dialog) | File paths, proto schema |
| store → component | Zustand store state flows into React; no external data at this layer | In-memory form values |
| UI → store | AmqpPropertiesSheet writes user-entered strings to useAmqpStore | AMQP property strings |
| store → Rust IPC | publishMessage invokes publish_message with optional AMQP fields | AMQP properties, payload bytes |
| Rust → RabbitMQ broker | AMQP properties sent over wire to broker | Protobuf-encoded messages |
| PublishBar → useHistoryStore | Form values and payload bytes written to persistent store | Form values, binary payload |
| useHistoryStore → tauri-plugin-store | Entries serialized to history.json on disk | History entries (local only) |
| HistoryTable → HexViewDialog | User-selected entry's payloadBytes rendered as hex | Binary payload (display only) |
| history entry → form.reset | fieldValues from history.json are deserialized and fed into react-hook-form | User's own prior values |
| history entry → publishMessage IPC | payloadBytes from history.json are passed directly to Rust publish command | Raw stored bytes |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-03-01-01 | Tampering | useProtoStore addOrActivateFile | accept | Input from Tauri parse_proto — already sanitized in Rust | closed |
| T-03-01-02 | Info Disclosure | useProtoStore latestValues | accept | Values stay in-process (Zustand in-memory); never serialized | closed |
| T-03-01-03 | DoS | FileSection openFiles array | mitigate | Cap at 20 in addOrActivateFile — `MAX_OPEN_FILES = 20`, early return with toast | closed |
| T-03-01-04 | Spoofing | FileSection tab close button | accept | Index bounded by openFiles.length; no spoofing vector | closed |
| T-03-02-01 | Tampering | AmqpPropertiesSheet header key/value | mitigate | Add button disabled when key empty; store silently rejects empty keys after trim | closed |
| T-03-02-02 | DoS | Custom headers array | mitigate | Cap at 20 in addHeader — toast error if `headers.length >= MAX_HEADERS` | closed |
| T-03-02-03 | Info Disclosure | AMQP correlation ID / reply-to | accept | User-supplied metadata passed to broker; no PII beyond user intent | closed |
| T-03-02-04 | Tampering | TTL input | mitigate | `Number.isInteger(parsed) && parsed >= 0` check; inline error; handleApply returns early on invalid | closed |
| T-03-02-05 | EoP | Rust publish command delivery_mode | mitigate | Rust validates `delivery_mode` is 1 or 2 if Some; returns AppError::InvalidInput otherwise | closed |
| T-03-03-01 | Info Disclosure | useHistoryStore history.json | accept | Intentional local dev tool storage — developer-authored proto messages only | closed |
| T-03-03-02 | DoS | history.json growth | mitigate | 100-entry FIFO cap: `[entry, ...current].slice(0, MAX_ENTRIES)` | closed |
| T-03-03-03 | Tampering | HexViewDialog payloadBytes | accept | Read-only hex `<pre>` display; no eval or execution | closed |
| T-03-03-04 | Info Disclosure | fieldValues in history entry | accept | Persisted only to local disk; no network transmission | closed |
| T-03-03-05 | DoS | HistoryTable 100 rows | accept | 100 rows with simple text cells; no virtualization needed | closed |
| T-03-03-06 | Tampering | appendEntry race (pre-hydration write) | mitigate | `historyLoaded` guard: `if (!get().historyLoaded) return;` — prevents writes before loadHistory() resolves | closed |
| T-03-04-01 | Tampering | handleReplay fieldValues into form.reset | accept | fieldValues from user's own prior submission; no external input | closed |
| T-03-04-02 | Tampering | handleResend payloadBytes direct publish | accept | App-encoded bytes stored locally; no external modification vector | closed |
| T-03-04-03 | Spoofing | handleResend target (exchange/routingKey) | accept | User-selected in a prior session; no spoofing without physical machine access | closed |
| T-03-04-04 | DoS | HistoryFilterBar substring match | accept | Max 100 entries; O(n) string search negligible | closed |
| T-03-04-05 | EoP | handleReplay setActiveIndex | mitigate | `-1` check guards invalid index: toast error + early return if `tabIndex === -1` | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-01-01 | Input originates from Rust parse_proto result — sanitized at parse layer | dev team | 2026-05-18 |
| AR-03-02 | T-03-01-02 | Zustand in-memory only; no IPC or disk serialization in this plan | dev team | 2026-05-18 |
| AR-03-03 | T-03-01-04 | Close button index bounded by array length — no arbitrary index injection | dev team | 2026-05-18 |
| AR-03-04 | T-03-02-03 | AMQP metadata is user-intentional; no PII concern | dev team | 2026-05-18 |
| AR-03-05 | T-03-03-01 | Dev tool design intent: history.json holds developer-authored messages on local disk | dev team | 2026-05-18 |
| AR-03-06 | T-03-03-03 | HexViewDialog renders read-only hex; no eval; XSS not applicable in Tauri WebView | dev team | 2026-05-18 |
| AR-03-07 | T-03-03-04 | fieldValues local-disk only; no network transmission | dev team | 2026-05-18 |
| AR-03-08 | T-03-03-05 | 100 row max; simple text cells; performance acceptable without virtualization | dev team | 2026-05-18 |
| AR-03-09 | T-03-04-01 | User replaying their own prior data — no external tamper vector | dev team | 2026-05-18 |
| AR-03-10 | T-03-04-02 | App-encoded bytes stored locally on the dev machine | dev team | 2026-05-18 |
| AR-03-11 | T-03-04-03 | Exchange/routingKey is user-selected from prior session; requires physical access to attack | dev team | 2026-05-18 |
| AR-03-12 | T-03-04-04 | 100 entry max; O(n) substring match; no debounce needed | dev team | 2026-05-18 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-18 | 20 | 20 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-18
