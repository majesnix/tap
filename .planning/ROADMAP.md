# Roadmap: Proto Sender

**Current Milestone:** v1.1 Dark Mode — In Progress
**Mode:** mvp

---

## Milestones

- ✅ **v1.0 MVP** — Phases 1–4 (shipped 2026-05-18)
- **v1.1 Dark Mode** — Phase 5 (in progress)

---

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1–4) — SHIPPED 2026-05-18</summary>

- [x] **Phase 1: Proto Parsing + Form** — 6/6 plans — completed 2026-05-17
- [x] **Phase 2: Connect + Publish** — 6/6 plans — completed 2026-05-17
- [x] **Phase 3: Full Feature Set** — 4/4 plans — completed 2026-05-18
- [x] **Phase 4: Response Queue Reader** — 2/2 plans — completed 2026-05-18

See [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for full phase details, decisions, and retrospective.

</details>

**v1.1 Dark Mode**

- [ ] **Phase 5: Dark Mode** - Add OS-aware dark mode with in-app toggle and persistent preference

---

## Phase Details

### Phase 5: Dark Mode
**Goal**: Users can choose their preferred theme (system, light, or dark), have it applied immediately across the entire app, and find their choice remembered on next launch
**Depends on**: Phase 4 (brownfield — all existing UI surfaces must be verified in dark mode)
**Requirements**: DRK-01, DRK-02, DRK-03, DRK-04
**Success Criteria** (what must be TRUE):
  1. On first launch with no saved preference, the app matches the OS dark/light setting automatically
  2. User can open a theme toggle in the app UI and switch between system, light, and dark modes — the change takes effect immediately without a reload
  3. After switching theme and restarting the app, the previously selected mode is restored
  4. Every existing UI surface — form panel, connection sidebar, publish bar, AMQP properties sheet, message history panel, response tab, modals, and shadcn/ui components — renders without visual defects in dark mode
**Plans**: 3 plans
Plans:
- [x] 05-01-PLAN.md — ThemeProvider + ThemeBootstrap with race-guard persistence bridge (DRK-01, DRK-03)
- [x] 05-02-PLAN.md — ThemeToggle component + Sidebar footer integration (DRK-02)
- [ ] 05-03-PLAN.md — DRK-04 manual visual UAT checkpoint (DRK-04)
**UI hint**: yes

---

## Progress Table

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Proto Parsing + Form | v1.0 | 6/6 | Complete | 2026-05-17 |
| 2. Connect + Publish | v1.0 | 6/6 | Complete | 2026-05-17 |
| 3. Full Feature Set | v1.0 | 4/4 | Complete | 2026-05-18 |
| 4. Response Queue Reader | v1.0 | 2/2 | Complete | 2026-05-18 |
| 5. Dark Mode | v1.1 | 0/3 | Not started | - |

---

## Coverage

**v1.0 — all 30 requirements delivered**

| Requirement | Phase | Status |
|-------------|-------|--------|
| PROT-01 | Phase 1 | ✅ Complete |
| PROT-02 | Phase 1 | ✅ Complete |
| PROT-03 | Phase 3 | ✅ Complete |
| PROT-04 | Phase 3 | ✅ Complete |
| FORM-01 through FORM-09 | Phase 1 | ✅ Complete |
| CONN-01 through CONN-04 | Phase 2 | ✅ Complete |
| PUBL-01 through PUBL-03 | Phase 2 | ✅ Complete |
| PUBL-04 | Phase 3 | ✅ Complete |
| HIST-01 through HIST-04 | Phase 3 | ✅ Complete |
| RESP-01 through RESP-05 | Phase 4 | ✅ Complete |

**v1.1 — 4/4 requirements mapped**

| Requirement | Phase | Status |
|-------------|-------|--------|
| DRK-01 | Phase 5 | Pending |
| DRK-02 | Phase 5 | Pending |
| DRK-03 | Phase 5 | Pending |
| DRK-04 | Phase 5 | Pending |
