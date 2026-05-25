---
id: T03
parent: S03
milestone: M001
key_files:
  - src/components/publish/PublishBar.tsx
key_decisions:
  - Plan-run guard uses usePlanExecutionStore.getState().isRunning (imperative, not reactive) to avoid unnecessary re-renders — only checked at switch time
  - Profile loading on mount uses fire-and-forget pattern with silent catch — profiles may already be loaded via sidebar
  - Select disabled at <=1 profiles (not just 0) since switching with one profile is a no-op
duration: 
verification_result: passed
completed_at: 2026-05-25T20:15:04.432Z
blocker_discovered: false
---

# T03: Added connection quick-switch dropdown in PublishBar with colored status dot, profile loading on mount, and plan-run guard that blocks switching with toast warning

**Added connection quick-switch dropdown in PublishBar with colored status dot, profile loading on mount, and plan-run guard that blocks switching with toast warning**

## What Happened

Added a compact Select dropdown at the far left of PublishBar (before the mode RadioGroup) that shows all saved connection profiles from useConnectionStore. On mount, if profiles array is empty, the component calls listProfiles() IPC to ensure profiles are available even if the sidebar was never opened. The handleQuickSwitch handler replicates ConnectionSection.handleProfileChange flow: checks usePlanExecutionStore.getState().isRunning — if true, shows toast.warning('Cannot switch profile while a plan is running') and returns early. Otherwise: setActiveProfile → setConnectionStatus('disconnected') → await activateProfile(name) → setConnectionStatus('connected'), with catch setting error status and toast.error. A colored dot indicator (green=connected, yellow=disconnected, red=error) renders inline with the dropdown. The Select is disabled when profiles.length <= 1 since there's nothing to switch to.

## Verification

Ran pnpm tsc --noEmit — passes clean with no errors. Initial run caught an unused variable (isRunning reactive subscription) which was removed since the handler uses getState() imperatively.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `pnpm tsc --noEmit` | 0 | pass | 8000ms |

## Deviations

none

## Known Issues

none

## Files Created/Modified

- `src/components/publish/PublishBar.tsx`
