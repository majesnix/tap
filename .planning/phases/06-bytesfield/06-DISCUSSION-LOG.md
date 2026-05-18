# Phase 6: BytesField - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 6-BytesField
**Areas discussed:** Injection point, "From text" helper UX, BFLD-04 error source

---

## Injection Point

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-dispatch branch (Recommended) | Add `if (field.kind.type === 'scalar' && field.kind.scalar === 'bytes')` before the switch in renderField | ✓ |
| Internal ScalarField split | ScalarField checks `if (scalar === 'bytes') return <BytesFieldInner />` internally | |
| You decide | Claude picks | |

**User's choice:** Pre-dispatch branch in `ProtoFormRenderer.renderField`

**Follow-up — Remove bytes from ScalarField?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — remove it (Recommended) | ScalarField no longer handles bytes at all | ✓ |
| Keep it as fallback | Leave the z.string() bytes path in ScalarField as safety net | |

**User's choice:** Yes — remove it.

---

## "From text" Helper UX

| Option | Description | Selected |
|--------|-------------|----------|
| Popover with textarea + Convert (Recommended) | Button opens shadcn Popover with textarea and Convert button | ✓ |
| Inline collapsible textarea | Clicking button reveals textarea inline below the input | |
| Direct conversion — no text input UI | Button opens native OS dialog for pasting text | |

**User's choice:** Popover with textarea + Convert button.

**Follow-up — Close popover after Convert?**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — convert and close (Recommended) | Single action: fill field + dismiss popover | ✓ |
| No — keep popover open | User closes manually | |

**User's choice:** Yes — convert and close.

**Follow-up — Button placement?**

| Option | Description | Selected |
|--------|-------------|----------|
| Below the input, left-aligned (Recommended) | Small secondary button below the base64 input | ✓ |
| Right side of the label row | Inline with field label and type badge | |
| You decide | Claude picks | |

**User's choice:** Below the input, left-aligned.

---

## BFLD-04 Error Source

| Option | Description | Selected |
|--------|-------------|----------|
| Frontend validation before IPC (Recommended) | BytesField validates atob() can decode before invoke | ✓ |
| Rust decode error via AppError | Rust tries to decode, returns AppError on failure (toast) | |
| Both — frontend + Rust as safety net | Belt-and-suspenders, redundant for a dev tool | |

**User's choice:** Frontend validation before IPC.

**Follow-up — Single zod rule or separate checks?**

| Option | Description | Selected |
|--------|-------------|----------|
| Single zod rule for both (Recommended) | One regex covers BFLD-03 character check and BFLD-04 structural check | ✓ |
| Separate checks | BFLD-03 = regex on blur; BFLD-04 = atob() try/catch at submit | |

**User's choice:** Single zod rule covers both.

---

## Claude's Discretion

None — user made explicit choices in all areas.

## Deferred Ideas

None — discussion stayed within phase scope.
