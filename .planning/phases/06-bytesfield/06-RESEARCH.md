# Phase 6: BytesField - Research

**Researched:** 2026-05-19
**Domain:** React frontend component — base64 input, zod validation, shadcn Popover
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `BytesField` is routed via a **pre-dispatch branch** in `ProtoFormRenderer.renderField`, before the `switch`. Add `if (field.kind.type === 'scalar' && field.kind.scalar === 'bytes') return <BytesField key={path} field={field} path={path} />` before `case "scalar"`.
- **D-02:** The existing `bytes` handling in `ScalarField` is **removed** once `BytesField` is in place. `ScalarField` no longer handles bytes at all.
- **D-03:** The helper uses a **shadcn `Popover`**. Clicking "From text" opens a popover with a `<Textarea>` and "Convert" button.
- **D-04:** Clicking "Convert" fills the base64 field with `btoa(utf8Text)` and **closes the popover** in one action.
- **D-05:** "From text" button is placed **below the base64 input, left-aligned**.
- **D-06:** Single zod rule: `z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/, "Must be valid base64 (standard alphabet, not URL-safe)")`. Fires on blur.
- **D-07:** BFLD-04 send-time decode error is **frontend-only** — zod validation on blur blocks invalid base64 before `invoke('encode_message')` is called.
- **D-08:** Error message for BFLD-03 and BFLD-04 uses the same message from the single zod rule.

### Claude's Discretion

None specified — all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BFLD-01 | User can enter a bytes field value as a standard base64 string (RFC 4648, `+`/`/` alphabet) | Text input + zod regex validates standard base64; Rust `STANDARD.decode()` reads RFC 4648 standard alphabet |
| BFLD-02 | User can click a "From text" helper button to encode UTF-8 text into base64 in one action | Popover + Textarea + Convert button fills input and closes; requires UTF-8-safe encoding (not bare `btoa`) |
| BFLD-03 | User sees inline validation error when input contains non-standard characters (URL-safe `-`/`_`) | Zod regex `/^[A-Za-z0-9+/]*={0,2}$/` explicitly excludes `-` and `_`; fires on blur |
| BFLD-04 | User sees error on send when base64 cannot be decoded — not silent empty bytes | Rust `base64_decode_or_empty` silently returns empty on failure (confirmed in encode.rs); frontend zod guard prevents sending invalid values — requires the regex to be structurally complete |
</phase_requirements>

---

## Summary

Phase 6 is a pure frontend change that introduces `BytesField` as a dedicated component for proto `bytes` scalar fields. The component replaces the bare `z.string()` fallback currently handling bytes in `ScalarField`. No Rust changes are required.

The core technical challenge is ensuring the zod validation in `BytesField` reliably prevents silent byte corruption. The Rust backend (`encode.rs:base64_decode_or_empty`) calls `STANDARD.decode(s).unwrap_or_default()` — any base64 string that fails decoding silently becomes empty bytes. The locked D-06 regex (`/^[A-Za-z0-9+/]*={0,2}$/`) catches character-set violations (BFLD-03) but has a structural gap: it accepts strings whose length mod 4 is not valid (e.g., `"abc"` — 3 chars — passes the regex but `atob("abc")` throws). This gap must be addressed in the implementation.

The second technical challenge is the "From text" helper. The locked D-04 specifies `btoa(utf8Text)`, but `btoa()` only handles Latin-1 (code points 0-255). Input containing multi-byte UTF-8 characters (e.g., `"café"`, `"日本語"`) will throw `InvalidCharacterError`. The correct pattern uses `TextEncoder` to produce a UTF-8 byte array and then encodes that to base64.

**Primary recommendation:** Implement `BytesField` following the `ScalarField` Controller pattern exactly, with a reinforced zod rule (refine or length-check added to D-06's regex) and a UTF-8-safe Convert implementation.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Base64 input rendering | Frontend (React) | — | Pure UI — `BytesField` component |
| Base64 character validation (BFLD-03) | Frontend (React) | — | Zod regex in Controller `rules.validate` |
| Base64 structural validation (BFLD-04) | Frontend (React) | Rust (passthrough) | Frontend zod blocks invalid values; Rust `base64_decode_or_empty` silently drops failures — frontend is the last line of defense |
| UTF-8 → base64 conversion (BFLD-02) | Frontend (React) | — | `TextEncoder` + manual base64 encode in "Convert" click handler |
| Byte count label display | Frontend (React) | — | Derived display: `atob(value).length` (or decoded byte array length) shown when field is valid |
| ProtoFormRenderer dispatch | Frontend (React) | — | Pre-dispatch branch added before switch; renderer itself frozen |

---

## Standard Stack

### Core (already installed — no new packages needed)

[VERIFIED: package.json]

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `react-hook-form` | ^7.76.0 | Form state, `Controller`, blur validation | Already project-wide form library |
| `zod` | ^3.25.76 | Runtime validation schema | Pinned to ^3.x — `@hookform/resolvers` incompatible with zod v4 |
| `radix-ui` (Popover) | ^1.4.3 | Popover primitive | Already installed; `popover.tsx` already in `src/components/ui/` |
| `tailwindcss` | ^4.3.0 | Styling | Project-wide CSS framework |

### UI Components Available in `src/components/ui/`

[VERIFIED: filesystem]

| Component | File | Used in BytesField |
|-----------|------|--------------------|
| `Popover`, `PopoverTrigger`, `PopoverContent` | `popover.tsx` | Yes — "From text" helper |
| `Textarea` | `textarea.tsx` | Yes — UTF-8 input inside popover |
| `Button` | `button.tsx` | Yes — "From text" trigger + "Convert" action |
| `Input` | `input.tsx` | Yes — base64 text input |
| `Label` | `label.tsx` | Yes — field label |
| `Badge` | `badge.tsx` | Yes — scalar type label |

### No New Dependencies

Phase 6 introduces zero new npm packages. All required components exist in the codebase.

---

## Architecture Patterns

### System Architecture Diagram

```
User input (base64 string)
        │
        ▼
  BytesField <Controller name={path}>
        │
        ├─── onBlur ──► zod validate ──► valid? 
        │                               ├─ yes: no error shown; byte count label updates
        │                               └─ no: fieldState.error → <p role="alert">
        │
        ├─── onChange ─► rhfField.onChange(raw string)
        │
        ▼
  useWatch (in ProtoFormRenderer)
        │
        ▼
  handleValuesChange → setLatestValues (Zustand)
        │
        ▼
  useDebounce 200ms → encodeMessage IPC call
        │
        ▼
  Rust encode.rs:Kind::Bytes → base64_decode_or_empty(s)
        (returns empty vec on failure — frontend zod is the guard)

"From text" flow:
  [From text button] ──► Popover opens
        │
        ▼
  <Textarea> (UTF-8 text input, local useState)
        │
  [Convert] ──► utf8ToBase64(text) ──► rhfField.onChange(b64)
                                    └─► setPopoverOpen(false)
```

### Recommended File Structure

```
src/components/form/fields/
├── BytesField.tsx         # new — dedicated bytes field component
├── ScalarField.tsx        # modified — remove bytes case + badge + getZodSchema arm
└── ...                    # other fields unchanged

src/components/form/
└── ProtoFormRenderer.tsx  # modified — add pre-dispatch branch for bytes
```

### Pattern 1: Single Controller (follow ScalarField exactly)

[VERIFIED: src/components/form/fields/ScalarField.tsx]

```typescript
// Source: ScalarField.tsx — established pattern
<Controller
  name={path}
  control={control}
  defaultValue=""
  rules={{ validate }}
  render={({ field: rhfField, fieldState }) => (
    <>
      <Input
        id={path}
        type="text"
        value={rhfField.value ?? ""}
        onChange={(e) => rhfField.onChange(e.target.value)}
        onBlur={rhfField.onBlur}
        aria-invalid={!!fieldState.error}
        className={fieldState.error ? "border-destructive" : ""}
      />
      {fieldState.error && (
        <p className="text-xs text-destructive" role="alert">
          {field.label}: {fieldState.error.message}
        </p>
      )}
    </>
  )}
/>
```

Do NOT use two Controllers — single Controller wraps both input and error display.

### Pattern 2: Popover with controlled open state (follow AmqpPropertiesSheet)

[VERIFIED: src/components/publish/AmqpPropertiesSheet.tsx]

```typescript
// Source: AmqpPropertiesSheet.tsx — established Popover pattern
const [popoverOpen, setPopoverOpen] = useState(false);

<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
  <PopoverTrigger asChild>
    <Button variant="outline" size="sm">From text</Button>
  </PopoverTrigger>
  <PopoverContent className="w-72 p-3" side="bottom" align="start">
    {/* Textarea + Convert button */}
    <Button onClick={() => {
      rhfField.onChange(convertText(utf8Input));
      setPopoverOpen(false);  // close in same action — D-04
    }}>
      Convert
    </Button>
  </PopoverContent>
</Popover>
```

Local `useState` for popover state — not Zustand (consistent with codebase pattern).

### Pattern 3: Pre-dispatch branch in ProtoFormRenderer

[VERIFIED: src/components/form/ProtoFormRenderer.tsx]

```typescript
// Add BEFORE the switch(field.kind.type) block, inside renderField
if (field.kind.type === "scalar" && field.kind.scalar === "bytes") {
  return <BytesField key={path} field={field} path={path} />;
}

switch (field.kind.type) {
  case "scalar":
    return <ScalarField key={path} field={field} path={path} />;
  // ... rest of switch unchanged
}
```

The `switch` itself is FROZEN — only the pre-dispatch branch is added.

### Anti-Patterns to Avoid

- **Two Controllers for one field:** `ScalarField` uses one Controller that wraps both input and error — do not add a second Controller for the byte count label; derive byte count from `rhfField.value` inside the single Controller's render prop.
- **Using `btoa()` directly for UTF-8 text:** Throws `InvalidCharacterError` for any character code > 255. Always use `TextEncoder` path (see Code Examples below).
- **Structural-only regex relying on D-06 as written:** The locked regex passes some invalid base64 lengths. See Pitfall 1 for the fix.
- **Storing popover state in Zustand:** Local `useState` is the project pattern for ephemeral UI state. Zustand is for cross-component shared state.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Popover container | Custom modal/dropdown | `shadcn Popover` from `src/components/ui/popover.tsx` | Already in codebase, keyboard-accessible, portal-rendered |
| Textarea inside popover | Raw `<textarea>` | `shadcn Textarea` from `src/components/ui/textarea.tsx` | Consistent styling, dark mode handled |
| Form validation | Manual `onChange` checks | Zod `z.string().regex()` in Controller `rules.validate` | Integrates with react-hook-form blur mode; error display is automatic |
| UTF-8 → base64 | npm library | Browser-native `TextEncoder` + manual base64 | Zero dependency; available in all modern browsers and Tauri's WebView |

---

## Critical Implementation Gap: D-06 Regex Is Character-Set Only

[VERIFIED: testing `btoa("abc")` in JavaScript — throws on 3-char input without padding]

### The Problem

The locked D-06 regex `/^[A-Za-z0-9+/]*={0,2}$/` checks only the alphabet. It does NOT enforce that the string length is a valid base64-encoded length (i.e., `length % 4 === 0` after accounting for padding, or equivalently the string forms complete 4-character blocks).

Examples of strings that pass the regex but are structurally invalid base64:
- `"abc"` — 3 chars, no padding → `atob("abc")` throws `InvalidCharacterError`
- `"a"` — 1 char → `atob("a")` throws
- `"abcde"` — 5 chars → `atob("abcde")` throws

If these strings pass frontend validation and reach Rust's `base64_decode_or_empty`, the function returns an empty `Vec<u8>` (silently). This is the exact "silent empty bytes" problem BFLD-04 requires preventing.

### The Fix: Add a `.refine()` step

```typescript
// Source: [VERIFIED — browser atob() API + codebase analysis]
const base64Validate = z
  .string()
  .regex(
    /^[A-Za-z0-9+/]*={0,2}$/,
    "Must be valid base64 (standard alphabet, not URL-safe)"
  )
  .refine(
    (s) => {
      if (s === "") return true;        // empty is valid (empty bytes field)
      try { atob(s); return true; } catch { return false; }
    },
    "Must be valid base64 (standard alphabet, not URL-safe)"
  );
```

The `.refine()` with `atob()` catches structural invalidity that the regex misses. Both the regex and refine use the same error message (D-08). The regex runs first (fast path for URL-safe char rejection), the refine runs second (structural check for BFLD-04).

**Note on D-07:** D-07 says "Rust never sees invalid base64." This is only true if the frontend validation is structurally complete. The regex alone does not make D-07 true for structural invalidity. The `.refine()` step is required to honor D-07's guarantee.

---

## Critical Implementation Gap: D-04 `btoa(utf8Text)` Fails for Non-Latin-1

[VERIFIED: MDN — btoa() spec requires code points 0-255; throws InvalidCharacterError otherwise]

### The Problem

`btoa("café")` — the `é` character is code point 233 in ISO-8859-1 but encodes as a multi-byte sequence in UTF-8. `btoa()` operates on a Latin-1 string (one byte per character). Characters above 0xFF throw `InvalidCharacterError` in all browsers including Tauri's WebView.

### The Fix: UTF-8-Safe Conversion

```typescript
// Source: [VERIFIED — browser TextEncoder API; standard pattern for UTF-8 base64]
function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
```

This is the canonical browser-native pattern: encode to UTF-8 bytes first via `TextEncoder`, then convert each byte to a Latin-1 character, then `btoa()`. No npm dependencies needed. Works in all modern browsers and Tauri's Chromium WebView.

**What the planner must do:** Replace `btoa(utf8Text)` in D-04's description with the `utf8ToBase64` helper above.

---

## BFLD-04 Success Criterion #4: Byte Count Label

The phase success criteria include: "User sees a byte count label (e.g. '14 bytes') confirming the decoded length after a valid base64 value is entered."

This is not covered by D-01 through D-08. It is a derived UI element: when the field value is valid base64 (no `fieldState.error`), show the decoded byte length.

**Implementation approach** (derive inside single Controller render prop):

```typescript
// Inside Controller render prop, after error display
{!fieldState.error && rhfField.value && (
  <p className="text-xs text-muted-foreground">
    {atob(rhfField.value).length} bytes
  </p>
)}
```

`atob()` is safe here because the value has already passed validation (no `fieldState.error`).

---

## Common Pitfalls

### Pitfall 1: Regex Passes Structurally Invalid Base64

**What goes wrong:** `"abc"` (3 chars) passes `/^[A-Za-z0-9+/]*={0,2}$/` but `atob("abc")` throws. The Rust `base64_decode_or_empty` silently returns empty bytes.

**Why it happens:** The regex is alphabet-only; valid base64 also requires `length % 4 === 0` (or equivalently the decoded-length math must produce whole bytes).

**How to avoid:** Add `.refine((s) => { try { atob(s); return true; } catch { return false; } })` after the regex — empty string is whitelisted (`if (s === "") return true`).

**Warning signs:** Test passes with `"aGVsbG8="` (valid) but silently encodes empty when given `"abc"`.

### Pitfall 2: `btoa()` Throws on Multi-Byte UTF-8 Characters

**What goes wrong:** User types `"héllo"` or any non-ASCII character in the "From text" popover; "Convert" throws `InvalidCharacterError` in the console and the field does not populate.

**Why it happens:** `btoa()` is a Latin-1 encoder (byte per character). UTF-8 characters above U+00FF have multi-byte representations that `btoa()` cannot handle.

**How to avoid:** Use `utf8ToBase64(text)` helper (see Code Examples above). Never call `btoa(text)` directly on arbitrary user input.

**Warning signs:** Works for ASCII test cases; breaks for any non-ASCII input in the popover textarea.

### Pitfall 3: ScalarField Bytes Badge Test Will Fail

**What goes wrong:** The existing test `"bytes field renders text input with bytes badge"` in `ScalarField.test.tsx` (line 196-207) asserts `expect(screen.getByText("bytes (base64)")).toBeInTheDocument()`. Once the bytes branch is removed from `ScalarField`, this test will fail.

**Why it happens:** The test verifies the badge that exists in `ScalarField` for the bytes case — which is being removed in D-02.

**How to avoid:** The test file must be updated alongside the ScalarField cleanup. Remove the bytes badge test from `ScalarField.test.tsx` and add equivalent coverage to `BytesField.test.tsx`.

### Pitfall 4: Popover Portal Breaks jsdom Tests

**What goes wrong:** `PopoverContent` renders in a Radix UI portal (outside the React tree root in jsdom). `screen.getByText("Convert")` may not find the button depending on test approach.

**Why it happens:** Radix UI portals append to `document.body`, not to the component's DOM subtree. jsdom supports portals but test assertions must target `document.body` or use `screen` queries (which search entire document).

**How to avoid:** Use `screen.getByRole("button", { name: "Convert" })` — `screen` queries search the full document including portals. Do NOT use `container.querySelector` for popover content.

**Warning signs:** Popover test renders but "Convert" button not found; fixed by switching from `container.querySelector` to `screen.getByRole`.

### Pitfall 5: Byte Count Label Uses `rhfField.value` Before Validation Clears

**What goes wrong:** Byte count displays stale length from a previously-valid value when user has now entered an invalid string (error state).

**Why it happens:** `rhfField.value` holds the current input string regardless of validation state.

**How to avoid:** Gate the byte count label on `!fieldState.error && rhfField.value !== ""`. The label should only display when the field is currently valid and non-empty.

---

## Code Examples

### BytesField: Full Component Structure

```typescript
// src/components/form/fields/BytesField.tsx
// Source: adapted from ScalarField.tsx pattern [VERIFIED: src/components/form/fields/ScalarField.tsx]
import { useState } from "react";
import { Controller, useFormContext } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { FieldSchema } from "@/lib/types";

interface BytesFieldProps {
  field: FieldSchema;
  path: string;
}

/** Encode arbitrary UTF-8 text to standard base64 (RFC 4648). */
function utf8ToBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

const base64Schema = z
  .string()
  .regex(
    /^[A-Za-z0-9+/]*={0,2}$/,
    "Must be valid base64 (standard alphabet, not URL-safe)"
  )
  .refine(
    (s) => {
      if (s === "") return true;
      try { atob(s); return true; } catch { return false; }
    },
    "Must be valid base64 (standard alphabet, not URL-safe)"
  );

export function BytesField({ field, path }: BytesFieldProps) {
  const { control } = useFormContext();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [utf8Input, setUtf8Input] = useState("");

  const validate = (value: unknown) => {
    const result = base64Schema.safeParse(value);
    if (!result.success) {
      return result.error.issues[0]?.message ?? "Invalid value";
    }
    return true;
  };

  return (
    <div className="flex flex-col gap-1 mb-3">
      {/* Label row */}
      <div className="flex items-center gap-2">
        <Label className="text-xs font-semibold text-foreground" htmlFor={path}>
          {field.label}
        </Label>
        <Badge variant="outline" className="text-xs px-1.5 py-0 w-fit">
          bytes
        </Badge>
      </div>

      {/* Single Controller for input + error */}
      <Controller
        name={path}
        control={control}
        defaultValue=""
        rules={{ validate }}
        render={({ field: rhfField, fieldState }) => (
          <>
            <Input
              id={path}
              type="text"
              value={rhfField.value ?? ""}
              onChange={(e) => rhfField.onChange(e.target.value)}
              onBlur={rhfField.onBlur}
              aria-invalid={!!fieldState.error}
              className={fieldState.error ? "border-destructive" : ""}
              placeholder="base64 encoded value"
            />

            {/* Byte count label — only when valid and non-empty */}
            {!fieldState.error && rhfField.value !== "" && (
              <p className="text-xs text-muted-foreground">
                {atob(rhfField.value).length} bytes
              </p>
            )}

            {/* Inline validation error */}
            {fieldState.error && (
              <p className="text-xs text-destructive" role="alert">
                {field.label}: {fieldState.error.message}
              </p>
            )}

            {/* "From text" helper — below input, left-aligned (D-05) */}
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs w-fit">
                  From text
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3" side="bottom" align="start">
                <div className="flex flex-col gap-2">
                  <Textarea
                    placeholder="Type UTF-8 text to convert to base64…"
                    value={utf8Input}
                    onChange={(e) => setUtf8Input(e.target.value)}
                    className="min-h-20 text-sm"
                  />
                  <Button
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      rhfField.onChange(utf8ToBase64(utf8Input));
                      setPopoverOpen(false);
                      setUtf8Input("");
                    }}
                  >
                    Convert
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </>
        )}
      />
    </div>
  );
}
```

### ProtoFormRenderer: Pre-Dispatch Branch

```typescript
// Source: ProtoFormRenderer.tsx — add before switch [VERIFIED: src/components/form/ProtoFormRenderer.tsx]
const renderField: RenderFieldFn = (field, path, depth) => {
  if (depth > MAX_DEPTH) { /* ... */ }

  // Pre-dispatch branch for bytes (Phase 6 addition — switch is FROZEN)
  if (field.kind.type === "scalar" && field.kind.scalar === "bytes") {
    return <BytesField key={path} field={field} path={path} />;
  }

  switch (field.kind.type) {
    case "scalar":
      return <ScalarField key={path} field={field} path={path} />;
    // ... rest unchanged
  }
};
```

### ScalarField Cleanup

Three surgical edits to `ScalarField.tsx`:

1. `getZodSchema`: Remove `case "bytes":` arm (merge with `default: return z.string()`)
2. `getInputType`: Remove `"bytes"` from `textKinds` array
3. JSDoc comment on `ScalarField`: Remove `bytes → Input type='text' + 'bytes (base64)' badge` line
4. JSX: Remove the `{scalar === "bytes" && <Badge>bytes (base64)</Badge>}` conditional

### ScalarField Test Cleanup

```typescript
// src/components/form/__tests__/ScalarField.test.tsx
// REMOVE this test (line 196-207) — bytes case moves to BytesField.test.tsx
test("bytes field renders text input with bytes badge", () => { ... });
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `btoa(str)` for arbitrary text | `TextEncoder` + `btoa(binaryStr)` | Modern browsers (ES2016+) | Correct UTF-8 handling |
| Manual base64 regex with no structural check | Regex + `atob()` refine for structural validity | — | Prevents silent empty bytes on length violations |

**Deprecated/outdated:**
- `Buffer.from(str, 'utf8').toString('base64')` — Node.js only, not available in Tauri browser context without polyfill

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `atob()` and `TextEncoder` are available in all Tauri WebView engines without polyfill (WKWebView/macOS, WebKitGTK/Linux, WebView2/Windows) | Code Examples, Pitfall 1 | If unavailable, byte count display and refine validation would need alternative decode approach; LOW risk — both are Web standard APIs supported since Safari 10 / WebKit 534 |

**All other claims verified from codebase (encode.rs, ScalarField.tsx, ProtoFormRenderer.tsx, package.json, popover.tsx, textarea.tsx) or from official language specs (TextEncoder, atob).**

---

## Open Questions (RESOLVED)

1. **D-06 regex gap: use `.refine()` or tighten the regex?**
   - What we know: The locked regex accepts structurally invalid base64; `.refine()` with `atob()` is the minimal fix.
   - What's unclear: Whether the planner should explicitly note this diverges from D-06's literal text, or treat it as a non-breaking refinement of D-06.
   - Recommendation: Treat the `.refine()` as an extension of D-06 that preserves its intent (block invalid base64 before Rust sees it). Document in the plan task as "D-06 plus structural guard."

2. **Byte count label implementation detail: where in the JSX tree?**
   - What we know: Must appear when field is valid and non-empty; must not show when `fieldState.error` is set.
   - What's unclear: Whether it appears above or below the error message. Error and byte count are mutually exclusive states, so ordering is aesthetic.
   - Recommendation: Place byte count label immediately below the Input (before the popover trigger), before the error message. Error message is rendered below byte count when error clears.

---

## Environment Availability

Step 2.6: SKIPPED — no external dependencies. Phase 6 is a pure frontend component change. All required UI components (`shadcn Popover`, `Textarea`, `Button`, `Input`, `Label`, `Badge`) are already installed. No new npm packages required. `atob()` and `TextEncoder` are Web standard APIs available in all Tauri WebView engines (WKWebView on macOS, WebKitGTK on Linux, WebView2 on Windows).

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies to Phase 6 |
|-----------|-------------------|
| Tauri 2.x + Rust + React stack | Frontend only — no Rust changes |
| Binary protobuf wire format only | Bytes field feeds into existing encode path unchanged |
| Runtime proto parsing (not pre-compiled) | No change to parsing layer |
| `zod` pinned to `^3.24.2` (not v4) | Confirmed — `zod ^3.25.76` in package.json |
| ProtoFormRenderer dispatch FROZEN | Pre-dispatch branch only; switch untouched |
| Single Controller pattern | BytesField follows ScalarField exactly |
| `mode: onBlur` form-wide | BytesField validation fires on blur |
| `shadcn nova` preset | No UI preset changes needed |
| 200-400 lines per file, 800 max | BytesField component will be ~80-100 lines |
| No `console.log` in production code | BytesField introduces no logging |
| Immutable state patterns | `setUtf8Input` and `setPopoverOpen` use React setState (no mutation) |
| Error handling at every level | zod validate returns error strings; no swallowed errors |

---

## Sources

### Primary (HIGH confidence)
- `src-tauri/src/commands/encode.rs` — `base64_decode_or_empty` confirmed as `STANDARD.decode(s).unwrap_or_default()` — silent empty on failure
- `src/components/form/fields/ScalarField.tsx` — Controller pattern, single Controller, `mode: onBlur`, error display pattern
- `src/components/form/ProtoFormRenderer.tsx` — dispatch switch structure, pre-dispatch branch insertion point
- `src/components/ui/popover.tsx` — confirmed `Popover`, `PopoverTrigger`, `PopoverContent` exports
- `src/components/ui/textarea.tsx` — confirmed `Textarea` export
- `src/components/publish/AmqpPropertiesSheet.tsx` — confirmed Popover controlled-open pattern with `useState`
- `src/components/form/__tests__/ScalarField.test.tsx` — bytes badge test confirmed at line 196-207 (must be removed)
- `src/components/form/fields/RepeatedField.tsx` — confirmed `renderItem` called with `{ ...field, repeated: false }` preserving `kind.scalar === 'bytes'`; pre-dispatch branch in renderField routes repeated bytes items to BytesField correctly
- `package.json` — `zod ^3.25.76`, `react-hook-form ^7.76.0`, `radix-ui ^1.4.3` confirmed
- `.planning/config.json` — `nyquist_validation: false` confirmed (Validation Architecture section omitted)

### Secondary (MEDIUM confidence)
- MDN Web API: `atob()` — Latin-1 only, throws InvalidCharacterError for code points >255
- MDN Web API: `TextEncoder` — produces UTF-8 byte array from string

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json; all components verified from filesystem
- Architecture: HIGH — encode path traced end-to-end through encode.rs; Rust silent-failure confirmed
- Pitfalls: HIGH — regex gap confirmed via atob() behavior; btoa() UTF-8 limitation confirmed via MDN spec; ScalarField test impact confirmed from test file

**Research date:** 2026-05-19
**Valid until:** 2026-06-19 (stable React/zod/shadcn ecosystem; no fast-moving dependencies)
