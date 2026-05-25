---
estimated_steps: 8
estimated_files: 1
skills_used: []
---

# T03: Added connection quick-switch dropdown in PublishBar with colored status dot, profile loading on mount, and plan-run guard that blocks switching with toast warning

Why: R017 requires profile switching from publish bar without opening sidebar. R018 requires blocking switch during plan execution.

Do:
1. In PublishBar, add a compact Select dropdown at the far left (before mode RadioGroup) showing profile names from useConnectionStore.profiles.
2. On mount, if profiles.length === 0, call listProfiles() and setProfiles() to ensure profiles are available even if sidebar was never opened.
3. onValueChange handler replicates ConnectionSection.handleProfileChange flow: check usePlanExecutionStore.getState().isRunning — if true, toast.warning('Cannot switch profile while a plan is running') and return. Otherwise: setActiveProfile(name) → setConnectionStatus('disconnected') → await activateProfile(name) → setConnectionStatus('connected') catch → setConnectionStatus('error', message) + toast.error.
4. Show colored dot indicator: green for connected, yellow for disconnected, red for error. Use existing connectionStatus from useConnectionStore.
5. Disable Select when only 0-1 profiles exist (nothing to switch to).

Done when: Dropdown renders profiles, switching reconnects, plan-run guard blocks with toast, status dot reflects connection state

## Inputs

- `src/components/publish/PublishBar.tsx`
- `src/stores/useConnectionStore.ts`
- `src/stores/usePlanExecutionStore.ts`
- `src/lib/ipc.ts`

## Expected Output

- `src/components/publish/PublishBar.tsx`

## Verification

pnpm tsc --noEmit
