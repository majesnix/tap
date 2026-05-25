# S04: Randomizer + Field Type Tooltips — UAT

**Milestone:** M001
**Written:** 2026-05-25T20:57:18.629Z

# S04: Randomizer + Field Type Tooltips — UAT

**Milestone:** M001
**Written:** 2026-05-25

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: All features are covered by 23 dedicated tests (randomizer unit tests, FieldTooltip component tests, FormPanel integration tests) plus full 616-test regression suite. No live runtime required — form behavior is fully testable via jsdom.

## Preconditions

- Proto file loaded with at least one message type selected
- Form rendered with fields visible

## Smoke Test

Click the Randomize button (Dices icon) in the FormPanel header. All empty fields should populate with values appropriate to their proto type.

## Test Cases

### 1. Randomize fills empty fields

1. Load a proto file with multiple field types (scalar, enum, bytes, nested, map, repeated)
2. Leave all fields empty
3. Click the Randomize button
4. **Expected:** All fields populate with type-appropriate random values — strings get random text, enums get valid enum values, bytes get base64-encoded data, int64/uint64 get string representations

### 2. Randomize preserves dirty fields

1. Load a proto file and manually fill in 2-3 fields
2. Click the Randomize button
3. **Expected:** Manually-filled fields retain their values; only empty fields get random values

### 3. FieldTooltip displays proto metadata

1. Load a proto file with various field types
2. Hover over a scalar field label
3. **Expected:** Tooltip appears showing proto type (e.g. "string"), field number (e.g. "1"), and cardinality (e.g. "optional")

### 4. FieldTooltip for enum field

1. Hover over an enum field label
2. **Expected:** Tooltip shows enum type name, field number, and cardinality

### 5. FieldTooltip for repeated field

1. Hover over a repeated field label
2. **Expected:** Tooltip shows element type, field number, and cardinality "repeated"

### 6. FieldTooltip for map field

1. Hover over a map field label
2. **Expected:** Tooltip shows map key/value types, field number, and cardinality

### 7. FieldTooltip hides field number for synthetic fields

1. Hover over a oneof group label
2. **Expected:** Tooltip shows type and cardinality but omits field number (since synthetic oneof groups have field_number 0)

## Edge Cases

### Deeply nested message randomization

1. Load a proto with 6+ levels of message nesting
2. Click Randomize
3. **Expected:** Nested messages populate up to depth 5; deeper levels remain empty (depth cap prevents stack overflow)

### All fields already dirty

1. Manually fill every field in the form
2. Click Randomize
3. **Expected:** No fields change — all are considered dirty and preserved

### Proto with only enum fields

1. Load a proto where all fields are enums
2. Click Randomize
3. **Expected:** Each enum field gets a valid value from its defined enum values (never an invalid numeric value)

## Failure Signals

- Randomize button click produces no visible change in fields
- Tooltip does not appear on hover after 300ms delay
- Tooltip shows "0" for field number on non-synthetic fields
- Random enum values show numeric indices instead of enum names
- Random bytes values are not valid base64

## Not Proven By This UAT

- Visual tooltip positioning and styling (requires live browser)
- Draft persistence of randomized values across app restart (covered by S03 UAT)
- Performance with very large proto schemas (100+ fields)

## Notes for Tester

- The Randomize button uses a Dices icon and is positioned between the Clear button and JSON toggle in the FormPanel header
- Tooltip delay is 300ms — hover and wait briefly before expecting content
- Radix Tooltip renders text in both a visible div and a screen-reader span — test assertions use findAllByText to handle this
