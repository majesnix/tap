---
phase: 02-connect-publish
plan: GAP
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/connection/ProfileManagementModal.tsx
  - src/components/sidebar/ConnectionSection.tsx
autonomous: true
requirements: [CONN-01]
gap_closure: true
uat_gap: "User can create a connection profile, click 'Test Connection', and see a green checkmark inline when the broker is reachable with valid credentials"

must_haves:
  truths:
    - "A 'Test Connection' button is visible in the new-profile form, independently of the 'Save & Connect' button"
    - "Clicking 'Test Connection' saves the profile to storage and runs the connection test without activating the profile or closing the modal"
    - "The ConnectionTestResult component (spinner → green checkmark / red X) appears inline after clicking 'Test Connection'"
    - "A re-test button (or icon) is visible in ConnectionSection.tsx when a profile is selected, allowing re-testing of an already-saved profile"
    - "Clicking the re-test button in the sidebar calls testConnection and shows the result inline without changing the selected profile"
    - "An existing saved connection profile can be opened for editing with all fields pre-populated"
  artifacts:
    - path: "src/components/connection/ProfileManagementModal.tsx"
      provides: "Standalone Test Connection button in create form"
      contains: "handleTestOnly"
    - path: "src/components/sidebar/ConnectionSection.tsx"
      provides: "Re-test button with inline ConnectionTestResult display"
      contains: "handleRetest"
  key_links:
    - from: "ProfileManagementModal.tsx handleTestOnly"
      to: "ipc.testConnection"
      via: "saveProfile then testConnection(profile.name)"
      pattern: "testConnection"
    - from: "ConnectionSection.tsx handleRetest"
      to: "ipc.testConnection"
      via: "testConnection(activeProfileName)"
      pattern: "testConnection"
---

<objective>
Surface the existing `test_connection` Rust command through two dedicated UI affordances that are currently missing:
1. A standalone "Test Connection" button in ProfileManagementModal.tsx (new-profile form)
2. A re-test button in ConnectionSection.tsx for already-saved profiles

Purpose: UAT test 1 failed because the only way to trigger a connection test was implicitly via "Save & Connect". This gap fix makes the capability explicit and discoverable without changing any Rust backend code.

Output: Two modified React component files and one new test file (ProfileManagementModal.test.tsx). No Rust changes.

Note: CONTEXT.md D-02 states "No separate Testing spinner state — testing happens synchronously during save inside the modal." The UAT diagnosis explicitly mandates surfacing the test button independently; this gap fix supersedes the D-02 scope. The status dot in the sidebar retains its 3-state model (connected / error / disconnected) — the spinner is rendered by ConnectionTestResult as a sibling element, not as a fourth dot state.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/02-connect-publish/02-CONTEXT.md

<!-- Key interfaces the executor needs — no codebase exploration required -->
<interfaces>
From src/lib/ipc.ts (lines 39-41):
```typescript
export async function testConnection(profileName: string): Promise<void>
export async function saveProfile(profile: ConnectionProfile, password: string): Promise<void>
```

From src/components/connection/ConnectionTestResult.tsx:
```typescript
type TestState = "idle" | "testing" | "success" | "error";

interface ConnectionTestResultProps {
  state: TestState;
  errorMessage?: string | null;
}

export function ConnectionTestResult({ state, errorMessage }: ConnectionTestResultProps)
// Returns null when state === "idle"; shows spinner / checkmark / red X otherwise
```

From src/components/connection/ProfileManagementModal.tsx (current state):
```typescript
// Existing state at component top:
const [testState, setTestState] = useState<TestState>("idle");
const [testError, setTestError] = useState<string | null>(null);

// handleSave (lines 83-133):
// Step 1: saveProfile(profile, formValues.password)
// Step 2: setTestState("testing") → testConnection(profile.name) → setTestState("success")
//         → setActiveProfile, setConnectionStatus("connected")   ← these are what handleTestOnly MUST skip
// On error: setTestState("error"), setConnectionStatus("error", message)

// Button row (lines 269-276):
<div className="flex justify-end gap-2">
  <Button variant="outline" onClick={handleCancel}>Cancel</Button>
  <Button onClick={handleSave} disabled={testState === "testing"}>Save &amp; Connect</Button>
</div>

// ConnectionTestResult already rendered at line 267:
<ConnectionTestResult state={testState} errorMessage={testError} />
```

From src/components/sidebar/ConnectionSection.tsx (current state):
```typescript
// Imports already present: listProfiles, activateProfile from "@/lib/ipc"
// testConnection is NOT yet imported in ConnectionSection.tsx — must add it
// ConnectionTestResult is NOT yet imported — must add it

// Status row (lines 87-98):
<div className="flex items-center gap-2">
  <span className={`w-2 h-2 rounded-full ${dotClass}`} />
  <span className="text-xs text-muted-foreground">{statusText}</span>
  <Button variant="ghost" size="icon" onClick={() => setDialogOpen(true)} aria-label="Manage connection profiles">
    <Settings className="w-4 h-4" />
  </Button>
</div>
```

From src/stores/useConnectionStore.ts (inferred from usage in ProfileManagementModal):
```typescript
// setConnectionStatus signature:
setConnectionStatus: (status: "connected" | "disconnected" | "error", message?: string) => void
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add standalone "Test Connection" button to ProfileManagementModal</name>
  <files>src/components/connection/ProfileManagementModal.tsx</files>
  <behavior>
    - handleTestOnly: when called with empty name → sets error "Profile name is required." (same as handleSave)
    - handleTestOnly: when called with empty host → sets error "Host is required."
    - handleTestOnly: on saveProfile success + testConnection success → testState is "success"
    - handleTestOnly: on saveProfile success + testConnection failure → testState is "error", testError contains message
    - handleTestOnly: does NOT call setActiveProfile or setConnectionStatus (global store untouched)
    - handleTestOnly: does NOT close the modal
    - "Save & Connect" button (handleSave) behaviour is unchanged
  </behavior>
  <action>
Add a `handleTestOnly` async function to ProfileManagementModal.tsx. Place it after `handleCancel` and before `handleSave`.

Exact semantics of `handleTestOnly`:
1. Clear error, reset testState to "idle", reset testError.
2. Build the same `profile: ConnectionProfile` object that `handleSave` builds (identical field mapping).
3. Validate name and host — same guards as `handleSave` (set error + return early on failure).
4. Call `await saveProfile(profile, formValues.password)`. If it throws, set `setError(message)` and return — do NOT proceed to test. On success, immediately refresh the profiles list unconditionally: `const updated = await listProfiles(); setProfiles(updated);`. This ensures the profile appears in the sidebar regardless of whether the subsequent connection test passes or fails.
5. Set `setTestState("testing")`.
6. Call `await testConnection(profile.name)`.
   - On success: `setTestState("success")`. Do NOT call `setActiveProfile` or `setConnectionStatus`. Do NOT close the modal.
   - On error: `setTestState("error"); setTestError(message);`. Do NOT call `setConnectionStatus`. Do NOT close the modal.

Then, in the button row JSX (the `<div className="flex justify-end gap-2">` around lines 269-276), add a "Test Connection" button BETWEEN Cancel and "Save & Connect":

```tsx
<Button
  variant="outline"
  onClick={handleTestOnly}
  disabled={testState === "testing"}
>
  Test Connection
</Button>
```

Final button order left-to-right: Cancel | Test Connection | Save & Connect

No other changes to the file. The `<ConnectionTestResult>` component at line 267 is already rendered — it will display the result of `handleTestOnly` because it reads the same `testState`/`testError` state.

Decision rationale: `testConnection(profileName)` is a Rust command that requires a persisted profile (the backend looks up credentials by name). Therefore "Test Connection" must save first. The key difference from "Save & Connect" is that `handleTestOnly` intentionally omits `setActiveProfile` and `setConnectionStatus("connected")` — the profile is saved but not activated until the user explicitly clicks "Save & Connect".

Test file: `src/components/connection/__tests__/ProfileManagementModal.test.tsx` does NOT yet exist (only ConnectionSection.test.tsx exists in that directory). Create it as part of this task with tests covering all behaviors in the `<behavior>` block above before implementing `handleTestOnly`. Follow the existing ConnectionSection.test.tsx as a structural reference for vitest + @testing-library/react setup.
  </action>
  <verify>
    <automated>npm test -- --reporter=verbose ProfileManagementModal</automated>
  </verify>
  <done>
    "Test Connection" button renders between Cancel and "Save & Connect" in the create form.
    Clicking it saves the profile and runs testConnection without activating it.
    ConnectionTestResult updates to show spinner then success/error.
    "Save & Connect" continues to save, test, and activate as before.
    `npx tsc --noEmit` exits 0.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Add re-test button to ConnectionSection for saved profiles</name>
  <files>src/components/sidebar/ConnectionSection.tsx</files>
  <behavior>
    - Re-test button is disabled when testState === "testing" or activeProfileName is null/empty
    - Clicking re-test sets testState to "testing", calls testConnection(activeProfileName), then sets "success" or "error"
    - On re-test success: testState is "success" — global connectionStatus is set to "connected"
    - On re-test error: testState is "error", testError contains message — global connectionStatus is set to "error"
    - ConnectionTestResult renders below the status row only when testState !== "idle"
    - The profile select dropdown and settings gear button are unaffected
  </behavior>
  <action>
**Before writing any implementation, write tests first (TDD — RED phase).**

Extend `src/components/connection/__tests__/ConnectionSection.test.tsx` with the following test cases for `handleRetest` before implementing the function. Each test must fail (RED) when first run against the current code, then pass (GREEN) after implementation:

- `handleRetest: shows green checkmark after successful re-test` — mock `testConnection` to resolve; click "Re-test"; assert `ConnectionTestResult` renders with success state (aria-label or test-id showing checkmark).
- `handleRetest: shows red badge with error message after failed re-test` — mock `testConnection` to reject with `new Error("connection refused")`; click "Re-test"; assert `ConnectionTestResult` renders with error state and the message "connection refused" visible.
- `handleRetest: Re-test button is disabled while testing is in progress` — mock `testConnection` to never resolve (pending promise); click "Re-test"; assert button has `disabled` attribute before the promise resolves.

Run `npm test -- --reporter=verbose ConnectionSection` after adding these tests and confirm they fail (RED). Then proceed with the implementation steps below.

---

Modify `src/components/sidebar/ConnectionSection.tsx` as follows:

**1. Add imports** at the top (alongside existing imports from `@/lib/ipc` and components):
```tsx
import { testConnection } from "@/lib/ipc";
import { ConnectionTestResult } from "@/components/connection/ConnectionTestResult";
```

**2. Add local state** inside the `ConnectionSection` function body, after the existing `useState(false)` for `dialogOpen`:
```tsx
type TestState = "idle" | "testing" | "success" | "error";
const [testState, setTestState] = useState<TestState>("idle");
const [testError, setTestError] = useState<string | null>(null);
```

**3. Add `handleRetest` function** after `handleProfileChange`:
```tsx
const handleRetest = async () => {
  if (!activeProfileName) return;
  setTestState("testing");
  setTestError(null);
  try {
    await testConnection(activeProfileName);
    setTestState("success");
    setConnectionStatus("connected");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    setTestState("error");
    setTestError(message);
    setConnectionStatus("error", message);
  }
};
```

Rationale for updating global `setConnectionStatus` on re-test: unlike the modal (which tests a new profile before activation), the re-test in the sidebar is testing the *currently active* profile. A re-test result is authoritative for the connection status shown to the user, so updating the global status is correct here.

**4. Add re-test button and result** inside the returned JSX of the non-empty profiles branch (the `<div className="flex flex-col gap-2">` block). Insert after the existing status row `<div>` and before `<ProfileManagementModal .../>`:

```tsx
<div className="flex items-center gap-2">
  <Button
    variant="outline"
    size="sm"
    onClick={handleRetest}
    disabled={!activeProfileName || testState === "testing"}
    className="text-xs"
  >
    Re-test
  </Button>
</div>
<ConnectionTestResult state={testState} errorMessage={testError} />
```

Keep the existing settings gear button (`<Button variant="ghost" size="icon">`) inside the status row exactly as it is. Do not move or reorder it.

No changes needed to the empty-profiles branch (the early return) — re-test only applies when a profile is already selected.
  </action>
  <verify>
    <automated>npm test -- --reporter=verbose ConnectionSection</automated>
  </verify>
  <done>
    All three new `handleRetest` test cases pass: success → green checkmark, failure → red badge with error message, in-flight → button disabled.
    "Re-test" button renders in the sidebar below the status dot row when a profile is selected.
    Clicking it calls testConnection with the active profile name.
    ConnectionTestResult appears inline with spinner then success/error state.
    Disabled when no profile selected or while testing is in progress.
    `npx tsc --noEmit` exits 0.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add edit mode to ProfileManagementModal for saved profiles</name>
  <files>src/components/connection/ProfileManagementModal.tsx, src/components/connection/__tests__/ProfileManagementModal.test.tsx</files>
  <behavior>
    - An Edit button appears alongside the existing Delete button in each profile list row
    - Clicking Edit switches formMode to "edit" and pre-populates all fields (name, host, port, vhost, username, managementPort, managementSsl) from the selected profile; password field is left blank with placeholder "Enter password to update; leave blank to keep current"
    - The Profile Name field is read-only when formMode === "edit" (name is the upsert key)
    - In edit mode with a non-blank password: saveProfile is called (upsert by name updates the non-secret fields and overwrites the keychain entry)
    - In edit mode with a blank password: saveProfile is NOT called — the save is blocked and an inline error is shown: "Password is required to save changes. Enter the current password to keep it, or a new password to change it."
    - The form title changes to "Edit Profile" when formMode === "edit" (was "New Profile" / "Create Profile" in create mode)
  </behavior>
  <action>
**RED phase — write tests before any implementation.**

Extend the existing test file `src/components/connection/__tests__/ProfileManagementModal.test.tsx` (created in Task 1) with the following edit-mode test cases. Run `npm test -- --reporter=verbose ProfileManagementModal` after adding them and confirm each fails (RED) before writing any implementation code.

Test cases to add (all inside a `describe("edit mode", ...)` block):

1. `edit button appears for each profile row` — render the modal in list view with two mock profiles; assert that two "Edit" buttons are present (one per row), alongside the existing "Delete" buttons.

2. `clicking Edit pre-populates form fields from the selected profile` — click the Edit button for a profile with known field values; assert that the name, host, port, vhost, and username inputs contain those values; assert that the password input is empty (value `""`); assert that the password input placeholder is `"Enter password to update; leave blank to keep current"`.

3. `Profile Name field is read-only in edit mode` — click Edit on any profile row; assert that the profile name input has the `readOnly` attribute (or `disabled` — match whatever the implementation uses).

4. `save in edit mode with password calls saveProfile with updated values` — mock `saveProfile` to resolve; click Edit on a profile, change the host to `"new-host.local"`, enter `"mypassword"` in the password field, click "Save & Connect"; assert `saveProfile` was called once with a profile object whose `host` is `"new-host.local"` and the password argument `"mypassword"`.

5. `blank password in edit mode blocks save and shows inline error` — mock `saveProfile`; click Edit on a profile, change the host to `"new-host.local"`, leave password blank, click "Save & Connect"; assert `saveProfile` was NOT called; assert an error message containing "Password is required" is visible.

---

**GREEN phase — implement after all five tests are red.**

Modify `src/components/connection/ProfileManagementModal.tsx` as follows. No changes to any Rust backend file.

**1. Extend the `formMode` union type.**

Find the existing `formMode` state declaration (type `"list" | "create"`). Change it to:
```typescript
const [formMode, setFormMode] = useState<"list" | "create" | "edit">("list");
```

**2. Add `handleShowEditForm` function** after `handleShowCreateForm` (or wherever the create-mode handler lives):
```typescript
const handleShowEditForm = (profile: ConnectionProfile) => {
  setFormValues({
    name: profile.name,
    host: profile.host,
    port: String(profile.port),
    vhost: profile.vhost,
    username: profile.username,
    password: "",            // intentionally blank — user must re-enter to change
    managementPort: String(profile.managementPort ?? 15672),
    managementSsl: profile.managementSsl ?? false,
  });
  setError(null);
  setTestState("idle");
  setTestError(null);
  setFormMode("edit");
};
```

**3. Add Edit button to each profile list row.**

Locate the profile list rendering (the section around lines 166–174 that renders the Delete button per row). Add an Edit button immediately before the Delete button in each row:

```tsx
<Button
  variant="ghost"
  size="icon"
  onClick={() => handleShowEditForm(profile)}
  aria-label={`Edit profile ${profile.name}`}
>
  <Pencil className="w-4 h-4" />
</Button>
```

Import `Pencil` from `lucide-react` at the top of the file alongside any existing lucide imports.

**4. Make Profile Name read-only in edit mode.**

Locate the Profile Name `<Input>` field in the form. Add `readOnly={formMode === "edit"}` (and optionally `className` adjustments for a visual hint, e.g. `opacity-60 cursor-not-allowed`):

```tsx
<Input
  id="profile-name"
  value={formValues.name}
  onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
  readOnly={formMode === "edit"}
  className={formMode === "edit" ? "opacity-60 cursor-not-allowed" : ""}
  placeholder="My RabbitMQ"
/>
```

**5. Add password-blank guard to `handleSave` for edit mode.**

At the top of `handleSave`, after the existing name/host validation guards, add:

```typescript
if (formMode === "edit" && formValues.password.trim() === "") {
  setError(
    "Password is required to save changes. Enter the current password to keep it, or a new password to change it."
  );
  return;
}
```

This guard exists because `save_profile` on the Rust side unconditionally calls `store_password(&profile.name, &password)` (verified in `src-tauri/src/commands/connection.rs` line 66) — there is no empty-string skip on the backend. Passing an empty string would overwrite the keychain entry with a blank password and break subsequent connections.

**6. Update the form title.**

Locate the form heading that currently shows "New Profile" or "Create Profile". Make it conditional:

```tsx
<DialogTitle>
  {formMode === "edit" ? "Edit Profile" : "New Profile"}
</DialogTitle>
```

**7. Update password field placeholder.**

Locate the password `<Input>`. Set placeholder conditionally:

```tsx
<Input
  id="password"
  type="password"
  value={formValues.password}
  onChange={(e) => setFormValues({ ...formValues, password: e.target.value })}
  placeholder={
    formMode === "edit"
      ? "Enter password to update; leave blank to keep current"
      : "Password"
  }
/>
```

Note: the placeholder text is intentionally kept even though blank password is now blocked by the save guard — it explains intent to the user before they attempt to save.

No changes to `handleTestOnly` (Task 1) — test-only mode is only available in `formMode === "create"`. The "Test Connection" button should not render in edit mode (add `{formMode === "create" && <Button ...>Test Connection</Button>}` around it). This avoids the complexity of testing a half-edited profile that has not yet been saved.

No Rust backend changes. The existing `save_profile` upsert-by-name behavior handles updates transparently.
  </action>
  <verify>
    <automated>npm test -- --reporter=verbose ProfileManagementModal</automated>
  </verify>
  <done>
    All five edit-mode test cases pass (edit button per row, fields pre-populated on click, name read-only, save with password calls saveProfile, blank password blocks save and shows error).
    Edit button renders in each profile row in the list view.
    Clicking Edit switches to a pre-populated form with the profile name read-only.
    Form title shows "Edit Profile" in edit mode.
    Attempting to save with a blank password shows the inline error and does not call saveProfile.
    "Test Connection" button is hidden in edit mode.
    `npx tsc --noEmit` exits 0.
    All Task 1 and Task 2 tests continue to pass (no regressions).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| frontend → Tauri IPC | testConnection result (success/void or thrown error string) crosses from Rust to React |
| Rust backend → RabbitMQ broker | Network call; broker may be unreachable or return auth failure |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-GAP-01 | Spoofing | testConnection error message display | accept | Error message comes from Rust via Tauri IPC — no user-controlled content reaches the display; displayed as text not innerHTML |
| T-GAP-02 | Denial of Service | Re-test button spam | accept | Button is disabled while testState === "testing"; one in-flight request at a time; dev tool, not public-facing |
| T-GAP-03 | Information Disclosure | testConnection error message leaks broker internals | accept | Dev tool intended for developers who already have broker credentials; leak of internal error text is acceptable |
| T-GAP-04 | Tampering | Edit mode blank-password overwrite of OS keychain entry | mitigate | Frontend guard in handleSave blocks saveProfile call when password is blank in edit mode; Rust save_profile always writes to keychain unconditionally (verified in src-tauri/src/commands/connection.rs:66), so the guard must live in the frontend |
</threat_model>

<verification>
Run in order after all tasks are complete:

```bash
# TypeScript clean
npx tsc --noEmit

# Unit tests
npm test -- --reporter=verbose

# Manual smoke test (requires local RabbitMQ):
# 1. Open app → gear icon → "+ New Profile" → fill fields → click "Test Connection"
#    Expected: spinner appears, then green checkmark "Connected". Modal stays open.
#    Profile is NOT activated (sidebar still shows previous selection).
#    Profile IS visible in the sidebar profile list (listProfiles refreshed unconditionally).
# 2. Click "Save & Connect" on same form.
#    Expected: profile activates, green dot in sidebar, modal can be closed.
# 3. In sidebar with profile selected → click "Re-test"
#    Expected: spinner inline, then green checkmark. Status dot remains green.
# 4. Disconnect broker mid-test → click "Re-test"
#    Expected: red X with error message. Status dot turns red.
# 5. Open profile list → click Edit on an existing profile
#    Expected: form switches to "Edit Profile" title, all fields pre-populated, name field is read-only, password field is empty with placeholder hint.
# 6. Change host, leave password blank → click "Save & Connect"
#    Expected: inline error "Password is required to save changes..." appears; saveProfile is NOT called.
# 7. Change host, enter current password → click "Save & Connect"
#    Expected: profile saved with updated host, profile activated, modal closeable.
```
</verification>

<success_criteria>
- All files compile with zero TypeScript errors (`npx tsc --noEmit` exits 0)
- Existing unit tests continue to pass (no regressions)
- "Test Connection" button visible in the new-profile create form between Cancel and "Save & Connect"
- "Re-test" button visible in sidebar when a saved profile is selected
- Both buttons are disabled during an in-flight test (testState === "testing")
- ConnectionTestResult renders inline in both locations after a test is triggered
- All three new handleRetest test cases pass (success green checkmark, failure red badge, disabled while loading)
- Profile appears in sidebar profile list after "Test Connection" regardless of whether the connection test passes or fails
- Edit button renders in each profile row in the list view
- Clicking Edit pre-populates all form fields from the selected profile (password blank)
- Profile Name field is read-only in edit mode
- Blank password in edit mode blocks saveProfile call and shows inline error
- All five edit-mode test cases pass
- No Rust backend changes required
</success_criteria>

<output>
After completion, create `.planning/phases/02-connect-publish/02-GAP-SUMMARY.md` using the standard summary template.
</output>
