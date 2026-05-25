# Technology Stack — v1.7 Additions

**Project:** Tap (proto-sender)
**Milestone:** v1.7 — Block Apply Completeness + History Search
**Researched:** 2026-05-25
**Scope:** New stack items only. Existing v1.6 stack is validated and unchanged.

---

## Feature A: Block Apply for oneof / WellKnownType / map Fields

### Verdict: No new libraries required

All required primitives are already in the v1.6 stack:

| Existing capability | Used by this feature |
|---------------------|---------------------|
| `react-hook-form` 7.76.0 — `methods.setValue`, `formState.dirtyFields` | Writing block values into complex fields, conflict detection |
| `shadcn/ui` `AlertDialog` (radix-ui 1.4.3) | Per-field overwrite/skip conflict prompt — already installed at `src/components/ui/alert-dialog.tsx`, already used in BlockLibraryPanel delete flow |
| `shadcn/ui` `Dialog` | Alternative for non-blocking prompt variant if needed — also already installed |
| `zustand` 5.x | No store changes needed; conflict state is transient UI state, local React state suffices |
| `dnd-kit` PointerSensor drop wiring | Already complete; `applyBlockRef` contract already exists in FormPanel/ProtoFormRenderer |

### What changes (application code, not stack)

The `applyBlockRef.current` function in `ProtoFormRenderer.tsx` (lines 149–180) currently gates eligibility on:

```ts
f.kind.type === 'scalar' || f.kind.type === 'enum' || f.kind.type === 'message'
```

The v1.7 work extends eligibility to `oneof`, `well_known`, and `map` and adds conflict detection logic before calling `methods.setValue`. The conflict prompt (per-field overwrite/skip) uses the existing `AlertDialog` component — triggered from `FormPanel`, which already owns the `applyBlockRef` ref and orchestrates the drop flow.

### What NOT to add

- No new dialog or overlay library. `AlertDialog` from `radix-ui` is already source-copied into the project via shadcn.
- No new state management library. Conflict state (which fields are in conflict, user choice) is transient and belongs in local React state inside FormPanel.
- No changes to `WellKnownTypeField`, `OneofField`, or `MapField` component internals — the merge writes via `methods.setValue` from outside the component tree, same as today's scalar/enum path.

---

## Feature B: Full-Text Search in History Panel

### Verdict: No search library needed — extend the existing substring pattern

**Why:** `useHistoryStore` is capped at `MAX_ENTRIES = 100`. At N=100 in-memory entries, a `useMemo` + `includes()` scan over serialized field values runs in well under 1ms. The existing `filterHistoryEntries` helper already uses this pattern for type and target filters. The new search requirement adds coverage over more fields (`fieldValues`, field names/keys, `messageTypeName`, target) — it does not add a scale problem.

The milestone goal wording — "search bar across decoded field values, field names/keys, message type name, and queue/exchange target" — describes substring matching over multiple fields, not ranked fuzzy matching. Fuse.js-style typo tolerance is not implied by the UX spec.

### No new dependencies

| Candidate | Version | Why not needed |
|-----------|---------|---------------|
| `fuse.js` | 7.3.0 | Fuzzy ranking and typo tolerance — valuable at thousands of entries, over-engineered at 100 with no ranking requirement. Zero benefit for substring match across flat fields. |
| `minisearch` | 7.2.0 | Inverted index + full-text tokenization — index maintenance overhead exists for a dataset that never exceeds 100 items. Indistinguishable from `includes()` at this scale. |
| `flexsearch` | 0.8.212 | Same as minisearch. Additional concern: FlexSearch has ESM/CJS packaging issues that create Vite config friction. |

### Implementation pattern (application code)

Extend `filterHistoryEntries` in `historyHelpers.ts` to accept a `searchQuery` parameter. When non-empty, test each entry against:

1. `entry.messageTypeName` — direct string
2. `entry.exchange` + `entry.routingKey` — direct strings (already covered by existing target filter; unified search would replace or AND with it)
3. `Object.keys(entry.fieldValues)` — field name match
4. `JSON.stringify(entry.fieldValues)` — field value match (catches nested scalar values without recursive traversal)

All matches use `.toLowerCase().includes(query.toLowerCase())`. This is the same pattern as the existing filter, applied to more fields.

The search input goes into `HistoryFilterBar` as an additional `Input` control (or the existing two inputs are consolidated into a single search bar — planner decides UX layout). State stays in `MessageHistoryPanel` local `useState`, same as today's `typeFilter`/`targetFilter`.

No debounce library needed: `<input onChange>` + `useMemo` at N=100 is imperceptibly fast. A 150ms `setTimeout` debounce in a `useCallback` is acceptable if desired — no library.

### What NOT to add

- No search indexing library (`fuse.js`, `minisearch`, `flexsearch`). None provide meaningful benefit at 100 entries.
- No new Zustand store for search state. Search query is transient UI state.
- No new shadcn UI component. `Input` (already installed) is sufficient; a search icon from `lucide-react` (already installed) is the only visual addition needed.

---

## Existing Stack Reference (v1.6 validated — do not re-research)

| Technology | Version | Status |
|------------|---------|--------|
| Tauri | 2.x | Validated |
| React | 19.1.0 | Validated |
| react-hook-form | 7.76.0 | Validated |
| zod | 4.4.3 (note: PROJECT.md key-decisions cites 3.24.2 — version mismatch in docs, not blocking) | Validated |
| zustand | 5.0.13 | Validated |
| shadcn/ui (nova) + radix-ui | 1.4.3 | Validated |
| Tailwind CSS | 4.x | Validated |
| dnd-kit | 6.3.1 / sortable 10.0.0 | Validated |
| tauri-plugin-store | 2.4.3 | Validated |
| sonner | 2.0.7 | Validated |
| lucide-react | 1.16.0 | Validated |

---

## Summary for Roadmap Planner

Both v1.7 features require **zero new dependencies**. Stack additions: none.

| Feature | New libraries | New shadcn components | Application code scope |
|---------|--------------|----------------------|------------------------|
| Block apply (oneof/WKT/map) | None | None (`AlertDialog` already installed) | `applyBlockRef` logic in ProtoFormRenderer + conflict prompt in FormPanel |
| History full-text search | None | None (`Input` already installed) | Extend `filterHistoryEntries` + add search field to `HistoryFilterBar` |

The only install command for v1.7 is: **none.**

---

## Sources

- Fuse.js version: `npm view fuse.js version` → 7.3.0 (verified 2026-05-25); docs confirmed via Context7 `/krisk/fuse`
- MiniSearch version: `npm view minisearch version` → 7.2.0 (verified 2026-05-25)
- FlexSearch version: `npm view flexsearch version` → 0.8.212 (verified 2026-05-25)
- Project `useHistoryStore` MAX_ENTRIES=100 cap: `src/stores/useHistoryStore.ts` line 6
- `filterHistoryEntries` substring pattern: `src/components/history/historyHelpers.ts`
- `applyBlockRef` contract and current eligibility gate: `src/components/form/ProtoFormRenderer.tsx` lines 149–180
- `AlertDialog` already installed: `src/components/ui/alert-dialog.tsx`, used in `src/components/blocks/BlockLibraryPanel.tsx`
- Full shadcn UI component inventory verified: `src/components/ui/` (2026-05-25)
