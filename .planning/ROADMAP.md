# Roadmap: Tap

**Last Milestone:** v1.4 Response Stream — SHIPPED 2026-05-21
**Current:** v1.5 Distribution — in progress

---

## Milestones

- ✅ **v1.0 MVP** — Phases 1–4 (shipped 2026-05-18)
- ✅ **v1.1 Dark Mode** — Phase 5 (shipped 2026-05-18)
- ✅ **v1.2 Form Improvements** — Phases 6–8 (shipped 2026-05-19)
- ✅ **v1.3 Publishing UX + Message Blocks** — Phases 9–12 (shipped 2026-05-20)
- ✅ **v1.4 Response Stream** — Phases 13–15 (shipped 2026-05-21)
- 🔄 **v1.5 Distribution** — Phases 16–18 (in progress)

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

<details>
<summary>✅ v1.1 Dark Mode (Phase 5) — SHIPPED 2026-05-18</summary>

- [x] **Phase 5: Dark Mode** — 3/3 plans — completed 2026-05-18

See [milestones/v1.1-ROADMAP.md](milestones/v1.1-ROADMAP.md) for full phase details, decisions, and retrospective.

</details>

<details>
<summary>✅ v1.2 Form Improvements (Phases 6–8) — SHIPPED 2026-05-19</summary>

- [x] **Phase 6: BytesField** — 1/1 plans — completed 2026-05-19
- [x] **Phase 7: MapField** — 4/4 plans — completed 2026-05-19
- [x] **Phase 8: JSON Override Toggle** — 2/2 plans — completed 2026-05-19

See [milestones/v1.2-ROADMAP.md](milestones/v1.2-ROADMAP.md) for full phase details, decisions, and retrospective.

</details>

<details>
<summary>✅ v1.3 Publishing UX + Message Blocks (Phases 9–12) — SHIPPED 2026-05-20</summary>

- [x] **Phase 9: Routing Key Autocomplete** — 3/3 plans — completed 2026-05-19
- [x] **Phase 10: Publisher Confirms Badge** — 2/2 plans — completed 2026-05-19
- [x] **Phase 11: Block Library — Store, Editor, Persistence** — 3/3 plans — completed 2026-05-19
- [x] **Phase 12: Block Library — Drag-and-Drop Layer** — 3/3 plans — completed 2026-05-20

See [milestones/v1.3-ROADMAP.md](milestones/v1.3-ROADMAP.md) for full phase details, decisions, and retrospective.

</details>

<details>
<summary>✅ v1.4 Response Stream (Phases 13–15) — SHIPPED 2026-05-21</summary>

- [x] **Phase 13: Message Feed Foundation + Drain Mode** — 3/3 plans — completed 2026-05-20
- [x] **Phase 14: Live Subscribe Mode** — 3/3 plans — completed 2026-05-21
- [x] **Phase 15: Filter + Export** — 1/1 plans — completed 2026-05-21

See [milestones/v1.4-ROADMAP.md](milestones/v1.4-ROADMAP.md) for full phase details, decisions, and retrospective.

</details>

### v1.5 Distribution (Phases 16–18)

- [x] **Phase 16: Pipeline Foundation** - Fix release.yml structure, Entitlements.plist, and bump to v1.5.0; validate via workflow_dispatch without signing (completed 2026-05-21)
- [ ] **Phase 17: macOS Signing + Notarization** - Wire Developer ID cert, Apple secrets, notarytool; first signed and notarized .dmg passes Gatekeeper
- [ ] **Phase 18: Auto-Update + Linux + Docs** - tauri-plugin-updater hook, Linux AppImage validation, libsecret documentation

---

## Phase Details

### Phase 13: Message Feed Foundation + Drain Mode
**Goal**: Users can drain messages from a queue and see them all in a scrollable, expandable list with full AMQP metadata and queue depth
**Depends on**: Phase 12
**Requirements**: CONS-01, CONS-02, CONS-03, CONS-04, CONS-08
**Success Criteria** (what must be TRUE):
  1. User can see routing key, exchange, content-type, and timestamp on each consumed message row in the list
  2. User can expand any message row to reveal the decoded protobuf payload and raw hex
  3. User can drain up to N messages from a queue in one shot and see all of them appear in the list
  4. User can see the current queue message count before clicking drain, and the count updates after draining
  5. The list displays newest messages at the top and older messages are dropped when the list reaches capacity
  6. User can select one or more candidate message types for decoding; the first type that decodes without error is used and shown on each row
**Plans**: 3 plans
Plans:
- [x] 13-01-PLAN.md — Rust drain_messages command + TypeScript IPC contract (DrainResult, DrainOutcome, FeedMessage types; drainMessages() IPC function)
- [x] 13-02-PLAN.md — Accordion install + ResponseHexSection props refactor (TS compilation bridge)
- [x] 13-03-PLAN.md — Store evolution + Drain UI + MessageFeedTab/Row + test migration
**UI hint**: yes

### Phase 14: Live Subscribe Mode
**Goal**: Users can start a persistent subscribe session that streams messages into the feed continuously until they stop it, with a visible status badge and automatic shutdown on profile change
**Depends on**: Phase 13
**Requirements**: CONS-05, CONS-06, CONS-07
**Success Criteria** (what must be TRUE):
  1. User can click Start and messages published to the selected queue arrive in the feed in real time without manual polling
  2. User can click Stop and the stream halts cleanly with no further messages arriving
  3. User can see a status badge showing Running, Stopping, Idle, or Error reflecting the current subscribe state
  4. When the user switches to a different connection profile, any running subscribe session stops automatically
**Plans**: 3 plans
Plans:
**Wave 1**
- [x] 14-01-PLAN.md — Rust backend: Cargo.toml changes + subscribe.rs (SubscribeState, start_subscribe, stop_subscribe) + lib.rs + mod.rs wiring
- [x] 14-02-PLAN.md — Frontend foundation: SubscribeStatus type + IPC wrappers + useResponseStore extensions + toggle-group.tsx

**Wave 2**
- [x] 14-03-PLAN.md — UI integration: SubscribePanel + MessageFeedTab mode toggle + ResponseQueuePicker mode prop
**UI hint**: yes

### Phase 15: Filter + Export
**Goal**: Users can narrow the message feed by routing key or content-type and export the current feed to a JSON file
**Depends on**: Phase 14
**Requirements**: FILT-01, FILT-02, XPRT-01
**Success Criteria** (what must be TRUE):
  1. User can type a routing key substring and the feed list narrows to only matching messages without clearing the underlying data
  2. User can select a content-type from a dropdown and the feed shows only messages with that content-type
  3. User can click Export and receive a JSON file containing all messages currently visible in the feed
**Plans**: 1 plan
Plans:
- [x] 15-01-PLAN.md — Tauri capability permissions + filter state/visibleMessages/export handler in MessageFeedTab + tests
**UI hint**: yes

### Phase 16: Pipeline Foundation
**Goal**: The GitHub Actions release pipeline has a correct structural foundation — valid action versions, Rust cache, matrix layout, and fixed Entitlements.plist — verified green via workflow_dispatch without requiring any Apple credentials
**Depends on**: Nothing (no signing credentials required)
**Requirements**: CICD-02, CICD-03, SIGN-03
**Success Criteria** (what must be TRUE):
  1. A `workflow_dispatch` dry-run completes green on all matrix jobs (macOS-latest and ubuntu-22.04) with no action-not-found or checkout failures
  2. Rust build cache is active — a second workflow_dispatch run completes in under 8 minutes on macOS (vs 15–20 min cold)
  3. `Entitlements.plist` contains `cs.allow-jit`, `cs.allow-unsigned-executable-memory`, and `cs.allow-dyld-environment-variables`; the old sandbox exception entitlement is absent
  4. App version reads 1.5.0 in `Cargo.toml` and `tauri.conf.json`
**Plans**: 2 plans
Plans:
**Wave 1**
- [x] 16-01-PLAN.md — Fix release.yml (runner + Rust cache + signing gate comment), replace Entitlements.plist, bump version to 1.5.0

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 16-02-PLAN.md — Trigger workflow_dispatch dry-runs and verify both matrix jobs green + cache hit

### Phase 17: macOS Signing + Notarization
**Goal**: A tagged release produces a signed, notarized Universal .dmg that passes Gatekeeper on a clean Mac without quarantine warning
**Depends on**: Phase 16; human one-time Apple Developer setup (register App ID `com.tap.app`, create Developer ID Application cert, export .p12, store 8 GitHub secrets: APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID, KEYCHAIN_PASSWORD, TAURI_SIGNING_PRIVATE_KEY, TAURI_SIGNING_PRIVATE_KEY_PASSWORD; note: APPLE_SIGNING_IDENTITY is auto-extracted by CI from the imported keychain certificate)
**Requirements**: CICD-01, SIGN-01, SIGN-02
**Success Criteria** (what must be TRUE):
  1. Pushing a `v1.5.0` tag triggers the pipeline and produces a draft GitHub Release containing a .dmg artifact
  2. `codesign -dv --verbose=4 Tap.dmg` (or the .app inside it) shows `Authority=Developer ID Application` and `Universal` in the architecture field (`lipo -info` confirms arm64 + x86_64)
  3. `spctl --assess --type execute -vvv Tap.app` returns `accepted source=Notarized Developer ID` on a clean Mac that has never seen this binary
  4. Opening the downloaded .dmg on a clean Mac shows no Gatekeeper quarantine warning and the app launches successfully
**Plans**: 2 plans
Plans:
**Wave 1**
- [ ] 17-01-PLAN.md — Wire 6 signing env vars onto tauri-action step, add if-guards on cert steps, add Gatekeeper spctl verification step, flip draft: true, restore cs.allow-unsigned-executable-memory in Entitlements.plist

**Wave 2** *(blocked on Wave 1 completion and human secret setup)*
- [ ] 17-02-PLAN.md — Human setup checklist (docs/release-setup.md, 8 secrets), tag-push trigger, clean-Mac Gatekeeper verification

### Phase 18: Auto-Update + Linux + Docs
**Goal**: Installed users receive an in-app update notification when a new version is tagged, Linux users can install and run the AppImage, and the libsecret prerequisite is documented
**Depends on**: Phase 17
**Requirements**: PKG-01, UPD-01, UPD-02, UPD-03, UPD-04, DOC-01
**Success Criteria** (what must be TRUE):
  1. The `latest.json` file is uploaded to GitHub Releases as part of the release pipeline and is accessible at `https://github.com/majesnix/proto-sender/releases/latest/download/latest.json`
  2. App shows a non-modal update notification on startup when a newer version tag exists on GitHub Releases (UPD-02 verified by tagging v1.5.1 with a higher version in `latest.json`)
  3. User clicks the update notification, the app downloads and installs the update, and offers to relaunch — after relaunch the version number reflects the new release
  4. The Linux AppImage built on ubuntu-22.04 launches and runs on both Ubuntu 22.04 and Ubuntu 24.04
  5. `docs/linux-keychain.md` exists and contains instructions for installing `libsecret-1-0` / `gnome-keyring` on Debian/Ubuntu and Fedora/RHEL
**Plans**: 4 plans
Plans:
**Wave 1** (parallel)
- [x] 18-01-PLAN.md — Rust/Tauri config: desktop-only Cargo deps, lib.rs plugin registration, tauri.conf.json createUpdaterArtifacts + plugins.updater placeholder, capabilities permissions
- [x] 18-02-PLAN.md — Frontend UpdateChecker component + tests (UPD-02/UPD-03), mounted in App.tsx
- [x] 18-03-PLAN.md — CI signing env vars on Linux job, delete Windows job, docs/linux-keychain.md

**Wave 2** *(blocked on Wave 1 completion)*
- [ ] 18-04-PLAN.md — Ed25519 keygen, real pubkey into tauri.conf.json, GitHub secrets checkpoint, pipeline verify + latest.json smoke test
**UI hint**: yes

---

## Progress Table

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Proto Parsing + Form | v1.0 | 6/6 | Complete | 2026-05-17 |
| 2. Connect + Publish | v1.0 | 6/6 | Complete | 2026-05-17 |
| 3. Full Feature Set | v1.0 | 4/4 | Complete | 2026-05-18 |
| 4. Response Queue Reader | v1.0 | 2/2 | Complete | 2026-05-18 |
| 5. Dark Mode | v1.1 | 3/3 | Complete | 2026-05-18 |
| 6. BytesField | v1.2 | 1/1 | Complete | 2026-05-19 |
| 7. MapField | v1.2 | 4/4 | Complete | 2026-05-19 |
| 8. JSON Override Toggle | v1.2 | 2/2 | Complete | 2026-05-19 |
| 9. Routing Key Autocomplete | v1.3 | 3/3 | Complete | 2026-05-19 |
| 10. Publisher Confirms Badge | v1.3 | 2/2 | Complete | 2026-05-19 |
| 11. Block Library — Store, Editor, Persistence | v1.3 | 3/3 | Complete | 2026-05-19 |
| 12. Block Library — Drag-and-Drop Layer | v1.3 | 3/3 | Complete | 2026-05-20 |
| 13. Message Feed Foundation + Drain Mode | v1.4 | 3/3 | Complete | 2026-05-20 |
| 14. Live Subscribe Mode | v1.4 | 3/3 | Complete | 2026-05-21 |
| 15. Filter + Export | v1.4 | 1/1 | Complete | 2026-05-21 |
| 16. Pipeline Foundation | v1.5 | 2/2 | Complete    | 2026-05-21 |
| 17. macOS Signing + Notarization | v1.5 | 0/2 | Planned    |  |
| 18. Auto-Update + Linux + Docs | v1.5 | 3/4 | In Progress|  |

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

**v1.1 — all 4 requirements delivered**

| Requirement | Phase | Status |
|-------------|-------|--------|
| DRK-01 | Phase 5 | ✅ Complete |
| DRK-02 | Phase 5 | ✅ Complete |
| DRK-03 | Phase 5 | ✅ Complete |
| DRK-04 | Phase 5 | ✅ Complete |

**v1.2 Form Improvements — all 15 requirements delivered**

| Requirement | Phase | Status |
|-------------|-------|--------|
| BFLD-01 | Phase 6 | ✅ Complete |
| BFLD-02 | Phase 6 | ✅ Complete |
| BFLD-03 | Phase 6 | ✅ Complete |
| BFLD-04 | Phase 6 | ✅ Complete |
| MFLD-01 | Phase 7 | ✅ Complete |
| MFLD-02 | Phase 7 | ✅ Complete |
| MFLD-03 | Phase 7 + quick-260519-q01 | ✅ Complete |
| MFLD-04 | Phase 7 | ✅ Complete |
| MFLD-05 | Phase 7 | ✅ Complete |
| JSON-01 | Phase 8 | ✅ Complete |
| JSON-02 | Phase 8 | ✅ Complete |
| JSON-03 | Phase 8 | ✅ Complete |
| JSON-04 | Phase 8 | ✅ Complete |
| JSON-05 | Phase 8 | ✅ Complete |
| JSON-06 | Phase 8 | ✅ Complete |

**v1.3 Publishing UX + Message Blocks — all 16 requirements delivered**

| Requirement | Phase | Status |
|-------------|-------|--------|
| PUBL-01 | Phase 9 | ✅ Complete |
| PUBL-02 | Phase 9 | ✅ Complete |
| PUBL-03 | Phase 9 | ✅ Complete |
| PUBL-04 | Phase 9 | ✅ Complete |
| PUBL-05 | Phase 10 | ✅ Complete |
| PUBL-06 | Phase 10 | ✅ Complete |
| PUBL-07 | Phase 10 | ✅ Complete |
| PUBL-08 | Phase 10 | ✅ Complete |
| BLK-01 | Phase 11 | ✅ Complete |
| BLK-02 | Phase 11 | ✅ Complete |
| BLK-03 | Phase 11 | ✅ Complete |
| BLK-04 | Phase 11 | ✅ Complete |
| BLK-05 | Phase 11 | ✅ Complete |
| BLK-06 | Phase 12 | ✅ Complete |
| BLK-07 | Phase 12 | ✅ Complete |
| BLK-08 | Phase 12 | ✅ Complete |

**v1.4 Response Stream — 11 requirements delivered**

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONS-01 | Phase 13 | ✅ Complete |
| CONS-02 | Phase 13 | ✅ Complete |
| CONS-03 | Phase 13 | ✅ Complete |
| CONS-04 | Phase 13 | ✅ Complete |
| CONS-08 | Phase 13 | ✅ Complete |
| CONS-05 | Phase 14 | ✅ Complete |
| CONS-06 | Phase 14 | ✅ Complete |
| CONS-07 | Phase 14 | ✅ Complete |
| FILT-01 | Phase 15 | ✅ Complete |
| FILT-02 | Phase 15 | ✅ Complete |
| XPRT-01 | Phase 15 | ✅ Complete |

**v1.5 Distribution — 0/11 requirements delivered**

| Requirement | Phase | Status |
|-------------|-------|--------|
| CICD-02 | Phase 16 | Pending |
| CICD-03 | Phase 16 | Pending |
| SIGN-03 | Phase 16 | Pending |
| CICD-01 | Phase 17 | Pending |
| SIGN-01 | Phase 17 | Pending |
| SIGN-02 | Phase 17 | Pending |
| PKG-01 | Phase 18 | Pending |
| UPD-01 | Phase 18 | Pending |
| UPD-02 | Phase 18 | Pending |
| UPD-03 | Phase 18 | Pending |
| UPD-04 | Phase 18 | Pending |
| DOC-01 | Phase 18 | Pending |

- Total v1.5: 12
- Mapped: 12
- Delivered: 0 (in progress)
