---
estimated_steps: 12
estimated_files: 2
skills_used: []
---

# T02: Build SchemaExplorer component and wire into Sidebar

**Why:** R025 requires a collapsible tree showing all messages, fields, and enums. R026 requires recursive type safety with depth cap and visited-set guard.

**Do:**
1. Create `src/components/sidebar/SchemaExplorer.tsx` with these node types:
   - **MessageNode**: collapsible, shows icon (FileText) + message name + field count badge. Clicking the name calls `setSelectedType(full_name)`. Expanding shows FieldNodes.
   - **FieldNode**: shows field name, type badge (Badge variant='outline' with scalar type / message short name / 'enum'), field_number in muted text, repeated/map indicator. If kind is message, renders as expandable — resolves via `schema.message_map[full_name]` and recurses.
   - **EnumNode**: collapsible under 'Enums' section header, shows icon (List) + enum name + value count badge. Expanding shows `name = number` per value.
   - **OneofNode**: expandable, shows branches with their fields.
   - **Recursive guard**: maintain a `Set<string>` of message full_names on the current render stack. When a message type is already in the set, render '(recursive)' label instead of expanding. Also enforce `MAX_DEPTH = 5` as secondary guard.
2. Use existing shadcn components: `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` for expand/collapse; `ScrollArea` for overflow; `Badge` for type badges.
3. Use `text-xs` for compact rendering, `ml-3` per depth level for indentation.
4. Wire into `src/components/sidebar/Sidebar.tsx`: import SchemaExplorer, render between the message type Select and the ConnectionSection Separator (after line 83's closing fragment, before line 86's Separator). Wrap in a conditional on `schema && schema.messages.length > 0` (same guard as the message selector).

**Done when:** Component renders in the sidebar showing messages and enums from store schema. Recursive types show '(recursive)' instead of infinite expansion. Click on message name changes selected type.

## Inputs

- `src/lib/types.ts`
- `src/stores/useProtoStore.ts`
- `src/components/ui/collapsible.tsx`
- `src/components/ui/scroll-area.tsx`
- `src/components/sidebar/Sidebar.tsx`

## Expected Output

- `src/components/sidebar/SchemaExplorer.tsx`
- `src/components/sidebar/Sidebar.tsx`

## Verification

pnpm tsc --noEmit && pnpm vitest run
