# Phase 6: BytesField - Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 5 (2 new, 3 modified)
**Analogs found:** 4 / 5 (1 partial — popover test has no codebase analog)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/form/fields/BytesField.tsx` | component (field) | request-response | `src/components/form/fields/ScalarField.tsx` | exact |
| `src/components/form/__tests__/BytesField.test.tsx` | test | — | `src/components/form/__tests__/ScalarField.test.tsx` | exact |
| `src/components/form/ProtoFormRenderer.tsx` (modify) | component (dispatcher) | request-response | `src/components/form/ProtoFormRenderer.tsx` itself | self — add pre-dispatch branch only |
| `src/components/form/fields/ScalarField.tsx` (modify) | component (field) | request-response | self — surgical removal only | self |
| `src/components/form/__tests__/ScalarField.test.tsx` (modify) | test | — | self — remove one test | self |

---

## Pattern Assignments

### `src/components/form/fields/BytesField.tsx` (new — component, request-response)

**Analog:** `src/components/form/fields/ScalarField.tsx`

**Imports pattern** (`ScalarField.tsx` lines 1–7):
```typescript
import { Controller, useFormContext } from "react-hook-form";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { FieldSchema, ScalarKind } from "@/lib/types";
```

BytesField drops `Checkbox` and `ScalarKind`; adds `useState`, `Button`, `Textarea`,
`Popover` / `PopoverContent` / `PopoverTrigger` from `@/components/ui/`.

**Props interface pattern** (`ScalarField.tsx` lines 9–13):
```typescript
interface ScalarFieldProps {
  field: FieldSchema;
  /** Field path in the form value tree — matches ProtoFormRenderer callsite: `path` */
  path: string;
}
```

BytesField uses the identical two-prop signature: `{ field: FieldSchema; path: string }`.

**Zod validate helper pattern** (`ScalarField.tsx` lines 125–131):
```typescript
const validate = (value: unknown) => {
  const result = zodSchema.safeParse(value);
  if (!result.success) {
    return result.error.issues[0]?.message ?? "Invalid value";
  }
  return true;
};
```

BytesField uses the same `validate` function shape but against the bytes-specific `base64Schema`
(regex + `.refine()` — see RESEARCH.md Code Examples for the full schema).

**Outer wrapper + label row pattern** (`ScalarField.tsx` lines 133–151):
```typescript
return (
  <div className="flex flex-col gap-1 mb-3">
    {/* Label row with scalar type badge */}
    <div className="flex items-center gap-2">
      <Label
        className="text-xs font-semibold text-foreground"
        htmlFor={path}
      >
        {field.label}
      </Label>
      <Badge variant="outline" className="text-xs px-1.5 py-0 w-fit">
        {scalar}
      </Badge>
      {scalar === "bytes" && (
        <Badge variant="secondary" className="text-xs px-1.5 py-0">
          bytes (base64)
        </Badge>
      )}
    </div>
```

BytesField copies the outer `div` and label row exactly. The type badge renders `bytes`
(`variant="outline"`) only — no secondary badge (D-02 removes the "bytes (base64)" hint).

**Single Controller + Input + error pattern** (`ScalarField.tsx` lines 153–194):
```typescript
<Controller
  name={path}
  control={control}
  defaultValue={defaultValue}
  rules={{ validate }}
  render={({ field: rhfField, fieldState }) => (
    <>
      <Input
        id={path}
        type={inputType}
        value={rhfField.value ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          if (inputType === "number") {
            rhfField.onChange(raw === "" ? "" : Number(raw));
          } else {
            rhfField.onChange(raw);
          }
        }}
        onBlur={rhfField.onBlur}
        aria-invalid={!!fieldState.error}
        className={fieldState.error ? "border-destructive" : ""}
      />

      {/* Inline validation error (FORM-06) */}
      {fieldState.error && (
        <p className="text-xs text-destructive" role="alert">
          {field.label}: {fieldState.error.message}
        </p>
      )}
    </>
  )}
/>
```

BytesField uses this pattern verbatim for the Input (type always `"text"`, no number branch).
Inside the same render prop, add the byte count label (`!fieldState.error && value !== "" ...`)
and the Popover trigger below the error — all within the single Controller render prop.
**Never add a second Controller.**

**Controlled-open Popover pattern** (`src/components/publish/AmqpPropertiesSheet.tsx` lines 44–45, 209–266):
```typescript
// Local state — not Zustand (lines 44–45)
const [headerPopoverOpen, setHeaderPopoverOpen] = useState(false);
const [newHeaderKey, setNewHeaderKey] = useState("");

// Popover with controlled open + action that closes on commit (lines 209–266)
<Popover
  open={headerPopoverOpen}
  onOpenChange={setHeaderPopoverOpen}
>
  <PopoverTrigger asChild>
    <Button variant="outline" size="sm" className="mt-1 text-xs">
      Add Header
    </Button>
  </PopoverTrigger>
  <PopoverContent
    className="w-64 p-3"
    side="bottom"
    align="start"
  >
    <div className="flex flex-col gap-2">
      <Input
        placeholder="Header key"
        value={newHeaderKey}
        onChange={(e) => setNewHeaderKey(e.target.value)}
        className="h-7 text-xs"
      />
      <Button
        size="sm"
        className="text-xs"
        onClick={() => {
          // ... commit action ...
          setHeaderPopoverOpen(false);   // close in same handler
        }}
      >
        Add Header
      </Button>
    </div>
  </PopoverContent>
</Popover>
```

BytesField replaces `Input` inside the popover with `Textarea`, renames local state
(`popoverOpen` / `utf8Input`), and calls `rhfField.onChange(utf8ToBase64(utf8Input))` before
`setPopoverOpen(false)`. The `Textarea` placeholder is `"Type UTF-8 text to convert to base64…"`.
Popover width is `w-72` (288px). Button label is `"From text"` / `"Convert"`.

---

### `src/components/form/__tests__/BytesField.test.tsx` (new — test)

**Analog:** `src/components/form/__tests__/ScalarField.test.tsx`

**Test wrapper pattern** (`ScalarField.test.tsx` lines 11–24):
```typescript
function renderField(schema: FieldSchema) {
  const Wrapper = () => {
    const methods = useForm({
      defaultValues: { [schema.name]: schema.default_value },
      mode: "onBlur",
    });
    return (
      <FormProvider {...methods}>
        <ScalarField field={schema} path={schema.name} />
      </FormProvider>
    );
  };
  return render(<Wrapper />);
}
```

BytesField test replaces `ScalarField` with `BytesField`. The `mode: "onBlur"` must be
preserved — it controls when validation fires.

**Blur validation test pattern** (`ScalarField.test.tsx` lines 211–226):
```typescript
test("int32 shows validation error on out-of-range value", async () => {
  const user = userEvent.setup();
  renderField({ ... });
  const input = screen.getByRole("spinbutton");
  await user.clear(input);
  await user.type(input, "9999999999");
  await user.tab(); // trigger blur validation
  expect(await screen.findByRole("alert")).toBeInTheDocument();
});
```

BytesField tests use `screen.getByRole("textbox")`, `await user.type(...)`,
`await user.tab()`, then `await screen.findByRole("alert")`. Tests to cover:

1. Renders a textbox with `placeholder="base64 encoded value"`
2. Renders the `bytes` badge (label `"bytes"`) — confirms the `variant="outline"` badge
3. Valid base64 input shows byte count label (`{n} bytes`) after blur — use `"aGVsbG8="` (5 bytes)
4. Invalid base64 (URL-safe char `"abc-def"`) shows alert after blur
5. Structurally invalid base64 (`"abc"` — 3 chars, no padding) shows alert after blur
6. Empty string is valid (no alert)
7. "From text" button is visible (`screen.getByRole("button", { name: "From text" })`)
8. Clicking "From text" opens popover; clicking "Convert" fills field and closes popover

For test 8, use `screen.getByRole("button", { name: "Convert" })` — `screen` queries
search the full document including Radix portals. Do **not** use `container.querySelector`
for popover content (see Pitfall 4 in RESEARCH.md).

---

### `src/components/form/ProtoFormRenderer.tsx` (modify — add pre-dispatch branch)

**Analog:** self — add 3 lines before the existing `switch`

**Insertion point** (`ProtoFormRenderer.tsx` lines 144–148):
```typescript
switch (field.kind.type) {
  case "scalar":
    return (
      <ScalarField key={path} field={field} path={path} />
    );
```

Add the pre-dispatch branch immediately before line 144:
```typescript
// Phase 6: bytes fields bypass ScalarField (D-01)
if (field.kind.type === "scalar" && field.kind.scalar === "bytes") {
  return <BytesField key={path} field={field} path={path} />;
}
```

Also add to the import block (lines 1–9):
```typescript
import { BytesField } from "./fields/BytesField";
```

The `switch` body itself is FROZEN — no other lines in `ProtoFormRenderer.tsx` change.

---

### `src/components/form/fields/ScalarField.tsx` (modify — surgical bytes removal)

**Analog:** self — 4 surgical cuts

**Cut 1 — getZodSchema bytes case** (lines 63–65):
```typescript
// REMOVE: the bytes case is now handled by BytesField
case "string":
case "bytes":     // <-- remove "bytes" from this case group
default:
  return z.string();
```
After removal, `case "string":` falls through to `default:` alone.

**Cut 2 — getInputType textKinds array** (lines 75–83):
```typescript
const textKinds: ScalarKind[] = [
  "int64",
  "uint64",
  "sint64",
  "fixed64",
  "sfixed64",
  "string",
  "bytes",   // <-- remove this line
];
```

**Cut 3 — JSDoc on ScalarField** (lines 103–110):
```
 *   bytes          → Input type="text" + "bytes (base64)" badge   ← remove this line
```

**Cut 4 — secondary bytes badge in JSX** (lines 146–150):
```typescript
{scalar === "bytes" && (
  <Badge variant="secondary" className="text-xs px-1.5 py-0">
    bytes (base64)
  </Badge>
)}
```
Remove the entire conditional block (4 lines).

---

### `src/components/form/__tests__/ScalarField.test.tsx` (modify — remove bytes test)

**Analog:** self — remove one test block

**Lines to remove** (lines 194–207):
```typescript
// ─── bytes ───────────────────────────────────────────────────────────────────

test("bytes field renders text input with bytes badge", () => {
  renderField({
    name: "data",
    label: "data",
    kind: { type: "scalar", scalar: "bytes" },
    repeated: false,
    default_value: "",
  });
  expect(screen.getByRole("textbox")).toBeInTheDocument();
  // The "bytes (base64)" badge annotation must be present
  expect(screen.getByText("bytes (base64)")).toBeInTheDocument();
});
```

Remove the section comment and the entire `test(...)` block. Equivalent coverage moves
to `BytesField.test.tsx` (renders textbox + `bytes` badge).

---

## Shared Patterns

### Controller + FormProvider test harness
**Source:** `src/components/form/__tests__/ScalarField.test.tsx` lines 11–24
**Apply to:** `BytesField.test.tsx`

The `renderField` wrapper function with `FormProvider` + `useForm({ mode: "onBlur" })`
is the universal field test harness in this codebase. Copy it verbatim, substituting
the target component name.

### Error display format
**Source:** `src/components/form/fields/ScalarField.tsx` lines 186–190
**Apply to:** `BytesField.tsx`
```typescript
{fieldState.error && (
  <p className="text-xs text-destructive" role="alert">
    {field.label}: {fieldState.error.message}
  </p>
)}
```
Format is always `{field.label}: {errorMessage}` — never message alone.

### Zod safeParse validate adapter
**Source:** `src/components/form/fields/ScalarField.tsx` lines 125–131
**Apply to:** `BytesField.tsx`

The `validate` function signature and body (safeParse + first issue message + `return true`)
is the project standard for react-hook-form `rules.validate`. Deviation breaks error display.

### Popover controlled-open with local useState
**Source:** `src/components/publish/AmqpPropertiesSheet.tsx` lines 44–45, 209–214
**Apply to:** `BytesField.tsx`

All ephemeral UI state (popover open/close, transient input values) lives in component-local
`useState`. Zustand stores are for cross-component shared state only.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `BytesField.test.tsx` — popover/portal interaction tests | test | — | No existing test in the codebase exercises a Radix UI `Popover`. `AmqpPropertiesSheet.tsx` uses Popover but has no test file. Use Pitfall 4 guidance from RESEARCH.md: `screen.getByRole(...)` queries span the full document including portals; never use `container.querySelector` for popover content. |

---

## Metadata

**Analog search scope:** `src/components/form/fields/`, `src/components/form/__tests__/`, `src/components/publish/`, `src/components/ui/`
**Files scanned:** 9 (ScalarField, ProtoFormRenderer, AmqpPropertiesSheet, popover.tsx, ScalarField.test, EnumField.test, ProtoFormRenderer.test, types.ts, plus directory listing)
**Pattern extraction date:** 2026-05-19
