---
phase: 06-bytesfield
slug: bytesfield
status: verified
threats_open: 0
asvs_level: 1
created: 2026-05-19
---

# Phase 06 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| user → BytesField Input | User types or pastes an arbitrary string into the base64 text input | Unvalidated string; validated by zod before form submission |
| user → Popover Textarea | User types arbitrary UTF-8 text in the "From text" conversion helper | Arbitrary UTF-8; converted to base64 via TextEncoder before touching the field value |
| BytesField form value → Rust IPC | The validated base64 string from form state is passed via `invoke('encode_message')` → `base64_decode_or_empty` | Base64-encoded bytes; guarded at frontend before IPC dispatch |

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| T-06-01 | Tampering / Info Disclosure | BytesField zod schema → `encode.rs:base64_decode_or_empty` | mitigate | Two-layer zod validation: char-set regex (`/^[A-Za-z0-9+/]*={0,2}$/`) rejects URL-safe chars; `.refine()` with strict RFC 4648 structural regex (`/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==\|[A-Za-z0-9+/]{3}=)?$/`) rejects invalid lengths (e.g. `"abc"`). Rust's `STANDARD.decode(s).unwrap_or_default()` silent-empty fallback cannot be reached with invalid input. Verified in `BytesField.tsx` lines 50–64. | closed |
| T-06-02 | Denial of Service (UX) | `utf8ToBase64` helper in Convert click handler | mitigate | `utf8ToBase64` uses `new TextEncoder().encode(text)` + `btoa(binary)` — never calls `btoa()` directly on raw user text. Handles non-ASCII code points (`"café"`, `"日本語"`) without throwing `InvalidCharacterError`. Verified in `BytesField.tsx` lines 27–34. | closed |
| T-06-03 | XSS | Popover Textarea content | accept | User-typed text passes through `utf8ToBase64()` to produce a base64 string, which is set as a React controlled input value. No `innerHTML`, no `dangerouslySetInnerHTML`. React escapes string values by default. No actionable XSS vector. See Accepted Risks Log. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-06-01 | T-06-03 | Textarea content is processed through `utf8ToBase64()` producing a base64 string used as a React controlled input value — no DOM injection path. React's default escaping removes any residual XSS risk. Accepted as LOW severity by design at plan time. | gsd-secure-phase (automated) | 2026-05-19 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-19 | 3 | 3 | 0 | gsd-secure-phase (short-circuit: register_authored_at_plan_time=true, threats_open=0) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (T-06-03 → AR-06-01)
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-19
