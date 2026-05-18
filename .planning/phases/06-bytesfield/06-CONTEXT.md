# Phase 6: BytesField - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a dedicated `BytesField` component for proto `bytes` scalar fields. Replaces the current bare `z.string()` fallback in `ScalarField` with:
- Base64 input (RFC 4648 standard alphabet `+/`) with inline zod validation
- "From text" helper button (Popover) for UTF-8 → base64 conversion
- Send-time decode guard via the same zod rule (no silent empty bytes)

Requirements covered: BFLD-01, BFLD-02, BFLD-03, BFLD-04.

</domain>

<decisions>
## Implementation Decisions

### Injection Point
- **D-01:** `BytesField` is routed via a **pre-dispatch branch** in `ProtoFormRenderer.renderField`, before the `switch`. Add `if (field.kind.type === 'scalar' && field.kind.scalar === 'bytes') return <BytesField key={path} field={field} path={path} />` before `case "scalar"`. ProtoFormRenderer itself stays otherwise frozen.
- **D-02:** The existing `bytes` handling in `ScalarField` (the `z.string()` fallback and "bytes (base64)" badge) is **removed** once `BytesField` is in place. `ScalarField` no longer handles bytes at all.

### "From text" Helper UX
- **D-03:** The helper uses a **shadcn `Popover`** (already in codebase). Clicking "From text" opens a popover containing a `<Textarea>` and a "Convert" button.
- **D-04:** Clicking "Convert" fills the base64 field with `btoa(utf8Text)` and **closes the popover** in one action (no manual dismiss step).
- **D-05:** The "From text" button is placed **below the base64 input, left-aligned** (a small secondary button, same column as the input). Not inline with the label row.

### Base64 Validation (BFLD-03 + BFLD-04)
- **D-06:** Single zod rule covers both BFLD-03 and BFLD-04: `z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, "Must be valid base64 (standard alphabet, not URL-safe)")`. This fires on blur (consistent with `mode: onBlur`).
- **D-07:** BFLD-04 send-time decode error is **frontend-only** — the zod validation on blur already blocks invalid base64 before `invoke('encode_message')` is called. No Rust-side decode check needed; Rust never sees invalid base64.
- **D-08:** Error message for non-standard characters (BFLD-03) and structural decode failure (BFLD-04) uses the same message from the single zod rule — no separate error strings.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Bytes Field — BFLD-01 through BFLD-04 (authoritative acceptance criteria)

### Existing Field Components (read before writing BytesField)
- `src/components/form/fields/ScalarField.tsx` — Controller + zod pattern to follow; bytes branch to remove
- `src/components/form/ProtoFormRenderer.tsx` — where the pre-dispatch branch is added (frozen otherwise)

### UI Components Available
- `src/components/ui/popover.tsx` (or shadcn Popover) — used for the "From text" helper
- `src/components/ui/textarea.tsx` — textarea inside the popover
- `src/components/ui/button.tsx` — "From text" and "Convert" buttons

### Stack Constraints (from STATE.md)
- zod pinned to `^3.24.2` (not v4) — `@hookform/resolvers` incompatible with zod v4
- ProtoFormRenderer dispatch is **FROZEN** — only add the pre-dispatch branch; do not restructure the switch

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ScalarField.tsx` — Controller + `rhfField` + `fieldState.error` pattern; `<Label>`, `<Badge>`, `<Input>` composition; exact pattern for BytesField to follow
- shadcn `Popover` / `PopoverTrigger` / `PopoverContent` — available (used elsewhere in codebase)
- shadcn `Textarea` — available for the UTF-8 text input inside the popover
- `zod` (`z.string().regex(...)`) — existing bytes validation pattern already stubbed; upgrade to real regex

### Established Patterns
- Single `Controller` wraps both input and error display (one `<Controller name={path} ...>`) — do not use two Controllers
- `mode: onBlur` is set form-wide on `useForm` — validation fires on blur, not on change
- `<Badge variant="outline">` for scalar type label, `<Badge variant="secondary">` for hints (e.g., "bytes (base64)")
- Error display: `<p className="text-xs text-destructive" role="alert">` inside the Controller render
- Local `useState` for popover open/close state (not Zustand)

### Integration Points
- `ProtoFormRenderer.tsx:renderField` — add pre-dispatch branch for bytes before the `case "scalar"` switch arm
- `ScalarField.tsx:getZodSchema` — remove `case "bytes"` arm (or consolidate into `default: return z.string()`)
- `ScalarField.tsx:getInputType` — remove `"bytes"` from `textKinds` array
- `ScalarField.tsx` JSDoc — remove "bytes → Input type='text' + 'bytes (base64)' badge" line

</code_context>

<specifics>
## Specific Ideas

- Popover "Convert" button text: "Convert" (clear, action-oriented)
- "From text" button label: "From text" (matches BFLD-02 wording exactly)
- The popover textarea placeholder: "Type UTF-8 text to convert to base64…" (or similar)
- No URL-safe base64 input mode — standard alphabet only (`+/`), consistent with what prost-reflect produces

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 6-BytesField*
*Context gathered: 2026-05-19*
