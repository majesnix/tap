# Handoff: Tap — Workbench redesign (MajesNix)

Repo: `majesnix/tap` (main) · Frontend: React 19 + TypeScript, Tailwind CSS 4, shadcn/ui (radix-ui), Zustand, react-hook-form, Geist Variable via `@fontsource-variable/geist`, Tauri 2.

## Overview
Re-layout and restyle of the Tap desktop app (protobuf → RabbitMQ sender) onto the MajesNix design system. The chosen direction is **Workbench**: the form becomes a "Request" card that ends in Send, the hex preview is a collapsible strip in that card's footer, History + Response merge into one **Activity** timeline that groups each sent request with its reply, plan steps become expandable cards, and connection management is a right-hand sheet. Every current capability is kept; nothing in the Rust backend or Zustand stores changes. This is a `src/components/**` + `src/index.css` job.

## About the design files
`Tap Workbench.dc.html` is an **HTML design reference / clickable prototype**, not production code. Recreate it in the existing React + Tailwind + shadcn codebase using its patterns (cva variants, Radix primitives, Zustand stores, react-hook-form). It depends on `Icon.dc.html`, `icons/`, `public/`, `_ds/`, `support.js` — keep them beside it when opening in a browser. `Tap - Current.dc.html` is a faithful copy of today's UI for diffing.

## Fidelity
**High-fidelity.** Colors, type, spacing, radii and control sizes below are final. Design frame is 1280×820 (min width 1240); the app is a resizable Tauri window — sidebar 272 and Activity 360 are fixed, the Request card flexes.

## Implementation strategy
1. **Tokens** — replace the oklch neutral values in `src/index.css` with MajesNix tokens (see Design tokens). Map: `--background`→`#0C0D12`, `--card`/`--popover`/`--sidebar`→`#13151E`, `--muted`/`--secondary`/`--accent`→`#1C1F2C`, `--border`/`--input`→`rgba(255,255,255,.08)`, `--primary`→`#7B6CF6` with `--primary-foreground` `#FFFFFF`, `--muted-foreground`→`#9499B8`, `--destructive`→`#F87171`, `--ring`→`#7B6CF6`. Set `--radius: 0.375rem` (6px). Add `--font-mono: 'Geist Mono Variable'` (`@fontsource-variable/geist-mono`).
2. **Shell** — `AppLayout.tsx` becomes: Header (52px) / row [Sidebar 272 | (Blocks drawer 272, optional) | Main flex | Activity 360]. `PlanView.tsx` reuses the same shell with a different sidebar and main.
3. **Components** — restyle shadcn primitives once (Button, Input, Badge→"Tag", Tabs→segmented control, Switch, Select), then rebuild the feature components listed per section below.
4. **Light theme** — keep the toggle; derive light values for the same token names (not designed here).

---

## Screens

### 1 · Header (`AppLayout.tsx`, new `AppHeader`)
h52, px20, border-bottom 1px `rgba(255,255,255,.08)`, gap 16.
- Brand: `public/tap-mark.svg` 24px + "Tap" 15px/600 letter-spacing -.01em.
- View switch (replaces sidebar "Plans" button + `viewMode` in `App.tsx`): segmented control — container p2 radius 6 bg `#13151E` border; items h28 px12 radius 4 gap6 12.5px, Lucide icon 13px (`send` Compose, `list-checks` Plans); active bg `#1C1F2C` weight 600 text-1, inactive weight 500 text-2.
- Right: **Connection pill** (replaces sidebar `ConnectionSection` + PublishBar profile select) — h34 radius 999 bg `#13151E` border, pl12 pr6 gap10: 8px status dot (`#34D399` + `box-shadow 0 0 8px rgba(52,211,153,.6)` connected, `#5C6182` disconnected, `#F87171` error), profile name 13/500, host mono 11 text-3, **environment pill** h20 px8 radius 999 10px/700 letter-spacing .08em uppercase (local `#34D399` on `rgba(52,211,153,.12)`, shared `#FBBF24` on `rgba(251,191,36,.12)`, production `#F87171` on `rgba(248,113,113,.12)`), chevron-down 14 in a 24px hit area. Hover: border `rgba(123,108,246,.45)`. Click → Connection sheet (list). No profiles → dashed violet pill "+ Add connection".
- 32px ghost icon buttons: `library` (toggle Blocks drawer; active bg `rgba(123,108,246,.12)` icon `#A497FF`), `keyboard` (shortcut cheatsheet popover — new, optional), theme cycle (`moon`/`sun`/`monitor`). Ghost hover: bg `#1C1F2C`, icon text-1.

### 2 · Sidebar (`Sidebar.tsx` → `FilesSidebar`)
w272, p 16 12, gap 18, border-right. Section labels 11px/600 uppercase letter-spacing .1em text-3, px8.
- **FILES** header with 24px ghost icons `refresh-cw` (Reload ⌘R) and violet `plus` (Open ⌘O; violet hover bg `rgba(123,108,246,.12)`). File rows h40 px10 radius 10: 28px icon tile radius 6 (`file-code` 15; active tile bg `rgba(123,108,246,.12)` icon `#A497FF`, inactive tile bg `#13151E` icon text-2), name 13/500, meta 11 text-3 ellipsized ("6 messages · 1 enum · includes examples/"; the includes part opens include-path management = `IncludePathManager`), 22px `x` close on the active row. Active row bg `#13151E` + border; inactive hover bg `#13151E`. Parse errors render under the row as 12px `#F87171` with `triangle-alert`.
- **MESSAGES** (replaces Message Type `Select` + `SchemaExplorer` list): rows h32 px10 radius 6, 6px dot (`#7B6CF6` selected, `#5C6182` otherwise), name 13/500, field count mono 11 text-3; selected bg `rgba(123,108,246,.12)` text-1; hover bg `#13151E`. Click = `setSelectedType`. **ENUMS** rows use a 6px square (radius 2) marker.
- Empty (no file): dashed violet button h40 radius 10 "+ Open .proto ⌘O" (hover bg `rgba(123,108,246,.08)`), then **RECENT** rows h32 (`file-code` 14, text-2; stale files line-through text-3 with tooltip "File not found").
- Footer: "v1.9.0 · Steady Signal" 11 text-3 + 24px `trash-2` ghost (ClearLocalDataButton; hover `#F87171`).
- Plans mode: sidebar shows **PLANS** + violet `plus`; plan cards p 10 12 radius 10: name 13/500, "3 steps · ran 14:02" 11 text-3; selected bg `rgba(123,108,246,.12)`.

### 3 · Request card (`FormPanel.tsx` + `PublishBar.tsx` merged)
Main p16; card fills, radius 16, bg `#13151E`, border, overflow hidden, column.
- **Header** p 14 18, border-bottom: "REQUEST" label, message name 16/600 letter-spacing -.01em, full name mono 12 text-3, "· draft saved" 11 text-3 (from `useDraftStore`). Right: toolbar container p2 radius 6 bg `#0C0D12` border with 28×26 icon buttons `library` (blocks, pressed = violet .12/#A497FF), `dices`, `rotate-ccw` (⌘⇧R), `braces` (JSON mode, pressed = violet). Hover bg `#1C1F2C` icon text-1.
- **Destination strip** p 12 18, border-bottom, bg `rgba(255,255,255,.02)`, gap 10, wraps: "TO" label; Queue|Exchange segmented (container bg `#0C0D12` border; items h26 px10 radius 4 12px/600, active bg `#252840`); target combobox w280 h36 radius 6 bg `#0C0D12` border pl12 pr8: name mono 12.5, meta mono 11 text-3 ("12 msgs · 1 consumer" from `fetchQueueDepth`, exchange type in exchange mode), `chevrons-up-down` 14; Exchange mode adds `arrow-right` 14 text-3 + routing-key combobox w220 (prefix "key" 11 text-3, value mono 12.5; `RoutingKeyCombobox`). "● Live catalog" 11 text-2 (dot `#34D399`; Manual = `#FBBF24` "Manual entry"; 401 = red tag "AUTH FAILED" with tooltip). Spacer. **Properties summary button** h28 px10 radius 6 12px text-2: `layers` 14 + "persistent · reply-to `orders.reply` · 2 headers" (mono for values; "defaults" when nothing set) + "Edit" `#A497FF`/500; open state border `rgba(123,108,246,.45)` bg `rgba(123,108,246,.08)` and label "Done". Fanout/headers hint (12 text-3) renders as a second line of the strip.
- **Properties section** (inline, replaces `AmqpPropertiesSheet`) p 4 18 16, gap 12: grid `2fr 1fr 1fr` Content type input / Delivery segmented (Transient|Persistent, h36) / TTL input with "ms" suffix; grid `1fr 1fr 2fr` Correlation ID / Reply-to / Headers (label + "2 / 20" mono 11 text-3; header pills h28 radius 999 bg `#0C0D12` border mono 12 `x-tenant = acme ×`, value text-2, `x` 12 text-3; dashed "+ header" pill opens inline key/value entry). Footer row: "Reset to defaults" 12 text-2 left, primary "Apply" h28 px12 12px right. Draft semantics unchanged (apply on Apply).
- **Form body** p18 gap16, scrolls. Field styles (`ProtoFormRenderer` + `fields/*`):
  - Scalar / enum label row: label 13/500, `type · fieldNumber` mono 11 text-3, spacer, `copy` 12 text-3 (CopyButton, always visible at low contrast). Input h36 px12 radius 6 bg `#0C0D12` border, value mono 13 text-1; focus border `rgba(123,108,246,.45)` + ring `0 0 0 3px rgba(123,108,246,.35)`; invalid border `#F87171` + 12px `#F87171` message. Top-level scalars in `grid-cols-2 gap-16`.
  - Enum select shows `NAME = number` (number text-3), chevron-down 14.
  - **Repeated of a flat message (≤5 scalar fields, no nesting) → table**: label row (label, "repeated LineItem · 3 · N rows" mono 11 text-3, spacer, "+ Add item" 12/500 violet ghost); column header row grid `28px 2fr 3fr 1fr 1fr 28px` mono 10.5 text-3 with field names; data rows grid same, p 6 12 radius 6 bg `#0C0D12` border (hover border .16): index mono 11 text-3, borderless inputs h28 px8 radius 4 (focus border violet + bg `#13151E`), `trash-2` 13 text-3 (hover `#F87171` on `rgba(248,113,113,.12)`). Repeated of anything else → stacked containers (below) with an index header and trash.
  - **Nested message → container** p14 radius 10 border (no fill): header button chevron-down 14 text-2 (rotates -90° when collapsed, 150ms), label 13/500, `Type · fieldNumber` mono 11 text-3; collapsed shows a one-line mono 11 text-2 summary of the values. Children: label 12 text-2 above inputs h34 (grid columns by field count, e.g. Address `2fr 1fr 1fr 1fr 1fr`). Depth alternates input bg `#0C0D12` / `#13151E`.
  - **Oneof → segmented control** (container bg `#0C0D12` border h36; items mono 12, active bg `#252840` 600) followed by a container for the selected branch: header "Credit Card" 13/500 + "CreditCard · 4 fields" mono 11 text-3; fields in `grid-cols-4`, sub-labels 12 text-2 with type mono 10.5 text-3.
  - Bool → switch 28×16 (thumb 12; on `#7B6CF6`/white, off `#252840`/text-2). Bytes/map/well-known keep current behavior in these styles.
  - JSON mode: gutter w44 bg `#0C0D12` mono 12.5/20 text-3 right-aligned; editor `#13151E` (CodeMirror theme: keys text-2, strings `#A497FF`, numbers text-1). Parse-error banner: radius 6 bg `rgba(248,113,113,.1)` border `rgba(248,113,113,.4)` p12, `triangle-alert` + 12px `#F87171`, buttons "Fix JSON" outline / "Discard changes" destructive.
  - Drop target while dragging a block: card border `rgba(123,108,246,.45)` + ring `0 0 0 4px rgba(123,108,246,.12)`; header right "Drop to fill Shipping · 5 fields" 12 `#A497FF`; the receiving container gets violet border + bg `rgba(123,108,246,.06)`. Drag overlay: p 10 14 radius 10 bg `#252840` border violet .45 shadow `0 8px 32px rgba(0,0,0,.6)` rotate -2°. Conflict dialog keeps its content in the dialog style below.
- **Footer** border-top bg `rgba(255,255,255,.02)`: row p 12 18 gap 12 — hex strip button (`binary` 15 text-2, "142 B · 0a 0a 6f …" mono 11.5, count text-2 bytes text-1, ellipsized, "Expand/Collapse" 12/500 violet); outcome chip h24 px8 radius 2 mono 11/600 (`circle-check` + "ACK · 14:02:11" `#34D399` on `rgba(52,211,153,.1)`; Returned `#FBBF24`; NACK/Timeout `#F87171`; timeout has an `x`); **Send** h36 pl14 pr8 radius 6 bg `#7B6CF6` white 600 `send` 15 + "Send to {target}" + kbd "⌘↵" (h20 px6 radius 4 bg `rgba(255,255,255,.14)` mono 11/500); hover `brightness(1.1)` + `box-shadow 0 0 24px rgba(123,108,246,.25)`; active `scale(.97)`; sending: `loader-circle` spin + "Sending…"; disabled opacity .5 with existing tooltips. Expanded hex: header "wire format · 142 bytes · example.Order" mono 11 text-3 + `copy`/`download` (.bin, new optional) 26px ghosts; dump grid 2 columns p 12 14 radius 6 bg `#0C0D12` border .06, mono 11.5/20: offset (4 hex digits, text-3, w36), 8 bytes text-1 letter-spacing .02em (w200), ASCII text-3 (non-printable "·"); max-height 180 scroll. Encode error: mono 12 `#F87171` in the strip.
- **Empty state** (no schema): dashed placeholder (border 1px dashed `rgba(255,255,255,.1)`, radius 16), centered column max-w 420: `public/tap-icon.svg` 64 radius 16; "Send a real protobuf message in 30 seconds" 20/600 letter-spacing -.02em; copy 14 text-2/1.55; three step cards `grid-cols-3 gap-10` (p12 radius 10 bg `#13151E` border; icon 16 — `file-code` violet / `radio` teal / `send` green; title 13/600; hint 11 text-2; first card is a button with violet border → open file); footer line 12 text-3 "Connected to local · try examples/order.proto".

### 4 · Activity panel (replaces `RightPanel` Hex/History/Response)
w360, border-left, column.
- Header p 16 16 10: "ACTIVITY" label; segmented All | Sent | Received (container bg `#13151E` border, items h22 px8 11px, active bg `#1C1F2C` 600).
- Controls p 0 16 10 gap 8: filter input h30 radius 6 bg `#13151E` border (`search` 13, placeholder "Filter type, target, payload…" — replaces the three History filter inputs; `filterHistoryEntries` matches all); **read-mode button** h30 px10 radius 6 bg `#13151E` border: 6px dot + label + chevron. Running Tap/Subscribe: dot `#2DD4BF` pulsing (1.6s ease-in-out opacity 1→.35), border `rgba(45,212,191,.35)`, label "Tapping orders"; idle: dot text-3, label "Read queue". Its popover holds `ResponseQueuePicker` + `SubscribePanel`: mode segmented Tap / Subscribe / Peek / Consume, queue combobox, decode-as multiselect, count input, Start/Stop or Peek/Consume button, the existing safety copy and confirmations.
- Timeline rows (border-top `rgba(255,255,255,.05)`): 22px icon tile radius 6 — sent `arrow-right` `#A497FF` on `rgba(123,108,246,.12)`, received `arrow-left` `#2DD4BF` on `rgba(45,212,191,.12)`; line 1 type 13/500 ellipsized + status 10/700 letter-spacing .06em (ACK `#34D399`, NACK/Failed `#F87171`, Returned/NO DECODER `#FBBF24`, DECODED `#2DD4BF`); line 2 mono 11: target text-2 · time `HH:MM:SS.mmm` · size, text-3. Sent = `useHistoryStore.entries`; received = `useResponseStore.messages`; merged and sorted by timestamp.
- **Reply grouping**: a received message whose `correlationId` matches a sent entry's correlation id (or whose routing key equals the sent reply-to, within the timeout) renders under that sent row: margin 2 16 12 27, padding 6 0 0 14, left rule 1px `rgba(45,212,191,.35)`; tile + type + "REPLY" tag `#2DD4BF` + meta "orders.reply · req-7c1e · +278 ms · 88 B" mono 11 text-3. Hidden when the filter is "Sent".
- **Expanded row** (click): the whole group gets bg `rgba(255,255,255,.03)`; below it (p 0 16 14 48): decoded block p 10 12 radius 6 bg `#13151E` border .06, mono 12/1.6 — keys text-2, strings `#A497FF`, enum names `#2DD4BF`, numbers text-1, nested "[1 LineItem]"/"{…}" text-2 (reuse `ResponseDecodedView` tree with these colors); action row of h26 outline buttons 12px text-2 (`arrow-left` Load = `onReplay`, `rotate-ccw` Resend, `binary` Hex → `HexViewDialog`/`ResponseHexSection`). Received rows show the same block with decode error mono `#F87171` when `error` is set.
- Footer p 10 16 border-top 11 text-3: "4 sent · 3 received · today" left; `download` + "Export" 12 text-2 right (existing `handleExport`, visible rows).
- Empty: "Sent and received messages appear here as one timeline." 12 text-3.

### 5 · Plans (`PlanView`, `PlanDetailPanel`, `PlanRunBar`, `StepListPanel`, `StepFieldEditor`, `TargetSection`, `ResponseModeSection`)
Main p16 gap 12, scrolls.
- **Run bar card** p 14 18 radius 16 bg `#13151E` border: plan name 16/600, "3 steps · last run 14:02 · 3.9 s" 12 text-3; result pill h26 px10 radius 999 (`circle-check` "3 / 3 succeeded" `#34D399` on `rgba(52,211,153,.1)`; ✗ variant `#F87171`); Stop-on-error switch + label 12 text-2; primary button h34 px14 (`play` "Run plan" / "Run again"; running → `square` "Stop" `#F87171` on `rgba(248,113,113,.12)`; progress chip "1 / 3 · waiting 4.2s" amber mono 11 replaces the result pill).
- **Step cards** radius 10 bg `#13151E` border (selected border `rgba(123,108,246,.45)`): header grid `16px 28px 1fr auto` p 14 16 — `grip-vertical` 14 text-3 (drag handle, dnd-kit sortable), 28px numbered circle (done `rgba(52,211,153,.15)`/`#34D399`; active `#7B6CF6`/white; pending `#1C1F2C`/text-2; error `rgba(248,113,113,.15)`/`#F87171`), name 14/600 + status pill h18 px7 radius 999 10/700 (DONE/SENDING/WAITING/ERROR/PENDING same colors), meta row mono 11.5 text-2 with keys text-3 "type Order · to orders · then wait 200 ms", right column duration mono 11 text-3 + "View reply" 12/500 violet. Kebab actions (Rename/Duplicate/Delete) on hover at the right of the header.
- **Expanded step** (selected; border-top .06, p 14 16 16 72): grid 3 selects Proto file / Message type / Response mode (h34, 12.5); grid 3 Target combobox (mono) / Delay or Timeout input with "ms" suffix / Reply queue (mono; "—" text-3 for no-wait); Fields row: "Fields · 6 fields · 2 empty" 12 text-2 + "Edit fields" 12/500 violet (`pencil`) → opens the field form inside the card (same field styles as the Request card, inputs h34). Inputs disabled (opacity .6) while running.
- Dashed "+ Add step — blank · from history · from block" h44 radius 10 (hover violet) → dropdown with the three sources (`StepHistoryPicker`, `StepBlockPicker`).
- **Right panel** (w360): "STEP 2 · REPLY" label + "Reply feed · 2" 12 text-2; reply card m 0 16 p 12 14 radius 10 bg `#13151E` border: teal tile + type 13/500 + "+412 ms" mono 11 text-3; meta mono 11 text-3; decoded block (as Activity); footer "Decoded as PaymentConfirmed" / "Hex" 11. No-wait step: dashed note "This step does not wait for a reply. Switch its response mode to correlation id or first arrival to capture one." 12 text-3. Reply feed tab lists all replies of the run in the Activity row style.
- Empty plan / no plan selected: `clipboard-list` 40 text-3 + "Select a plan to get started" 13/600 + hint 12 text-3, centered.

### 6 · Blocks drawer (`BlockLibraryPanel`)
w272 column between sidebar and main (p 16 0 16 16); card radius 16 bg `#13151E` border. Header "BLOCKS" + 24px `search` / violet `plus`. Block cards p 10 12 radius 10 bg `#0C0D12` border, cursor grab, hover border violet .45: `grip-vertical` 14 text-3 + name 13/500 + `pencil` 13 text-3; JSON preview mono 11 text-3 ellipsized; fit line 11px ("fits Shipping · 5 of 5 fields" `#34D399`; partial/replace `#FBBF24`; no match text-3) — computed by matching block keys against the selected message's fields (new, optional; omit line if not implemented). Footer note 11 text-3 border-top. Editor view (new/edit): same card, `arrow-left` back + title, name input h36, CodeMirror flex, error banner as JSON mode, primary "Save block" full width. Delete = AlertDialog.

### 7 · Connection sheet (replaces `ProfileManagementModal`)
Overlay `rgba(12,13,18,.6)` + `backdrop-filter blur(12px)` (click closes). Sheet right w440 bg `rgba(19,21,30,.97)` border-left, shadow `0 8px 32px rgba(0,0,0,.6)`; slide-in 200ms from +10px.
- **List**: header p 18 20 12 "Connections" 15/600 + "Passwords live in the OS keychain" 12 text-3 + `x`. Profile rows p 12 14 radius 10 bg `#0C0D12` border (active profile border violet .45; hover violet): 8px dot (`#34D399` active, text-3 otherwise), name 13/500 + URL mono 11 text-3 (`amqps://user@host:port/vhost`), environment pill, `chevron-right` 14 text-3. Dashed violet "+ New connection" h44. Row click → detail; quick-switch happens from the header pill dropdown (list of names with dots) — the sheet is for editing.
- **Detail**: header `arrow-left` back, name 15/600 + "Connection profile" 12 text-3, environment pill h22, `x`. Three grouped cards radius 10 bg `#0C0D12` border with 11px uppercase labels:
  - **BROKER** grid `100px 1fr` gap 6 10: Name (read-only when editing), Host (mono), Ports [5671 `amqps` | 15671 `https`] (mono, suffix 10 text-3; choosing 5671/15671 flips the TLS switches as today), Virtual host, Credentials [user | password] (password placeholder "leave blank to keep" when editing). Inputs h30 px10 radius 6 bg `#13151E` border.
  - **SAFETY**: Environment segmented (Shared active label `#FBBF24`, Production `#F87171`), helper 11 text-3 "Shared asks before Consume and Subscribe. Production also asks before Send.", rows h34 separated by `rgba(255,255,255,.05)`: Read-only profile switch, Record sent messages in history switch.
  - **TLS**: header summary right-aligned (`shield` + "Encrypted on both transports" `#34D399`, or `triangle-alert` + "Password travels unencrypted over AMQP" `#FBBF24` = `cleartextTransports`), rows: AMQP over TLS `amqps` switch, Management API over HTTPS switch, CA certificate input + `folder-plus` browse (30px outline).
  - Footer p 12 20 border-top: "Delete" 12 `#F87171` left; test result (`circle-check` "Reachable · 41 ms" `#34D399` / `circle-alert` + message `#F87171` / `loader-circle` "Testing…" text-2); outline "Test" h34; primary "Save & connect" h34 (closes sheet and activates the profile on success, stays open on error).

### 8 · Dialogs / toasts
AlertDialog (delete, production publish, shared consume, block conflicts): radius 16 bg `#13151E` border, title 15/600, body 13 text-2, destructive action bg `rgba(248,113,113,.12)` `#F87171`, cancel outline. Overlay as the sheet. Toasts (sonner): bg `#1C1F2C` border radius 10 13px; success dot `#34D399`, error `#F87171`.

---

## Interactions & behavior
- Keyboard: ⌘O open, ⌘R reload, ⌘↵ send, ⌘⇧R clear — unchanged; surfaced as kbd chips. ⌘1/2/3 (old tabs) → ⌘1 focus filter, ⌘2 toggle hex, ⌘3 toggle read-mode popover (or drop). `keyboard` icon shows a cheatsheet.
- Motion: hover 150ms, press 200ms (`scale(.97)`), panel/sheet 300ms, easing `cubic-bezier(0.16,1,0.3,1)`; chevrons rotate 150ms; no bounce.
- Auto-switch rules that used to change tabs: after send → highlight the new Activity row (bg `rgba(123,108,246,.06)` fading over 1.5s); replay → scroll the Request card to top; read → new received rows slide in at top.
- Outcome chip auto-dismiss: ACK 3s, Returned/NACK 5s, Timeout manual.
- Drag: `PointerSensor` distance 8 (form), 4 (steps).
- Errors/loading states as specified per section.

## State management
No new stores. Local UI state: `view` (compose|plans, `App.tsx`), `blocksOpen`, `propsOpen`, `hexOpen`, `jsonMode`, per-container collapsed flags, `activityFilter`, `expandedActivityId`, `sheet` (null|list|profileName), `selectedStepId`. Derived: properties summary/count from `useAmqpStore`; Activity merge from `useHistoryStore` + `useResponseStore`; reply grouping by correlation id / reply-to; block fit from `schema.message_map[selectedMessageType].fields`.

## Design tokens (MajesNix)
Backgrounds: bg `#0C0D12`, surface `#13151E`, surface-2 `#1C1F2C`, surface-3 `#252840`.
Borders: `rgba(255,255,255,.08)` default, `.05/.06` hairlines inside cards, `.12` dashed placeholders, `.16` hover, `rgba(123,108,246,.45)` focus/selected.
Text: text-1 `#EEF0F8`, text-2 `#9499B8`, text-3 `#5C6182`; white `#FFFFFF` on violet.
Accent violet `#7B6CF6`, bright `#A497FF` (links/active icons), bg `rgba(123,108,246,.08–.12)`, glow `rgba(123,108,246,.18–.25)`. Teal (received/tap) `#2DD4BF`, bg `rgba(45,212,191,.12)`, rule `.35`.
Semantic: success `#34D399` / `rgba(52,211,153,.10–.15)`; warning `#FBBF24` / `rgba(251,191,36,.10–.12)`; danger `#F87171` / `rgba(248,113,113,.10–.15)`.
Type: Geist 10 / 11 / 12 / 12.5 / 13 / 14 / 15 / 16 / 20 px; weights 500 / 600 / 700. Geist Mono 10.5 / 11 / 11.5 / 12 / 12.5 / 13 px for hosts, queue names, hex, values, counts, type names. Section labels 11/600 uppercase letter-spacing .1em text-3. Tags 10/700 uppercase letter-spacing .06–.08em.
Spacing: 4px grid (2 4 6 8 10 12 14 16 18 20).
Radii: 2 (outcome chip), 4 (segment items, kbd, small ghosts), 6 (inputs, buttons, rows, tiles), 10 (cards, containers, sheet groups), 16 (Request card, run bar, sheet/dialog), 999 (pills).
Shadows: none on surfaces; popover/sheet/drag `0 8px 32px rgba(0,0,0,.6)`; focus `0 0 0 3px rgba(123,108,246,.35)`; glow `0 0 24px rgba(123,108,246,.18–.25)`; glass `backdrop-filter blur(12px)`.
Controls: inputs 28 (table cells) / 30 (sheet) / 34 (nested) / 36 (top-level) px — the prototype's `inputHeight` tweak (30–40) shows the density range; buttons 26 / 28 / 30 / 34 / 36; icon buttons 22 / 24 / 26 / 28 / 32; icons 11–17px Lucide 1.5 stroke `currentColor`.

## Assets
- `public/tap-mark.svg`, `public/tap-icon.svg` — from the repo, unchanged.
- Icons — Lucide (`lucide-react` already installed). Used: send, list-checks, library, keyboard, moon, sun, monitor, settings, chevron-down, chevron-right, chevrons-up-down, refresh-cw, plus, x, file-code, trash-2, dices, rotate-ccw, braces, layers, arrow-right, arrow-left, copy, binary, download, circle-check, circle-alert, triangle-alert, loader-circle, search, grip-vertical, pencil, play, square, shield, folder-plus, radio, clipboard-list.
- Fonts — Geist Variable (present), Geist Mono Variable (`@fontsource-variable/geist-mono`, add).

## Files in this bundle
- `Tap Workbench.dc.html` — the clickable prototype (open in a browser ≥1240px wide). Interactive: Compose⇄Plans, open/close file (empty state), message select, Queue⇄Exchange, Properties expand, JSON mode, collapse Shipping, oneof segments, add/remove line items, hex expand, Send (spinner → ACK), Activity filters + row expand, tap indicator, Blocks drawer, connection pill → sheet → Save & connect, plan step expand. Tweaks: `environment`, `inputHeight`.
- `Tap - Current.dc.html` — recreation of the current shadcn UI for diffing.
- `Icon.dc.html`, `icons/*.svg`, `public/*.svg`, `_ds/**` (tokens in `_ds/**/colors_and_type.css`), `support.js` — dependencies.
- `github.md` — source association and screen map.

## Open questions
1. Light theme palette (derive from token names; not designed).
2. Optional new capabilities shown: save hex as `.bin`, block "fits" hint, queue depth in the target combobox, shortcut cheatsheet, persistent "Schema reloaded" state.
3. Reply grouping heuristic when no correlation id is set (currently: reply-to match within the response timeout).
