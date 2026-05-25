---
estimated_steps: 8
estimated_files: 4
skills_used: []
---

# T03: Wired Cmd+O file open and Cmd+1/2/3 tab switch shortcuts in AppLayout, with platform-correct tooltips on RightPanel tabs

Why: R002 (Cmd+O open) and R004 (Cmd+1/2/3 tabs) complete the keyboard-first navigation. Both live in AppLayout since they cross component boundaries. RightPanel's activeTab is local state that must be exposed via callback prop. FileSection's handleOpenFile must be callable from AppLayout.

Do:
1. RightPanel.tsx: Add `onTabChange?: (tab: string) => void` prop. Add `useImperativeHandle` or simpler: add `tabRef?: React.MutableRefObject<((tab: string) => void) | null>` prop, assign `setActiveTab` to ref on mount. OR: simpler approach — accept `externalTab` prop and sync via useEffect. Choose simplest: add `setActiveTabRef` as a ref prop that AppLayout passes down.
2. FileSection.tsx: Expose handleOpenFile via a ref prop or hoist the open-file logic to useProtoStore as a `triggerOpenFile` signal (simpler: use a ref callback).
3. AppLayout.tsx: Create refs for setActiveTab and handleOpenFile. Pass to RightPanel and FileSection/Sidebar respectively. Add useHotkeys: 'mod+o' → calls handleOpenFile ref, 'mod+1' → setActiveTab('hex'), 'mod+2' → setActiveTab('history'), 'mod+3' → setActiveTab('response'). All with preventDefault: true.
4. RightPanel.tsx: Add tooltips to tab triggers showing platform-branched shortcut labels (⌘1/⌘2/⌘3 or Ctrl+1/2/3).
5. Write tests: AppLayout shortcut registration, RightPanel tab change via ref.

Done when: Cmd+O opens file picker, Cmd+1/2/3 switches tabs, tab triggers show shortcut tooltips, tests pass, tsc clean.

## Inputs

- `src/components/layout/AppLayout.tsx`
- `src/components/layout/RightPanel.tsx`
- `src/components/sidebar/FileSection.tsx`
- `src/hooks/usePlatformLabel.ts`

## Expected Output

- `src/components/layout/AppLayout.tsx`
- `src/components/layout/RightPanel.tsx`
- `src/components/sidebar/FileSection.tsx`

## Verification

pnpm tsc --noEmit && pnpm vitest run src/components/layout/RightPanel.test.tsx
