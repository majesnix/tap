---
status: complete
phase: 06-bytesfield
source: [06-01-SUMMARY.md]
started: 2026-05-19T09:10:00Z
updated: 2026-05-19T09:30:00Z
---

## Current Test

[testing complete]

## Tests

### 1. BytesField renders for bytes scalar fields
expected: Load a .proto file that contains a `bytes` field (e.g. `bytes payload = 1;`). Navigate to the form. The bytes field should render a dedicated input labelled with a "bytes" badge — NOT a plain text input like string fields. It should look visually distinct from other scalar fields.
result: pass

### 2. Valid base64 shows byte count
expected: In the bytes field input, type or paste a valid standard base64 string such as `aGVsbG8=` (the base64 encoding of "hello"). After typing/pasting, a label below the input should appear showing `5 bytes` (the decoded byte length). No error message should be visible.
result: pass

### 3. URL-safe base64 characters are rejected
expected: In the bytes field input, type a value that includes URL-safe base64 characters such as `abc-def_` (using `-` or `_` instead of `+` or `/`). Tab out of the field (blur). An inline error should appear: "Must be valid base64 (standard alphabet, not URL-safe)". No byte count label should appear.
result: pass

### 4. Structurally invalid base64 is rejected
expected: In the bytes field input, type `abc` (3 characters, not a valid base64 group — missing padding). Tab out (blur). An inline error should appear indicating invalid base64. The field should block submission; the user should NOT see an empty bytes value silently accepted.
result: pass

### 5. "From text" popover converts UTF-8 text to base64
expected: Click the "From text" button below the bytes input. A popover or panel should open with a text area. Type any UTF-8 text (e.g. `hello` or even `café` with a non-ASCII character). Click "Convert". The popover should close automatically, and the bytes field should be populated with the base64-encoded value (e.g. `aGVsbG8=` for "hello"). The byte count label should update to reflect the converted value.
result: pass

### 6. Empty bytes field is valid (no spurious error)
expected: Leave the bytes field completely empty. Tab out (blur). No error message should appear — an empty bytes field is valid and should not show any inline error. The form should allow submission with the empty field.
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none]
