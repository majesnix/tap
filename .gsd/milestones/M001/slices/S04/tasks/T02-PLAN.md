---
estimated_steps: 13
estimated_files: 2
skills_used: []
---

# T02: Created generateRandomValues utility handling all proto field types and FieldTooltip component showing type/field number/cardinality on hover

**Why:** The randomizer (R008, R009) is a pure function that generates type-appropriate values for all proto field types. The FieldTooltip (R024) shows proto metadata on hover. Both are new standalone artifacts with no UI wiring yet.

**Do:**
1. Create `src/lib/randomizer.ts` with `generateRandomValues(message: MessageSchema, messageMap: Record<string, MessageSchema>, dirtyFields?: Record<string, boolean>): Record<string, unknown>`
   - Handle all FieldKind variants: scalar (bool, string, bytes, all int types, float/double), enum (random valid value number from values[]), message (recurse with depth cap at 5), well_known (Timestamp → ISO string, Duration → seconds string), oneof (pick random branch, fill fields, set _selected), map (1-3 random entries as [{key, value}] array), repeated (1-3 random items)
   - 64-bit integers as strings (match buildDefaultValues convention)
   - Skip fields where dirtyFields[fieldName] is truthy
   - At depth 5, nested messages return {} (match ProtoFormRenderer.MAX_DEPTH)
2. Create `src/components/form/fields/FieldTooltip.tsx`
   - Wraps children with Radix Tooltip from `@/components/ui/tooltip`
   - Props: `field: FieldSchema` + `children: React.ReactNode`
   - Content format: `"int32 · field 3 · optional"` — shows scalar/enum/message type, field number (omit if 0 for oneof groups), cardinality (repeated/map/optional per D011)
   - Use TooltipProvider with delayDuration 300ms

**Done when:** `pnpm tsc --noEmit` passes. Both files exist and export their public API.

## Inputs

- `src/lib/types.ts`
- `src/components/ui/tooltip.tsx`
- `src/components/form/ProtoFormRenderer.tsx`

## Expected Output

- `src/lib/randomizer.ts`
- `src/components/form/fields/FieldTooltip.tsx`

## Verification

cd /Users/majesnix/gits/proto-sender/.gsd/worktrees/M001 && pnpm tsc --noEmit
