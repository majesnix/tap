# Linux Keychain Setup

Tap stores RabbitMQ connection credentials (AMQP URIs including passwords) in the OS
keychain using the D-Bus Secret Service API. On Linux this requires a running Secret
Service daemon such as GNOME Keyring or KWallet.

---

## What Tap stores in the keychain

Tap stores AMQP connection URIs containing passwords. It uses the
`dbus-secret-service-keyring-store` crate with the `crypto-rust` feature, which
communicates with the Secret Service protocol over D-Bus directly. It does **not** use the
`libsecret` C API or require `libsecret-1-dev` at runtime.

---

## Runtime dependencies

You need one of:

- **`gnome-keyring`** — GNOME/GTK environments (most Ubuntu and Fedora desktops)
- **`kwallet`** — KDE Plasma environments
- Any other D-Bus Secret Service-compatible daemon (e.g., `secret-service` from the
  Secret Service specification)

The underlying D-Bus client library (`libdbus-1-3`) is typically pre-installed on all
major Linux desktop distributions.

---

## Note on libsecret-1-0

`libsecret-1-0` is NOT required for this application. The app uses D-Bus directly for
keychain access via the `dbus-secret-service-keyring-store` crate with the `crypto-rust`
feature. This crate communicates with the Secret Service protocol over D-Bus without going
through the `libsecret` C library. You do NOT need to install `libsecret-1-0` or
`libsecret-1-dev` for Tap to access the keychain.

---

## Step 1: Install GNOME Keyring

**Ubuntu / Debian:**
```bash
sudo apt-get install gnome-keyring
```

**Fedora / RHEL:**
```bash
sudo dnf install gnome-keyring
```

**Arch Linux:**
```bash
sudo pacman -S gnome-keyring
```

---

## Step 2: Ensure the daemon is running

On a standard desktop session, GNOME Keyring starts automatically at login. If it is not
running (e.g., after first install or in a minimal session), start it manually:

```bash
gnome-keyring-daemon --start --components=secrets
```

---

## Headless / server environments

If no Secret Service daemon is available, Tap will fail to save or load connection
profiles with a keychain error at startup. On headless systems you must either:

1. Run `gnome-keyring-daemon --start --components=secrets` before launching Tap, or
2. Use a virtual display and session manager that starts a keyring daemon automatically.

Tap is a desktop dev tool and is not designed for headless server use.

---

## Verification

Check that a Secret Service daemon is accessible via D-Bus:

```bash
# Should print the Secret Service introspection XML (no error = daemon is running)
gdbus introspect --session --dest org.freedesktop.secrets \
  --object-path /org/freedesktop/secrets
```

Alternatively:
```bash
# List secrets (requires gnome-keyring running; output may be empty on a fresh install)
secret-tool search --all application tap 2>/dev/null || echo "secret-tool not found — install libsecret-tools"
```
