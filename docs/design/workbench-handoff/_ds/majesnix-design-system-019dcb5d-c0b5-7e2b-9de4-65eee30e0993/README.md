# MajesNix Design System

> **Status:** Built from brief — no external assets, codebase, or Figma provided. All foundations derived from the brand description: *"MajesNix core design — darker colors, clean design, rounded corners."*

---

## Company / Product Context

**MajesNix** is a tech product brand. The name evokes mastery + precision ("Majestic" + "Nix" — evoking Unix/NixOS heritage or simply "clean, zero-noise"). The product positioning is **powerful, refined, dark-luxury tech** — surgical clarity over flashiness.

No external sources (Figma, codebase, assets) were provided for this system. All visual decisions below are design proposals that can be iterated with real brand assets.

---

## Sources

| Type | Reference |
|------|-----------|
| Figma | None provided |
| Codebase | None provided |
| Assets | None provided |
| Brief | "Darker colors, clean design, rounded corners" |

---

## File Index

```
README.md                  ← This file
SKILL.md                   ← Agent skill descriptor
colors_and_type.css        ← CSS variables: colors, type, spacing, radii
assets/
  logo.svg                 ← MajesNix wordmark / logomark (proposed)
preview/
  colors-bg.html           ← Background color swatches
  colors-accent.html       ← Accent + semantic colors
  type-display.html        ← Display type specimens
  type-body.html           ← Body + mono type specimens
  type-scale.html          ← Full type scale
  spacing.html             ← Spacing tokens
  radii-shadows.html       ← Radius + shadow system
  buttons.html             ← Button variants
  inputs.html              ← Form inputs
  badges.html              ← Badges + tags
  cards.html               ← Card components
  nav.html                 ← Navigation elements
ui_kits/
  majesnix/
    README.md
    index.html             ← Interactive UI prototype
    Shell.jsx              ← App shell (sidebar, topbar)
    Dashboard.jsx          ← Dashboard screen
    Components.jsx         ← Shared UI components
```

---

## CONTENT FUNDAMENTALS

**Voice & Tone**
- **Precise and confident.** MajesNix does not hedge. "Set up in 30 seconds." Not "You can get started in about 30 seconds or so."
- **Technical but not cold.** Respects the user's intelligence. Avoids dumbing down.
- **First-person voice is rare.** Prefer active second-person: "You control everything." or imperative: "Deploy instantly."
- **No filler words.** No "amazing", "powerful", "cutting-edge" unless in a specific marketing context and used once.
- **No emoji in UI.** Rare use in marketing copy only. Never in error messages, labels, or navigation.

**Casing**
- UI labels: **Title Case** for nav items, section headings. **Sentence case** for body copy and descriptions.
- Button labels: **Sentence case** (e.g. "Get started", not "Get Started")
- Error messages: **Sentence case.** Never ALL CAPS except for rare badge labels (e.g. `NEW`, `BETA`).

**Numbers & Data**
- Use numerals always: "3 items", "12 errors" — not "three items".
- Large numbers use commas: 1,024 not 1024.
- Dates: "Apr 26, 2026" format in UI.

**Examples of On-brand Copy**
- "No config required. Works out of the box."
- "Everything you need. Nothing you don't."
- "Built for teams that ship."
- "Your environment. Your rules."

---

## VISUAL FOUNDATIONS

### Colors
- **Background system:** Near-black multi-layer. `bg` (#0C0D12) → `surface` (#13151E) → `surface-2` (#1C1F2C) → `surface-3` (#252840). Each layer is ~7-8% lighter.
- **Text:** Off-white primary (`#EEF0F8`), muted secondary (`#9499B8`), ghost tertiary (`#5C6182`).
- **Accent:** Electric indigo-violet (`#7B6CF6`) as the primary action color. Deep teal (`#2DD4BF`) as a secondary highlight.
- **Semantic:** Success green (`#34D399`), warning amber (`#FBBF24`), danger red (`#F87171`).
- **Color vibe of imagery:** Cool-toned, desaturated. Blue-violet atmospheric shots. No warm filters.

### Typography
- **Display / Body:** Geist Variable — clean, neutral, precise. One family across the whole system; hierarchy comes from weight (600–800 for display, 400–500 for body) and tight letter-spacing, not a separate display face.
- **Mono:** Geist Mono — code, terminal, technical values.
- **Scale:** 12px → 14px → 16px → 18px → 24px → 32px → 48px → 64px → 80px.

### Spacing
- **Base unit:** 4px grid. All spacing values are multiples of 4.
- **Density:** Medium-compact in UI (12–16px internal padding for components), generous for marketing/hero sections.

### Backgrounds & Surfaces
- **No gradients on backgrounds.** Flat dark surfaces only.
- **Subtle noise texture** (3% opacity) on the root background for tactility.
- **Glass panels:** `backdrop-filter: blur(12px)` on modals and overlays, over a `rgba(255,255,255,0.04)` fill.
- **No full-bleed images** in UI (only in marketing hero sections).

### Borders & Separation
- **Default border:** `1px solid rgba(255,255,255,0.08)` — very subtle.
- **Strong border (focus/selected):** `1px solid rgba(123,108,246,0.5)` — violet-tinted.
- **No divider lines in favor of spacing where possible.**

### Corner Radii
- `2px` — micro (tags, small badges)
- `6px` — small (inputs, buttons, inline code)
- `10px` — medium (cards, panels, dropdowns)
- `16px` — large (modals, sheets)
- `9999px` — pill (status pills, avatar rings)

### Shadows & Elevation
- **No heavy drop shadows.** Elevation is expressed via surface color, not shadow depth.
- **Focus rings:** `0 0 0 3px rgba(123,108,246,0.35)` — violet glow.
- **Glow accent:** `0 0 24px rgba(123,108,246,0.15)` on primary buttons in hover state.

### Animations & Motion
- **Duration:** 150ms for micro (hover opacity), 200ms for standard (button press), 300ms for larger (panel open).
- **Easing:** `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) for entries, `ease-in` for exits.
- **No bounce or spring in production UI.** Bounces only in onboarding/marketing.
- **Hover states:** Slight brightness lift `brightness(1.1)` or background lightening. Never scale up on hover for functional UI (only for CTAs).
- **Press states:** `scale(0.97)` + `brightness(0.92)` for buttons.

### Iconography (see ICONOGRAPHY section)
- Lucide Icons (stroke-based, 1.5px weight, rounded joins).
- 16px (dense UI), 20px (standard), 24px (prominent).

---

## ICONOGRAPHY

**Approach:** Stroke-based icon set. Clean, consistent weight, rounded line joins/caps.

**Source:** [Lucide Icons](https://lucide.dev) — CDN available. Not copied locally (SVG-heavy). Load via `https://unpkg.com/lucide@latest`.

**Usage rules:**
- Standard size: `20px` in most UI contexts.
- Color: inherit from text color (use `currentColor`).
- Never scale icons with CSS `transform` — set explicit `width`/`height`.
- No colored icons in navigation or forms. Colored icons only in status indicators (success/error/warning).
- No emoji substitutes for icons.

**Note:** No brand-specific icon set was provided. Lucide is the designated substitute. If MajesNix has proprietary icons, replace the CDN import with local SVG sprites.

---

*Last updated: Apr 26, 2026 | Version 1.0.0*
