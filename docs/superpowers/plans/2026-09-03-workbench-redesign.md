# Workbench Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-layout and restyle the Tap frontend onto the MajesNix design system as the "Workbench" direction: header + files sidebar + Request card + Activity timeline, plan step cards, blocks drawer and a connection sheet.

**Architecture:** Tokens first (`src/index.css`), then a handful of hand-written design components (`src/components/common/`) and restyled shadcn primitives, then a shell (`AppShell`/`AppHeader`) that the two views (`ComposeView`, `PlanView`) fill. Feature areas are rebuilt as new components that reuse the existing hooks, stores and IPC layer unchanged; each area is one task so they can run in parallel worktrees after the shell lands.

**Tech Stack:** React 19 + TypeScript, Tailwind CSS 4 (`@theme inline` tokens), shadcn/radix-ui primitives, Zustand stores (unchanged), react-hook-form, dnd-kit, CodeMirror, lucide-react, sonner, Vitest + Testing Library (jsdom).

**Spec:** `docs/design/workbench-handoff/README.md` (sections §1–§8 are referenced below as "handoff §N"); clickable prototype `docs/design/workbench-handoff/Tap Workbench.dc.html`; current UI for diffing `docs/design/workbench-handoff/Tap - Current.dc.html`.

## Global Constraints

- **No new Zustand stores; no backend behaviour changes.** The only Rust change is additive: `DrainResult.correlation_id` (Task 1). Every current capability stays (handoff "Overview").
- **Fidelity is final for dark.** Colors, type, spacing, radii and control sizes in the handoff are exact. Light theme: derive values for the same token names (Task 1 defines them); keep the theme toggle.
- **Layout:** header 52px; sidebar 272px fixed; Activity 360px fixed; blocks drawer 272px; Request card flexes; window min width 1240 (handoff "Fidelity").
- **Tokens (dark):** bg `#0C0D12`, surface `#13151E`, surface-2 `#1C1F2C`, surface-3 `#252840`; text-1 `#EEF0F8`, text-2 `#9499B8`, text-3 `#5C6182`; border `rgba(255,255,255,.08)`, hairline `.05/.06`, hover `.16`, focus/selected `rgba(123,108,246,.45)`; violet `#7B6CF6`, bright `#A497FF`; teal `#2DD4BF`; success `#34D399`; warning `#FBBF24`; danger `#F87171`; overlay `rgba(12,13,18,.6)` + `blur(12px)`; shadow `0 8px 32px rgba(0,0,0,.6)`; focus ring `0 0 0 3px rgba(123,108,246,.35)`; glow `0 0 24px rgba(123,108,246,.25)`.
- **Tailwind class names for tokens** (defined in Task 1, use everywhere): `bg-background` (bg), `bg-card` (surface), `bg-surface-2`, `bg-surface-3`, `text-foreground` (text-1), `text-muted-foreground` (text-2), `text-ghost` (text-3), `border-border`, `border-hairline`, `border-border-strong`, `text-primary`/`bg-primary` (violet), `text-violet-bright`, `text-teal`, `text-success`, `text-warning`, `text-danger`, `bg-overlay`, `shadow-lg`, `shadow-glow`, `ring-ring`. Opacity modifiers work on all of them (`bg-success/10`).
- **Type scale classes:** `text-10`, `text-11`, `text-12`, `text-13`, `text-14`, `text-15`, `text-16`, `text-20` (px); halves as arbitrary values `text-[10.5px]`, `text-[11.5px]`, `text-[12.5px]`. `font-sans` = Geist Variable, `font-mono` = Geist Mono Variable. Section labels: `text-11 font-semibold uppercase tracking-[.1em] text-ghost`. Tags: `text-10 font-bold uppercase tracking-[.08em]`.
- **Radii classes:** `rounded-xs` 2, `rounded-sm` 4, `rounded-md` 6, `rounded-lg` 10, `rounded-xl` 16, `rounded-full` pill.
- **Icons:** lucide-react, sizes 11–17px as given per element, `strokeWidth={1.5}`.
- **Motion:** hover 150ms, press `active:scale-[.97]`, panels 300ms, easing `cubic-bezier(0.16,1,0.3,1)`, no bounce; respect `prefers-reduced-motion`.
- **Copy:** sentence case for buttons and body, Title Case for section headings only where the handoff shows it, no emoji, numerals always.
- **Tests:** every task keeps `pnpm test` green and the coverage thresholds in `vite.config.ts` (78/70/76/79). jsdom cannot drive Radix portals or cmdk: mock `@/components/ui/select`, `@/components/ui/searchable-select`, `@/components/ui/popover` and `@/components/ui/dropdown-menu` with plain DOM the way `src/components/publish/__tests__/PublishBar.test.tsx` and `src/components/ui/searchable-select.test.tsx` do; reset Zustand stores with `useXStore.setState(...)` in `beforeEach`; flush effects with `await act(async () => {})` in `afterEach`.
- **Commands:** one file `pnpm exec vitest run <path>`; all `pnpm test`; types `pnpm exec tsc --noEmit`; lint `pnpm lint` (0 errors); Rust `cargo test --manifest-path src-tauri/Cargo.toml` (integration tests need the Docker broker from `docker compose up -d`).
- **Git:** work on `feat/workbench-redesign`; conventional commits (`feat(scope): …`, `refactor(scope): …`, `test(scope): …`); use `git mv` when a component is renamed so history follows; no attribution lines.
- **Keep the app runnable after every task.** Task 3 wires the *existing* feature components into the new shell; Tasks 4–10 replace one slot each.

---

## File map

New or renamed files and what owns what. Names in **bold** are new.

| Area | Files |
|---|---|
| Tokens | `src/index.css` (rewrite), `src/App.css` (delete) |
| Common design components | **`src/components/common/SegmentedControl.tsx`**, **`SectionLabel.tsx`**, **`Kbd.tsx`**, **`Tag.tsx`**, **`IconButton.tsx`**, **`EnvironmentPill.tsx`**, **`StatusDot.tsx`**, **`DecodedTree.tsx`**, **`HexDump.tsx`**, **`src/lib/hexDump.ts`** |
| Shell | **`src/components/layout/AppShell.tsx`**, **`AppHeader.tsx`**, **`ShortcutsPopover.tsx`**, `layout/ThemeToggle.tsx` (moved from sidebar), `layout/ComposeView.tsx` (renamed from `AppLayout.tsx`), **`src/hooks/useGlobalShortcuts.ts`**, `src/App.tsx` |
| Connection | **`src/components/connection/ConnectionPill.tsx`**, **`ConnectionSheet.tsx`**, **`ProfileForm.tsx`**, **`profileForm.ts`**, `ConnectionTestResult.tsx` (restyle); delete `ProfileManagementModal.tsx`, `sidebar/ConnectionSection.tsx` |
| Sidebar | **`src/components/sidebar/FilesSidebar.tsx`**, **`FileRow.tsx`**, **`MessageList.tsx`**, **`RecentFiles.tsx`**, **`SidebarFooter.tsx`**, **`useProtoFiles.ts`**, **`useIncludePaths.ts`**, **`PlansSidebar.tsx`** (renamed from `plans/PlanListPanel.tsx`); `IncludePathManager.tsx`, `ClearLocalDataButton.tsx`, `include-paths/IncludePathDialog.tsx` (restyle); delete `Sidebar.tsx`, `FileSection.tsx`, `SchemaExplorer.tsx` |
| Request card | **`src/components/compose/RequestCard.tsx`**, **`RequestHeader.tsx`**, **`DestinationStrip.tsx`**, **`CatalogStatus.tsx`**, **`PropertiesSummary.tsx`**, **`PropertiesSection.tsx`**, **`propertiesSummary.ts`**, **`RequestFooter.tsx`**, **`HexStrip.tsx`**, **`OutcomeChip.tsx`**, **`EmptyState.tsx`**, **`BlockConflictDialog.tsx`**, **`useRequestForm.ts`**, **`useDestination.ts`**, **`usePublish.ts`**, **`destination.ts`**, `compose/RoutingKeyCombobox.tsx` (moved from `publish/`); delete `form/FormPanel.tsx`, `publish/PublishBar.tsx`, `publish/AmqpPropertiesSheet.tsx`, `preview/HexPreviewPanel.tsx` |
| Form fields | `src/components/form/ProtoFormRenderer.tsx`, `JsonEditor.tsx`, `fields/*.tsx` (restyle), **`fields/RepeatedTable.tsx`**, **`fields/fieldMeta.ts`**, **`fields/FieldLabel.tsx`** |
| Activity | **`src/components/activity/ActivityPanel.tsx`**, **`ActivityRow.tsx`**, **`ReplyRow.tsx`**, **`ActivityExpanded.tsx`**, **`ReadModeButton.tsx`**, **`ReadModePopover.tsx`**, **`activityModel.ts`**, **`useActivityActions.ts`**, **`useQueueRead.ts`**, `activity/HexViewDialog.tsx` (moved from `history/`); `response/ResponseQueuePicker.tsx`, `response/SubscribePanel.tsx` (restyle); delete `layout/RightPanel.tsx`, `history/MessageHistoryPanel.tsx`, `HistoryTable.tsx`, `HistoryFilterBar.tsx`, `response/MessageFeedTab.tsx`, `MessageFeedRow.tsx`, `ResponseDecodedView.tsx` |
| Blocks | `src/components/blocks/BlockLibraryPanel.tsx` (restyle), **`BlockCard.tsx`**, **`blockFit.ts`** |
| Plans | `src/components/plans/PlanView.tsx`, `PlanRunBar.tsx`, `StepStatusBadge.tsx`, `step-editor/*.tsx` (restyle), **`StepCard.tsx`**, **`StepCardList.tsx`** (renamed from `StepListPanel.tsx`), **`StepEditor.tsx`** (renamed from `StepFieldEditor.tsx`), **`StepReplyPanel.tsx`**, **`AddStepButton.tsx`**; delete `PlanDetailPanel.tsx`, `StepReplyView.tsx`, `PlanReplyFeedTab.tsx`, `response/ResponseHexSection.tsx` |

Task order and parallelism: 1 → 2 → 3 → {4, 5, 6, 7, 8, 9, 10 in parallel worktrees} → 11.

---

### Task 1: Design tokens, fonts and type extensions

**Files:**
- Modify: `src/index.css` (full rewrite), `package.json` (add `@fontsource-variable/geist-mono`), `pnpm-lock.yaml` (via `pnpm add`)
- Delete: `src/App.css` (unused Vite template; nothing imports it)
- Modify: `src-tauri/tauri.conf.json:14-18` (window min size)
- Modify: `src/lib/types.ts` (`DrainResult.correlationId`, `FeedMessage.receivedAt`), `src/stores/useResponseStore.ts:57-70` (map both), `src/stores/useHistoryStore.ts:18-30` (`correlationId`, `replyTo`, `outcome`), `src/hooks/usePlanRunner.ts:445-456` (`receivedAt: Date.now()`, `timestamp: null`)
- Modify: `src-tauri/src/commands/consume.rs:218-228,459-469,538-548,567-577`, `src-tauri/src/commands/subscribe.rs:127-139,542-552`
- Test: `src/stores/useResponseStore.test.ts` (add), `src/stores/useHistoryStore.test.ts` (add)

**Interfaces:**
- Produces CSS custom properties and Tailwind utilities listed in Global Constraints.
- Produces `FeedMessage.receivedAt: number` (ms, client clock, set when the message enters the store) and `FeedMessage.correlationId` now populated from the broker.
- Produces `HistoryEntry.correlationId?: string; replyTo?: string; outcome?: "ack" | "nack" | "returned" | "timeout"` (all optional; older entries load unchanged).

- [ ] **Step 1: Write the failing store tests**

Append to `src/stores/useResponseStore.test.ts`:

```ts
test("appendMessages keeps the correlation id and stamps a client receipt time", () => {
  const before = Date.now();
  useResponseStore.getState().appendMessages([
    {
      routingKey: "orders.reply", exchange: "", contentType: null, timestamp: null,
      correlationId: "req-7c1e", decoded: { ok: true }, hexString: "0a 01",
      error: null, decodedAs: "Reply", isTerminal: false,
    },
  ]);
  const [msg] = useResponseStore.getState().messages;
  expect(msg.correlationId).toBe("req-7c1e");
  expect(msg.receivedAt).toBeGreaterThanOrEqual(before);
});
```

Append to `src/stores/useHistoryStore.test.ts`:

```ts
test("normalizeHistoryEntry keeps correlationId, replyTo and outcome when present", () => {
  const entry = normalizeHistoryEntry({
    id: "1", timestamp: new Date().toISOString(), messageTypeName: "pkg.Order",
    exchange: "", routingKey: "orders", status: "sent", fieldValues: {},
    payloadBase64: "CgU=", correlationId: "req-1", replyTo: "orders.reply", outcome: "ack",
  });
  expect(entry).toMatchObject({ correlationId: "req-1", replyTo: "orders.reply", outcome: "ack" });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/stores/useResponseStore.test.ts src/stores/useHistoryStore.test.ts`
Expected: FAIL — `correlationId` is `null` / TypeScript complains about unknown `correlationId` on `DrainResult`.

- [ ] **Step 3: Extend the types and stores**

`src/lib/types.ts` — in `DrainResult` add after `contentType`:
```ts
  correlationId: string | null;    // AMQP correlation_id property, null when the publisher did not set one
```
In `FeedMessage` replace the `timestamp` comment and add `receivedAt`:
```ts
  timestamp: number | null;        // publisher timestamp, seconds since epoch; null when not set
  receivedAt: number;              // client clock (ms) when the message entered the feed — drives the Activity timeline
```
`src/stores/useResponseStore.ts` `appendMessages`: `correlationId: result.correlationId ?? null, receivedAt: Date.now(),`.
`src/stores/useHistoryStore.ts` `HistoryEntry`: add
```ts
  correlationId?: string;               // AMQP property set at send time; used to pair replies in the Activity panel
  replyTo?: string;                     // AMQP reply-to queue set at send time
  outcome?: "ack" | "nack" | "returned" | "timeout"; // publisher-confirm result; absent for failed sends and old entries
```
`src/hooks/usePlanRunner.ts` reply feed entry: `timestamp: null, receivedAt: Date.now(),`.

- [ ] **Step 4: Expose `correlation_id` from Rust**

In `consume.rs` `DrainResult` add `pub correlation_id: Option<String>,` after `content_type`. Where the struct is built (`consume.rs:459`, `subscribe.rs:542`) add
```rust
let correlation_id = delivery.properties.correlation_id().as_ref().map(|s| s.to_string());
```
next to the existing `content_type` extraction and pass `correlation_id,`. In `subscribe.rs::error_drain_result` and both test fixtures in `consume.rs` add `correlation_id: None,`. Run `cargo test --manifest-path src-tauri/Cargo.toml drain_result` (unit tests only) — expected: PASS, `cargo clippy` clean.

- [ ] **Step 5: Run the store tests again**

Run: `pnpm exec vitest run src/stores/useResponseStore.test.ts src/stores/useHistoryStore.test.ts`
Expected: PASS. Then `pnpm exec tsc --noEmit` — fix `MessageFeedTab.test.tsx`/`MessageFeedRow` fixtures that build `FeedMessage` literals by adding `receivedAt: 0` (they are deleted in Task 8; keep them compiling now).

- [ ] **Step 6: Install Geist Mono and rewrite the tokens**

Run: `pnpm add @fontsource-variable/geist-mono@^5.3.0`. Delete `src/App.css`. Replace `src/index.css` with:

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@import "@fontsource-variable/geist";
@import "@fontsource-variable/geist-mono";

@custom-variant dark (&:is(.dark *));

/* ── MajesNix tokens — light (derived) ─────────────────────────────────── */
:root {
  --background: #f4f5fa;
  --foreground: #141626;
  --card: #ffffff;
  --card-foreground: #141626;
  --popover: #ffffff;
  --popover-foreground: #141626;
  --surface-2: #eceef5;
  --surface-3: #dfe2ee;
  --primary: #6a5ae6;
  --primary-foreground: #ffffff;
  --secondary: #eceef5;
  --secondary-foreground: #141626;
  --muted: #eceef5;
  --muted-foreground: #5a6080;
  --ghost: #8c92ae;
  --accent: #eceef5;
  --accent-foreground: #141626;
  --destructive: #dc2626;
  --danger: #dc2626;
  --success: #15935f;
  --warning: #b7791f;
  --teal: #0fa394;
  --violet-bright: #5b4fd4;
  --border: rgba(20, 22, 38, 0.1);
  --hairline: rgba(20, 22, 38, 0.06);
  --border-strong: rgba(106, 90, 230, 0.5);
  --input: rgba(20, 22, 38, 0.1);
  --ring: #6a5ae6;
  --overlay: rgba(244, 245, 250, 0.7);
  --shadow-lg: 0 8px 32px rgba(20, 22, 38, 0.18);
  --shadow-glow: 0 0 24px rgba(106, 90, 230, 0.25);
  --kbd-bg: rgba(255, 255, 255, 0.25);
  --radius: 6px;
}

/* ── MajesNix tokens — dark (final, handoff "Design tokens") ───────────── */
.dark {
  --background: #0c0d12;
  --foreground: #eef0f8;
  --card: #13151e;
  --card-foreground: #eef0f8;
  --popover: #13151e;
  --popover-foreground: #eef0f8;
  --surface-2: #1c1f2c;
  --surface-3: #252840;
  --primary: #7b6cf6;
  --primary-foreground: #ffffff;
  --secondary: #1c1f2c;
  --secondary-foreground: #eef0f8;
  --muted: #1c1f2c;
  --muted-foreground: #9499b8;
  --ghost: #5c6182;
  --accent: #1c1f2c;
  --accent-foreground: #eef0f8;
  --destructive: #f87171;
  --danger: #f87171;
  --success: #34d399;
  --warning: #fbbf24;
  --teal: #2dd4bf;
  --violet-bright: #a497ff;
  --border: rgba(255, 255, 255, 0.08);
  --hairline: rgba(255, 255, 255, 0.05);
  --border-strong: rgba(123, 108, 246, 0.45);
  --input: rgba(255, 255, 255, 0.08);
  --ring: #7b6cf6;
  --overlay: rgba(12, 13, 18, 0.6);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.6);
  --shadow-glow: 0 0 24px rgba(123, 108, 246, 0.25);
  --kbd-bg: rgba(255, 255, 255, 0.14);
}

@theme inline {
  --font-sans: "Geist Variable", ui-sans-serif, system-ui, sans-serif;
  --font-heading: var(--font-sans);
  --font-mono: "Geist Mono Variable", ui-monospace, "SF Mono", Menlo, monospace;

  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-surface-2: var(--surface-2);
  --color-surface-3: var(--surface-3);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-ghost: var(--ghost);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-danger: var(--danger);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-teal: var(--teal);
  --color-violet-bright: var(--violet-bright);
  --color-border: var(--border);
  --color-hairline: var(--hairline);
  --color-border-strong: var(--border-strong);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-overlay: var(--overlay);

  --shadow-lg: var(--shadow-lg);
  --shadow-glow: var(--shadow-glow);

  --radius-xs: 2px;
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 10px;
  --radius-xl: 16px;
  --radius-2xl: 20px;

  --text-10: 10px;  --text-10--line-height: 14px;
  --text-11: 11px;  --text-11--line-height: 16px;
  --text-12: 12px;  --text-12--line-height: 16px;
  --text-13: 13px;  --text-13--line-height: 18px;
  --text-14: 14px;  --text-14--line-height: 20px;
  --text-15: 15px;  --text-15--line-height: 20px;
  --text-16: 16px;  --text-16--line-height: 22px;
  --text-20: 20px;  --text-20--line-height: 26px;

  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --animate-tap-pulse: tap-pulse 1.6s ease-in-out infinite;
  --animate-row-highlight: row-highlight 1.5s var(--ease-out-expo) forwards;
  --animate-row-in: row-in 200ms var(--ease-out-expo);

  @keyframes tap-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
  @keyframes row-highlight { from { background-color: rgba(123, 108, 246, 0.06); } to { background-color: transparent; } }
  @keyframes row-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
}

@layer base {
  * { border-color: var(--border); }
  html { font-family: var(--font-sans); -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
  body { background-color: var(--background); color: var(--foreground); font-size: 13px; line-height: 18px; }
  input::placeholder, textarea::placeholder { color: var(--ghost); }
  ::selection { background: rgba(123, 108, 246, 0.35); }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
}
```

Verify the old `--color-sidebar-*` and `--color-chart-*` names are not referenced anywhere (`grep -rn "sidebar-\|chart-" src --include=*.tsx`); they are dropped.

- [ ] **Step 7: Window minimum size**

In `src-tauri/tauri.conf.json` window entry add `"minWidth": 1240, "minHeight": 720`.

- [ ] **Step 8: Verify the build compiles the CSS**

Run: `pnpm exec vite build` — expected: exit 0, no unknown-utility warnings. Run `pnpm test` — expected: all green (the existing UI still uses shadcn token names, which still exist).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(design): MajesNix tokens, Geist Mono, feed receipt time and correlation id"
```

---

### Task 2: Common design components and restyled primitives

**Files:**
- Create: `src/lib/hexDump.ts`, `src/components/common/{SegmentedControl,SectionLabel,Kbd,Tag,IconButton,EnvironmentPill,StatusDot,DecodedTree,HexDump}.tsx`
- Modify: `src/components/ui/{button,input,textarea,badge,tabs,switch,checkbox,label,select,dialog,alert-dialog,sheet,popover,tooltip,sonner,command,dropdown-menu,scroll-area,searchable-select}.tsx`
- Test: `src/lib/__tests__/hexDump.test.ts`, `src/components/common/__tests__/{SegmentedControl,Tag,IconButton,DecodedTree,HexDump}.test.tsx`

**Interfaces (Produces):**
```ts
// src/components/common/SegmentedControl.tsx
export interface SegmentedItem<T extends string> {
  value: T; label: React.ReactNode; icon?: React.ReactNode; title?: string; disabled?: boolean;
  /** extra classes when active, e.g. "text-warning" for the Shared environment segment */
  activeClassName?: string;
}
export function SegmentedControl<T extends string>(props: {
  value: T; onChange: (value: T) => void; items: SegmentedItem<T>[];
  /** tabs: container bg-card, active bg-surface-2 (view switch, activity filter). choice: container bg-background, active bg-surface-3 (Queue|Exchange, delivery, oneof, environment) */
  variant?: "tabs" | "choice"; size?: "xs" | "sm" | "md"; mono?: boolean; stretch?: boolean;
  disabled?: boolean; className?: string; "aria-label": string;
}): JSX.Element   // role="radiogroup" with role="radio" buttons, aria-checked, ArrowLeft/ArrowRight move selection

// src/components/common/SectionLabel.tsx
export function SectionLabel(props: React.ComponentProps<"span">): JSX.Element  // text-11 font-semibold uppercase tracking-[.1em] text-ghost

// src/components/common/Kbd.tsx
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }): JSX.Element

// src/components/common/Tag.tsx
export type TagTone = "success" | "warning" | "danger" | "teal" | "violet" | "neutral";
export function Tag(props: { tone: TagTone; size?: "xs" | "sm" | "md"; children: React.ReactNode; className?: string; title?: string }): JSX.Element
// heights xs 18 / sm 20 / md 22, px 7/8/9, rounded-full, text-10 font-bold uppercase tracking-[.08em], bg tone/12 text tone (neutral: bg-surface-2 text-muted-foreground)

// src/components/common/IconButton.tsx
export function IconButton(props: React.ComponentProps<"button"> & {
  size?: 22 | 24 | 26 | 28 | 32; tone?: "ghost" | "violet"; active?: boolean; danger?: boolean; label: string; // aria-label + title
}): JSX.Element
// ghost: text-muted-foreground hover:bg-surface-2 hover:text-foreground; violet: text-violet-bright hover:bg-primary/12; active: bg-primary/12 text-violet-bright; danger: hover:text-danger; rounded-sm; disabled:opacity-50

// src/components/common/EnvironmentPill.tsx
export function EnvironmentPill({ environment, size }: { environment: ProfileEnvironment; size?: "sm" | "md" }): JSX.Element
// LOCAL success, SHARED warning, PRODUCTION danger; data-testid="environment-badge"; text = ENVIRONMENT_LABELS[env].toUpperCase()

// src/components/common/StatusDot.tsx
export function StatusDot({ tone, size = 8, pulse, glow }: { tone: "success" | "danger" | "ghost" | "teal" | "warning" | "violet"; size?: 6 | 8; pulse?: boolean; glow?: boolean }): JSX.Element
// glow: box-shadow 0 0 8px tone/60 ; pulse: animate-tap-pulse

// src/components/common/DecodedTree.tsx
export function DecodedTree({ value, className }: { value: Record<string, unknown> | unknown[]; className?: string }): JSX.Element
// mono text-12 leading-[1.6]; key text-muted-foreground; string values text-violet-bright wrapped in quotes; numbers/booleans text-foreground;
// strings matching /^[A-Z][A-Z0-9_]*$/ (enum names) text-teal without quotes; null → "null" text-ghost;
// nested object → clickable summary "{…}" (text-muted-foreground), array → "[N items]" or "[N <Type>]" when every element is an object with the same keys… keep it "[N items]";
// summaries toggle open (default collapsed); children indented pl-3 border-l border-hairline

// src/components/common/HexDump.tsx
export function HexDump({ hex, maxHeight = 180, className }: { hex: string; maxHeight?: number; className?: string }): JSX.Element
// grid grid-cols-2 gap-x-8 p-3 rounded-md bg-background border border-hairline font-mono text-[11.5px] leading-5 overflow-auto;
// each row: offset text-ghost w-9, bytes text-foreground tracking-[.02em] w-[200px], ascii text-ghost

// src/lib/hexDump.ts
export interface HexRow { offset: string; bytes: string; ascii: string }
export function hexRows(hex: string, bytesPerRow?: number): HexRow[]   // accepts spaced or unspaced hex
export function inlineHex(hex: string, maxBytes?: number): string       // first N bytes spaced, "…" appended when longer
```

- [ ] **Step 1: Write the failing tests**

`src/lib/__tests__/hexDump.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { hexRows, inlineHex } from "@/lib/hexDump";

describe("hexRows", () => {
  it("splits spaced hex into 8-byte rows with offset and ascii", () => {
    const rows = hexRows("48 65 6c 6c 6f 00 ff 21 41");
    expect(rows).toEqual([
      { offset: "0000", bytes: "48 65 6c 6c 6f 00 ff 21", ascii: "Hello··!" },
      { offset: "0008", bytes: "41", ascii: "A" },
    ]);
  });
  it("accepts unspaced hex and returns no rows for an empty string", () => {
    expect(hexRows("0a05")[0].bytes).toBe("0a 05");
    expect(hexRows("")).toEqual([]);
  });
});

describe("inlineHex", () => {
  it("returns the first bytes and an ellipsis when longer", () => {
    expect(inlineHex("0a 05 0c", 2)).toBe("0a 05 …");
    expect(inlineHex("0a 05", 2)).toBe("0a 05");
  });
});
```

`src/components/common/__tests__/SegmentedControl.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SegmentedControl } from "@/components/common/SegmentedControl";

const items = [
  { value: "queue", label: "Queue" },
  { value: "exchange", label: "Exchange" },
] as const;

describe("SegmentedControl", () => {
  it("renders a radiogroup and marks the current value checked", () => {
    render(<SegmentedControl aria-label="Target" value="queue" onChange={() => {}} items={[...items]} />);
    expect(screen.getByRole("radiogroup", { name: "Target" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Queue" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Exchange" })).toHaveAttribute("aria-checked", "false");
  });
  it("calls onChange with the clicked value", () => {
    const onChange = vi.fn();
    render(<SegmentedControl aria-label="Target" value="queue" onChange={onChange} items={[...items]} />);
    fireEvent.click(screen.getByRole("radio", { name: "Exchange" }));
    expect(onChange).toHaveBeenCalledWith("exchange");
  });
  it("moves with arrow keys and skips disabled items", () => {
    const onChange = vi.fn();
    render(<SegmentedControl aria-label="T" value="queue" onChange={onChange}
      items={[...items, { value: "x", label: "X", disabled: true }]} />);
    fireEvent.keyDown(screen.getByRole("radio", { name: "Queue" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledWith("exchange");
    fireEvent.keyDown(screen.getByRole("radio", { name: "Exchange" }), { key: "ArrowRight" });
    expect(onChange).toHaveBeenLastCalledWith("queue"); // wraps, skipping the disabled item
  });
  it("disables every segment when disabled", () => {
    render(<SegmentedControl aria-label="T" value="queue" onChange={() => {}} items={[...items]} disabled />);
    expect(screen.getByRole("radio", { name: "Queue" })).toBeDisabled();
  });
});
```

`src/components/common/__tests__/Tag.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { Tag } from "@/components/common/Tag";
import { EnvironmentPill } from "@/components/common/EnvironmentPill";

it("Tag renders uppercase text with the tone classes", () => {
  render(<Tag tone="success">ack</Tag>);
  const el = screen.getByText("ack");
  expect(el.className).toContain("text-success");
  expect(el.className).toContain("uppercase");
});
it("EnvironmentPill maps environments to tones and labels", () => {
  const { rerender } = render(<EnvironmentPill environment="production" />);
  expect(screen.getByTestId("environment-badge")).toHaveTextContent("PRODUCTION");
  expect(screen.getByTestId("environment-badge").className).toContain("text-danger");
  rerender(<EnvironmentPill environment="local" />);
  expect(screen.getByTestId("environment-badge").className).toContain("text-success");
});
```

`src/components/common/__tests__/IconButton.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { IconButton } from "@/components/common/IconButton";

it("IconButton exposes its label to assistive tech and forwards clicks", () => {
  const onClick = vi.fn();
  render(<IconButton label="Reload" onClick={onClick} size={24}><span>i</span></IconButton>);
  const btn = screen.getByRole("button", { name: "Reload" });
  expect(btn).toHaveAttribute("title", "Reload");
  fireEvent.click(btn);
  expect(onClick).toHaveBeenCalled();
});
it("IconButton marks the active state with aria-pressed", () => {
  render(<IconButton label="Blocks" active><span>i</span></IconButton>);
  expect(screen.getByRole("button", { name: "Blocks" })).toHaveAttribute("aria-pressed", "true");
});
```

`src/components/common/__tests__/DecodedTree.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { it, expect } from "vitest";
import { DecodedTree } from "@/components/common/DecodedTree";

it("renders scalar keys and values with the design colors", () => {
  render(<DecodedTree value={{ order_id: "ord_1", amount: 2.5, status: "ORDER_STATUS_PAID", ok: true, none: null }} />);
  expect(screen.getByText("order_id").className).toContain("text-muted-foreground");
  expect(screen.getByText('"ord_1"').className).toContain("text-violet-bright");
  expect(screen.getByText("2.5").className).toContain("text-foreground");
  expect(screen.getByText("ORDER_STATUS_PAID").className).toContain("text-teal");
  expect(screen.getByText("true")).toBeInTheDocument();
  expect(screen.getByText("null").className).toContain("text-ghost");
});
it("collapses nested values behind a summary that expands on click", () => {
  render(<DecodedTree value={{ items: [{ sku: "a" }], shipping: { city: "Hamburg" } }} />);
  expect(screen.getByText("[1 items]")).toBeInTheDocument();
  expect(screen.queryByText('"Hamburg"')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("{…}"));
  expect(screen.getByText('"Hamburg"')).toBeInTheDocument();
});
```

`src/components/common/__tests__/HexDump.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { HexDump } from "@/components/common/HexDump";

it("renders one row per 8 bytes with offsets", () => {
  render(<HexDump hex={"0a ".repeat(9).trim()} />);
  expect(screen.getByText("0000")).toBeInTheDocument();
  expect(screen.getByText("0008")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run src/lib/__tests__/hexDump.test.ts src/components/common`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `hexDump.ts`**

```ts
export interface HexRow { offset: string; bytes: string; ascii: string }

const PRINTABLE_MIN = 32;
const PRINTABLE_MAX = 126;

function bytesOf(hex: string): string[] {
  return hex.replace(/\s+/g, "").toLowerCase().match(/.{2}/g) ?? [];
}

/** Rows of `bytesPerRow` bytes: 4-digit hex offset, spaced bytes, printable ASCII with "·" for the rest. */
export function hexRows(hex: string, bytesPerRow = 8): HexRow[] {
  const bytes = bytesOf(hex);
  const rows: HexRow[] = [];
  for (let i = 0; i < bytes.length; i += bytesPerRow) {
    const chunk = bytes.slice(i, i + bytesPerRow);
    rows.push({
      offset: i.toString(16).padStart(4, "0"),
      bytes: chunk.join(" "),
      ascii: chunk
        .map((b) => {
          const code = parseInt(b, 16);
          return code >= PRINTABLE_MIN && code <= PRINTABLE_MAX ? String.fromCharCode(code) : "·";
        })
        .join(""),
    });
  }
  return rows;
}

/** The first `maxBytes` bytes as spaced hex, with an ellipsis when the payload is longer. */
export function inlineHex(hex: string, maxBytes = 48): string {
  const bytes = bytesOf(hex);
  const head = bytes.slice(0, maxBytes).join(" ");
  return bytes.length > maxBytes ? `${head} …` : head;
}
```

- [ ] **Step 4: Implement the common components**

`SegmentedControl.tsx`:
```tsx
import { useCallback } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedItem<T extends string> {
  value: T; label: React.ReactNode; icon?: React.ReactNode; title?: string; disabled?: boolean; activeClassName?: string;
}
interface SegmentedControlProps<T extends string> {
  value: T; onChange: (value: T) => void; items: SegmentedItem<T>[];
  variant?: "tabs" | "choice"; size?: "xs" | "sm" | "md"; mono?: boolean; stretch?: boolean;
  disabled?: boolean; className?: string; "aria-label": string;
}
const SIZE_CLASS = { xs: "h-[22px] px-2 text-11", sm: "h-[26px] px-2.5 text-12", md: "h-7 px-3 text-[12.5px]" } as const;

export function SegmentedControl<T extends string>({ value, onChange, items, variant = "tabs", size = "sm", mono, stretch, disabled, className, "aria-label": ariaLabel }: SegmentedControlProps<T>) {
  const move = useCallback((from: number, step: 1 | -1) => {
    const enabled = items.filter((i) => !i.disabled);
    if (enabled.length === 0) return;
    const current = enabled.findIndex((i) => i.value === items[from].value);
    const next = enabled[(current + step + enabled.length) % enabled.length];
    onChange(next.value);
  }, [items, onChange]);

  return (
    <div role="radiogroup" aria-label={ariaLabel}
      className={cn("inline-flex rounded-md border border-border p-0.5", variant === "tabs" ? "bg-card" : "bg-background", stretch && "flex w-full", className)}>
      {items.map((item, index) => {
        const active = item.value === value;
        return (
          <button key={item.value} type="button" role="radio" aria-checked={active} title={item.title}
            disabled={disabled || item.disabled} tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => { if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(index, 1); } if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(index, -1); } }}
            className={cn("inline-flex items-center justify-center gap-1.5 rounded-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-50",
              SIZE_CLASS[size], mono && "font-mono", stretch && "flex-1",
              active ? cn("font-semibold text-foreground", variant === "tabs" ? "bg-surface-2" : "bg-surface-3", item.activeClassName) : "text-muted-foreground hover:text-foreground")}>
            {item.icon}{item.label}
          </button>
        );
      })}
    </div>
  );
}
```

`Tag.tsx`:
```tsx
import { cn } from "@/lib/utils";
export type TagTone = "success" | "warning" | "danger" | "teal" | "violet" | "neutral";
const TONE: Record<TagTone, string> = {
  success: "bg-success/12 text-success", warning: "bg-warning/12 text-warning", danger: "bg-danger/12 text-danger",
  teal: "bg-teal/12 text-teal", violet: "bg-primary/12 text-violet-bright", neutral: "bg-surface-2 text-muted-foreground",
};
const SIZE = { xs: "h-[18px] px-[7px]", sm: "h-5 px-2", md: "h-[22px] px-[9px]" } as const;
export function Tag({ tone, size = "sm", className, children, title }: { tone: TagTone; size?: keyof typeof SIZE; className?: string; children: React.ReactNode; title?: string }) {
  return <span title={title} className={cn("inline-flex items-center rounded-full text-10 font-bold uppercase tracking-[.08em] whitespace-nowrap", TONE[tone], SIZE[size], className)}>{children}</span>;
}
```

`EnvironmentPill.tsx`: `const TONES: Record<ProfileEnvironment, TagTone> = { local: "success", shared: "warning", production: "danger" }`; renders `<Tag tone={TONES[environment]} size={size} data-testid="environment-badge">` — give `Tag` a `...rest` spread of span props so `data-testid` passes through.

`IconButton.tsx`:
```tsx
const SIZE: Record<22 | 24 | 26 | 28 | 32, string> = { 22: "size-[22px]", 24: "size-6", 26: "size-[26px]", 28: "size-7", 32: "size-8" };
export function IconButton({ size = 24, tone = "ghost", active, danger, label, className, type = "button", ...rest }: IconButtonProps) {
  return (
    <button type={type} aria-label={label} title={rest.title ?? label} aria-pressed={active}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/35 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
        SIZE[size],
        tone === "violet" ? "text-violet-bright hover:bg-primary/12" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
        active && "bg-primary/12 text-violet-bright",
        danger && "hover:text-danger hover:bg-danger/12",
        className)}
      {...rest} />
  );
}
```

`SectionLabel.tsx`, `Kbd.tsx` (`inline-flex h-5 items-center rounded-sm px-1.5 font-mono text-11 font-medium` with `style={{ background: "var(--kbd-bg)" }}`), `StatusDot.tsx` (`inline-block rounded-full` with size classes `size-1.5`/`size-2`, tone bg classes, `glow && "shadow-[0_0_8px_var(--success)]"` implemented per tone via a small map, `pulse && "animate-tap-pulse"`).

`DecodedTree.tsx`: recursive `Node` with `useState(false)` for open; render lines as `<div className="flex gap-2 min-w-0"><span className="text-muted-foreground">{key}</span><Value/></div>`; scalar formatting function `formatScalar(v): { text: string; className: string }` exported for tests; enum heuristic `/^[A-Z][A-Z0-9_]*$/`.

`HexDump.tsx`: maps `hexRows(hex)` to rows; `style={{ maxHeight }}`.

- [ ] **Step 5: Run the common tests**

Run: `pnpm exec vitest run src/lib/__tests__/hexDump.test.ts src/components/common`
Expected: PASS.

- [ ] **Step 6: Restyle the shadcn primitives**

Change class strings only (keep exports, props and data-slot attributes so existing tests keep working until their components are replaced). Exact treatments:

- `button.tsx` — base: `inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-13 font-medium whitespace-nowrap transition-[color,background-color,filter,transform] duration-150 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/35 active:scale-[.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`. Variants: `default: "bg-primary text-primary-foreground font-semibold hover:brightness-110 hover:shadow-glow"`, `outline: "border border-border bg-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground aria-expanded:bg-surface-2"`, `secondary: "bg-surface-2 text-foreground hover:bg-surface-3"`, `ghost: "text-muted-foreground hover:bg-surface-2 hover:text-foreground aria-expanded:bg-surface-2"`, `destructive: "bg-danger/12 text-danger hover:bg-danger/20"`, `link: "text-violet-bright hover:text-foreground"`. Sizes: `xs: "h-[26px] px-2 text-12 rounded-sm"`, `sm: "h-7 px-2.5 text-12"`, `default: "h-[30px] px-3"`, `md: "h-[34px] px-3.5"`, `lg: "h-9 px-3.5 pr-2"`, `icon: "size-7 rounded-sm"`, `"icon-xs": "size-[22px] rounded-sm [&_svg:not([class*='size-'])]:size-3"`, `"icon-sm": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3.5"`, `"icon-lg": "size-8"`.
- `input.tsx` — `h-9 w-full min-w-0 rounded-md border border-border bg-background px-3 text-13 text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-ghost focus-visible:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/35 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger`.
- `textarea.tsx` — same tokens, `min-h-16 py-2`.
- `badge.tsx` — base `inline-flex h-5 w-fit shrink-0 items-center gap-1 rounded-full px-2 text-11 font-medium whitespace-nowrap`; `default: "bg-primary/12 text-violet-bright"`, `secondary: "bg-surface-2 text-muted-foreground"`, `destructive: "bg-danger/12 text-danger"`, `outline: "border border-border text-muted-foreground"`, `ghost`, `link` as before.
- `tabs.tsx` — list `inline-flex w-fit items-center rounded-md border border-border bg-card p-0.5`; trigger `inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-sm px-3 text-12 font-medium text-muted-foreground transition-colors hover:text-foreground data-active:bg-surface-2 data-active:font-semibold data-active:text-foreground`; drop the `line` variant underline classes (keep the variant prop for compatibility).
- `switch.tsx` — root `h-4 w-7 rounded-full border-0 data-checked:bg-primary data-unchecked:bg-surface-3` (sizes: `data-[size=sm]:h-[14px] data-[size=sm]:w-6`); thumb `size-3 rounded-full data-checked:translate-x-[14px] data-unchecked:translate-x-0.5 data-checked:bg-white data-unchecked:bg-muted-foreground`.
- `checkbox.tsx` — `size-4 rounded-sm border border-border bg-background data-checked:border-primary data-checked:bg-primary data-checked:text-white`.
- `label.tsx` — `text-12 text-muted-foreground font-normal`.
- `select.tsx` — trigger `flex h-9 w-full items-center justify-between gap-2 rounded-md border border-border bg-background pl-3 pr-2.5 text-13 whitespace-nowrap transition-colors hover:border-border-strong focus-visible:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/35 data-placeholder:text-ghost data-[size=sm]:h-[34px] [&_svg]:size-3.5 [&_svg]:text-ghost`; content `rounded-lg border border-border bg-card p-1 text-foreground shadow-lg`; item `rounded-sm px-2 py-1.5 text-13 focus:bg-surface-2`.
- `dialog.tsx` / `alert-dialog.tsx` — overlay `fixed inset-0 z-50 bg-overlay backdrop-blur-[12px] duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0`; content `rounded-xl border border-border bg-card p-5 text-13 shadow-lg gap-3 sm:max-w-md`; title `text-15 font-semibold`; description `text-13 text-muted-foreground`; footer `mt-1 flex justify-end gap-2` (remove the `-mx-4 -mb-4 bg-muted/50 border-t` treatment); `AlertDialogAction` keeps the `variant` prop (destructive = `bg-danger/12 text-danger hover:bg-danger/20`).
- `sheet.tsx` — overlay as dialog; content `fixed z-50 flex flex-col gap-0 bg-card/97 border-border shadow-lg duration-200 data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:w-[440px] data-[side=right]:border-l data-open:animate-in data-open:slide-in-from-right-2 data-open:fade-in-0 data-closed:animate-out data-closed:slide-out-to-right-2 data-closed:fade-out-0` (keep the other sides' classes); close button `IconButton`-like 28px at `top-4 right-4`; header `p-[18px_20px_12px]`; title `text-15 font-semibold`; description `text-12 text-ghost`.
- `popover.tsx` — content `z-50 w-72 rounded-lg border border-border bg-card p-2 text-13 text-foreground shadow-lg outline-none duration-150 …animate classes unchanged`.
- `tooltip.tsx` — content `z-50 max-w-xs rounded-sm border border-border bg-surface-3 px-2 py-1 text-12 text-foreground shadow-lg`; remove the arrow.
- `sonner.tsx` — style vars: `--normal-bg: var(--surface-2)`, `--normal-text: var(--foreground)`, `--normal-border: var(--border)`, `--border-radius: 10px`; add `--success-text: var(--success)`, `--error-text: var(--danger)`; `toastOptions.classNames.toast: "cn-toast text-13"`.
- `command.tsx` — root `bg-transparent p-0`; input wrapper `border-b border-hairline px-2` with `h-8 text-13 bg-transparent` input (drop InputGroup); list `max-h-72 p-1`; item `rounded-sm px-2 py-1.5 text-13 data-selected:bg-surface-2 data-selected:text-foreground`; empty `py-6 text-center text-12 text-ghost`.
- `dropdown-menu.tsx` — content `min-w-40 rounded-lg border border-border bg-card p-1 text-13 shadow-lg`; item `rounded-sm px-2 py-1.5 text-13 focus:bg-surface-2`; destructive item `text-danger focus:bg-danger/12`.
- `scroll-area.tsx` — thumb `bg-foreground/15`.
- `searchable-select.tsx` — add props `meta?: React.ReactNode` (trailing, `font-mono text-11 text-ghost`), `mono?: boolean` (default `true`, applies `font-mono text-[12.5px]` to the value), `size?: "sm" | "md"` (`h-[34px]` | `h-9`); trigger becomes a plain `<button role="combobox">` styled `flex items-center gap-2 rounded-md border border-border bg-background pl-3 pr-2 text-left transition-colors hover:border-border-strong focus-visible:ring-3 focus-visible:ring-ring/35 disabled:opacity-50` with `ChevronsUpDown size={14} className="text-ghost"`; keep `w-48` default width, the popover width matches the trigger via `w-(--radix-popover-trigger-width)`; keep `title` on the value span and the `Check` indicator behaviour so `src/components/ui/searchable-select.test.tsx` still passes.

- [ ] **Step 7: Run the whole suite and the type check**

Run: `pnpm test && pnpm exec tsc --noEmit`
Expected: PASS. If a test asserted an old class (e.g. `bg-muted` on the Library button in `FormPanel.test.tsx:389`), update the assertion to the new class — those tests are replaced in later tasks anyway.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(design): common design components and restyled primitives"
```

---

### Task 3: Shell — App state, header, connection pill, compose view

**Files:**
- Create: `src/components/layout/AppShell.tsx`, `src/components/layout/AppHeader.tsx`, `src/components/layout/ShortcutsPopover.tsx`, `src/components/connection/ConnectionPill.tsx`, `src/hooks/useGlobalShortcuts.ts`
- Rename: `git mv src/components/sidebar/ThemeToggle.tsx src/components/layout/ThemeToggle.tsx`; `git mv src/components/layout/AppLayout.tsx src/components/layout/ComposeView.tsx`
- Modify: `src/App.tsx`, `src/components/plans/PlanView.tsx` (use `AppShell`; keep old panels inside for now), `src/components/sidebar/Sidebar.tsx` (drop the Plans button + ConnectionSection + ThemeToggle — they moved to the header)
- Test: `src/components/layout/__tests__/AppHeader.test.tsx`, `src/components/connection/__tests__/ConnectionPill.test.tsx`, update `src/__tests__/keyboard-shortcuts.test.tsx` (import `ComposeView`), delete `src/components/connection/__tests__/ConnectionSection.test.tsx` and `src/components/publish/__tests__/PublishBar-quickswitch.test.tsx` (their behaviours move to the pill tests)

**Interfaces:**
- Consumes: `SegmentedControl`, `IconButton`, `EnvironmentPill`, `StatusDot`, `Kbd`, `SectionLabel` (Task 2); `findProfile`, `profileEnvironment` from `@/lib/profileSafety`; `listProfiles`, `activateProfile`, `keychainStatus` from `@/lib/ipc`.
- Produces:
```ts
// src/App.tsx
export type WorkbenchView = "compose" | "plans";
export type SheetState = null | { mode: "list" } | { mode: "new" } | { mode: "edit"; profile: string };
// App owns: view, blocksOpen, sheet. It renders <AppHeader …/> inside AppShell and either <ComposeView/> or <PlanView/>.

// src/components/layout/AppShell.tsx
export function AppShell(props: { header: React.ReactNode; sidebar: React.ReactNode; drawer?: React.ReactNode; main: React.ReactNode; aside: React.ReactNode }): JSX.Element
// <div class="flex h-screen w-screen min-w-[1240px] flex-col overflow-hidden bg-background text-foreground">
//   {header}  <div class="flex flex-1 min-h-0">  <aside class="flex w-[272px] shrink-0 flex-col border-r border-border overflow-hidden">{sidebar}</aside>
//   {drawer}  <main class="flex min-w-0 flex-1 flex-col">{main}</main>  <aside class="flex w-[360px] shrink-0 flex-col border-l border-border min-h-0">{aside}</aside> </div></div>

// src/components/layout/AppHeader.tsx
export function AppHeader(props: { view: WorkbenchView; onViewChange: (v: WorkbenchView) => void; blocksOpen: boolean; onToggleBlocks: () => void; blocksDisabled?: boolean; onOpenSheet: (s: Exclude<SheetState, null>) => void }): JSX.Element

// src/components/connection/ConnectionPill.tsx
export function ConnectionPill({ onOpenSheet }: { onOpenSheet: (s: Exclude<SheetState, null>) => void }): JSX.Element

// src/components/layout/ComposeView.tsx
export interface ComposeSignals { focusFilter: React.MutableRefObject<(() => void) | null>; toggleHex: React.MutableRefObject<(() => void) | null>; toggleReadMode: React.MutableRefObject<(() => void) | null>; }
export function ComposeView(props: { blocksOpen: boolean }): JSX.Element
// owns the three signal refs above, binds mod+1 → focusFilter, mod+2 → toggleHex, mod+3 → toggleReadMode (react-hotkeys-hook, enableOnFormTags), owns the DndContext + DragOverlay for block drags (moved verbatim from AppLayout).

// src/hooks/useGlobalShortcuts.ts
export function useGlobalShortcuts(): void  // mod+o → requestOpenFile, mod+r → requestReload (moved from AppLayout); called once in App
```

- [ ] **Step 1: Write the failing tests**

`src/components/layout/__tests__/AppHeader.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { AppHeader } from "@/components/layout/AppHeader";

vi.mock("@/components/connection/ConnectionPill", () => ({ ConnectionPill: () => <div data-testid="pill" /> }));
vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "dark", setTheme: vi.fn() }) }));

function renderHeader(overrides: Partial<React.ComponentProps<typeof AppHeader>> = {}) {
  const props = { view: "compose" as const, onViewChange: vi.fn(), blocksOpen: false, onToggleBlocks: vi.fn(), onOpenSheet: vi.fn(), ...overrides };
  render(<AppHeader {...props} />);
  return props;
}

describe("AppHeader", () => {
  it("shows the brand, the view switch and the connection pill", () => {
    renderHeader();
    expect(screen.getByText("Tap")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /compose/i })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /plans/i })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByTestId("pill")).toBeInTheDocument();
  });
  it("switches views and toggles the blocks drawer", () => {
    const props = renderHeader();
    fireEvent.click(screen.getByRole("radio", { name: /plans/i }));
    expect(props.onViewChange).toHaveBeenCalledWith("plans");
    fireEvent.click(screen.getByRole("button", { name: "Blocks" }));
    expect(props.onToggleBlocks).toHaveBeenCalled();
  });
  it("marks the blocks button pressed when the drawer is open", () => {
    renderHeader({ blocksOpen: true });
    expect(screen.getByRole("button", { name: "Blocks" })).toHaveAttribute("aria-pressed", "true");
  });
  it("lists the shortcuts in the keyboard popover", () => {
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: "Shortcuts" }));
    expect(screen.getByText(/send/i)).toBeInTheDocument();
    expect(screen.getByText(/open \.proto/i)).toBeInTheDocument();
  });
});
```
(Mock `@/components/ui/popover` with pass-through DOM in this file: `Popover: ({children}) => <>{children}</>`, `PopoverTrigger: ({children}) => <>{children}</>`, `PopoverContent: ({children}) => <div>{children}</div>` — the content is then always rendered, which is fine for the assertion.)

`src/components/connection/__tests__/ConnectionPill.test.tsx` — port these behaviours from `ConnectionSection.test.tsx` and `PublishBar-quickswitch.test.tsx`: shows dashed "Add connection" when there are no profiles and clicking it calls `onOpenSheet({ mode: "new" })`; shows profile name, host and environment pill when profiles exist; clicking a profile in the dropdown calls `activate_profile` and sets `connectionStatus` to `connected`; a failing `activate_profile` sets status `error` and toasts; switching is blocked with `toast.warning` while `usePlanExecutionStore` `isRunning`; the status dot has `bg-success` when connected, `bg-danger` on error, `bg-ghost` when disconnected; `keychain_status` returning `{ available: false, error: "locked" }` renders a `triangle-alert` button whose `title` contains "Keychain unavailable"; "Manage connections…" calls `onOpenSheet({ mode: "list" })`. Mock `@/components/ui/dropdown-menu` with plain DOM (`DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent` → fragments/divs, `DropdownMenuItem` → `<button onClick={onSelect}>`), mock `@tauri-apps/api/core` `invoke` and `sonner` as in the existing tests.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm exec vitest run src/components/layout src/components/connection/__tests__/ConnectionPill.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Build the shell**

`AppShell.tsx` as in the interface block. `AppHeader.tsx` (handoff §1):
```tsx
<header className="flex h-[52px] shrink-0 items-center gap-4 border-b border-border px-5">
  <div className="flex items-center gap-2.5">
    <img src="/tap-mark.svg" alt="" className="size-6" />
    <span className="text-15 font-semibold tracking-[-.01em]">Tap</span>
  </div>
  <SegmentedControl aria-label="View" className="ml-2" size="md" value={view} onChange={onViewChange}
    items={[{ value: "compose", label: "Compose", icon: <Send size={13} strokeWidth={1.5} /> }, { value: "plans", label: "Plans", icon: <ListChecks size={13} strokeWidth={1.5} /> }]} />
  <div className="flex-1" />
  <ConnectionPill onOpenSheet={onOpenSheet} />
  <div className="flex gap-0.5">
    <IconButton size={32} label="Blocks" active={blocksOpen} disabled={blocksDisabled} onClick={onToggleBlocks}><Library size={17} strokeWidth={1.5} /></IconButton>
    <ShortcutsPopover />   {/* IconButton size 32 label "Shortcuts" with <Keyboard size={17}/> */}
    <ThemeToggle />        {/* now an IconButton size 32; icons moon/sun/monitor 17px; keep the mounted guard and cycle order */}
  </div>
</header>
```
`ShortcutsPopover.tsx`: Popover with a `w-64` list, rows `flex justify-between text-12`: "Open .proto" ⌘O, "Reload schema" ⌘R, "Send" ⌘↵, "Clear form" ⌘⇧R, "Focus activity filter" ⌘1, "Toggle hex" ⌘2, "Read queue" ⌘3 — use `usePlatformLabel().modSymbol` and `<Kbd>`.

`ConnectionPill.tsx` (handoff §1 "Connection pill"): mount effect loads `listProfiles()` and `keychainStatus()` exactly as `ConnectionSection.tsx:37-52` did; `handleQuickSwitch` verbatim from `PublishBar.tsx:117-133`. Render:
```tsx
{profiles.length === 0 ? (
  <button type="button" onClick={() => onOpenSheet({ mode: "new" })}
    className="flex h-[34px] items-center gap-2 rounded-full border border-dashed border-border-strong px-3 text-13 font-medium text-violet-bright hover:bg-primary/8">
    <Plus size={14} strokeWidth={1.5} />Add connection
  </button>
) : (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button type="button" aria-label="Connection" className="flex h-[34px] items-center gap-2.5 rounded-full border border-border bg-card pl-3 pr-1.5 text-13 transition-colors hover:border-border-strong">
        <StatusDot tone={dotTone} glow={connectionStatus === "connected"} />
        <span className="font-medium whitespace-nowrap">{activeProfile?.name ?? "No profile"}</span>
        {activeProfile && <span className="font-mono text-11 text-ghost whitespace-nowrap">{activeProfile.host}</span>}
        {activeProfile && <EnvironmentPill environment={profileEnvironment(activeProfile)} />}
        {keychainError && <TriangleAlert size={14} className="text-warning" aria-label="Keychain unavailable" />}
        <span className="inline-flex size-6 items-center justify-center text-muted-foreground"><ChevronDown size={14} strokeWidth={1.5} /></span>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-56">
      {profiles.map((p) => <DropdownMenuItem key={p.name} onSelect={() => void handleQuickSwitch(p.name)}><StatusDot tone={p.name === activeProfileName ? "success" : "ghost"} size={6} /><span className="flex-1">{p.name}</span><span className="font-mono text-11 text-ghost">{p.host}</span></DropdownMenuItem>)}
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={() => onOpenSheet({ mode: "list" })}><Settings size={14} strokeWidth={1.5} />Manage connections…</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
)}
```
Dot tones: connected → `success`, error → `danger`, disconnected → `ghost`. When the keychain is unavailable wrap the warning icon with `title="Keychain unavailable: passwords are kept in memory for this session only ({error})"` (a `<button>` so tests find it by role).

`useGlobalShortcuts.ts`: the two `useHotkeys` calls from `AppLayout.tsx:31-32`.

`App.tsx`:
```tsx
const [view, setView] = useState<WorkbenchView>("compose");
const [blocksOpen, setBlocksOpen] = useState(false);
const [sheet, setSheet] = useState<SheetState>(null);
useGlobalShortcuts();
const header = <AppHeader view={view} onViewChange={setView} blocksOpen={blocksOpen} onToggleBlocks={() => setBlocksOpen((v) => !v)} blocksDisabled={view !== "compose"} onOpenSheet={setSheet} />;
… {view === "compose" ? <ComposeView header={header} blocksOpen={blocksOpen} /> : <Suspense …><PlanView header={header} /></Suspense>}
<ProfileManagementModal open={sheet !== null} onClose={() => setSheet(null)} />   // replaced by ConnectionSheet in Task 4
```
`ComposeView` renders `<AppShell header={header} sidebar={<Sidebar />} drawer={blocksOpen && <BlockLibraryPanel />} main={<><PublishBar /><FormPanel …/></>} aside={<RightPanel setActiveTabRef={…} />} />` keeping the existing DndContext/DragOverlay/hotkeys (mod+1/2/3 still drive the RightPanel tabs until Task 8 — keep `setActiveTabRef` for now and add the three `ComposeSignals` refs with hotkeys that call `signal.current?.()`). `PlanView` renders `<AppShell header={header} sidebar={<PlanListPanel …/>} main={<PlanDetailPanel …/>} aside={<div />} />` for now.

`Sidebar.tsx`: remove the Plans button, the `ConnectionSection` and the footer `ThemeToggle` (the footer keeps version + update check + `ClearLocalDataButton`); drop the now-unused props.

- [ ] **Step 4: Update the shortcut test and run everything**

In `src/__tests__/keyboard-shortcuts.test.tsx` replace the `AppLayout` import/usage with `ComposeView` (`render(<ComposeView header={<div />} blocksOpen={false} />)`), keep every assertion. Run: `pnpm test && pnpm exec tsc --noEmit && pnpm lint` — expected: PASS, 0 lint errors.

- [ ] **Step 5: Look once**

Run `pnpm dev` and open http://localhost:1420 in the browser pane (Tauri IPC rejects there; the shell still renders). Check: header 52px, segmented view switch, pill/"Add connection", sidebar 272, right column 360, dark palette. Fix only what is visibly broken.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(shell): workbench header, connection pill and app shell"
```

---

### Task 4: Connection sheet

**Files:**
- Create: `src/components/connection/profileForm.ts`, `src/components/connection/ProfileForm.tsx`, `src/components/connection/ConnectionSheet.tsx`
- Modify: `src/components/connection/ConnectionTestResult.tsx`, `src/App.tsx` (render `<ConnectionSheet state={sheet} onStateChange={setSheet} />` instead of the modal)
- Delete: `src/components/connection/ProfileManagementModal.tsx`, `src/components/connection/__tests__/ProfileManagementModal.test.tsx`, `src/components/sidebar/ConnectionSection.tsx`
- Test: `src/components/connection/__tests__/profileForm.test.ts`, `src/components/connection/__tests__/ConnectionSheet.test.tsx`

**Interfaces:**
```ts
// src/components/connection/profileForm.ts  (pure; moved from ProfileManagementModal.tsx:33-106 and 162-197)
export interface ProfileFormValues { name; host; port; vhost; username; password; managementPort; managementSsl; amqpTls; caCertPath; environment; environmentTouched; readOnly; recordHistory }  // same fields as today
export const DEFAULT_FORM_VALUES: ProfileFormValues;
export const AMQP_TLS_PORT = "5671"; export const MANAGEMENT_TLS_PORT = "15671";
export function formFromProfile(profile: ConnectionProfile): ProfileFormValues;   // = handleShowEditForm mapping, password ""
export function profileFromForm(values: ProfileFormValues): ConnectionProfile;
export function cleartextTransports(values: ProfileFormValues): string[];
export function withHost(values, host): ProfileFormValues;                 // environment follows the host until touched
export function withPort(values, port): ProfileFormValues;                 // 5671 → amqpTls true, 5672 → false
export function withManagementPort(values, port): ProfileFormValues;       // 15671 → managementSsl true, 15672 → false
export function validateProfile(values, mode: "new" | "edit"): string | null;  // "Profile name is required." | "Host is required." | edit + blank password message | null

// src/components/connection/ConnectionSheet.tsx
export function ConnectionSheet({ state, onStateChange }: { state: SheetState; onStateChange: (s: SheetState) => void }): JSX.Element

// src/components/connection/ProfileForm.tsx
export function ProfileForm(props: { mode: "new" | "edit"; initial: ProfileFormValues; onBack: () => void; onClose: () => void; onSaved: (profileName: string) => void; onDeleted: () => void }): JSX.Element

// src/components/connection/ConnectionTestResult.tsx — props gain `latencyMs?: number`; success renders "Reachable · {latencyMs} ms" (or "Reachable" when unknown) in text-success with <CircleCheck size={13}/>, testing "Testing…" text-muted-foreground with a spinning <LoaderCircle/>, error <CircleAlert/> + message in text-danger
```

- [ ] **Step 1: Write the failing tests**

`profileForm.test.ts` — cases: `withPort(DEFAULT, "5671").amqpTls === true` and `withPort(…, "5672").amqpTls === false` while another port leaves it unchanged; `withManagementPort` mirrors that with `managementSsl`; `withHost(DEFAULT, "mq.internal").environment === "shared"` but with `environmentTouched: true` the environment stays; `cleartextTransports` returns `[]` for `localhost`, `["AMQP", "Management API"]` for a remote host with both switches off, `["Management API"]` with only AMQP TLS on; `validateProfile` returns the three messages and `null` for a valid new profile; `profileFromForm` falls back to ports 5672/15672 and vhost "/" and sends `ca_cert_path: null` when blank.

`ConnectionSheet.test.tsx` — port from `ProfileManagementModal.test.tsx` with the new copy: renders nothing when `state` is `null`; `{ mode: "list" }` shows "Connections", "Passwords live in the OS keychain", one row per profile (name, `amqps://user@host:port/vhost` URL built as `${tls ? "amqps" : "amqp"}://${username}@${host}:${port}/${vhost === "/" ? "" : vhost}`, environment pill) and a "New connection" button; clicking a row opens the detail with the name in the header; detail validation messages ("Profile name is required.", "Host is required."); "Test" saves then tests without activating and shows "Reachable"; "Save & connect" saves, tests, activates (`activateProfile` not needed — `setActiveProfile` + `setConnectionStatus("connected")` as today) and calls `onStateChange(null)`; on a failing test it stays open and shows the error; edit mode: name input read-only, blank password blocks with the existing message; port 5671 flips the AMQP TLS switch (`role="switch"` checked); cleartext warning text "Password travels unencrypted over AMQP" for a remote host; delete asks in an AlertDialog and calls `delete_profile`. Mock `@/components/ui/select` is not needed (no selects); mock `@tauri-apps/plugin-dialog` `open`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/components/connection`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `profileForm.ts`** by moving the code out of `ProfileManagementModal.tsx` (constants, `profileFromForm`, `cleartextTransports`, the three `handle*Change` reducers as pure `with*` functions, `validateProfile` from the checks in `handleTestOnly`/`handleSave`).

- [ ] **Step 4: Implement `ConnectionSheet.tsx` and `ProfileForm.tsx`** (handoff §7)

Use the restyled `Sheet` (`side="right"`, `showCloseButton={false}`, own header). List view:
```tsx
<div className="flex items-center gap-2.5 p-[18px_20px_12px]">
  <div className="flex flex-1 flex-col gap-0.5"><span className="text-15 font-semibold">Connections</span><span className="text-12 text-ghost">{keychainError ? `Keychain unavailable — passwords stay in memory this session (${keychainError})` : "Passwords live in the OS keychain"}</span></div>
  <IconButton size={28} label="Close" onClick={() => onStateChange(null)}><X size={16} strokeWidth={1.5} /></IconButton>
</div>
<div className="flex flex-col gap-1.5 px-5 py-1.5">
  {profiles.map((p) => (
    <button key={p.name} type="button" onClick={() => onStateChange({ mode: "edit", profile: p.name })}
      className={cn("flex items-center gap-3 rounded-lg border bg-background p-[12px_14px] text-left transition-colors hover:border-border-strong", p.name === activeProfileName ? "border-border-strong" : "border-border")}>
      <StatusDot tone={p.name === activeProfileName ? "success" : "ghost"} />
      <div className="flex flex-1 flex-col gap-0.5"><span className="text-13 font-medium">{p.name}</span><span className="font-mono text-11 text-ghost whitespace-nowrap">{profileUrl(p)}</span></div>
      <EnvironmentPill environment={profileEnvironment(p)} />
      <ChevronRight size={14} className="text-ghost" strokeWidth={1.5} />
    </button>
  ))}
  <button type="button" onClick={() => onStateChange({ mode: "new" })} className="mt-1 flex h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong text-13 font-medium text-violet-bright hover:bg-primary/8"><Plus size={14} strokeWidth={1.5} />New connection</button>
</div>
```
Detail view = `ProfileForm`: header with `ArrowLeft` back (28px), name (15/600) + "Connection profile" (12 ghost), `EnvironmentPill size="md"`, close. Body `flex-1 overflow-auto flex flex-col gap-3 px-5 pt-1.5 pb-4`, three group cards `rounded-lg border border-border bg-background`, each with a `SectionLabel` at `p-[10px_14px_4px]`:
- **BROKER** — `grid grid-cols-[100px_1fr] items-center gap-x-2.5 gap-y-1.5 p-[6px_14px_12px]`; labels `text-12 text-muted-foreground`; inputs `h-[30px] px-2.5 text-12 bg-card` (`Input className="h-[30px] bg-card text-12"`; Host/vhost/ports mono); Name read-only in edit mode; Ports row = two inputs side by side each with a suffix span (`amqps`/`amqp`, `https`/`http`) inside a wrapper `flex items-center rounded-md border border-border bg-card`; Credentials row = username + password (placeholder "leave blank to keep" in edit mode, "password" in new mode).
- **SAFETY** — `SegmentedControl variant="choice" stretch` items Local / Shared (`activeClassName="text-warning"`) / Production (`activeClassName="text-danger"`) with `aria-label="Environment"`, helper text-11 ghost "Shared asks before Consume and Subscribe. Production also asks before Send.", then two `h-[34px] border-t border-hairline` rows with a `text-12` label and a `Switch` (`aria-label="Read-only profile"`, `aria-label="Record sent messages in history"`).
- **TLS** — header row with the summary at the right: both switches on → `<Shield size={13}/> Encrypted on both transports` in text-success; otherwise `<TriangleAlert size={13}/> Password travels unencrypted over {transports.join(" and ")}` in text-warning (only when `cleartextTransports` is non-empty; a local host with switches off shows "Local host — TLS optional" in text-ghost); rows: "AMQP over TLS <span class=text-ghost>amqps</span>" switch, "Management API over HTTPS" switch, then CA certificate input + `folder-plus` 30px outline button (`aria-label="Browse for CA certificate"`).
Footer `flex items-center gap-2 border-t border-border p-[12px_20px]`: "Delete" text-12 text-danger button (edit only) → AlertDialog "Delete {name}?" body as today, actions "Keep profile" / "Delete profile"; spacer; `ConnectionTestResult`; outline "Test" (h-[34px]); primary "Save & connect" (h-[34px]). Inline `error` renders above the footer in text-12 text-danger.

Handlers: copy `handleTestOnly`, `handleSave`, `handleDeleteConfirm` from `ProfileManagementModal.tsx:211-318` into `ProfileForm`; measure latency with `performance.now()` around `testConnection`; on save success call `onSaved(profile.name)` (sheet closes) — on test failure stay open and set `setConnectionStatus("error", message)` as before. Keep `invalidateCatalog` calls.

- [ ] **Step 5: Wire it up and delete the modal**

`App.tsx`: `<ConnectionSheet state={sheet} onStateChange={setSheet} />`. `git rm` the modal, its test and `ConnectionSection.tsx`. Run `pnpm test && pnpm exec tsc --noEmit && pnpm lint`. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(connection): connection sheet replaces the profile modal"
```

---

### Task 5: Files sidebar

**Files:**
- Create: `src/components/sidebar/useProtoFiles.ts`, `useIncludePaths.ts`, `FilesSidebar.tsx`, `FileRow.tsx`, `MessageList.tsx`, `RecentFiles.tsx`, `SidebarFooter.tsx`
- Modify: `src/components/sidebar/IncludePathManager.tsx` (restyle; accept `includePaths`/`onChange` from `useIncludePaths` so the row meta and the manager share one source), `ClearLocalDataButton.tsx` (`IconButton size={24} danger label="Clear local data"`), `src/components/include-paths/IncludePathDialog.tsx` (restyle only: title 15/600, path rows mono 12, dashed "Add path"), `src/components/layout/ComposeView.tsx` (sidebar slot → `<FilesSidebar />`)
- Delete: `src/components/sidebar/Sidebar.tsx`, `FileSection.tsx`, `SchemaExplorer.tsx`, `__tests__/SchemaExplorer.test.tsx`, `__tests__/FileSection-reload.test.tsx`, `__tests__/FileSection-parse-error.test.tsx`
- Test: `src/components/sidebar/__tests__/useProtoFiles.test.tsx`, `FilesSidebar.test.tsx`, `MessageList.test.tsx`; update `IncludePathManager.test.tsx`, `ClearLocalDataButton.test.tsx` for the new markup

**Interfaces:**
```ts
// useProtoFiles.ts — all logic of FileSection.tsx (recent files persistence, stale check, open → include dialog → parse, reload, open recent) as a hook.
export function useProtoFiles(): {
  openFiles; activeIndex; recentFiles: string[]; closedRecentFiles: string[]; stalePaths: Set<string>;
  parseError: string | null; isReloading: boolean;
  openFile: () => Promise<void>; reload: () => Promise<void>; openRecent: (path: string) => Promise<void>;
  activate: (index: number) => void; close: (index: number) => void;
  includeDialog: { open: boolean; initialPaths: string[]; onConfirm: (paths: string[]) => Promise<void>; onCancel: () => void };
}
// It also consumes openFileRequested / reloadRequested from useProtoStore exactly as FileSection.tsx:133-145 does.

// useIncludePaths.ts
export function useIncludePaths(filePath: string): { paths: string[]; loaded: boolean; setPaths: (paths: string[]) => Promise<void> }
// loads "include_paths:{filePath}" from tap.json (parent dir fallback), setPaths persists and reloads every open file (IncludePathManager.tsx:747-783 logic).

export function fileName(path: string): string;   // last segment, both separators
export function dirName(path: string): string;    // last directory segment of a directory path

// MessageList.tsx
export function MessageList({ schema, selected, onSelect }: { schema: ProtoSchema; selected: string | null; onSelect: (fullName: string) => void }): JSX.Element
```

- [ ] **Step 1: Write the failing tests**

`useProtoFiles.test.tsx` — port `FileSection-reload.test.tsx` (reload calls `reload_proto` with every open file and its saved include paths, applies each schema to its own file, toasts "Proto schema reloaded", sets `parseError` "Reload failed: …" on error) and `FileSection-parse-error.test.tsx` (raw protox message surfaced; import errors get the "add the containing directory to include paths." hint) against a tiny harness component that calls the hook and renders `parseError`, a "reload" button and an "open" button. Also: `openRecent` on a stale path is a no-op; `openRecent` without saved include paths opens the dialog with the parent dir.

`MessageList.test.tsx`:
```tsx
it("lists messages with field counts and enums with value counts, and selects on click", () => {
  const schema = makeSchema([msg("pkg.Order", 6), msg("pkg.LineItem", 4)], [{ name: "OrderStatus", full_name: "pkg.OrderStatus", values: [{ name: "A", number: 0 }] }]);
  const onSelect = vi.fn();
  render(<MessageList schema={schema} selected="pkg.Order" onSelect={onSelect} />);
  expect(screen.getByRole("button", { name: /Order 6/ })).toHaveAttribute("aria-current", "true");
  fireEvent.click(screen.getByRole("button", { name: /LineItem 4/ }));
  expect(onSelect).toHaveBeenCalledWith("pkg.LineItem");
  expect(screen.getByText("Enums")).toBeInTheDocument();
  expect(screen.getByText("OrderStatus")).toBeInTheDocument();
});
```

`FilesSidebar.test.tsx` — with `useProtoStore` set to one open file: shows "Files", the file row with name + meta "N messages · M enums", the close button `aria-label="Close order.proto"`, the reload button `aria-label="Reload proto schema"`, the open button `aria-label="Open .proto"`; with no files: dashed "Open .proto" button and a "Recent" section listing `recentFiles` (stale ones rendered with `line-through` and `title` "File not found: …"); parse errors render with `role="alert"`; footer shows the version text. Mock `@tauri-apps/api/app` `getVersion`, `@tauri-apps/plugin-store`, `@tauri-apps/plugin-dialog`, `@/lib/ipc`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/components/sidebar`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the hook and components** (handoff §2)

`FilesSidebar.tsx`:
```tsx
<div className="flex h-full flex-col gap-[18px] overflow-hidden p-[16px_12px]">
  <div className="flex flex-col gap-1.5">
    <div className="flex items-center justify-between px-2">
      <SectionLabel>Files</SectionLabel>
      <div className="flex gap-0.5">
        {openFiles.length > 0 && <IconButton size={24} label="Reload proto schema" title={`Reload (${modSymbol}R)`} onClick={() => void reload()} disabled={isReloading}><RefreshCw size={14} strokeWidth={1.5} className={isReloading ? "animate-spin" : ""} /></IconButton>}
        <IconButton size={24} tone="violet" label="Open .proto" title={`Open .proto (${modSymbol}O)`} onClick={() => void openFile()}><Plus size={15} strokeWidth={1.5} /></IconButton>
      </div>
    </div>
    {openFiles.length === 0
      ? <button … className="flex h-10 items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong text-13 font-medium text-violet-bright hover:bg-primary/8"><Plus size={14}/>Open .proto<Kbd className="bg-transparent text-10 text-ghost">{modSymbol}O</Kbd></button>
      : <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">{openFiles.map((f, i) => <FileRow key={f.filePath} file={f} active={i === activeIndex} onActivate={() => activate(i)} onClose={() => close(i)} />)}</div>}
    {parseError && <p role="alert" className="flex items-start gap-1.5 px-2 text-12 text-danger"><TriangleAlert size={13} className="mt-0.5 shrink-0" />{parseError}</p>}
  </div>
  {schema && <MessageList schema={schema} selected={selectedMessageType} onSelect={setSelectedType} />}
  {openFiles.length === 0 && closedRecentFiles.length > 0 && <RecentFiles files={closedRecentFiles} stale={stalePaths} onOpen={openRecent} />}
  <div className="flex-1" />
  <SidebarFooter />
  {includeDialog.open && <IncludePathDialog … />}
</div>
```
`FileRow.tsx`: `h-10 px-2.5 rounded-lg flex items-center gap-2.5`; active: `bg-card border border-border`, inactive: `text-muted-foreground hover:bg-card cursor-pointer`; 28px icon tile `rounded-md` (`bg-primary/12 text-violet-bright` active, `bg-card text-muted-foreground` inactive) with `<FileCode size={15}/>`; name `text-13 font-medium truncate`; meta `text-11 text-ghost truncate` = `${messages} messages · ${enums} enums` (singular forms when 1) plus ` · includes ${dirName(paths[0])}${paths.length > 1 ? ` +${paths.length - 1}` : ""}` when `useIncludePaths(file.filePath).loaded`; the meta is a `<button>` (`aria-label="Include paths for {name}"`) that opens a `Popover` containing `IncludePathManager`; active row gets `IconButton size={22} label={`Close ${name}`}` with `<X size={13}/>`. The row itself is a `div role="button"` calling `onActivate` (keep `title={file.filePath}`).

`MessageList.tsx`: `SectionLabel` "Messages" at `px-2 pb-1.5`; rows `<button aria-current={selected}>` `h-8 px-2.5 rounded-md flex items-center gap-2 text-13` with a `size-1.5 rounded-full` dot (`bg-primary` selected, `bg-ghost` otherwise), name `flex-1 text-left font-medium truncate`, count `font-mono text-11 text-ghost`; selected `bg-primary/12 text-foreground`, otherwise `text-muted-foreground hover:bg-card`; then "Enums" label at `pt-3.5` with rows using a `size-1.5 rounded-xs bg-ghost` square marker and the value count (not clickable). Accessible name of a row is "Order 6" (name + count) — the test relies on it.

`RecentFiles.tsx`: "Recent" label; rows `h-8 px-2.5 rounded-md text-13 text-muted-foreground hover:bg-card hover:text-foreground` with `<FileCode size={14}/>`; stale rows are `div`s with `line-through text-ghost` and `title="File not found: {path}"`.

`SidebarFooter.tsx`: `flex items-center justify-between px-2 text-11 text-ghost whitespace-nowrap` — `v{version} · {RELEASE_NAME}` (the `getVersion` effect from `Sidebar.tsx:34-37`), right: update-check `IconButton size={24}` on non-mac + `ClearLocalDataButton`.

- [ ] **Step 4: Wire, delete, verify**

`ComposeView` sidebar slot → `<FilesSidebar />`. `git rm` `Sidebar.tsx`, `FileSection.tsx`, `SchemaExplorer.tsx` and their tests. Run `pnpm test && pnpm exec tsc --noEmit && pnpm lint`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sidebar): files sidebar with message list, recent files and include-path popover"
```

---

### Task 6: Request card (form + destination + properties + send + hex)

**Files:**
- Create: `src/components/compose/{destination.ts,propertiesSummary.ts,useDestination.ts,usePublish.ts,useRequestForm.ts,BlockConflictDialog.tsx,CatalogStatus.tsx,RequestHeader.tsx,DestinationStrip.tsx,PropertiesSummary.tsx,PropertiesSection.tsx,HexStrip.tsx,OutcomeChip.tsx,RequestFooter.tsx,EmptyState.tsx,RequestCard.tsx}`
- Rename: `git mv src/components/publish/RoutingKeyCombobox.tsx src/components/compose/RoutingKeyCombobox.tsx` (+ its test to `compose/__tests__/`)
- Modify: `src/lib/bytes.ts` (add `hexToBytes`), `src/components/layout/ComposeView.tsx` (main slot)
- Delete: `src/components/form/FormPanel.tsx`, `src/components/publish/PublishBar.tsx`, `src/components/publish/AmqpPropertiesSheet.tsx`, `src/components/preview/HexPreviewPanel.tsx`, `src/components/form/__tests__/FormPanel*.test.tsx`, `src/components/publish/__tests__/PublishBar.test.tsx`
- Test: `src/components/compose/__tests__/{destination,propertiesSummary,useDestination,usePublish,useRequestForm,DestinationStrip,PropertiesSection,RequestFooter,RequestCard}.test.tsx`, `src/lib/__tests__/bytes.test.ts` (add `hexToBytes`)

**Interfaces:**
```ts
// destination.ts (pure)
export type TargetMode = "queue" | "exchange";
export function buildPublishArgs(mode, selectedQueue, selectedExchange, routingKey): { exchange: string; routingKey: string }  // moved from PublishBar.tsx:57-70, same tests
export function isAuthError(message: string): boolean            // message.includes("authentication failed")
export function isHintExchange(type: string): boolean            // "headers" | "fanout"
export function routingKeyHint(type: string): string | null      // the two D-06 sentences

// propertiesSummary.ts (pure)
export interface SummaryPart { text: string; mono?: boolean }
export function summarizeProperties(p: AmqpProperties): SummaryPart[]
// all defaults → [{ text: "defaults" }]; otherwise, in order: content type (mono, only when ≠ INITIAL), "persistent"|"transient",
// "ttl {n} ms", "corr" + {id mono}, "reply-to" + {queue mono}, "{n} header(s)". Rendered joined by " · ".

// useDestination.ts — mode/target/routing key state + catalog + bindings (PublishBar.tsx:72-207 verbatim, incl. 401 discrimination and the D-10 silent fallback)
export function useDestination(): {
  mode; setMode; selectedQueue; setSelectedQueue; selectedExchange; setSelectedExchange; routingKey; setRoutingKey;
  queues: string[]; exchanges: ExchangeSummary[]; managementStatus; managementAuthError;
  bindingKeys: string[]; isLoadingBindings: boolean; useCombobox: boolean; selectedExchangeType: string;
  targetName: string; hasTarget: boolean; queueDepth: number | null;   // queueDepth via fetchQueueDepth(activeProfileName, selectedQueue) with a cancelled-guard, null in exchange mode
}

// usePublish.ts — send pipeline (PublishBar.tsx:216-335 verbatim) + confirmation
export function usePublish(d: ReturnType<typeof useDestination>): {
  send: () => void;                 // = requestSend: production confirm first, otherwise handleSend
  isSending: boolean; canSend: boolean; readOnly: boolean; isConnected: boolean; disabledReason: string | null;
  outcome: PublishOutcome | null; dismissOutcome: () => void; outcomeAt: number | null;   // Date.now() when the outcome arrived — the chip shows HH:MM:SS
  pendingPublish: BrokerConfirmRequest | null; confirmPublish: () => void; cancelPublish: () => void;
}
// history entries now also carry correlationId / replyTo (from properties) and outcome (result.status) — Task 1 types.

// useRequestForm.ts — FormPanel.tsx state without the JSX
export function useRequestForm(message: MessageSchema | null): {
  isJsonMode; jsonDraft; setJsonDraft; parseError; toggleJson: () => void; fixJson: () => void; discardJson: () => void;
  clear: () => void; randomize: () => void;
  handleValuesChange: (values: unknown) => void; resetRef; getDirtyFieldsRef; applyBlockRef;
  conflict: { plan: ApplyPlan | null; choices: ConflictChoices; setChoices; apply: () => void; discard: () => void };
  dropZone: { setNodeRef: (el: HTMLElement | null) => void; isOver: boolean };
  hasDraft: boolean;   // a draft exists for (activeFilePath, selectedMessageType) — drives "· draft saved"
}
// Registers the mod+shift+r (clear) and mod+enter (requestSend, skipped inside .cm-editor) hotkeys exactly like FormPanel.tsx:215-224.

// RequestCard.tsx
export function RequestCard({ signals }: { signals: ComposeSignals }): JSX.Element
// renders EmptyState when !schema || !selectedMessageType (the "Message type not found" fallback stays as a text-12 text-ghost line);
// registers signals.toggleHex.current = () => setHexOpen(v => !v)
```

- [ ] **Step 1: Write the failing tests**

`destination.test.ts` — the three `buildPublishArgs` cases from `PublishBar.test.tsx:111-126`, plus `isAuthError`, `isHintExchange("fanout") === true`, `routingKeyHint("direct") === null`.

`propertiesSummary.test.ts`:
```ts
it("says defaults when nothing was changed", () => {
  expect(summarizeProperties({ ...INITIAL_PROPERTIES, headers: [] })).toEqual([{ text: "defaults" }]);
});
it("lists delivery, reply-to and header count", () => {
  const parts = summarizeProperties({ ...INITIAL_PROPERTIES, replyTo: "orders.reply", headers: [{ key: "a", value: "1" }, { key: "b", value: "2" }] });
  expect(parts.map((p) => p.text)).toEqual(["persistent", "reply-to", "orders.reply", "2 headers"]);
  expect(parts[2].mono).toBe(true);
});
it("mentions transient delivery, ttl and a non-default content type", () => {
  const parts = summarizeProperties({ ...INITIAL_PROPERTIES, contentType: "application/x-protobuf", deliveryMode: 1, ttl: 500, headers: [] });
  expect(parts.map((p) => p.text)).toEqual(["application/x-protobuf", "transient", "ttl 500 ms"]);
});
```

`useDestination.test.tsx` — port from `PublishBar.test.tsx` "Phase 9" block (`fetch_bindings` called for a direct exchange, not for fanout/headers, `useCombobox` false after a rejected fetch) and the catalog states (live/manual/401) using a harness component that renders the hook's values as text.

`usePublish.test.tsx` — port from `PublishBar.test.tsx` "Phase 10" block: ACK outcome then auto-dismiss after 3 s, Returned/NACK after 5 s, Timeout never; a send re-encodes from `latestValues` (`encode_message` called before `publish_message`); a production profile sets `pendingPublish` instead of publishing; read-only profiles have `canSend === false` with `disabledReason` "Profile is read-only"; the history entry written on success contains `outcome: "ack"`, `correlationId` and `replyTo` from `useAmqpStore` and is skipped when `record_history === false`.

`useRequestForm.test.tsx` — port `FormPanel.test.tsx`, `FormPanel-drafts.test.tsx`, `FormPanel-randomizer.test.tsx` using a harness that renders `ProtoFormRenderer` with the hook's refs plus buttons for toggle/clear/randomize/fix/discard and the JSON textarea: 200 ms debounce (one `encode_message` per burst), JSON mode round trip (valid → `setPendingReplayValues`, invalid → `parseError` and stays in JSON mode, unknown keys → `toast.warning` with the "1 unknown field ignored: x" copy), discard restores the entry snapshot, clear → defaults + `clearDraft`, randomize passes dirty fields, draft save skipped for defaults and during restore, `dropZone.isOver` reflects `useDroppable`, `onDragEnd` over `form-drop-zone` builds a plan and warns about unknown block fields.

`DestinationStrip.test.tsx` — with the `SearchableSelect`/`RoutingKeyCombobox` mocks from `PublishBar.test.tsx`: Queue|Exchange radios, "Live catalog" / "Manual entry" / "AUTH FAILED" states, routing key field only in exchange mode, fanout hint line, target meta "12 msgs" when `queueDepth` is 12, the properties summary button text and its "Edit"/"Done" toggle.

`PropertiesSection.test.tsx` — port `AmqpPropertiesSheet` behaviour: draft is synced from the store on open, Apply commits `setProperties` + `setHeaders`, Reset restores `INITIAL_PROPERTIES`, TTL rejects negatives with "TTL must be a non-negative integer (ms)", adding a 21st header toasts "Maximum 20 custom headers reached", header pill `×` removes it, the counter reads "2 / 20".

`RequestFooter.test.tsx` — hex strip shows `"{n} B · {inlineHex}"` and toggles to the dump ("wire format · n bytes · {full name}") with copy/save buttons; encode error shows in the strip; Send reads "Send to {target}" with the kbd chip, is disabled with the right tooltip when disconnected / read-only / no target, shows "Sending…" while sending; outcome chip renders "ACK · HH:MM:SS" (success), "RETURNED"/"NACK" and "TIMEOUT" with a dismiss button only for timeout.

`RequestCard.test.tsx` — smoke: renders EmptyState without a schema ("Send a real protobuf message in 30 seconds"), renders header "Request" + message name + full name + "· draft saved" when `hasDraft`, toolbar buttons `aria-label` "Block library" (aria-pressed follows `blocksOpen`), "Randomize", "Clear form" (title contains the platform shortcut), "Edit as JSON"/"Return to form"; drop zone `data-testid="drop-zone"` gets `ring-4 ring-primary/12 border-border-strong` when `isOver`.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm exec vitest run src/components/compose`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the pure modules and hooks**

Move the code as noted in the interface block. `bytes.ts` gains:
```ts
/** Inverse of base64ToHex: spaced or unspaced hex → bytes. */
export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, "");
  const out = new Uint8Array(Math.floor(clean.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}
```
`usePublish` records history as today (`PublishBar.tsx:283-296`) plus `outcome: result.status, correlationId: properties.correlationId ?? undefined, replyTo: properties.replyTo ?? undefined`; `outcomeAt = Date.now()` when the result arrives.

- [ ] **Step 4: Implement the card** (handoff §3)

`RequestCard.tsx` layout:
```tsx
<div className="flex min-h-0 flex-1 flex-col p-4">
  <BlockConflictDialog conflict={form.conflict} />
  <div ref={form.dropZone.setNodeRef} data-testid="drop-zone"
    className={cn("flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card transition-[border-color,box-shadow]",
      form.dropZone.isOver ? "border-border-strong ring-4 ring-primary/12" : "border-border")}>
    <RequestHeader message={message} hasDraft={form.hasDraft} isJsonMode={form.isJsonMode} blocksOpen={blocksOpen} onToggleBlocks={onToggleBlocks} onRandomize={form.randomize} onClear={form.clear} onToggleJson={form.toggleJson} dropHint={form.dropZone.isOver ? `Drop to fill ${message.name} · ${message.fields.length} fields` : null} />
    <DestinationStrip destination={d} propsOpen={propsOpen} onTogglePropsOpen={() => setPropsOpen(v => !v)} />
    {propsOpen && <PropertiesSection onApplied={() => setPropsOpen(false)} />}
    {form.isJsonMode
      ? <div className="flex min-h-0 flex-1 flex-col"><JsonEditor … /></div>
      : <div className="min-h-0 flex-1 overflow-auto p-[18px]"><ProtoFormRenderer message={message} onValuesChange={form.handleValuesChange} resetRef={form.resetRef} getDirtyFieldsRef={form.getDirtyFieldsRef} applyBlockRef={form.applyBlockRef} /></div>}
    <RequestFooter publish={p} targetName={d.targetName} messageFullName={message.full_name} hexOpen={hexOpen} onToggleHex={() => setHexOpen(v => !v)} />
  </div>
</div>
```
`blocksOpen`/`onToggleBlocks` come from `ComposeView` props (App state). Do not nest CodeMirror inside a ScrollArea (FormPanel pitfall 4).

`RequestHeader`: `flex items-center gap-3 border-b border-border p-[14px_18px]`: `SectionLabel` "Request", `text-16 font-semibold tracking-[-.01em]` name, `font-mono text-12 text-ghost` full name, `text-11 text-ghost` "· draft saved" when `hasDraft`, spacer, drop hint `text-12 text-violet-bright` when set, toolbar `flex rounded-md border border-border bg-background p-0.5` with four `IconButton size={28}` (`h-[26px]`): Library (`active={blocksOpen}`, label "Block library"), Dices ("Randomize", title "Fill empty fields with random values"), RotateCcw ("Clear form", title `Clear form (${modSymbol}+Shift+R)`), Braces (`active={isJsonMode}`, label "Edit as JSON" / "Return to form").

`DestinationStrip`: outer `flex flex-col border-b border-border bg-foreground/[.02]`; row `flex flex-wrap items-center gap-2.5 p-[12px_18px]`: `SectionLabel` "To"; `SegmentedControl variant="choice" aria-label="Target kind"` Queue/Exchange (`text-12 font-semibold` items, h-[26px]); target picker: `managementStatus === "live"` → `SearchableSelect className="w-[280px]" mono meta={queueMeta}` (queue mode items = queues; exchange mode items with `badge` = exchange type in `font-mono text-11 text-ghost`), else `Input className="w-[280px] font-mono text-[12.5px]"` placeholder "Queue name"/"Exchange name"; exchange mode adds `<ArrowRight size={14} className="text-ghost"/>` and the routing key: `RoutingKeyCombobox` (restyled `w-[220px] h-9`, prefix "key" `text-11 text-ghost`, value mono) when `useCombobox`, else an `Input` with the same prefix (use the `InputGroup` primitive or a wrapper div); `CatalogStatus` (`StatusDot size={6} tone="success"` + "Live catalog" / `tone="warning"` + "Manual entry" / `Tag tone="danger" title={managementAuthError}` "Auth failed"); spacer; `PropertiesSummary` button (`h-7 rounded-md px-2.5 text-12 text-muted-foreground border` — transparent border when closed, `border-border-strong bg-primary/8` when open — `<Layers size={14}/>`, the summary parts (mono parts in `font-mono text-foreground`), trailing "Edit"/"Done" in `text-violet-bright font-medium`). Second row (only when `routingKeyHint(selectedExchangeType)`): `px-[18px] pb-2.5 text-12 text-ghost`.

`PropertiesSection` (inline, `flex flex-col gap-3 p-[4px_18px_16px]`): grid `grid-cols-[2fr_1fr_1fr] gap-3` (Content type `Input`; Delivery `SegmentedControl variant="choice" stretch` Transient/Persistent inside a `h-9`; TTL input with trailing "ms" `text-11 text-ghost`), grid `grid-cols-[1fr_1fr_2fr] gap-3` (Correlation ID, Reply-to, Headers: label row with `font-mono text-11 text-ghost` "n / 20", pills `inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-background pl-2.5 pr-1.5 font-mono text-12` `key<span class="text-muted-foreground"> = value</span>` + `IconButton size={22} label={`Remove header ${key}`}`, dashed "+ header" pill opening the existing add-header `Popover`). Footer row: "Reset to defaults" (`text-12 text-muted-foreground hover:text-foreground` button) … spacer … primary `Button size="sm"` "Apply". Labels are `text-12 text-muted-foreground`. Draft/validation logic moves verbatim from `AmqpPropertiesSheet.tsx:36-91`.

`RequestFooter`: `flex flex-col border-t border-border bg-foreground/[.02]`; row `flex items-center gap-3 p-[12px_18px]`: `HexStrip` button (`flex flex-1 min-w-0 items-center gap-2.5 text-left`: `<Binary size={15} className="text-muted-foreground"/>`, `font-mono text-[11.5px] text-muted-foreground truncate` `{bytes} B · <span class="text-foreground">{inlineHex(hex)}</span>` or the encode error in `text-danger`, or "Fill in the form to see the wire bytes" in text-ghost when empty; trailing `text-12 font-medium text-violet-bright` "Expand"/"Collapse"), `OutcomeChip` (`h-6 rounded-xs px-2 font-mono text-11 font-semibold` — ack `bg-success/10 text-success` `<CircleCheck size={12}/> ACK · {time}`; returned `bg-warning/10 text-warning` "RETURNED"; nack `bg-danger/10 text-danger` "NACK"; timeout `bg-danger/10 text-danger` "TIMEOUT" + `IconButton size={22} label="Dismiss timeout badge"`), Send (`Button size="lg" className="pl-3.5 pr-2 gap-2"`: `<Send size={15}/>` or `<LoaderCircle className="animate-spin"/>`, `Send to {targetName}` / "Sending…", `<Kbd>{modSymbol}↵</Kbd>`; wrapped in the tooltip pattern from `PublishBar.tsx:552-583` with `disabledReason`). Expanded hex: `px-[18px] pb-3.5`: header `font-mono text-11 text-ghost` "wire format · {n} bytes · {full name}" + `IconButton size={26}` copy (`navigator.clipboard.writeText(hex)` → toast "Hex copied") and save (`save({ defaultPath: `${shortName}.bin`, filters: [{ name: "Binary", extensions: ["bin"] }] })` then `writeFile(path, hexToBytes(hex))` from `@tauri-apps/plugin-fs`; toast "Saved {name}.bin"); `<HexDump hex={hexPreview} />`. Bytes count = `hexPreview.replace(/\s+/g, "").length / 2`.

`EmptyState` (handoff §3 "Empty state"): `flex flex-1 items-center justify-center m-4 rounded-xl border border-dashed border-foreground/10`; inner column `max-w-[420px] items-center gap-4 text-center`: `<img src="/tap-icon.svg" className="size-16 rounded-xl"/>`, `text-20 font-semibold tracking-[-.02em]` "Send a real protobuf message in 30 seconds", `text-14 text-muted-foreground leading-[1.55]` copy from the prototype, `grid grid-cols-3 gap-2.5 w-full` — card 1 is a `<button>` with `border-border-strong` opening the file (`requestOpenFile()`), icons `FileCode` violet / `Radio` teal / `Send` success, titles "1 · Open a .proto" / "2 · Pick a destination" / "3 · Send", hints "⌘O · include paths remembered per file", "queues and exchanges from the live catalog", "⌘↵ · publisher confirms shown inline"; footer `text-12 text-ghost` "Connected to <span class=text-muted-foreground>{profile}</span>" (or "Not connected") " · try examples/order.proto".

`BlockConflictDialog`: the AlertDialog from `FormPanel.tsx:351-454` unchanged in behaviour, restyled rows (`border-hairline`, `Tag tone="neutral"` for the kind badge).

- [ ] **Step 5: Wire into ComposeView, delete the old components**

`ComposeView` main slot → `<RequestCard signals={signals} blocksOpen={blocksOpen} onToggleBlocks={onToggleBlocks} />` (App passes `onToggleBlocks`). `git rm` the four old components and their tests. Run `pnpm test && pnpm exec tsc --noEmit && pnpm lint`. Expected: PASS and coverage thresholds met.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(compose): request card merges the form, destination, properties and send"
```

---

### Task 7: Form field restyle

**Files:**
- Create: `src/components/form/fields/fieldMeta.ts`, `src/components/form/fields/FieldLabel.tsx`, `src/components/form/fields/RepeatedTable.tsx`
- Modify: `src/components/form/ProtoFormRenderer.tsx` (top-level layout grouping), `JsonEditor.tsx`, `fields/{ScalarField,EnumField,NestedMessageField,OneofField,RepeatedField,MapField,BytesField,WellKnownTypeField,CopyButton,DepthCapPlaceholder}.tsx`
- Test: `src/components/form/__tests__/fieldMeta.test.ts`, `RepeatedTable.test.tsx`; update `ScalarField.test.tsx` (bool → `role="switch"`), `OneofField.test.tsx` (radio group → `SegmentedControl` radios; the assertion names stay `role="radio"`), `NestedMessageField.test.tsx`, `RepeatedField.test.tsx`, `EnumField.test.tsx`, `ProtoFormRenderer.test.tsx`

**Interfaces:**
```ts
// fieldMeta.ts
export function typeLabel(field: FieldSchema): string;            // "string", "enum OrderStatus"→ use "enum", "Address", "oneof", "map<string, int32>", wkt name
export function fieldMeta(field: FieldSchema): string;            // `${typeLabel} · ${field_number}` (no number part when field_number is 0)
export function isFlatMessage(message: MessageSchema): boolean;   // 1–5 fields, each non-repeated scalar (incl. bytes) or enum
export function summarizeValues(values: unknown): string;         // one line: scalars joined by ", " (strings raw, numbers as-is), nested → "{…}", arrays → "[n]"; empty → "empty"
export function tableColumns(message: MessageSchema): string;     // grid-template-columns: "28px " + fields.map(f => f.kind.type === "scalar" && f.kind.scalar === "string" ? "3fr" : f.kind.type === "scalar" && f.kind.scalar === "bool" ? "1fr" : "2fr").join(" ") + " 28px"

// FieldLabel.tsx
export function FieldLabel({ field, htmlFor, copyValue, children }: { field: FieldSchema; htmlFor?: string; copyValue?: string; children?: React.ReactNode }): JSX.Element
// label row: <FieldTooltip><Label class="text-13 font-medium text-foreground">{field.label}</Label></FieldTooltip> + <span class="font-mono text-11 text-ghost">{fieldMeta(field)}</span> + spacer + children + CopyButton when copyValue !== undefined

// RepeatedTable.tsx
export function RepeatedTable({ field, path, message }: { field: FieldSchema; path: string; message: MessageSchema }): JSX.Element
// useFieldArray rows; header row of field names; each row: index (mono 11 ghost), one borderless input per field (h-7 px-2 rounded-sm; focus border-border-strong bg-card; bool → Switch size="sm"; enum → native-like Select trigger h-7), trash IconButton size 22 danger label "Remove item"
```

- [ ] **Step 1: Write the failing tests**

`fieldMeta.test.ts`:
```ts
it("formats the type and number", () => {
  expect(fieldMeta({ name: "id", label: "Id", field_number: 1, kind: { type: "scalar", scalar: "string" }, repeated: false })).toBe("string · 1");
  expect(fieldMeta({ name: "s", label: "S", field_number: 0, kind: { type: "enum", values: [] }, repeated: false })).toBe("enum");
});
it("detects flat messages", () => {
  const flat = { name: "LineItem", full_name: "p.LineItem", fields: [f("sku", { type: "scalar", scalar: "string" }), f("qty", { type: "scalar", scalar: "int32" })] };
  expect(isFlatMessage(flat)).toBe(true);
  expect(isFlatMessage({ ...flat, fields: [...flat.fields, f("addr", { type: "message", full_name: "p.Address" })] })).toBe(false);
  expect(isFlatMessage({ ...flat, fields: Array.from({ length: 6 }, (_, i) => f(`f${i}`, { type: "scalar", scalar: "string" })) })).toBe(false);
});
it("summarizes values on one line", () => {
  expect(summarizeValues({ street: "12 Hafenstrasse", city: "Hamburg", zip: 20457, tags: ["a"], geo: { lat: 1 } })).toBe("12 Hafenstrasse, Hamburg, 20457, [1], {…}");
  expect(summarizeValues({})).toBe("empty");
});
```
`RepeatedTable.test.tsx` — inside a `FormProvider` with `defaultValues: { items: [] }`: "Add item" appends a row with one input per field, the header lists the field names, the trash button removes the row, typing into a cell updates `getValues("items.0.sku")`.

- [ ] **Step 2: Run to verify failure** — `pnpm exec vitest run src/components/form` → FAIL.

- [ ] **Step 3: Restyle the fields** (handoff §3 "Form body")

- `ScalarField`: wrapper `flex flex-col gap-1.5` (no `mb-3`); `<FieldLabel field copyValue={String(watchedValue ?? "")} htmlFor={path}/>`; bool → `<Switch id={path} checked onCheckedChange aria-label={field.label}/>` (28×16); other inputs `Input className="font-mono text-13"`; error `<p role="alert" class="text-12 text-danger">` same copy.
- `BytesField`: same label row; keep "From text" popover (`Button variant="outline" size="xs"`), byte count `text-11 text-ghost`.
- `EnumField`: `SelectTrigger className="font-mono text-13"`; items render `{name} <span class="text-ghost">= {number}</span>` (test "shows enum value names" still finds the names).
- `WellKnownTypeField`: label row via `FieldLabel`; the datetime-local input uses the `Input` classes.
- `NestedMessageField`: container `flex flex-col gap-2.5 rounded-lg border border-border p-3.5` (no left rule, no `ml-4`); header `<button type="button" aria-expanded>` with `<ChevronDown size={14} className={cn("text-muted-foreground transition-transform duration-150", !open && "-rotate-90")}/>`, label `text-13 font-medium`, `font-mono text-11 text-ghost` `{TypeName} · {number}`, and when collapsed a `font-mono text-11 text-muted-foreground ml-2 truncate` summary from `summarizeValues(useWatch({ name: path }))`; children grid `grid gap-3` with `grid-template-columns: repeat(min(fields.length, 5), minmax(0, 1fr))` (first column `2fr` when the first field is a string — use `tableColumns`-style logic exported as `containerColumns(message)`), child labels `text-12 text-muted-foreground`; depth ≥ 1 inputs use `h-[34px]` and alternate `bg-background`/`bg-card` by depth parity (pass `depth` down through a `FieldDepthContext` so `ScalarField` can pick the background). Default open stays `true`.
- `OneofField`: label row (`fieldMeta` → "oneof · n"); `SegmentedControl variant="choice" mono stretch aria-label={field.label}` with the branch names (`Controller` on `${path}._selected` as today); selected branch renders in a container `rounded-lg border border-border p-3.5 flex flex-col gap-2.5`: header `text-13 font-medium` branch label (title-cased from the name) + `font-mono text-11 text-ghost` `{TypeName} · {n} fields` (for a message branch) or the scalar type; fields in `grid grid-cols-4 gap-3`, sub-labels `text-12 text-muted-foreground` with type `font-mono text-[10.5px] text-ghost`.
- `RepeatedField`: label row (`fieldMeta` → `repeated {Type} · {number} · {rows} rows`) with a `Button variant="ghost" size="xs" className="text-violet-bright"` "+ Add item"; when `field.kind.type === "message"` and `isFlatMessage(messageMap[full_name])` → `<RepeatedTable/>`; otherwise stacked containers `rounded-lg border border-border p-3` with an index header (`font-mono text-11 text-ghost` `#{i}`) and `IconButton size={22} danger label="Remove item"`.
- `MapField`: same header/row treatment as the stacked repeated container (`rounded-md border border-border bg-background p-[6px_12px]` rows, key column `w-1/3`).
- `CopyButton`: `IconButton size={22} label="Copy value"` with `<Copy size={12}/>` in `text-ghost hover:text-foreground`, always visible; keep the check feedback (`text-success` icon; update `keyboard-shortcuts.test.tsx`/`CopyButton.test.tsx` from `.text-green-500` to `.text-success`).
- `DepthCapPlaceholder`: `text-12 text-ghost italic`.
- `ProtoFormRenderer`: `form className="flex flex-col gap-4"`; group consecutive top-level fields that are non-repeated scalar/enum/well_known into `<div className="grid grid-cols-2 gap-4">` chunks; message/oneof/map/repeated fields render full width between them. Keep `buildDefaultValues`, the refs and `applyBlockRef` untouched.
- `JsonEditor`: build a CodeMirror theme extension once (`EditorView.theme`) — gutter `w-11 bg-background text-ghost text-[12.5px]`, editor `bg-card`, `HighlightStyle` with `tags.propertyName → var(--muted-foreground)`, `tags.string → var(--violet-bright)`, `tags.number/bool/null → var(--foreground)`; pass `theme="none"` and the extension instead of `"dark"|"light"` (the `resolvedTheme` prop stays for `dark: boolean` in the theme). Parse-error banner: `mx-4 mt-2 mb-3 rounded-md border border-danger/40 bg-danger/10 p-3` with `TriangleAlert size={14}` and the two buttons (`outline` "Fix JSON", `destructive` "Discard changes").

- [ ] **Step 4: Update the field tests and run the suite**

Adjust selectors: bool field `screen.getByRole("switch")`; oneof `screen.getAllByRole("radio")`; `NestedMessageField` title assertions stay text-based. Run `pnpm test && pnpm exec tsc --noEmit && pnpm lint`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(form): workbench field styles, repeated tables, oneof segments and nested containers"
```

---

### Task 8: Activity panel (history + response merged) and read-mode popover

**Files:**
- Create: `src/components/activity/{activityModel.ts,useActivityActions.ts,useQueueRead.ts,ActivityRow.tsx,ReplyRow.tsx,ActivityExpanded.tsx,ReadModeButton.tsx,ReadModePopover.tsx,ActivityPanel.tsx}`
- Rename: `git mv src/components/history/HexViewDialog.tsx src/components/activity/HexViewDialog.tsx`
- Modify: `src/components/response/ResponseQueuePicker.tsx`, `src/components/response/SubscribePanel.tsx` (restyle for the popover), `src/components/history/historyHelpers.ts` (remove `filterHistoryEntries`; keep `collectFieldNames`, `collectSearchTokens`, `findReplayTabIndex`), `src/components/layout/ComposeView.tsx` (aside slot; drop `setActiveTabRef`)
- Delete: `src/components/layout/RightPanel.tsx`, `src/components/layout/RightPanel.test.tsx`, `src/components/layout/__tests__/RightPanel.test.tsx`, `src/components/history/MessageHistoryPanel.tsx`, `HistoryTable.tsx`, `HistoryFilterBar.tsx`, `src/components/response/MessageFeedTab.tsx`, `MessageFeedTab.test.tsx`, `MessageFeedRow.tsx`, `ResponseDecodedView.tsx`, `ResponseDecodedView.test.tsx`
- Test: `src/components/activity/__tests__/{activityModel,ActivityPanel,ReadModePopover,useActivityActions}.test.tsx`; update `historyHelpers.test.ts` (drop the `filterHistoryEntries` block), `ResponseQueuePicker.test.tsx`, `SubscribePanel.test.tsx` (selectors only), `src/__tests__/keyboard-shortcuts.test.tsx` (mod+1/2/3 now call the signals)

**Interfaces:**
```ts
// activityModel.ts (pure)
export type ActivityFilter = "all" | "sent" | "received";
export type SentStatus = "ack" | "nack" | "returned" | "timeout" | "sent" | "failed";
export type ReceivedStatus = "decoded" | "no-decoder" | "error";
export interface SentItem { kind: "sent"; id: string; at: number; typeName: string; target: string; sizeBytes: number; status: SentStatus; correlationId: string | null; replyTo: string | null; entry: HistoryEntry }
export interface ReceivedItem { kind: "received"; id: string; at: number; typeName: string; target: string; sizeBytes: number; status: ReceivedStatus; correlationId: string | null; message: FeedMessage }
export type ActivityItem = SentItem | ReceivedItem;
export interface ActivityGroup { item: ActivityItem; reply: ReceivedItem | null }
export const REPLY_WINDOW_MS = 30_000;
export function shortTypeName(fullName: string): string;
export function describeTarget(exchange: string, routingKey: string): string;   // "exchange → key" or "key"
export function hexByteLength(hex: string): number;
export function sentItem(entry: HistoryEntry): SentItem;        // at = Date.parse(timestamp); status = failed ? "failed" : outcome ?? "sent"; size = base64ByteLength
export function receivedItem(message: FeedMessage): ReceivedItem; // at = receivedAt; typeName = short(decodedAs) or "unknown"; status by error/decodedAs
export function buildActivity(entries: HistoryEntry[], messages: FeedMessage[]): ActivityItem[];   // newest first
export function groupReplies(items: ActivityItem[], windowMs?: number): ActivityGroup[];
// a received item pairs with the newest earlier sent item that is not yet paired and (same non-empty correlationId) or (sent.replyTo === received routingKey and received.at - sent.at <= windowMs); paired items leave the top level
export function activityGroups(items: ActivityItem[], filter: ActivityFilter, query: string, windowMs?: number): ActivityGroup[];
// "received" → no grouping; "sent" → groups without replies; query matches typeName, target, status, contentType and collectSearchTokens() of fieldValues/decoded (case-insensitive substring)
export function formatClock(at: number): string;      // HH:MM:SS.mmm local
export function formatBytes(n: number): string;       // "142 B", "1.2 KB", "3.4 MB"
export function summarizeActivity(items: ActivityItem[], now?: number): string;  // "4 sent · 3 received" + " · today" when every item is from today
export const STATUS_LABEL: Record<SentStatus | ReceivedStatus, string>;   // ack ACK, nack NACK, returned RETURNED, timeout TIMEOUT, sent SENT, failed FAILED, decoded DECODED, "no-decoder" "NO DECODER", error ERROR
export const STATUS_TONE: Record<SentStatus | ReceivedStatus, TagTone>;   // ack/sent success; nack/failed/timeout/error danger; returned/no-decoder warning; decoded teal

// useActivityActions.ts
export function useActivityActions(): { replay: (entry: HistoryEntry) => void; resend: (entry: HistoryEntry) => Promise<void>; exportVisible: (groups: ActivityGroup[]) => Promise<void>; clearAll: () => Promise<void> }
// replay/resend verbatim from MessageHistoryPanel.tsx:540-642; exportVisible writes { exportedAt, messageCount, messages: <received rows as today's curated shape>, sent: [{ id, timestamp, messageTypeName, exchange, routingKey, status, outcome, fieldValues }] } via save()/writeTextFile (MessageFeedTab.tsx:157-196, default name `activity-export-${stamp}.json`); clearAll = clearHistory() + clearMessages()

// useQueueRead.ts — drain + confirmation from MessageFeedTab.tsx:106-155
export function useQueueRead(mode: FeedMode): { read: (count: number) => void; pending: BrokerConfirmRequest | null; confirm: () => void; cancel: () => void; isLoading: boolean }

// ActivityPanel.tsx
export function ActivityPanel({ signals }: { signals: ComposeSignals }): JSX.Element
// local state: filter, query (debounced 150 ms via useDebounce), expandedId, readModeOpen, mode: FeedMode ("tap" default); registers signals.focusFilter (input.focus()) and signals.toggleReadMode (setReadModeOpen(v => !v)); loads history on mount when !historyLoaded

// ReadModePopover.tsx
export function ReadModePopover({ open, onOpenChange, mode, onModeChange }: …): JSX.Element   // Popover anchored to ReadModeButton; body = SegmentedControl (Tap/Subscribe/Peek/Consume, locked while running) + ResponseQueuePicker + SubscribePanel (live modes) + BrokerConfirmDialog
```

- [ ] **Step 1: Write the failing tests**

`activityModel.test.ts`:
```ts
const sent = (o: Partial<HistoryEntry> = {}): HistoryEntry => ({ id: "s1", timestamp: "2026-09-03T14:02:11.412Z", messageTypeName: "example.Order", exchange: "", routingKey: "orders", status: "sent", fieldValues: { order_id: "ord_1" }, payloadBase64: "CgU=", outcome: "ack", ...o });
const recv = (o: Partial<FeedMessage> = {}): FeedMessage => ({ id: "r1", routingKey: "orders.reply", exchange: "", contentType: null, correlationId: null, timestamp: null, receivedAt: Date.parse("2026-09-03T14:02:11.690Z"), decoded: { ok: true }, hexString: "0a 01 02", error: null, decodedAs: "example.OrderConfirmed", ...o });

it("builds items newest first with sizes and statuses", () => {
  const items = buildActivity([sent()], [recv()]);
  expect(items.map((i) => i.kind)).toEqual(["received", "sent"]);
  expect(items[1]).toMatchObject({ typeName: "Order", target: "orders", sizeBytes: 3, status: "ack" });
  expect(items[0]).toMatchObject({ typeName: "OrderConfirmed", sizeBytes: 3, status: "decoded" });
});
it("pairs a reply by correlation id", () => {
  const groups = groupReplies(buildActivity([sent({ correlationId: "req-1" })], [recv({ correlationId: "req-1" })]));
  expect(groups).toHaveLength(1);
  expect(groups[0].reply?.id).toBe("r1");
});
it("pairs a reply by reply-to within the window and not outside it", () => {
  const items = buildActivity([sent({ replyTo: "orders.reply" })], [recv()]);
  expect(groupReplies(items)[0].reply?.id).toBe("r1");
  expect(groupReplies(items, 100)).toHaveLength(2);
});
it("does not pair when neither correlation id nor reply-to match", () => {
  expect(groupReplies(buildActivity([sent()], [recv()]))).toHaveLength(2);
});
it("filters by kind and query, dropping replies for the sent filter", () => {
  const items = buildActivity([sent({ correlationId: "req-1" })], [recv({ correlationId: "req-1" })]);
  expect(activityGroups(items, "sent", "")[0].reply).toBeNull();
  expect(activityGroups(items, "received", "")).toHaveLength(1);
  expect(activityGroups(items, "all", "ord_1")).toHaveLength(1);
  expect(activityGroups(items, "all", "nothing")).toHaveLength(0);
});
it("formats clocks, sizes and the summary", () => {
  expect(formatBytes(142)).toBe("142 B");
  expect(formatBytes(2048)).toBe("2.0 KB");
  expect(formatClock(new Date(2026, 8, 3, 14, 2, 11, 412).getTime())).toBe("14:02:11.412");
  expect(summarizeActivity(buildActivity([sent({ timestamp: new Date().toISOString() })], []))).toBe("1 sent · 0 received · today");
});
```

`ActivityPanel.test.tsx` — with real stores (`useHistoryStore.setState({ entries, historyLoaded: true })`, `useResponseStore.setState({ messages })`) and mocks for `@/lib/ipc`, `@tauri-apps/plugin-store`, `@tauri-apps/plugin-dialog`, `@tauri-apps/plugin-fs`, `@/components/ui/popover` (pass-through), `@/components/ui/select`, `@/components/ui/searchable-select`: renders one row per item with type, status tag and mono meta; the segmented filter narrows to sent/received; typing in the filter input hides non-matching rows; clicking a sent row expands it (decoded keys visible, buttons Load/Resend/Hex); Load calls `setPendingReplayValues` with the entry's `fieldValues` (file open) or toasts "Replay failed: .proto file not open. Open the file first."; Resend calls `publish_message` with the stored base64; Hex opens the dialog with "Binary payload"; a reply row shows the "REPLY" tag under its sent row; the footer summary reads "1 sent · 1 received"; Export is disabled with no visible rows and writes a file with `messages` and `sent` arrays otherwise; the empty state text "Sent and received messages appear here as one timeline." shows with no items; the read-mode button reads "Read queue" when idle and "Tapping {queue}" when `subscribeStatus === "Running"` in tap mode.

`ReadModePopover.test.tsx` — port `MessageFeedTab.test.tsx` blocks "consume confirmation on non-local hosts", "environment tags and read-only profiles", "tap and peek modes" and the drain tests (`drainMessages` called with `selectedDecodeTypes`, `requeue` true for Peek and false for Consume, `toast.info("Queue is empty")`, partial error toast, "Feed capped at 500" info).

`useActivityActions.test.tsx` — resend refuses a truncated payload with the existing toast copy and records a history entry after a successful resend; export shape assertions ported from `MessageFeedTab.test.tsx:357-431` (envelope, curated received fields, ISO timestamp from epoch seconds, null timestamp stays null).

- [ ] **Step 2: Run to verify failure** — `pnpm exec vitest run src/components/activity` → FAIL.

- [ ] **Step 3: Implement `activityModel.ts`**

```ts
import type { HistoryEntry } from "@/stores/useHistoryStore";
import type { FeedMessage } from "@/lib/types";
import { base64ByteLength } from "@/lib/bytes";
import { collectSearchTokens } from "@/components/history/historyHelpers";
import type { TagTone } from "@/components/common/Tag";

export const REPLY_WINDOW_MS = 30_000;

export function shortTypeName(fullName: string): string { return fullName.split(".").pop() || fullName || "unknown"; }
export function describeTarget(exchange: string, routingKey: string): string { return exchange ? `${exchange} → ${routingKey}` : routingKey; }
export function hexByteLength(hex: string): number { return Math.floor(hex.replace(/\s+/g, "").length / 2); }

export function sentItem(entry: HistoryEntry): SentItem {
  const parsed = Date.parse(entry.timestamp);
  return { kind: "sent", id: entry.id, at: Number.isNaN(parsed) ? 0 : parsed, typeName: shortTypeName(entry.messageTypeName), target: describeTarget(entry.exchange, entry.routingKey), sizeBytes: base64ByteLength(entry.payloadBase64), status: entry.status === "failed" ? "failed" : (entry.outcome ?? "sent"), correlationId: entry.correlationId ?? null, replyTo: entry.replyTo ?? null, entry };
}
export function receivedItem(message: FeedMessage): ReceivedItem {
  const status: ReceivedStatus = message.error ? "error" : message.decodedAs ? "decoded" : "no-decoder";
  return { kind: "received", id: message.id, at: message.receivedAt, typeName: message.decodedAs ? shortTypeName(message.decodedAs) : "unknown", target: describeTarget(message.exchange, message.routingKey), sizeBytes: hexByteLength(message.hexString), status, correlationId: message.correlationId, message };
}
export function buildActivity(entries: HistoryEntry[], messages: FeedMessage[]): ActivityItem[] {
  return [...entries.map(sentItem), ...messages.map(receivedItem)].sort((a, b) => b.at - a.at);
}
function isReplyTo(sent: SentItem, received: ReceivedItem, windowMs: number): boolean {
  if (sent.correlationId && received.correlationId) return sent.correlationId === received.correlationId;
  return sent.replyTo !== null && sent.replyTo === received.message.routingKey && received.at - sent.at <= windowMs;
}
export function groupReplies(items: ActivityItem[], windowMs = REPLY_WINDOW_MS): ActivityGroup[] {
  const replies = new Map<string, ReceivedItem>();   // sent id → reply
  const paired = new Set<string>();
  for (const received of items) {
    if (received.kind !== "received") continue;
    const match = items.find((s): s is SentItem => s.kind === "sent" && s.at <= received.at && !replies.has(s.id) && isReplyTo(s, received, windowMs));
    if (match) { replies.set(match.id, received); paired.add(received.id); }
  }
  return items.filter((i) => !paired.has(i.id)).map((item) => ({ item, reply: item.kind === "sent" ? (replies.get(item.id) ?? null) : null }));
}
function matches(item: ActivityItem, q: string): boolean {
  const fields = [item.typeName, item.target, STATUS_LABEL[item.status]];
  if (item.kind === "sent") fields.push(...collectSearchTokens(item.entry.fieldValues));
  else { if (item.message.decoded) fields.push(...collectSearchTokens(item.message.decoded)); if (item.message.contentType) fields.push(item.message.contentType); }
  return fields.some((f) => f.toLowerCase().includes(q));
}
export function activityGroups(items: ActivityItem[], filter: ActivityFilter, query: string, windowMs = REPLY_WINDOW_MS): ActivityGroup[] {
  const q = query.trim().toLowerCase();
  const groups = filter === "received" ? items.map((item) => ({ item, reply: null })) : groupReplies(items, windowMs);
  return groups
    .filter(({ item }) => filter === "all" || item.kind === filter)
    .map((g) => (filter === "sent" ? { ...g, reply: null } : g))
    .filter((g) => !q || matches(g.item, q) || (g.reply !== null && matches(g.reply, q)));
}
```
(`formatClock`, `formatBytes`, `summarizeActivity`, `STATUS_LABEL`, `STATUS_TONE` as specified in the interface block.)

- [ ] **Step 4: Implement the panel** (handoff §4)

`ActivityPanel.tsx`:
```tsx
<div className="flex h-full min-h-0 flex-col">
  <div className="flex items-center gap-2 p-[16px_16px_10px]">
    <SectionLabel>Activity</SectionLabel><div className="flex-1" />
    <SegmentedControl aria-label="Activity filter" size="xs" value={filter} onChange={setFilter} items={[{ value: "all", label: "All" }, { value: "sent", label: "Sent" }, { value: "received", label: "Received" }]} />
  </div>
  <div className="flex items-center gap-2 px-4 pb-2.5">
    <label className="flex h-[30px] flex-1 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-12 text-ghost focus-within:border-border-strong">
      <Search size={13} strokeWidth={1.5} /><input ref={filterRef} aria-label="Filter activity" placeholder="Filter type, target, payload…" className="min-w-0 flex-1 bg-transparent text-12 text-foreground outline-none" value={query} onChange={(e) => setQuery(e.target.value)} />
    </label>
    <ReadModeButton …>   {/* h-[30px] rounded-md border bg-card px-2.5 text-12; StatusDot size 6 (teal pulse when running, ghost idle); border-teal/35 when running; label "Tapping orders" | "Subscribed orders" | "Read queue"; ChevronDown 13 text-ghost */}
  </div>
  <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
    {groups.length === 0 ? <p className="p-4 text-12 text-ghost">{items.length === 0 ? "Sent and received messages appear here as one timeline." : "Nothing matches the filter."}</p>
      : groups.map((g) => <ActivityRow key={g.item.id} group={g} expanded={expandedId === g.item.id} highlighted={g.item.id === highlightedId} onToggle={…} actions={actions} />)}
  </div>
  <div className="flex items-center justify-between border-t border-border p-[10px_16px] text-11 text-ghost whitespace-nowrap">
    <span>{summarizeActivity(items)}</span>
    <div className="flex items-center gap-3">
      <button type="button" className="text-muted-foreground hover:text-foreground disabled:opacity-50" disabled={items.length === 0} onClick={() => setClearOpen(true)}>Clear</button>
      <button type="button" className="inline-flex items-center gap-1 text-12 text-muted-foreground hover:text-foreground disabled:opacity-50" disabled={groups.length === 0} onClick={() => void actions.exportVisible(groups)}><Download size={12} strokeWidth={1.5} />Export</button>
    </div>
  </div>
  <ReadModePopover …/>   <HexViewDialog …/>   <AlertDialog open={clearOpen}> "Clear activity?" … "Clear" (destructive) </AlertDialog>
</div>
```
Highlight: keep `useProtoStore((s) => s.lastSendAt)` in a ref; when it changes, set `highlightedId` to the newest sent item's id and clear it after 1.5 s (`animate-row-highlight` on the row). New received rows (receivedAt > panel mount time and not yet seen) get `animate-row-in` on their first render.

`ActivityRow.tsx`: outer `flex flex-col border-t border-hairline` (`bg-foreground/[.03]` when expanded); button `flex w-full gap-2.5 p-[10px_16px] text-left hover:bg-foreground/[.03]`: tile `size-[22px] rounded-md inline-flex items-center justify-center shrink-0 mt-px` (sent `bg-primary/12 text-violet-bright` `<ArrowRight size={13}/>`, received `bg-teal/12 text-teal` `<ArrowLeft size={13}/>`); column: line 1 `text-13 font-medium truncate flex-1` type + `Tag`-like span `text-10 font-bold tracking-[.06em]` in `text-{tone}` (use `STATUS_TONE` → class map) with `STATUS_LABEL`; line 2 `font-mono text-11 text-ghost whitespace-nowrap flex gap-1.5`: `<span class="text-muted-foreground">{target}</span> · {formatClock(at)} · {formatBytes(size)}`. Then `ReplyRow` when `group.reply` and `ActivityExpanded` when expanded.

`ReplyRow.tsx`: `flex gap-2.5 m-[2px_16px_12px_27px] pl-3.5 pt-1.5 border-l border-teal/35`: teal tile, `text-13 font-medium truncate` type, `text-10 font-bold tracking-[.06em] text-teal` "REPLY", meta `font-mono text-11 text-ghost truncate` `{routingKey} · {corr or "no decoder matched"} · +{reply.at - item.at} ms · {formatBytes}`; clicking expands the reply (its own expanded block underneath, same component).

`ActivityExpanded.tsx`: `flex flex-col gap-2 p-[0_16px_14px_48px] min-w-0`: decoded block `rounded-md border border-hairline bg-card p-[10px_12px]` → `<DecodedTree value={decoded}/>` for sent `entry.fieldValues`, for received `message.decoded` (or the `error` in `font-mono text-12 text-danger`, or "No decoded content" text-ghost); action row `flex items-center gap-1.5`: `Button variant="outline" size="xs"` "Load" (`ArrowLeft`), "Resend" (`RotateCcw`) for sent items only, "Hex" (`Binary`) for both → `HexViewDialog` with `title` `Binary payload — {type}` and `hex` (`base64ToHex(entry.payloadBase64)` guarded as today, or `message.hexString`), `truncated={entry.payloadTruncated}`.

`HexViewDialog.tsx` props become `{ open; onOpenChange; title: string; subtitle?: string; hex: string; truncated?: boolean }` and it renders `<HexDump hex maxHeight={320}/>` plus a copy button; keep the truncation note copy.

`ReadModePopover.tsx`: `PopoverContent align="end" className="w-[360px] flex flex-col gap-3 p-3"`: `SegmentedControl aria-label="Read mode" stretch size="sm"` Tap / Subscribe / Peek / Consume (titles from `MessageFeedTab.tsx:221-232`, `disabled` while `subscribeStatus` Running/Stopping); `<ResponseQueuePicker onDrain={read.read} mode={mode}/>`; live modes → `<SubscribePanel …/>`; `<BrokerConfirmDialog request={read.pending} …/>`.

Restyle `ResponseQueuePicker` to a vertical layout for the popover: rows `flex flex-col gap-2`; queue `SearchableSelect className="w-full" mono meta={depthMeta}` or `Input`; status line `CatalogStatus`-style (reuse the component from Task 6: `import { CatalogStatus } from "@/components/compose/CatalogStatus"`); decode-as multiselect trigger styled like the searchable trigger (`h-[34px]`), label "Decode as"; batch row: count input `w-16 h-[34px] font-mono text-center` + `Button` "Peek"/"Consume" (`size="md"`) + the helper copy in `text-11 text-ghost`. Keep every `aria-label`/`title` the existing tests use (`/consume count/i`, `/consume/i`, `/peek/i`). Restyle `SubscribePanel`: status `Tag` (Idle neutral / Running teal / Stopping warning / Error danger with `title`), `Button size="md"` Start (`Play`) / Stop (`Square`) and the safety copy `text-11 text-ghost`; behaviour untouched.

- [ ] **Step 5: Wire into ComposeView and update the shortcut test**

`ComposeView` aside → `<ActivityPanel signals={signals} />`; remove `RightPanel` and `setActiveTabRef`. In `keyboard-shortcuts.test.tsx` replace the "Cmd+1/2/3 tab switching" and "RightPanel tab triggers" blocks with: mod+1 focuses the element with `aria-label="Filter activity"`; mod+2 toggles the hex dump (the "wire format" header appears/disappears); mod+3 opens the read-mode popover ("Read mode" radiogroup appears). Mock `@/components/activity/ReadModePopover` only if the popover mock is not enough.

- [ ] **Step 6: Delete the old panels and verify**

`git rm` the files listed above. Run `pnpm test && pnpm exec tsc --noEmit && pnpm lint`. Expected: PASS, thresholds met.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(activity): one timeline for sent and received messages with reply grouping"
```

---

### Task 9: Blocks drawer

**Files:**
- Create: `src/components/blocks/blockFit.ts`, `src/components/blocks/BlockCard.tsx`
- Modify: `src/components/blocks/BlockLibraryPanel.tsx` (drawer card layout + search + editor view), `src/components/layout/ComposeView.tsx` (drawer slot wraps the panel in `<div className="flex w-[272px] shrink-0 flex-col p-[16px_0_16px_16px]">`)
- Test: `src/components/blocks/__tests__/blockFit.test.ts`; update `src/components/blocks/BlockLibraryPanel.test.tsx` (heading text "Blocks", card markup, fit line, search)

**Interfaces:**
```ts
// blockFit.ts (pure)
export type BlockFit = { tone: "success" | "warning"; label: string } | null;
export function describeBlockFit(content: string, message: MessageSchema | null): BlockFit;
// null when no message, invalid JSON, non-object, empty object or no key matches a top-level field name;
// every key matches → { tone: "success", label: `fits ${message.name} · ${matched} of ${message.fields.length} fields` };
// some keys match → { tone: "warning", label: `partly fits ${message.name} · ${matched} of ${keys.length} keys` }
export function previewJson(content: string, maxChars?: number): string;   // single-line collapse of whitespace, ellipsized at 60 chars

// BlockCard.tsx
export function BlockCard({ block, fit, onEdit }: { block: Block; fit: BlockFit; onEdit: (b: Block) => void }): JSX.Element   // useDraggable({ id: block.id }) exactly as DraggableBlockRow today; delete moves into the editor view footer
```

- [ ] **Step 1: Write the failing tests**

`blockFit.test.ts`:
```ts
const order = { name: "Order", full_name: "p.Order", fields: [f("order_id"), f("customer_id"), f("status")] };
it("returns null without a message or for non-object content", () => {
  expect(describeBlockFit('{"a":1}', null)).toBeNull();
  expect(describeBlockFit("[1]", order)).toBeNull();
  expect(describeBlockFit("{", order)).toBeNull();
  expect(describeBlockFit("{}", order)).toBeNull();
});
it("reports a full fit", () => {
  expect(describeBlockFit('{"order_id":"a","status":2}', order)).toEqual({ tone: "success", label: "fits Order · 2 of 3 fields" });
});
it("reports a partial fit and no fit", () => {
  expect(describeBlockFit('{"order_id":"a","nope":1}', order)).toEqual({ tone: "warning", label: "partly fits Order · 1 of 2 keys" });
  expect(describeBlockFit('{"nope":1}', order)).toBeNull();
});
it("previews JSON on one line", () => {
  expect(previewJson('{\n  "a": 1\n}')).toBe('{ "a": 1 }');
  expect(previewJson(`{"k":"${"x".repeat(80)}"}`).endsWith("…")).toBe(true);
});
```
`BlockLibraryPanel.test.tsx` updates: heading is "Blocks"; the new-block button keeps `aria-label="New block"`; each block renders `previewJson(content)` and, when `useProtoStore` has a selected message, the fit line with `text-success`/`text-warning`; the search button (`aria-label="Search blocks"`) reveals an input that filters cards by name; the editor view keeps the "New block"/"Edit block" headings, "Save block", "Back" and the delete confirmation (now a "Delete block" button in the editor footer, edit mode only); the drag tests stay as they are.

- [ ] **Step 2: Run to verify failure** — `pnpm exec vitest run src/components/blocks` → FAIL.

- [ ] **Step 3: Implement** (handoff §6)

Panel card: `flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card`; header `flex items-center justify-between p-[14px_14px_10px]` with `SectionLabel` "Blocks" and `IconButton size={24}` search (`Search size={14}`) + `tone="violet"` plus (`Plus size={15}`, label "New block"); optional filter `Input className="mx-2.5 mb-2 h-7 text-12"` (`aria-label="Filter blocks"`); list `flex flex-col gap-2 px-2.5 overflow-y-auto`; footer note `border-t border-border p-[12px_14px] text-11 text-ghost leading-[1.5]` "Drop onto the request. Fields that already have a value ask before being overwritten."; empty state copy unchanged ("No blocks yet", "Save JSON snippets you can reuse across messages."). `BlockCard`: `flex flex-col gap-1.5 rounded-lg border border-border bg-background p-[10px_12px] cursor-grab active:cursor-grabbing hover:border-border-strong` (`opacity-40` while dragging): row `GripVertical size={14} text-ghost` + `text-13 font-medium truncate flex-1` + `IconButton size={22} label={`Edit ${name}`}` (`Pencil size={13}`); preview `pl-[22px] font-mono text-11 text-ghost truncate`; fit line `pl-[22px] text-11` in `text-success`/`text-warning` when `fit`. Fit uses `useProtoStore((s) => s.schema?.message_map[s.selectedMessageType ?? ""] ?? null)`. Editor view: same card; header `IconButton size={24}` back (`ArrowLeft`) + `text-13 font-semibold` title; body `flex flex-1 flex-col gap-3 p-3 min-h-0`: `Input` (h-9, "Block name"), CodeMirror (same theme extension as `JsonEditor` — export it from `src/components/form/jsonEditorTheme.ts` in this task if Task 7 has not landed yet, otherwise import), error banner as the JSON-mode banner, footer: "Delete block" (`text-12 text-danger`, edit only, opens the existing AlertDialog) … primary "Save block" full width.

- [ ] **Step 4: Verify and commit**

Run `pnpm test && pnpm exec tsc --noEmit && pnpm lint` → PASS.
```bash
git add -A
git commit -m "feat(blocks): drawer cards with JSON preview and fit hint"
```

---

### Task 10: Plans view

**Files:**
- Rename: `git mv src/components/plans/PlanListPanel.tsx src/components/sidebar/PlansSidebar.tsx`; `git mv src/components/plans/StepListPanel.tsx src/components/plans/StepCardList.tsx`; `git mv src/components/plans/StepFieldEditor.tsx src/components/plans/StepEditor.tsx`
- Create: `src/components/plans/StepCard.tsx`, `src/components/plans/AddStepButton.tsx`, `src/components/plans/StepReplyPanel.tsx`
- Modify: `src/components/plans/PlanView.tsx`, `PlanRunBar.tsx`, `StepStatusBadge.tsx`, `step-editor/{LiveCombobox,TargetSection,ResponseModeSection}.tsx`, `StepHistoryPicker.tsx`, `StepBlockPicker.tsx` (Sheet restyle only), `src/App.tsx` (pass `header` to `PlanView`)
- Delete: `src/components/plans/PlanDetailPanel.tsx`, `StepReplyView.tsx`, `PlanReplyFeedTab.tsx`, `src/components/response/ResponseHexSection.tsx`, `ResponseHexSection.test.tsx`
- Test: `src/components/plans/__tests__/{StepCard,PlansSidebar,StepReplyPanel}.test.tsx`; update `PlanRunBar.test.tsx` (button names "Run plan", read-only still disables), `StepStatusBadge.test.tsx` (new classes: `text-success`, `text-warning`, `text-danger`, `bg-surface-2` for pending; spinner still present for waiting-response)

**Interfaces:**
```ts
// PlanView.tsx
export function PlanView({ header }: { header: React.ReactNode }): JSX.Element
// state: selectedPlanId, selectedStepId (both local, D-12); effective step during a run = activeStepId (PlanDetailPanel.tsx:308-312); DndContext for step sorting (distance 4) lives here.

// StepCard.tsx
export function StepCard(props: { step: PlanStep; index: number; planId: string; selected: boolean; status?: StepStatus; errorMsg?: string; hasReply: boolean; durationMs?: number; disabled: boolean; onSelect: () => void; onRename: (name: string) => void; onDuplicate: () => void; onDelete: () => void }): JSX.Element
// useSortable({ id: step.id }); header grid "grid-cols-[16px_28px_1fr_auto] gap-3 p-[14px_16px]"; expanded body = <StepEditor step planId disabled/> when selected

// StepReplyPanel.tsx
export function StepReplyPanel({ step, index, reply, feed }: { step: PlanStep | null; index: number; reply: ReplyMessage | null; feed: FeedMessage[] }): JSX.Element

// StepEditor.tsx — StepFieldEditor with a grid layout and the field form behind "Edit fields"; same props { step, planId, disabled }
```

- [ ] **Step 1: Write the failing tests**

`StepCard.test.tsx` (mock `@dnd-kit/sortable` `useSortable` → static attrs, `@dnd-kit/utilities` CSS; wrap in nothing else): renders the number circle with the 1-based index, the name (`text-14 font-semibold`), the status pill text ("DONE", "SENDING", "WAITING", "ERROR", "PENDING") with the tone classes, the meta row `type {short type} · to {target} · then {mode text}` where mode text is "wait 200 ms" / "wait for correlation id · 10 s" / "wait for first arrival · 10 s"; "View reply" appears only when `hasReply`; clicking the header calls `onSelect`; the kebab (`aria-label="Step options"`) offers Rename / Duplicate / Delete; when `selected` the editor is rendered (mock `./StepEditor` with a stub).

`PlansSidebar.test.tsx` — port the essentials of `PlanListPanel`: "Plans" label, `aria-label="New plan"` button creates via the inline row (`createPlan` called with the committed name, Escape cancels), rows show name + "N steps", kebab Rename/Duplicate/Delete, Delete confirms in an AlertDialog and resets the selection when the deleted plan was selected.

`StepReplyPanel.test.tsx` — no-wait step renders the dashed note "This step does not wait for a reply."; a reply renders the type, `+{ms} ms` when `durationMs` is known, meta `{routingKey} · corr:{id} · {bytes}`, decoded keys via `DecodedTree`, "Decoded as {type}" and a "Hex" button opening `HexViewDialog`; the feed list renders one row per `feed` item with a "Reply feed · N" header.

- [ ] **Step 2: Run to verify failure** — `pnpm exec vitest run src/components/plans src/components/sidebar/__tests__/PlansSidebar.test.tsx` → FAIL.

- [ ] **Step 3: Implement** (handoff §5 and §2 "Plans mode")

`PlansSidebar.tsx`: `flex h-full flex-col gap-1.5 p-[16px_12px]`; header `flex items-center justify-between px-2 pb-1.5` with `SectionLabel` "Plans" and `IconButton size={24} tone="violet" label="New plan"`; plan cards `flex flex-col gap-0.5 rounded-lg p-[10px_12px] cursor-pointer` (`bg-primary/12 text-foreground` selected, `text-muted-foreground hover:bg-card` otherwise): name `text-13 font-medium truncate` + `text-11 text-ghost` `{n} steps` (+ ` · ran {HH:MM}` when `usePlanExecutionStore` `summary` exists and `runningPlanId`/last run plan id matches — track `lastRunPlanId` locally in `PlanView` and pass it down; skip the suffix otherwise); kebab `IconButton size={22}` (`aria-label="Plan options"`) visible on hover (`opacity-0 group-hover:opacity-100 focus:opacity-100`); inline rename rows and dialogs unchanged from `PlanListPanel.tsx`; footer = `SidebarFooter` (Task 5).

`PlanRunBar.tsx` → run bar card `flex items-center gap-3 rounded-xl border border-border bg-card p-[14px_18px]`: name `text-16 font-semibold tracking-[-.01em]` over `text-12 text-ghost` `{n} steps · last run {HH:MM} · {seconds} s` (track run start/end in `PlanView` via `usePlanExecutionStore` transitions; omit parts that are unknown); result pill `inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-12 font-semibold` (`bg-success/10 text-success` with `CircleCheck size={13}` "{succeeded} / {total} succeeded", `bg-danger/10 text-danger` with `CircleAlert` otherwise); while running a chip `bg-warning/10 text-warning font-mono text-11` "{done} / {total} · {status text}" replaces it; `Switch` + `text-12 text-muted-foreground` "Stop on error"; `Button size="md"` `Play` "Run plan" / "Run again", running → `variant="destructive"` `Square` "Stop"; disabled reasons unchanged (tooltip pattern as today).

`StepCardList.tsx`: `flex flex-col gap-2.5` inside `SortableContext`; renders `StepCard` per step plus `AddStepButton` (dashed `h-11 rounded-lg border border-dashed border-foreground/12 text-12 text-muted-foreground hover:border-border-strong hover:text-violet-bright` `<Plus size={14}/> Add step <span class=text-ghost>— blank · from history · from block</span>` opening a `DropdownMenu` with the three sources; pickers unchanged). Empty plan: the `ClipboardList size={40}` empty state from `PlanDetailPanel.tsx:293-301` (copy unchanged).

`StepCard.tsx` header: grip `GripVertical size={14} text-ghost cursor-grab mt-1.5` (listeners on the grip only, as today), circle `size-7 rounded-full inline-flex items-center justify-center font-mono text-12 font-semibold` (done `bg-success/15 text-success`, active (sending/waiting) `bg-primary text-white`, error `bg-danger/15 text-danger`, pending/none `bg-surface-2 text-muted-foreground`), name row `flex items-center gap-2.5` (`text-14 font-semibold` + `StepStatusBadge`), meta row `flex flex-wrap gap-4 font-mono text-[11.5px] text-muted-foreground` with keys in `text-ghost`; right column `flex flex-col items-end gap-1`: duration `font-mono text-11 text-ghost`, "View reply" `text-12 font-medium text-violet-bright` (sets `paneMode`-equivalent: selects the step and scrolls the reply panel — just `onSelect`); kebab on hover at the far right. Card `rounded-lg border bg-card` with `border-border-strong` when selected, `opacity-50` while dragging. `StepStatusBadge` becomes a `Tag size="xs"` (tones: pending neutral, sending/waiting-response warning with the spinner, done success, error danger; text DONE / SENDING / WAITING / ERROR / PENDING; keep the error tooltip).

`StepEditor.tsx`: body `flex flex-col gap-3.5 border-t border-hairline p-[14px_16px_16px_72px]`: grid 1 `grid-cols-3 gap-3` — Proto file `Select size="sm"`, Message type `Select size="sm"`, Response mode `Select size="sm"` (moves the mode choice out of `ResponseModeSection`'s radios: `ResponseModeSection` now exposes `ModeSelect` + `ModeParams` pieces); grid 2 `grid-cols-3 gap-3` — Target (`TargetSection` reduced to `SegmentedControl` Queue|Exchange inline before a `LiveCombobox` `h-[34px] font-mono`; exchange mode shows the routing key input beneath the same cell), Delay/Timeout input with "ms" suffix, Reply queue (`LiveCombobox` or a `text-ghost` "—" for no-wait); fields row `flex items-center justify-between text-12 text-muted-foreground`: "Fields <span class=font-mono text-11 text-ghost>· {n} fields · {empty} empty</span>" + `Pencil size={12}` "Edit fields" `text-12 font-medium text-violet-bright` toggling the field form (`ProtoSchemaContext` + `FormProvider` + the `renderField` dispatch exactly as `StepFieldEditor.tsx:203-258`, `Dices` randomize kept as an `IconButton`); `fieldset disabled` while running (opacity .6). `empty` counts top-level values that are `""`, `null`, `[]` or `0`. All persistence logic (`updateStep` debounce, reset rules, stale-step guard) stays byte-for-byte.

`StepReplyPanel.tsx` (right aside): header `p-[16px_16px_10px]` with `SectionLabel` "Step {index} · reply" and `text-12 text-muted-foreground` "Reply feed · {feed.length}"; reply card `m-[0_16px] rounded-lg border border-border bg-card p-[12px_14px] flex flex-col gap-2` (teal tile + `text-13 font-medium` type + `font-mono text-11 text-ghost` `+{ms} ms`; meta line; `rounded-md bg-background p-[10px_12px]` `<DecodedTree/>`; footer `flex justify-between text-11 text-muted-foreground` "Decoded as {type}" / "Hex" `text-violet-bright`); no-wait note `m-[0_16px] rounded-lg border border-dashed border-foreground/10 p-3.5 text-12 text-ghost leading-[1.5]` with the copy from the prototype; below, "Reply feed" rows reuse `ActivityRow` from Task 8 (`receivedItem(feedMessage)` groups without replies) — if Task 8 has not merged yet in this worktree, render the rows with the same markup inline and switch to `ActivityRow` in Task 11.

`PlanView.tsx`: `<AppShell header={header} sidebar={<PlansSidebar …/>} main={selectedPlan ? <div className="flex flex-1 flex-col gap-3 overflow-auto p-4"><PlanRunBar …/><DndContext …><StepCardList …/><DragOverlay>…</DragOverlay></DndContext></div> : <EmptyPlans/>} aside={<StepReplyPanel …/>} />`. Step durations: record `performance.now()` per step status transition in a local `Map` in `PlanView` (sending → done/error) and pass `durationMs`.

- [ ] **Step 4: Verify and commit**

`git rm` the deleted files. Run `pnpm test && pnpm exec tsc --noEmit && pnpm lint` → PASS.
```bash
git add -A
git commit -m "feat(plans): step cards, run bar card and reply panel"
```

---

### Task 11: Integration, cleanup, docs and verification

**Files:**
- Modify: `src/components/layout/ComposeView.tsx`, `src/components/plans/StepReplyPanel.tsx` (use `ActivityRow` if Task 10 inlined rows), `README.md`, `docs/superpowers/plans/2026-09-03-workbench-redesign.md` (tick boxes)
- Delete: any `src/components/ui/*.tsx` no longer imported (`toggle-group.tsx`, `table.tsx`, `accordion.tsx`, `input-group.tsx` are the likely ones — check with `grep -rln "ui/<name>" src`), `src/components/history/HexViewDialog.tsx` if a stale copy remains, `src/components/preview/`, `src/components/publish/` directories when empty
- Test: full suite with coverage

- [ ] **Step 1: Merge the parallel branches** into `feat/workbench-redesign` in the order 4, 5, 7, 6, 8, 9, 10; resolve conflicts (expected only in `ComposeView.tsx`, `App.tsx` and `PlanView.tsx` slot lines) and run `pnpm test` after each merge.

- [ ] **Step 2: Remove dead code**

For each candidate: `grep -rn "from \"@/components/ui/toggle-group\"" src` (etc.) → delete when unused. Delete empty directories. `pnpm exec tsc --noEmit` and `pnpm lint` must stay clean.

- [ ] **Step 3: Docs**

`README.md`: under "Reading queues safely" replace "The Response panel offers four ways to read a queue" with "The read-mode button in the Activity panel offers four ways to read a queue"; add a short "Workbench layout" paragraph after the install section: header (view switch, connection pill), files sidebar, Request card (destination strip, properties, form, hex strip, Send), Activity timeline (sent + received, replies grouped under their request), blocks drawer, connection sheet, shortcuts (⌘O, ⌘R, ⌘↵, ⌘⇧R, ⌘1/2/3). Update the "Local data" sentence "the trash icon in the sidebar footer" (still true). Add `docs/design/workbench-handoff/README.md` as the design reference link.

- [ ] **Step 4: Full verification**

Run, in order, and record the output in the final report:
```bash
pnpm exec tsc --noEmit
pnpm lint
pnpm test -- --coverage
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
pnpm build
```
Expected: 0 type errors, 0 lint errors, all tests green with coverage ≥ 78/70/76/79, Rust green (Docker broker running), Vite build exit 0.

- [ ] **Step 5: Visual pass**

`pnpm dev` + the browser pane at http://localhost:1420 (IPC is unavailable there — profiles/catalog stay empty, which exercises the empty and manual states); then `pnpm dev:app` for the real thing with the Docker broker (`docker compose up -d`, profile `localhost:5672 guest/guest`): open `examples/order.proto`, send to a queue, tap it, check the Activity row + reply grouping, open the connection sheet, switch to Plans, toggle the light theme once (readable, no missing colors). Fix visible defects only; no polish loops.

- [ ] **Step 6: Commit and report**

```bash
git add -A
git commit -m "chore(design): remove legacy panels, document the workbench layout"
```
Report: what changed per area, test/coverage/lint/build numbers, the handoff "Open questions" decisions (light palette derived in Task 1; hex `.bin` save, block fit hint, queue depth in the target combobox and the shortcut cheatsheet implemented; reply grouping = correlation id, else reply-to within 30 s), and anything left out.

---

## Test migration map

| Old test | New home |
|---|---|
| `__tests__/keyboard-shortcuts.test.tsx` | kept; renders `ComposeView`; ⌘1/2/3 assertions rewritten in Task 8 |
| `layout/RightPanel.test.tsx`, `layout/__tests__/RightPanel.test.tsx` | `activity/__tests__/ActivityPanel.test.tsx` |
| `publish/__tests__/PublishBar.test.tsx` | `compose/__tests__/{destination,useDestination,usePublish,DestinationStrip,RequestFooter}.test.tsx` |
| `publish/__tests__/PublishBar-quickswitch.test.tsx`, `connection/__tests__/ConnectionSection.test.tsx` | `connection/__tests__/ConnectionPill.test.tsx` |
| `connection/__tests__/ProfileManagementModal.test.tsx` | `connection/__tests__/{profileForm,ConnectionSheet}.test.tsx` |
| `form/__tests__/FormPanel*.test.tsx` | `compose/__tests__/{useRequestForm,RequestCard}.test.tsx` |
| `response/MessageFeedTab.test.tsx` | `activity/__tests__/{ReadModePopover,ActivityPanel,useActivityActions}.test.tsx` |
| `response/ResponseDecodedView.test.tsx`, `ResponseHexSection.test.tsx` | `common/__tests__/{DecodedTree,HexDump}.test.tsx` |
| `sidebar/__tests__/FileSection-*.test.tsx`, `SchemaExplorer.test.tsx` | `sidebar/__tests__/{useProtoFiles,FilesSidebar,MessageList}.test.tsx` |
| `history/historyHelpers.test.ts` | kept minus `filterHistoryEntries`; `activity/__tests__/activityModel.test.ts` covers filtering |
| `plans/PlanRunBar.test.tsx`, `StepStatusBadge.test.tsx` | kept, selectors updated; plus `plans/__tests__/{StepCard,StepReplyPanel}.test.tsx`, `sidebar/__tests__/PlansSidebar.test.tsx` |
| `blocks/BlockLibraryPanel.test.tsx` | kept, markup updated; plus `blocks/__tests__/blockFit.test.ts` |
| `ui/searchable-select.test.tsx`, `response/ResponseQueuePicker.test.tsx`, `SubscribePanel.test.tsx` | kept, selectors updated |

## Self-review notes

- Spec coverage: §1 header → Task 3; §2 sidebar → Tasks 5 and 10; §3 request card → Tasks 6 and 7; §4 activity → Task 8; §5 plans → Task 10; §6 blocks → Task 9; §7 connection sheet → Task 4; §8 dialogs/toasts → Task 2; "Interactions & behavior" (shortcuts, motion, auto-highlight, outcome chip timers, drag distances) → Tasks 3, 6, 8, 10; "State management" (no new stores) holds throughout; "Open questions" answered in Task 11's report.
- Type consistency: `ComposeSignals` (Task 3) is consumed by `RequestCard` (Task 6) and `ActivityPanel` (Task 8); `SheetState` (Task 3) by `ConnectionPill`/`ConnectionSheet` (Task 4); `CatalogStatus` (Task 6) by `ResponseQueuePicker` (Task 8); `receivedItem`/`ActivityRow` (Task 8) by `StepReplyPanel` (Task 10); `SidebarFooter` (Task 5) by `PlansSidebar` (Task 10). Parallel tasks that depend on a sibling's export ship a local fallback and switch in Task 11.
