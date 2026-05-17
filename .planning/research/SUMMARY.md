# Research Summary: Proto Sender

**Synthesized:** 2026-05-17
**Confidence:** HIGH overall — all critical picks verified against primary sources (docs.rs, official Tauri docs, RabbitMQ docs)

---

## Recommended Stack

### Rust Backend

| Crate | Version | Rationale |
|-------|---------|-----------|
| `protox` | 0.9.1 | Pure-Rust `.proto` compiler — no `protoc` binary needed; bundles all well-known types automatically; outputs `FileDescriptorSet` consumed by `prost-reflect` |
| `prost-reflect` | 0.16.3 | Runtime reflection over the `FileDescriptorSet`; `DynamicMessage` encodes form values to wire bytes without compile-time codegen |
| `lapin` | 4.7.x | De facto standard Rust AMQP 0-9-1 client; actively maintained (4.7.4 released May 2025) |
| `reqwest` | 0.12.x | RabbitMQ Management HTTP API only — AMQP protocol has no list operation |
| `tauri-plugin-store` | 2.x | Persistent named connection profile storage; atomic writes |
| `keyring` | 3.x | OS keychain for passwords — never stored in the JSON profile file |
| `tauri-plugin-sql` (SQLite) | 2.x | Message history storage; queryable and paginated |
| `tokio::sync::Mutex` | — | Required for AppState holding AMQP connections across `.await` points |

### React Frontend

| Library | Version | Rationale |
|---------|---------|-----------|
| `react-hook-form` | 7.x | `useFieldArray` for repeated fields; avoids re-render per keystroke |
| `zod` | 3.x | Proto type constraint validation (int32 range, enum membership) |
| `shadcn/ui` | latest | Source-copied components; Radix UI accessibility; dark-mode ready |
| `zustand` | 5.x | Lightweight global state for active profile, connection status, schema tree |
| `@tanstack/react-query` | 5.x | Async state for history + queue/exchange lists |
| `tailwindcss` | 4.x | Required by shadcn/ui; uses CSS `@import` not `tailwind.config.js` |

**Do NOT use:** `prost-build` (build-time only), `@rjsf/core` (JSON Schema mismatches proto types), bare `tokio::spawn` in Tauri event handlers.

---

## Table Stakes Features

Must be present at v1 or users will not adopt the tool:

- Named connection profiles (host, port, vhost, user, password, management port)
- Runtime `.proto` file loading with user-configurable include paths
- Type-aware form editor: scalars, nested messages, repeated fields, enum dropdown, oneof radio, bytes (base64)
- Live queue + exchange list from Management API with manual text fallback
- Direct-to-queue publish and exchange + routing key publish
- Binary protobuf wire encoding via `DynamicMessage.encode()`
- AMQP message properties (content-type, delivery-mode, TTL)
- Send status feedback (confirmed / error)
- Message history log with re-send

**Differentiators worth v1 effort:** oneof as radio group with conditional visibility, pre-populated zero-value defaults, AMQP property panel (collapsed by default), connection test on profile save.

---

## Architecture at a Glance

```
React Frontend
  ProtoFormEngine          — renders SchemaNode JSON into form; collects field values
  ConnectionProfileManager — profile CRUD UI; never handles credentials directly
  MessageHistoryView       — display, filter, replay; SQLite-backed

       ↕ Tauri IPC (JSON commands + push events)

Rust Backend
  ProtoEngine    — protox parse → prost-reflect descriptor → SchemaNode JSON; DynamicMessage encode
  AmqpBroker     — lapin Connection per profile in AppState; Management API via reqwest
  ProfileStore   — tauri-plugin-store (metadata) + keyring (passwords)
  HistoryStore   — tauri-plugin-sql SQLite; stores values_json + payload_hex per send
```

**IPC Rule:** If it needs filesystem access, binary encoding, AMQP, or credential storage — it is a Rust command. The frontend sends/receives structured JSON only.

### Build Order (dependency-driven)

1. ProtoEngine standalone Rust binary — highest-risk unknown; validate before touching Tauri
2. Tauri shell + ProtoEngine IPC commands — scaffold; configure `fs:scope` and entitlements
3. ProtoFormEngine — React renderer from `SchemaNode`; all field types; no broker needed
4. AmqpBroker: connect + publish — lapin; publisher confirms; events to frontend
5. ProfileStore — `plugin-store` metadata + `keyring` passwords
6. Queue/Exchange listing — reqwest to Management API; manual text fallback
7. HistoryStore + replay — SQLite init + migrations; paginated list

---

## Critical Pitfalls

1. **Wrong proto crate — `prost` alone cannot do runtime reflection.** Use `protox` + `prost-reflect`. If you have compile-time typed structs instead of a queryable descriptor pool, this is a full rewrite.

2. **Import resolution requires user-declared include paths — design it first.** Hardcoding the file's directory as the only search root breaks any proto that imports from a sibling directory. Design the include-path list UI before building the form renderer.

3. **Recursive message types will crash the form renderer.** Track rendered type names in a stack; collapse on cycles; cap render depth at 5.

4. **`oneof` form state vs wire semantics.** Setting one branch must clear all others — the proto spec is explicit. Render as radio group; only the selected branch is visible and passed to the encoder.

5. **Management API unavailability is not an edge case.** Many real deployments have the Management Plugin disabled. Build the manual text fallback first, not last.

6. **Tauri 2 capabilities model silently blocks commands.** Every `#[command]` must appear in `src-tauri/capabilities/`. Missing entry returns `null` with no error. Add each command to the capability file immediately after defining it.

7. **`std::sync::Mutex` across async AMQP calls deadlocks.** Use `tokio::sync::Mutex` for all state accessed in async Tauri commands.

---

## Key Decisions Required

| Decision | Recommendation |
|----------|----------------|
| Proto include paths UX | Explicit include-path list in file picker — auto-detect from file location is unreliable |
| `oneof` form pattern | Radio group — collapse inactive branches; preserve draft state in React only |
| `bytes` field input | Base64 input (proto JSON mapping standard) with "UTF-8 text" helper |
| AMQP connection recovery | Explicit reconnect button — lapin auto-recover is experimental, does not restore channels |
| WellKnownTypes rendering | Purpose-built controls (datetime picker for `Timestamp`) — raw seconds/nanos fields confuse users |
| Code signing strategy | Set up in Phase 1 CI — macOS notarization + Windows SmartScreen block distribution if left late |

---

## Research Confidence

| Area | Confidence |
|------|------------|
| Proto parsing stack (`protox` + `prost-reflect`) | HIGH |
| AMQP client (`lapin`) | HIGH |
| Queue listing (Management HTTP API) | HIGH |
| Tauri 2 IPC, AppState, capabilities model | HIGH |
| Profile storage (plugin-store + keyring) | HIGH |
| React form stack (react-hook-form + zod) | HIGH |
| shadcn/ui + Tailwind 4 compatibility | MEDIUM — verify at setup |
| Linux keychain (libsecret) | MEDIUM — must be in install notes |
| macOS arbitrary file read entitlements | MEDIUM — needs testing |

**Remaining unknowns to validate during build:** protox parse performance on large import chains, prost-reflect `map<K, V>` API surface, shadcn/ui + Tailwind 4 Vite config for Tauri.
