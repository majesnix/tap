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
pnpm tauri dev
```

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

---

## Install on Arch Linux

Tap ships a native Arch package (`.pkg.tar.zst`) with every tagged release, alongside the macOS `.dmg` and Linux `.AppImage`/`.deb` artifacts.

**From a tagged release (recommended):**

```bash
curl -LO https://github.com/majesnix/tap/releases/latest/download/tap-1.8.2-1-x86_64.pkg.tar.zst
sudo pacman -U tap-1.8.2-1-x86_64.pkg.tar.zst
```

**From source (in-repo `makepkg`):**

```bash
git clone https://github.com/majesnix/tap.git
cd tap/packaging/arch
makepkg -si
```

See [`packaging/arch/README.md`](packaging/arch/README.md) for details on the PKGBUILD and runtime dependencies.

---

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

v1.8.2
