<p align="center">
  <img src="public/tap-icon.svg" width="96" height="96" alt="Tap icon" />
</p>

# Tap

**Send a real protobuf message to RabbitMQ in under 30 seconds — no code, no curl, no manual encoding.**

Tap is a desktop dev tool for teams that use RabbitMQ and Protocol Buffers. Load a `.proto` file, fill in the generated form, pick a queue or exchange, and send binary-encoded protobuf messages instantly.

---

## What it does

- **Runtime `.proto` parsing** — drop any `.proto` file in, no pre-compilation needed
- **Dynamic form generation** — fields, nested messages, `oneof`, `repeated`, enums — all rendered automatically
- **RabbitMQ integration** — connect to queues and exchanges with routing keys and virtual hosts
- **Binary protobuf encoding** — sends real wire-format messages, not JSON approximations
- **Connection profiles** — save and switch between environments (local, staging, prod) without re-entering credentials
- **Queue & exchange discovery** — browses available queues/exchanges via the RabbitMQ Management API

---

## Built for

Teams that ship protobuf-based services and want a fast, code-free way to craft and send test messages without writing throwaway scripts.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri 2.x |
| Frontend | React 19 + TypeScript |
| UI components | shadcn/ui + Tailwind CSS 4 |
| Form engine | react-hook-form + Zod |
| State | Zustand 5 |
| Proto parsing | protox + prost-reflect (Rust) |
| AMQP client | lapin 4 (Rust) |
| Queue discovery | RabbitMQ Management HTTP API (reqwest) |
| Profile storage | tauri-plugin-store |

---

## Development setup

**Prerequisites:** Node 20 LTS, pnpm, Rust stable (1.77.2+)

```bash
pnpm install
pnpm dev:app      # tauri dev with src-tauri/tauri.dev.conf.json
```

`pnpm dev:app` runs the app under the identifier `com.tap.dev` with its own data directory
and keychain namespace, so a development build never reads or overwrites the installed Tap's
profiles, history and drafts. Plain `pnpm tauri dev` shares the installed app's data.

**Run tests:**

```bash
pnpm test                                   # frontend (vitest)
cargo test --manifest-path src-tauri/Cargo.toml   # Rust unit + integration
```

The Rust suite includes broker-backed integration tests. They **skip automatically**
when no RabbitMQ broker is reachable, so the command above stays green without Docker.
To run them, start the local broker first and require them explicitly:

```bash
docker compose up -d rabbitmq
TAP_INTEGRATION=1 cargo test --manifest-path src-tauri/Cargo.toml
```

`TAP_INTEGRATION=1` makes a missing broker fail loudly instead of skipping (this is how
CI runs them). Coverage is enforced in CI at ≥80% region coverage via `cargo llvm-cov`:

```bash
cargo install cargo-llvm-cov
TAP_INTEGRATION=1 cargo llvm-cov --manifest-path src-tauri/Cargo.toml \
  --ignore-filename-regex '(lib\.rs|main\.rs|test_support\.rs)$'
```

**Build a release bundle:**

```bash
pnpm tauri build
```

Updater artifacts (which need `TAURI_SIGNING_PRIVATE_KEY`) are only produced by the release
workflow, so a local build needs no signing key. A debug bundle without the DMG step:

```bash
pnpm tauri build --debug --bundles app
```

---

## Install on Arch Linux

Tap ships a native Arch package (`.pkg.tar.zst`) with every tagged release, alongside the macOS `.dmg` and Linux `.AppImage`/`.deb` artifacts.

**From a tagged release (recommended):**

```bash
curl -LO https://github.com/majesnix/tap/releases/latest/download/tap-1.8.3-1-x86_64.pkg.tar.zst
sudo pacman -U tap-1.8.3-1-x86_64.pkg.tar.zst
```

**From source (in-repo `makepkg`):**

```bash
git clone https://github.com/majesnix/tap.git
cd tap/packaging/arch
makepkg -si
```

See [`packaging/arch/README.md`](packaging/arch/README.md) for details on the PKGBUILD and runtime dependencies.

---

## Workbench layout

Tap is one window, laid out the same way in both views:

- **Header** — the view switch (Compose / Plans), the connection pill (click it for the
  connection sheet), the blocks and shortcuts buttons and the theme toggle.
- **Files sidebar** (left) — open `.proto` files with their include paths, the message list of
  the active file, recent files, and the footer with the version and the trash icon.
- **Request card** (centre, Compose) — the destination strip (queue or exchange + routing key),
  the AMQP properties summary, the generated form (or its JSON view), the hex strip showing the
  encoded wire bytes, and Send.
- **Activity panel** (right) — one timeline of everything sent and received, newest first, with
  each reply grouped under the request it answers. Rows expand to the decoded tree, the hex dump
  and the replay/resend actions; the read-mode button reads a queue into the same timeline.
- **Plans view** — the plans sidebar, step cards with the run bar, and the reply panel for the
  selected step.
- **Blocks drawer** — saved JSON snippets, dragged onto the form to fill fields.
- **Connection sheet** — profiles, credentials and the connection test, opened from the pill.

Shortcuts (`⌘` on macOS, `Ctrl` elsewhere): `⌘O` open `.proto`, `⌘R` reload schema, `⌘↵` send,
`⌘⇧R` clear form, `⌘1` focus the activity filter, `⌘2` toggle hex, `⌘3` read a queue. The same
list lives behind the keyboard button in the header.

The design reference for this layout is
[`docs/design/workbench-handoff/README.md`](docs/design/workbench-handoff/README.md).

---

## Connecting over TLS

Profiles have two transport switches and an optional CA bundle:

| Setting | What it does | Default |
|---------|--------------|---------|
| AMQP over TLS | Connects with `amqps://` instead of `amqp://` | Off; switches on when the AMQP port is set to 5671 |
| Management API SSL | Uses `https://` for queue and exchange discovery | Off; switches on when the management port is set to 15671 |
| CA certificate | PEM bundle the broker certificate must chain to, for internal PKIs the OS trust store does not know | None |

Without TLS the AMQP password travels in cleartext, so the profile dialog warns when a
remote host is configured with either switch off. Certificates issued by a CA in the OS
trust store are accepted without a CA bundle.

## Broker user for Tap

Tap needs one RabbitMQ user for both AMQP and the Management API. On a shared broker, give it
the least it needs instead of the `administrator` tag used by the local Docker setup:

```bash
rabbitmqctl add_user tap 'choose-a-password'
rabbitmqctl set_user_tags tap monitoring          # read-only Management API: queues, exchanges, bindings, depth
rabbitmqctl set_permissions -p / tap \
  '^amq\.gen-.*$' \
  '^(orders|events\..*)$' \
  '^(orders|orders\.reply|amq\.gen-.*)$'
```

The three permission patterns are *configure*, *write* and *read*:

- **configure** `^amq\.gen-.*$` lets Tap declare its own private reply and tap queues and nothing else.
- **write** lists the exchanges (or queues, through the default exchange) developers may publish to.
- **read** lists the queues they may consume or tap, plus the private `amq.gen-*` queues.

When listing is denied, Tap switches its pickers to manual entry; when a publish or consume is
denied, the broker error is shown as-is.

## Reading queues safely

The read-mode button in the Activity panel offers four ways to read a queue:

| Mode | What happens on the broker | Effect on other consumers |
|------|----------------------------|---------------------------|
| **Tap** (default) | Declares a private, auto-delete queue bound to the same exchanges and routing keys as the target, and streams that copy | None. Needs the Management API to discover bindings; queues fed only through the default exchange cannot be tapped |
| **Peek** | Reads a batch with `basic.get` and hands it back with one requeue | None, apart from the `redelivered` flag on those messages |
| **Subscribe** | Joins the queue's consumer pool and acknowledges every delivery it receives | Removes roughly every other message from the real service |
| **Consume** | Reads a batch and acknowledges it | Removes those messages |

Subscribe and Consume ask for confirmation on profiles tagged Shared or Production (and on
any remote host), and are disabled on read-only profiles. Tap and Peek always stay available.

## Local data

History (sent payloads, capped at 64 KB each and 30 days), drafts, plans and blocks live in the
app data directory in cleartext. Profiles can switch off history recording, which is the right
setting for anything pointed at production, and the trash icon in the sidebar footer clears all
local data except connection profiles.

## RabbitMQ quick-start (Docker)

```bash
docker compose up -d
```

Management UI → [http://localhost:15672](http://localhost:15672) (guest / guest)

---

## Project structure

```
src/              React frontend (form renderer, connection UI, state)
src-tauri/        Rust backend (proto parsing, AMQP client, IPC commands)
examples/         Sample .proto files to try with the app
docs/             Additional documentation
```

---

## Version

v1.9.0
