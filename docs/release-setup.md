# macOS Signing + Notarization Setup

One-time setup required before pushing a signed release tag.

## Prerequisites

- Apple Developer Program membership (paid, $99/year)
- macOS machine with Xcode installed for certificate export

---

## Step 1: Register App ID

1. Go to [developer.apple.com → Certificates, Identifiers & Profiles → Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Click **+** and choose **App IDs**
3. Select **App** type
4. Set Bundle ID (Explicit): `com.tap.app`
5. No capabilities needed — click **Continue** then **Register**

---

## Step 2: Create Developer ID Application Certificate

1. Go to [Certificates, Identifiers & Profiles → Certificates → +](https://developer.apple.com/account/resources/certificates/add)
2. Choose **Developer ID Application**
3. Follow the prompts to generate a Certificate Signing Request (CSR) via Keychain Access
4. Download the resulting `.cer` file
5. Double-click the `.cer` to install it in Keychain Access
6. In Keychain Access, under **My Certificates**, find **Developer ID Application: Your Name (TEAMID)**
7. Right-click → **Export** → save as `certificate.p12` with a strong password (save this password — it becomes `APPLE_CERTIFICATE_PASSWORD`)

---

## Step 3: Generate App-Specific Password

1. Go to [appleid.apple.com → Sign-In and Security → App-Specific Passwords](https://appleid.apple.com/account/manage)
2. Click **+** and name it `tap-notarize`
3. Copy the generated password (it will not be shown again) — this becomes `APPLE_PASSWORD`

**Important:** `APPLE_PASSWORD` is the app-specific password, NOT your Apple ID account password. notarytool rejects Apple ID passwords.

---

## Step 4: Find Your Team ID

1. Go to [developer.apple.com → Account → Membership](https://developer.apple.com/account/#/membership)
2. Copy the **Team ID** (10-character alphanumeric string) — this becomes `APPLE_TEAM_ID`

---

## Step 5: Generate KEYCHAIN_PASSWORD

The release pipeline creates a temporary CI keychain to hold the certificate during each build run. Generate a random password for it:

```bash
openssl rand -base64 32
```

Copy the output — this becomes `KEYCHAIN_PASSWORD`. It has no external dependency; it only secures the ephemeral CI keychain on the runner.

---

## Step 6: Add All 8 Secrets to GitHub

Go to [github.com/majesnix/proto-sender/settings/secrets/actions](https://github.com/majesnix/proto-sender/settings/secrets/actions) and add each secret:

| Secret Name | Value |
|-------------|-------|
| `APPLE_CERTIFICATE` | Base64-encoded .p12: `base64 -i certificate.p12 \| pbcopy` (paste the result) |
| `APPLE_CERTIFICATE_PASSWORD` | Password used when exporting the .p12 in Step 2 |
| `APPLE_ID` | Your Apple ID email address |
| `APPLE_PASSWORD` | App-specific password from Step 3 |
| `APPLE_TEAM_ID` | 10-character Team ID from Step 4 |
| `KEYCHAIN_PASSWORD` | Random string from Step 5 |
| `TAURI_SIGNING_PRIVATE_KEY` | Required for Phase 18 auto-update. Generate: `tauri signer generate -w ~/.tauri/tap.key` — paste the private key file content |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password chosen when generating the signer key above |

**Note:** `APPLE_SIGNING_IDENTITY` is NOT added here. The CI pipeline extracts it automatically from the imported keychain certificate via `security find-identity` during the "Verify Certificate" step.

---

## Step 7: Push a Signed Tag

After all 8 secrets are in place:

```bash
git tag v1.5.0
git push origin v1.5.0
```

The GitHub Actions release pipeline will:
1. Build the app for universal macOS (arm64 + x86_64)
2. Import your certificate into the CI keychain
3. Sign the `.app` bundle with your Developer ID
4. Submit to Apple's notary service and wait for approval
5. Staple the notarization ticket to the `.dmg`
6. Run `spctl --assess` to verify Gatekeeper approval
7. Upload the `.dmg` as a draft GitHub Release

---

## Verification

After the pipeline completes (typically 15–25 minutes):

1. Open [github.com/majesnix/proto-sender/releases](https://github.com/majesnix/proto-sender/releases) — a draft release should appear
2. Download the `.dmg` to a clean Mac (one that has never seen this binary)
3. Mount the `.dmg` and attempt to open `Tap.app` — no Gatekeeper warning should appear
4. To verify programmatically:

```bash
# Check code signature
codesign -dv --verbose=4 /Volumes/Tap/Tap.app 2>&1 | grep -E "Authority|Identifier|Architecture"

# Check notarization (Gatekeeper)
spctl --assess --type open --context context:primary-signature --verbose /Volumes/Tap/Tap.app

# Check Universal binary
lipo -info /Volumes/Tap/Tap.app/Contents/MacOS/tap
```

Expected outputs:
- `codesign`: `Authority=Developer ID Application: ...`
- `spctl`: `accepted source=Notarized Developer ID`
- `lipo`: `Architectures in the fat file: ... are: x86_64 arm64`
