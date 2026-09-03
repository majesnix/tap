# Task 4: Connection sheet — implementation report

Worktree: `/Users/majesnix/gits/tap/.claude/worktrees/agent-aac62ba4c8ba71b58`
Branch: `worktree-agent-aac62ba4c8ba71b58`
Base commit reset to: `f88e5cb` (confirmed via `git log --oneline -1` before starting)
Commit: `00284a3 feat(connection): connection sheet replaces the profile modal`

## What was implemented

Per the brief, in step order:

1. **Tests first** — wrote `profileForm.test.ts` (23 cases) against the not-yet-existing
   pure module, and `ConnectionSheet.test.tsx` (initially ~25 cases, later expanded to 41)
   against the not-yet-existing `ConnectionSheet`/`ProfileForm` components. Verified both
   files failed with "module not found" before any implementation existed.
2. **`profileFormValues.ts`** (see "Deviation" below for the name) — moved the pure logic
   out of `ProfileManagementModal.tsx`: `ProfileFormValues`, `DEFAULT_FORM_VALUES`,
   `AMQP_TLS_PORT`, `MANAGEMENT_TLS_PORT`, `formFromProfile`, `profileFromForm`,
   `cleartextTransports`, `withHost`, `withPort`, `withManagementPort`, `validateProfile`.
   All immutable (spread-based updates), no React.
3. **`ProfileForm.tsx`** — the detail view: header (back/name/environment pill/close),
   three group cards (Broker / Safety / TLS) per §7 and the prototype markup, footer
   (Delete + test result + Test + Save & connect), delete confirmation `AlertDialog`.
   Carries `handleTestOnly`, `handleSave`, `handleDeleteConfirm` moved from the old modal,
   with `performance.now()` latency measurement around `testConnection`.
4. **`ConnectionSheet.tsx`** — container + list view (Sheet, header, profile rows with
   `StatusDot`/`EnvironmentPill`/URL, "New connection" row) that renders `ProfileForm` for
   `new`/`edit` sheet states and `null` for `null` state.
5. **`ConnectionTestResult.tsx`** — updated to the new contract (`latencyMs?`, "Reachable ·
   N ms" / "Reachable", "Testing…" with a spinning `LoaderCircle`, `CircleAlert` + message).
6. **Wired up `App.tsx`** (`<ConnectionSheet state={sheet} onStateChange={setSheet} />`) and
   deleted `ProfileManagementModal.tsx` + its test, and the dead
   `src/components/sidebar/ConnectionSection.tsx`.
7. Committed with the brief's exact message, no attribution trailers.

### Decisions made where the brief was silent
- `SheetState` imported from `@/lib/workbench` everywhere (never `@/App`).
- Keychain banner reads `useConnectionStore((s) => s.keychainError)` directly; did not
  call `keychainStatus()` again.
- Environment `SegmentedControl`: `variant="choice" stretch`, `activeClassName="text-warning"`
  (Shared) / `"text-danger"` (Production).
- Ports row: two bordered boxes, each with an `Input` (borderless, transparent, inside the
  box) and a trailing suffix span (`amqps`/`amqp`, `https`/`http`) reflecting the TLS switches.
- New-mode header title: "New connection" (brief only specified edit-mode header content).
- TLS group header: three states — "Encrypted on both transports" (success, both switches
  on), "Password travels unencrypted over …" (warning, `cleartextTransports` non-empty),
  "Local host — TLS optional" (ghost, otherwise — i.e. local host with switches not both on).
- Delete `AlertDialog` title is `Delete {name}?` (brief's literal example string), body is
  the unchanged remainder of the old modal's copy ("This will also remove the saved
  password from your OS keychain. This cannot be undone.").
- `onDeleted` and back-arrow both return the sheet to `{ mode: "list" }`; `onSaved` and the
  close (X) button both call `onStateChange(null)`.

## Deviation from the brief: file name

**The brief's exact filename `profileForm.ts` collides with `ProfileForm.tsx` in this
sandbox** — not at the OS level (`ls`/`fs.realpathSync` both prove the filesystem here is
genuinely case-sensitive: the two files coexist as distinct dirents), but both `tsc
--noEmit` (TS1149/TS1261: "File name differs from already included file name only in
casing") and Vite/esbuild's module resolution (confirmed empirically: React threw "Element
type is invalid... you likely mixed up default and named imports" at runtime, i.e. one
import silently resolved to the other file) break as soon as a single file (`ConnectionSheet.tsx`)
imports from both `@/components/connection/ProfileForm` and
`@/components/connection/profileForm` in the same module graph. I verified this is
specifically triggered by cross-importing both casings from the same file (a throwaway
same-name-different-case pair that nothing imported did not trigger the tsc error).

**Fix:** renamed the pure-helpers module to `src/components/connection/profileFormValues.ts`
(and its test to `profileFormValues.test.ts`), updating the three import sites
(`ConnectionSheet.tsx`, `ProfileForm.tsx`, the test file). All exported identifiers,
JSDoc, and the module's contents are otherwise exactly as specified in the brief's
interface section — only the file's own name changed. `ProfileForm.tsx` keeps its exact
required name and export. Flagging this clearly since it deviates from the brief's literal
file list.

## Tests + results

```
$ pnpm exec vitest run src/components/connection
 Test Files  3 passed (3)
      Tests  59 passed (59)
```

```
$ pnpm test   (full suite, after wiring + deletions)
 Test Files  69 passed (69)
      Tests  761 passed (761)
```

```
$ pnpm exec tsc --noEmit
(no output — clean)
```

```
$ pnpm lint
✖ 23 problems (0 errors, 23 warnings)
```
All 23 warnings are pre-existing, in files this task did not touch (FormPanel, PublishBar,
StepFieldEditor, AmqpPropertiesSheet, SubscribePanel, FileSection, IncludePathManager,
ThemeBootstrap) — matches the brief's "23 pre-existing warnings are fine".

```
$ pnpm exec vitest run --coverage
Statements   : 82.08% ( 2382/2902 )   [threshold 78]
Branches     : 73.75% ( 1442/1955 )   [threshold 70]
Functions    : 82.18% ( 678/825 )     [threshold 76]
Lines        : 83.5%  ( 2146/2570 )   [threshold 79]
```
All four ratchet thresholds pass with margin. Per-file coverage for the new/changed files:
`ConnectionSheet.tsx` 90.9%/85%/87.5%/94.44% (stmt/branch/fn/line), `ProfileForm.tsx`
95.72%/77.77%/100%/95.14%, `profileFormValues.ts` 100%/95.45%/100%/100%,
`ConnectionTestResult.tsx` 100%/80%/100%/100%.

## TDD evidence

- `profileForm.test.ts` / `ConnectionSheet.test.tsx` were written and run against
  non-existent modules first; both failed with "Cannot find module" / undefined-component
  errors (confirmed RED) before `profileFormValues.ts`, `ProfileForm.tsx`, and
  `ConnectionSheet.tsx` were written.
- After the initial implementation, `ConnectionSheet.test.tsx` failed with the file-casing
  runtime error described above (a real bug, not a test bug) — fixed by the rename, then
  reran to GREEN (39 tests passing).
- After the coverage run showed `ProfileForm.tsx` at only 39% function coverage, added 13
  more test cases (save-error path, delete-error path, delete-cancel, CA-cert file picker,
  field-by-field mutation coverage for username/vhost/management port/CA path, both TLS
  switches together, environment-touched-then-host-changed, Back/Close callbacks) — reran
  to GREEN (59 tests passing), coverage rose to 95.72%/77.77%/100%/95.14%.

## Files changed

- `src/components/connection/profileFormValues.ts` (new — see deviation note)
- `src/components/connection/ProfileForm.tsx` (new)
- `src/components/connection/ConnectionSheet.tsx` (new)
- `src/components/connection/ConnectionTestResult.tsx` (modified — new prop/copy contract)
- `src/App.tsx` (modified — wires `ConnectionSheet` in place of the modal)
- `src/components/connection/__tests__/profileFormValues.test.ts` (new)
- `src/components/connection/__tests__/ConnectionSheet.test.tsx` (new)
- `src/components/connection/ProfileManagementModal.tsx` (deleted)
- `src/components/connection/__tests__/ProfileManagementModal.test.tsx` (deleted)
- `src/components/sidebar/ConnectionSection.tsx` (deleted, dead since Task 3)

## Self-review against §7

- List view: header copy (title + keychain banner text), profile rows (dot, name, mono
  URL per the exact template, environment pill, chevron), dashed "New connection" row — all
  present and tested.
- Detail view: back/name/"Connection profile"/environment pill/close header; Broker card
  (Name read-only in edit, Host mono, Ports pair with TLS-following suffixes, Virtual host,
  Credentials pair with edit-mode password placeholder); Safety card (segmented
  environment control with colored active labels, helper text, Read-only + Record-history
  switches); TLS card (three-state header summary, AMQP/Management switches, CA cert input
  + browse button); footer (Delete/spacer/test result/Test/Save & connect); inline error
  above the footer — all present and tested.
- No extras added beyond the brief (no new dependencies, no unrelated refactors).
- `git rm`-equivalent deletions completed via plain `rm` + `git add -A`; confirmed no
  remaining references to `ProfileManagementModal` or `ConnectionSection` anywhere in `src`.

## Concerns

1. **File-casing deviation** (above) — flagging for the controller's awareness since it's a
   literal deviation from the brief's file list, forced by a real toolchain limitation in
   this environment rather than a judgment call. If the actual CI/reviewer environment does
   not reproduce this collision, the rename may look unnecessary in isolation, but removing
   it reproduces the "Element type is invalid" runtime crash and the tsc TS1149 error in this
   worktree.
2. `ProfileForm.tsx`'s branch coverage (77.77%) is the lowest of the new files — the
   remaining uncovered branches are the `err instanceof Error` false-branch (`String(err)`
   fallback) in `handleTestOnly`'s save-catch and test-catch blocks, which would need a
   non-Error rejection value to exercise; judged not worth the test-quality tradeoff of
   asserting on a contrived non-Error throw.
3. Did not add a standalone `ProfileForm.test.tsx` — per the brief's Test file list, only
   `profileForm.test.ts` and `ConnectionSheet.test.tsx` are specified; `ProfileForm` is
   exercised exclusively through `ConnectionSheet.test.tsx`, consistent with the brief.

## Verification commands (for the reviewer to re-run)

```bash
cd /Users/majesnix/gits/tap/.claude/worktrees/agent-aac62ba4c8ba71b58
pnpm exec vitest run src/components/connection
pnpm test
pnpm exec tsc --noEmit
pnpm lint
pnpm exec vitest run --coverage
```

---

## Fix round 1

Addressed review findings on top of `00284a3`.

### 1. (Important) Edit-mode Test-with-blank-password path was untested
`src/components/connection/__tests__/ConnectionSheet.test.tsx`:
- Renamed "Test on an existing profile without a password saves, tests and shows Reachable"
  to "Test on an existing profile with a password saves, tests and shows Reachable" (it does
  type a password before clicking Test) and added assertions that `save_profile` and
  `test_connection` were in fact called.
- Added a new test, "Test on an existing profile with a blank password shows the existing
  message and does not save or test": renders the edit form, leaves the password field
  blank, clicks Test, asserts the existing `/password is required to save changes/i` message
  appears, and that `save_profile`/`test_connection` were **not** called.
- `validateProfile` itself was not touched — Test still shares the same validation as Save
  in edit mode, as before.

### 2. (Important) `ConnectionSheet`/`ProfileForm` destructured the whole store
`src/components/connection/ConnectionSheet.tsx`: replaced
`const { profiles, activeProfileName, keychainError } = useConnectionStore();` with three
individual selector calls (`useConnectionStore((s) => s.profiles)`, etc.) so the sheet
(always mounted) only re-renders when one of those three fields actually changes.

`src/components/connection/ProfileForm.tsx`: replaced
`const { setProfiles, setActiveProfile, setConnectionStatus } = useConnectionStore();` with
individual selector calls for the same three stable action references.

### 3. (Minor) Read-only Name input styling
`src/components/connection/ProfileForm.tsx`: the Name `Input` in edit mode now also gets
`opacity-60 cursor-not-allowed` (via `cn(..., mode === "edit" && "opacity-60 cursor-not-allowed")`),
matching the old modal's read-only treatment, in addition to the existing `readOnly` attribute.

### Tests + results

```
$ pnpm exec vitest run src/components/connection
 Test Files  3 passed (3)
      Tests  60 passed (60)
```

```
$ pnpm test
 Test Files  69 passed (69)
      Tests  762 passed (762)
```

```
$ pnpm exec tsc --noEmit
(no output — clean)
```

```
$ pnpm lint
✖ 23 problems (0 errors, 23 warnings)
```
Same 23 pre-existing warnings as before this round, all in files outside this task's scope.

### Files changed this round
- `src/components/connection/ConnectionSheet.tsx`
- `src/components/connection/ProfileForm.tsx`
- `src/components/connection/__tests__/ConnectionSheet.test.tsx`
