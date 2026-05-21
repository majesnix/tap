<!-- GSD:project-start source:PROJECT.md -->
## Project

**Tap**

A Tauri desktop application (Rust backend + React frontend) that lets developers load `.proto` files, generates a dynamic form from the schema, connects to RabbitMQ, and sends binary-encoded protobuf messages to a selected queue or exchange — without writing any code. Built as a team dev-tool: each developer installs it locally and uses their own saved connection profiles.

**Core Value:** Send a real protobuf message to RabbitMQ in under 30 seconds from a raw `.proto` file — no code, no curl, no manual encoding.

### Constraints

- **Tech stack**: Tauri 2.x + Rust backend + React frontend — chosen by user
- **Message format**: Binary protobuf wire format only in v1 (not JSON)
- **Proto parsing**: Runtime parsing of raw `.proto` files (not pre-compiled descriptors)
- **RabbitMQ**: Must support queues, exchanges + routing key, and virtual hosts
- **Distribution**: Should be cross-platform (macOS, Windows, Linux) since it's a team tool
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Rust Backend
#### Runtime Proto Parsing
- `Compiler::new(includes)` — accepts a slice of include paths for import resolution
- `include_imports(true)` — ensures imported `.proto` files appear in the output (needed for `prost-reflect` to resolve nested types)
- `open_file()` / `open_files()` — compile individual files or batches
- Returns a `prost_types::FileDescriptorSet` directly usable by `prost-reflect`
#### AMQP Client
#### RabbitMQ Queue/Exchange Discovery
#### Local Profile Storage
# Cargo.toml
#### Supporting Rust Crates
| Crate | Version | Purpose |
|-------|---------|---------|
| `tokio` | 1.x | Async runtime (Tauri embeds one; use `tauri::async_runtime::spawn` not `tokio::spawn` directly — see Tauri Integration section) |
| `serde` | 1.x | JSON serialization for IPC data transfer |
| `serde_json` | 1.x | JSON encode/decode for profile data and form schema |
| `thiserror` | 2.x | Ergonomic error types for Tauri commands |
| `tracing` | 0.1 | Structured logging in Rust backend |
### React Frontend
#### Dynamic Form Generation
#### UI Components
#### State Management
#### React Supporting Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| `@tauri-apps/api` | 2.x | Core Tauri IPC (`invoke`) |
| `@tauri-apps/plugin-store` | 2.x | Profile storage JS bindings |
| `@tauri-apps/plugin-dialog` | 2.x | Native file picker for `.proto` files |
| `@tauri-apps/plugin-fs` | 2.x | Read `.proto` file content and resolve sibling imports |
| `react-hook-form` | 7.x | Form state, dynamic fields, validation hooks |
| `@hookform/resolvers` | 3.x | Zod resolver adapter |
| `zod` | 3.x | Runtime validation schema for proto field types |
| `zustand` | 5.x | Lightweight global state |
| `tailwindcss` | 4.x | Utility CSS (required by shadcn/ui) |
### Tauri Integration
#### IPC Pattern
#[tauri::command]
#[tauri::command]
#[tauri::command]
#### CRITICAL: Use `tauri::async_runtime::spawn`, NOT `tokio::spawn`
#### File System Access (`.proto` files)
#### AMQP Connection Lifecycle
## Alternatives Considered
| Category | Recommended | Rejected | Reason Rejected |
|----------|-------------|----------|-----------------|
| Proto runtime parsing | `protox` 0.9.1 | `protobuf` crate (stepancheg) | `protobuf` crate's runtime reflection API is more complex and the crate is less actively maintained in 2025; `protox` + `prost-reflect` is the cleaner split |
| Proto runtime parsing | `protox` 0.9.1 | `prost-build` | Build-time only — requires `protoc` and runs at compile time, not usable for loading user files at runtime |
| Dynamic encoding | `prost-reflect` | `protobuf::reflect` (stepancheg crate) | Older API, more verbose, the `prost` ecosystem is the community default |
| AMQP client | `lapin` 4.x | `amqprs` | `amqprs` is faster in benchmarks but `lapin` has larger ecosystem, more tutorials, more community usage; throughput is irrelevant for a dev tool |
| Queue/exchange listing | `reqwest` + Management API | AMQP passive declare | AMQP 0-9-1 has no enumeration operation; passive declare only checks existence of a known name |
| Queue/exchange listing | `reqwest` directly | `rabbitmq-management-client` crate | Thin wrapper adds abstraction over a 2-endpoint use case; `reqwest` is simpler |
| Profile storage | `tauri-plugin-store` | `tauri-plugin-fs` + manual JSON | `tauri-plugin-store` handles atomic writes, app data directory resolution, and cross-platform paths; manual file I/O is unnecessary complexity |
| Form generation | Hand-rolled + `react-hook-form` | `@rjsf/core` | Proto `oneof` and `repeated` fields do not map cleanly to JSON Schema; RJSF fights against the proto type model |
| UI components | `shadcn/ui` | MUI / Ant Design | Bundle bloat; opinionated theming; `shadcn/ui` is zero-dependency (components are source-copied) |
| Global state | Zustand 5 | Redux / Jotai | Redux is over-engineered for this scope; Zustand has simpler ergonomics with same capability |
## Version Constraints
| Constraint | Detail |
|------------|--------|
| Rust minimum | 1.77.2+ (required by Tauri 2 plugin ecosystem) |
| `lapin` async runtime | Must use `tauri::async_runtime::spawn`, not bare `tokio::spawn` inside event listeners — causes panic in Tauri 2 on Windows |
| `prost-reflect` + `protox` | Both use `prost_types::FileDescriptorSet` as the handoff type; ensure `prost` versions match (both should pull `prost` 0.13.x) |
| `tauri-plugin-*` | All official Tauri plugins must be on the v2 branch; v1 plugins are incompatible with Tauri 2.x |
| Node / npm | Use Node 20 LTS; Tailwind 4.x requires Node 18+ |
| `reqwest` TLS | Add `features = ["json", "rustls-tls"]` to `reqwest` if targeting Linux musl or avoiding OpenSSL linking issues in cross-compilation |
| `shadcn/ui` | Requires Tailwind CSS 4.x and Radix UI; verify Vite config for Tauri is compatible with Tailwind 4 (uses CSS `@import` rather than `tailwind.config.js` in v4) |
| `#[tokio::main]` conflict | Do NOT add `#[tokio::main]` to the Tauri `main.rs` — Tauri manages the runtime; adding it creates a nested runtime conflict |
## Confidence Levels
| Area | Confidence | Reasoning |
|------|------------|-----------|
| `protox` for runtime proto parsing | HIGH | Docs.rs verified at 0.9.1; `Compiler` API confirmed with include paths and `file_descriptor_set()` output; direct integration with `prost-reflect` via `DescriptorPool` confirmed |
| `prost-reflect` dynamic encoding | HIGH | Docs.rs confirmed at 0.16.3; `DynamicMessage`, `DescriptorPool`, `MessageDescriptor` APIs confirmed; oneof and repeated field support is documented |
| `lapin` AMQP client | HIGH | Confirmed active at 4.7.4 (released May 2025); `basic_publish`, `exchange_declare`, `queue_declare` APIs verified via Context7; is the de facto standard |
| Management API for queue listing | HIGH | AMQP 0-9-1 protocol limitation is unambiguous; confirmed by RabbitMQ official docs and multiple sources; Management Plugin is enabled by default on all standard installs |
| `tauri-plugin-store` profiles | HIGH | Official Tauri plugin, v2 confirmed, setup docs verified via v2.tauri.app |
| `tauri::async_runtime::spawn` requirement | HIGH | Confirmed via Tauri GitHub issue #10289 — `tokio::spawn` in event listeners panics on Windows in Tauri 2 |
| `react-hook-form` + `useFieldArray` | HIGH | Version 7.66.0 confirmed; `useFieldArray` for repeated fields, nested objects, and validation are documented and verified |
| shadcn/ui for dev tool UI | MEDIUM | Strong community consensus; version compatibility with Tailwind 4 requires verification during project setup (Tailwind 4 changed config format) |
| Hand-rolled form renderer vs RJSF | MEDIUM | Reasoned recommendation based on proto type system vs JSON Schema mismatch; no head-to-head benchmark available, but the architectural argument is sound |
| `reqwest` 0.12 for Management API | HIGH | Standard HTTP client; no compatibility concerns with the Management API |
## Sources
- protox Compiler API: https://docs.rs/protox/latest/protox/struct.Compiler.html
- prost-reflect DynamicMessage: https://docs.rs/prost-reflect/latest/prost_reflect/
- lapin crate (amqp-rs): https://crates.io/crates/lapin
- RabbitMQ AMQP 0-9-1 model (no queue enumeration): https://www.rabbitmq.com/tutorials/amqp-concepts
- tauri-plugin-store setup: https://v2.tauri.app/plugin/store/
- Tauri 2 IPC commands: https://v2.tauri.app/develop/calling-rust/
- Tauri 2 async_runtime spawn: https://docs.rs/tauri/latest/tauri/async_runtime/index.html
- Tauri 2 tokio::spawn panic issue: https://github.com/tauri-apps/tauri/issues/10289
- react-hook-form useFieldArray: https://react-hook-form.com/ (Context7 verified v7.66.0)
- rabbitmq-management-client crate: https://github.com/stefandanaita/rabbitmq-management-client
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
