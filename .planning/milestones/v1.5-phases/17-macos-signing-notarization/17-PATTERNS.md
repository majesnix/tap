# Phase 17: macOS Signing + Notarization — Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 3 (2 modified, 1 verified no-change)
**Analogs found:** 2 / 2 (self-analog — each file's current state is the closest analog)

---

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `.github/workflows/release.yml` | ci-workflow | event-driven | Itself (current `build-macos` job) | self — current state |
| `src-tauri/Entitlements.plist` | config | declarative | Itself (current 2-key plist) | self — additive change |
| `src-tauri/tauri.conf.json` | config | declarative | — | **No change required** (verified) |

---

## Pattern Assignments

### `.github/workflows/release.yml` (ci-workflow, event-driven)

**Analog:** Itself — current `build-macos` job, lines 10–79.

This is a modification-only file. Three distinct patterns must be applied.

---

#### Pattern 1: tauri-action step — current state (lines 66–71)

This is what exists today. The step is missing all 6 signing/notarization env vars:

```yaml
- name: Build Tauri app (universal macOS)
  uses: tauri-apps/tauri-action@v0.6.2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  with:
    args: --target universal-apple-darwin
```

**Change:** Replace the `env:` block with the full 7-var block. Source: `RESEARCH.md → "tauri-action Step Wiring Pattern"`:

```yaml
- name: Build Tauri app (universal macOS)
  uses: tauri-apps/tauri-action@v0.6.2
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
    APPLE_SIGNING_IDENTITY: ${{ env.CERT_ID }}
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
  with:
    args: --target universal-apple-darwin
```

---

#### Pattern 2: `if:` guard — in-repo precedent (line 169)

Existing use of a conditional guard in the same file:

```yaml
if: startsWith(github.ref, 'refs/tags/')
```

**Change:** Apply `if: github.event_name == 'push'` to these two steps that currently lack it:
- "Import Apple Developer Certificate" (line 41)
- "Verify Certificate" (line 55)

Both steps use the same env-block style as line 42–45. The guard must appear as a step-level `if:` key immediately after `- name:`:

```yaml
- name: Import Apple Developer Certificate
  if: github.event_name == 'push'
  env:
    APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
    ...
```

```yaml
- name: Verify Certificate
  if: github.event_name == 'push'
  run: |
    ...
```

---

#### Pattern 3: Gatekeeper verification step — new step after tauri-action

No existing analog in this file. Source pattern: `RESEARCH.md → "Gatekeeper Verification Step Pattern"`.

Insert after the tauri-action step, before the upload-artifact step (after line 71, before line 73 placeholder comment):

```yaml
- name: Verify Gatekeeper (notarization check)
  if: github.event_name == 'push'
  run: |
    DMG=$(find src-tauri/target/universal-apple-darwin/release/bundle/dmg -name "*.dmg" | head -1)
    echo "Verifying: $DMG"
    spctl --assess --type open --context context:primary-signature --verbose "$DMG"
```

---

#### Pattern 4: `draft:` flag in create-release step (line 185)

Current state:

```yaml
draft: false
```

**Change:** Flip to `draft: true`. Source: `RESEARCH.md → "create-release Draft Flag"`. No structural change — single value replacement.

---

### `src-tauri/Entitlements.plist` (config, declarative)

**Analog:** Itself — current 2-key state, lines 1–10.

Current state:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.app-sandbox</key>
  <false/>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
</dict>
</plist>
```

**Change:** Add one key/value pair inside `<dict>`, after `cs.allow-jit`. Copy the existing entry style (2-space indent, `<key>` followed by `<true/>`):

```xml
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
```

Result is a 3-key plist. Source: `RESEARCH.md → "Entitlements Configuration (Corrected)"`.

**Rationale:** WR-03 removed this entry. Without it, the notarized app crashes at launch when WKWebView initializes the JS JIT engine. `cs.allow-dyld-environment-variables` (also removed by WR-03) is genuinely optional and stays out.

---

### `src-tauri/tauri.conf.json` — No Change Required

Current state (lines 34–36) already contains:

```json
"macOS": {
  "entitlements": "Entitlements.plist"
}
```

The `bundle.macOS.entitlements` pointer is correct. No modification needed. The phase prompt noted this as "may need bundle.macOS section" — it already has one.

---

## Shared Patterns

### `if: github.event_name == 'push'` guard

**Apply to:** All signing-related steps in `build-macos` job:
- "Import Apple Developer Certificate"
- "Verify Certificate"
- "Verify Gatekeeper (notarization check)" (new step)

**Rationale:** `workflow_dispatch` runs without secrets pre-filled will fail at the cert import step (empty `$APPLE_CERTIFICATE`). The guard restricts signing steps to tag push events only.

**In-repo precedent:** `if: startsWith(github.ref, 'refs/tags/')` at line 169 of `release.yml` shows the established pattern for conditional job/step execution.

---

## No Analog Found

| File | Reason |
|------|--------|
| None | All files use self-analog (modification of existing files) or are explicitly excluded |

---

## Metadata

**Analog search scope:** `.github/workflows/`, `src-tauri/`
**Files scanned:** 4 (release.yml, Entitlements.plist, tauri.conf.json, 17-RESEARCH.md)
**Pattern extraction date:** 2026-05-22
