---
estimated_steps: 8
estimated_files: 6
skills_used: []
---

# T01: Installed react-hotkeys-hook, extracted usePlatformLabel hook from Sidebar.tsx, and created CopyButton component with clipboard + icon-swap feedback

Why: All shortcuts and copy icons depend on react-hotkeys-hook and shared utilities. The usePlatformLabel hook extracts the isMac pattern already in Sidebar.tsx line 21 into a reusable hook for tooltip labels. The CopyButton component encapsulates the identical hover-reveal copy icon pattern needed by 3 field types.

Do:
1. Run `pnpm add react-hotkeys-hook@^5`
2. Create `src/hooks/usePlatformLabel.ts` — export `usePlatformLabel()` returning `{ isMac, mod, modSymbol }` where mod='Cmd'/'Ctrl', modSymbol='⌘'/'Ctrl'. Use the regex from Sidebar.tsx line 21.
3. Refactor Sidebar.tsx to import from usePlatformLabel instead of inline isMac.
4. Create `src/components/form/fields/CopyButton.tsx` — receives `value: string` prop. Renders a button with Copy icon, opacity-0 by default (parent must have `group` class). On click: `navigator.clipboard.writeText(value)`, swap icon to Check for 1500ms via useState+useEffect timer. Wrap in Tooltip showing 'Copy value'. Catch clipboard errors and show toast via sonner.
5. Write unit tests for CopyButton (icon swap, clipboard call) and usePlatformLabel (Mac vs non-Mac).

Done when: react-hotkeys-hook is in package.json, usePlatformLabel hook works, CopyButton renders with icon swap, tests pass, tsc clean.

## Inputs

- `src/components/sidebar/Sidebar.tsx`
- `package.json`

## Expected Output

- `src/hooks/usePlatformLabel.ts`
- `src/components/form/fields/CopyButton.tsx`
- `src/hooks/__tests__/usePlatformLabel.test.ts`
- `src/components/form/__tests__/CopyButton.test.tsx`

## Verification

pnpm tsc --noEmit && pnpm vitest run src/hooks/__tests__/usePlatformLabel.test.ts src/components/form/__tests__/CopyButton.test.tsx
