# SECURITY.md — Phase 13: Message Feed Foundation / Drain Mode

**Audit Date:** 2026-05-21
**Phase:** 13 — message-feed-foundation-drain-mode
**ASVS Level:** L1
**Threats Closed:** 5/5 (mitigate) + 5/5 (accept)
**Threats Open:** 0

---

## Threat Verification

### Mitigations Verified in Code

| Threat ID | Category | Disposition | Status | Evidence |
|-----------|----------|-------------|--------|----------|
| T-13-01-01 | Tampering | mitigate | CLOSED | `consume.rs:254` — `if count == 0 \|\| count > 500 { return Err(AppError::InvalidInput(...)) }` before any AMQP connection; frontend secondary clamp: `ResponseQueuePicker.tsx:246-254` (onBlur) and `ResponseQueuePicker.tsx:265` (onClick `Math.min`) |
| T-13-01-02 | Tampering | mitigate | CLOSED | `consume.rs:249-253` — `if message_type_names.is_empty() { return Err(AppError::InvalidInput("message_type_names must not be empty")) }` fires before pool lock acquisition and before any AMQP URI is constructed |
| T-13-01-03 | Information Disclosure | mitigate | CLOSED | `consume.rs:281` — `drop(password)` called inside tight URI scope block before first `.await` at `consume.rs:284`; URI variable also drops when scope closes at `consume.rs:297`; password never survives into async body |
| T-13-03-01 | Tampering | mitigate | CLOSED | `ResponseQueuePicker.tsx:246-254` — `onBlur` clamps to [1,500], defaulting NaN to 10; `ResponseQueuePicker.tsx:265` — onClick applies `Math.min(drainCount, 500)` before `onDrain(safe)` is called; Rust validates independently (T-13-01-01) |
| T-13-03-04 | DoS | mitigate | CLOSED | `useResponseStore.ts:4` — `const FEED_MAX_SIZE = 500`; `useResponseStore.ts:69` — `combined.slice(0, FEED_MAX_SIZE)` enforced in every `appendMessages` call; single code path, no bypass |

### Accepted Risks

| Threat ID | Category | Component | Rationale |
|-----------|----------|-----------|-----------|
| T-13-01-04 | DoS | 500-message drain connection hold | count cap of 500 bounds worst-case hold duration; single-user local dev tool — no multi-user attack surface |
| T-13-02-01 | Information Disclosure | ResponseHexSection clipboard copy | User-initiated action; data already visible on screen; no new exposure |
| T-13-02-02 | Tampering | shadcn registry fetch (`npx shadcn@latest add accordion`) | Official shadcn registry only; standard tooling already in use by the project |
| T-13-03-02 | Tampering | selectedDecodeTypes from Decode-as combobox | Options sourced exclusively from type names in user's own loaded .proto files via `useProtoStore.openFiles`; no arbitrary text input path |
| T-13-03-03 | Information Disclosure | AMQP message content rendered in feed | Dev tool — user consuming their own queue messages; content rendered as text (no innerHTML); no third-party data exposure |

---

## Unregistered Flags

None. No new attack surface appeared during Phase 13 implementation that lacked a threat mapping.

---

## Audit Notes

### T-13-01-01 — Defense-in-depth verified at both layers

The Rust backend rejects `count == 0 || count > 500` with `AppError::InvalidInput` before opening any AMQP connection (`consume.rs:254`). The frontend applies two independent clamps: an `onBlur` handler (`ResponseQueuePicker.tsx:246-254`) and an inline `Math.min` in the `onClick` handler (`ResponseQueuePicker.tsx:265`). Both layers are present as declared.

### T-13-01-02 — Empty vec check precedes all resource allocation

The `message_type_names.is_empty()` guard at `consume.rs:249` fires before the descriptor pool lock is acquired and before the AMQP URI is constructed. This prevents wasted connections on malformed IPC calls.

### T-13-01-03 — Password scope is tight and structurally enforced

In `drain_messages`, `drop(password)` is called at `consume.rs:281`, and the first `.await` only occurs at `consume.rs:284` inside `tokio::time::timeout`. The URI variable is also dropped when the enclosing block closes at `consume.rs:297`. This mirrors the identical pattern in `consume_message` (`consume.rs:70`). The password never survives into the async body.

### T-13-03-04 — FIFO cap structurally enforced, not advisory

`FEED_MAX_SIZE = 500` is a named constant (`useResponseStore.ts:4`) used directly in the `slice(0, FEED_MAX_SIZE)` call (`useResponseStore.ts:69`) inside the Zustand `set` reducer. Every call to `appendMessages` passes through this single code path; there is no bypass route.
