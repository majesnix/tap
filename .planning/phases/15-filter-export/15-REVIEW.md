---
phase: 15-filter-export
reviewed: 2026-05-21T00:00:00Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - src-tauri/capabilities/default.json
  - src/components/response/MessageFeedTab.tsx
  - src/components/response/MessageFeedTab.test.tsx
findings:
  critical: 1
  warning: 3
  info: 2
  total: 6
status: issues_found
---

# Phase 15: Code Review Report

**Reviewed:** 2026-05-21
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Phase 15 adds routing-key / content-type filtering and a JSON export feature to `MessageFeedTab`. The component logic is clean and the test suite is comprehensive. Four issues were found: one BLOCKER (overly broad filesystem write permission added in this phase), two warnings (missing error handling around the `save()` call, and a hardcoded magic number duplicating a store constant), and two info items (a pluralization bug locked in by a test, and export filenames colliding within the same minute).

---

## Critical Issues

### CR-01: `fs:allow-write-text-file` paired with `**/*` scope grants write access to the entire filesystem

**File:** `src-tauri/capabilities/default.json:13-14`

**Issue:** This phase newly added `dialog:allow-save` and `fs:allow-write-text-file` (confirmed via `git diff 8e6625c5..HEAD`). The `fs:scope` entry with `{ "path": "**/*" }` was already present, but it only had practical effect for read operations before this phase. Adding `fs:allow-write-text-file` now combines with the wildcard scope to let the frontend write to any path on disk, not just the path returned by the `save()` dialog. The `save()` dialog enforces a user-visible path selection, but the Tauri FS scope is the actual security boundary enforced by the sandbox. Any code in the renderer that calls `writeTextFile` can target an arbitrary path without the user seeing a dialog — the current code passes the dialog-returned path correctly, but there is nothing in the capability that prevents a future bug or supply-chain compromise from writing to `~/.ssh/authorized_keys`, shell config files, or any other sensitive location.

**Fix:** Restrict `fs:scope` to only paths that the export feature needs. The user-selected path comes from the OS save dialog, so the scope should reference the user's home directory or documents folder rather than the root glob, or use `$APPDATA` / `$HOME` macros that Tauri supports:

```json
{
  "identifier": "fs:scope",
  "allow": [
    { "path": "$HOME/**" }
  ]
}
```

If cross-platform coverage of save locations is required, prefer the narrowest glob that covers the expected export destinations (Downloads, Documents, Desktop) and omit system directories entirely. Do not keep `**/*`.

---

## Warnings

### WR-01: `save()` call is outside the try-catch — rejection is silently swallowed

**File:** `src/components/response/MessageFeedTab.tsx:131-135`

**Issue:** `handleExport` awaits `save(...)` before entering the `try` block (line 155). The component calls `handleExport` as `void handleExport()` (line 235), which discards any unhandled rejection. If the Tauri dialog plugin rejects (e.g., window focus issues, platform error, plugin not initialised), the user sees nothing and the error is lost. The `try-catch` on line 155 only guards `writeTextFile`.

**Fix:** Move the entire async body into the try-catch, or wrap `save()` separately:

```typescript
const handleExport = async () => {
  const timestamp = new Date().toISOString().replace(/:/g, "-").slice(0, 16);
  const defaultPath = `feed-export-${timestamp}.json`;

  try {
    const filePath = await save({
      defaultPath,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!filePath) return;

    const payload = { /* ... */ };
    await writeTextFile(filePath, JSON.stringify(payload, null, 2));
    toast.success(`Exported ${visibleMessages.length} messages`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    toast.error(`Export failed: ${message}`);
  }
};
```

---

### WR-02: Feed-cap size of 500 is hardcoded in the component, duplicating the store constant

**File:** `src/components/response/MessageFeedTab.tsx:112-113`

**Issue:** The component hardcodes `500` in the user-facing toast message: `"Feed capped at 500 — ${totalAfterPrepend - 500} older message(s) removed"`. The canonical value lives in `useResponseStore.ts:4` as `const FEED_MAX_SIZE = 500`, but it is not exported and the component re-states it as a literal. If the cap is ever changed in the store, the toast message silently shows the wrong number.

**Fix:** Export `FEED_MAX_SIZE` from the store and import it in the component:

```typescript
// useResponseStore.ts
export const FEED_MAX_SIZE = 500;

// MessageFeedTab.tsx
import { FEED_MAX_SIZE } from "@/stores/useResponseStore";
// ...
if (totalAfterPrepend > FEED_MAX_SIZE) {
  toast.info(`Feed capped at ${FEED_MAX_SIZE} — ${totalAfterPrepend - FEED_MAX_SIZE} older message(s) removed`);
}
```

---

## Info

### IN-01: Pluralization bug in export success toast ("Exported 1 messages"), locked in by test

**File:** `src/components/response/MessageFeedTab.tsx:157` and `src/components/response/MessageFeedTab.test.tsx:322`

**Issue:** The success toast reads `Exported ${visibleMessages.length} messages` unconditionally. When `visibleMessages.length === 1` this produces "Exported 1 messages" — grammatically incorrect. The component already handles this correctly for `countLabel` (line 169-174 uses `"1 message"` vs `"${messageCount} messages"`). The test at line 322 asserts the broken string `"Exported 1 messages"`, so fixing the source will break the test unless both are updated together.

**Fix:**

```typescript
// MessageFeedTab.tsx:157
const exportLabel = visibleMessages.length === 1 ? "1 message" : `${visibleMessages.length} messages`;
toast.success(`Exported ${exportLabel}`);

// MessageFeedTab.test.tsx:322
expect(mockToastSuccess).toHaveBeenCalledWith("Exported 1 message");
```

---

### IN-02: Two exports within the same minute share the same default filename

**File:** `src/components/response/MessageFeedTab.tsx:128`

**Issue:** `.slice(0, 16)` on the ISO string (after colon replacement) produces `YYYY-MM-DDTHH-MM`, truncating seconds. If the user exports twice within the same minute, both dialogs open with `feed-export-2026-05-21T10-30.json` as the default name. In most cases the OS save dialog prevents silent overwrite (it will prompt or suffix), but the default name provides no disambiguation.

**Fix:** Extend the slice to include seconds (`slice(0, 19)`) — all colons are already replaced, so `YYYY-MM-DDTHH-MM-SS` is still filesystem-safe on all platforms:

```typescript
const timestamp = new Date().toISOString().replace(/:/g, "-").slice(0, 19);
```

Also update the test regex at `MessageFeedTab.test.tsx:381` from `/^feed-export-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}\.json$/` to `/^feed-export-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.json$/`.

---

_Reviewed: 2026-05-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
