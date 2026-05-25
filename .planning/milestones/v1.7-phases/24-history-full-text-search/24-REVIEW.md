---
phase: 24-history-full-text-search
reviewed: 2026-05-25T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/history/HistoryFilterBar.tsx
  - src/components/history/historyHelpers.test.ts
  - src/components/history/historyHelpers.ts
  - src/components/history/MessageHistoryPanel.tsx
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-05-25T00:00:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Four files implement history full-text search: a pure filter helper (`historyHelpers.ts`), its test suite (`historyHelpers.test.ts`), the search/filter bar component (`HistoryFilterBar.tsx`), and the history panel that wires them together (`MessageHistoryPanel.tsx`).

The logic is generally correct and the test coverage is strong. Three issues warrant attention before ship: a silent `catch {}` block that swallows a potentially important failure in `handleResend`; a search implementation that matches field **names** but silently ignores field **values**, which is misleading behaviour given the label "Search…"; and the absence of input debouncing on the search field, which re-filters the full entries array on every keystroke. Two info-level findings note a missing `label`/`aria-label` on the search input and the `onSearchChange` callback being optional in the props interface when the parent always supplies it.

---

## Warnings

### WR-01: Silent catch swallows history-persistence failure in `handleResend`

**File:** `src/components/history/MessageHistoryPanel.tsx:98-101`

**Issue:** The `appendEntry` call in `handleResend` is wrapped in a bare `catch {}` with no logging and no user feedback. The inline comment says "non-fatal — history will simply not show this resend", but this is not entirely benign: if persistence is broken (e.g. the Tauri store is read-only or the disk is full), the user will silently lose history entries on every resend without any indication that anything went wrong. A single, non-blocking log statement would make this diagnosable.

The project's coding-style rule states "Never silently swallow errors."

**Fix:**
```typescript
} catch (err: unknown) {
  // Non-fatal: message was sent; history record could not be persisted.
  // Log for diagnostics but do not surface to the user as a "Resend failed" toast.
  console.error("[history] appendEntry after resend failed:", err);
}
```

---

### WR-02: `filterHistoryEntries` searches field **names** only — field **values** are never matched

**File:** `src/components/history/historyHelpers.ts:56-64`

**Issue:** `collectFieldNames` returns only keys (e.g. `["orderId", "amount"]`). The search filter in `filterHistoryEntries` tests those keys against the query, but never inspects the corresponding values (e.g. `"ORD-001"` or `"99.99"`). A user typing a known order ID or a specific string value stored in a protobuf field will get zero results, even though the data is in the entry. This behaviour contradicts the plain-language label "Search…" on the input and the feature goal of full-text search.

This is also confirmed by the test suite: every `fieldValues` search test uses a *field name* as the query (e.g. `"orderid"`, `"streetname"`), not a field value. There are no tests for value matching.

**Fix:** Extend `collectFieldNames` (or add a new `collectFieldValues`) and include primitive values alongside field names in the search corpus:

```typescript
export function collectSearchTokens(obj: Record<string, unknown>): string[] {
  const tokens: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key === "_selected") continue;
    tokens.push(key);
    if (value !== null && !Array.isArray(value) && typeof value === "object") {
      tokens.push(...collectSearchTokens(value as Record<string, unknown>));
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && typeof item === "object" && !Array.isArray(item)) {
          tokens.push(...collectSearchTokens(item as Record<string, unknown>));
        } else if (item !== null && typeof item !== "object") {
          tokens.push(String(item));
        }
      }
    } else if (value !== null && typeof value !== "object") {
      tokens.push(String(value));
    }
  }
  return tokens;
}
```

Update `filterHistoryEntries` line 62 to call `collectSearchTokens` instead of `collectFieldNames`, and update the test suite to cover value matching.

---

### WR-03: No debounce on the search input — filter runs on every keystroke

**File:** `src/components/history/MessageHistoryPanel.tsx:18` / `src/components/history/HistoryFilterBar.tsx:25-27`

**Issue:** `setSearchQuery` is called directly on every `onChange` event. `filterHistoryEntries` is called in a `useMemo` that depends on `searchQuery`, so each keystroke triggers a full re-filter of the entries array. With the history capped at 100 entries the impact is small today, but `collectFieldNames` recurses into deeply nested `fieldValues` trees for every entry on every keystroke. Consistent with the project coding-style preference for predictable behaviour, the input should be debounced.

**Fix:** Introduce a debounced state in `MessageHistoryPanel`:

```typescript
import { useEffect, useMemo, useState } from "react";

// inside MessageHistoryPanel:
const [searchQuery, setSearchQuery] = useState("");
const [debouncedSearch, setDebouncedSearch] = useState("");

useEffect(() => {
  const id = setTimeout(() => setDebouncedSearch(searchQuery), 200);
  return () => clearTimeout(id);
}, [searchQuery]);

// use debouncedSearch in filteredEntries and isFiltered
const filteredEntries = useMemo(
  () => filterHistoryEntries(entries, typeFilter, targetFilter, debouncedSearch),
  [entries, typeFilter, targetFilter, debouncedSearch]
);
```

---

## Info

### IN-01: Search input has no accessible label

**File:** `src/components/history/HistoryFilterBar.tsx:23-28`

**Issue:** The search `<Input>` has a `placeholder` but no `aria-label` or associated `<label>` element. Screen readers will not announce a meaningful field name; `placeholder` text alone is insufficient per WCAG 1.3.1. The two filter inputs below it have the same problem but were pre-existing; the new search field is the one introduced in this phase.

**Fix:**
```tsx
<Input
  aria-label="Full-text search"
  placeholder="Search…"
  value={searchQuery}
  onChange={(e) => onSearchChange(e.target.value)}
  className="h-7 text-xs w-full"
/>
```

---

### IN-02: `searchQuery` / `onSearchChange` are optional in `HistoryFilterBarProps` but always provided by the parent

**File:** `src/components/history/HistoryFilterBar.tsx:8-9`

**Issue:** Both `searchQuery` and `onSearchChange` are declared as optional (`?`) in the interface, with fallback defaults of `""` and `() => {}`. `MessageHistoryPanel` always passes both. The optionality was likely retained for backward compatibility, but it creates a silent path where `onSearchChange` becomes a no-op (the empty function default), meaning a future caller that forgets to pass the prop will get a fully rendered but non-functional search box with no type error.

**Fix:** Since `HistoryFilterBar` is a private component (only used by `MessageHistoryPanel`), make both props required to let the type system catch misuse:

```typescript
interface HistoryFilterBarProps {
  typeFilter: string;
  targetFilter: string;
  onTypeChange: (query: string) => void;
  onTargetChange: (query: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}
```

---

_Reviewed: 2026-05-25T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
