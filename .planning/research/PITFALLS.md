# Pitfalls Research: Proto Sender

**Domain:** Tauri 2.x desktop app — runtime proto parsing, dynamic forms, AMQP publishing
**Researched:** 2026-05-17
**Overall confidence:** HIGH (all critical pitfalls have primary-source evidence)

---

## Critical Pitfalls (will block the project)

### 1. Using prost for runtime proto parsing

**What goes wrong:**
The default Rust protobuf workflow uses `prost` + `build.rs` codegen — types are generated at compile time. The official prost README explicitly states: _"Prost does not include support for runtime reflection or message descriptors."_ Building a dynamic form renderer on top of prost codegen is architecturally impossible without a separate reflection layer.

**Why it happens:**
`prost` is the most prominent Rust protobuf crate in documentation and tutorials. Developers reach for it first without checking whether it supports the runtime-dynamic mode this project requires.

**Consequences:**
Complete rewrite of the proto layer if you start with `prost` alone. Every form field renderer and encoder has to be rebuilt around a different type model.

**Prevention:**
Use `protox` (pure-Rust compiler, replaces the `protoc` binary) combined with `prost-reflect` (reflection + `DynamicMessage`). `prost-reflect` extends prost with a `DescriptorPool` API for runtime type introspection and a `DynamicMessage` type for encoding/decoding without compile-time type definitions.

**Detection:**
If your proto parsing code returns strongly-typed Rust structs rather than a descriptor pool you can query at runtime, you are on the wrong path.

**Sources:** prost README ("Prost does not include support for runtime reflection or message descriptors"); prost-reflect docs.rs; protox GitHub.

---

### 2. Import resolution: proto files that import other proto files

**What goes wrong:**
The proto compiler resolves imports relative to a configured set of root paths (equivalent to protoc's `-I` / `--proto_path` flags). When the user loads `order.proto` which imports `common/types.proto`, the compiler needs to know the root directory to search from. If your import resolver uses the directory of the loaded file rather than a user-configured include path, imports that cross directories silently fail or produce confusing "file not found" errors.

A secondary issue documented in prost-reflect's changelog (v0.12.0): the library now validates that all referenced types are in the declared dependency files. Files using `import public` that were silently passing before will be rejected — a breaking behaviour change that surfaced as seemingly valid files being rejected.

**Why it happens:**
Developers hardcode the directory of the dropped proto file as the only search root, not anticipating that real projects have a directory hierarchy with a single root.

**Consequences:**
Users cannot load any proto file that imports another proto file (which is almost all production protos). The feature becomes unusable for real codebases.

**Prevention:**
Present the user with a separate "include paths" configuration UI (analogous to protoc's `-I` flag). Allow adding multiple include directories. Resolve imports by searching these directories in order. Well-known types (`google/protobuf/*.proto`) must be bundled with the app and always available on the include path — `protox` bundles these automatically.

**Detection:**
Test with any proto file containing an `import` statement at the top.

**Phase:** Proto parsing phase (foundational — design the include-path model before building the file picker).

---

### 3. Circular / recursive message types cause infinite recursion in form generation

**What goes wrong:**
Protobuf explicitly supports recursive message types (e.g., a tree node with optional child nodes of the same type). The wire format handles this fine because each sub-message is `optional` — a `null` terminates the recursion. But a naive form generator that walks the descriptor tree to build React components has no termination condition and will call itself infinitely.

The bug pattern: the descriptor tree represents _types_, not values. There is no depth limit implied by the schema itself — only runtime data has a natural depth. A renderer that treats "this field's type is message X" as "render an expanded form for X inline" will recurse forever. This is a well-documented class of problem with protobuf code generators (protobuf-swift issue #38 tracks an identical initialization loop; the Kafka UI project filed the same error for schema-to-form conversion — "Error converting Protobuf schema with recursive references").

**Consequences:**
Browser tab crash or JavaScript stack overflow when loading any proto file with recursive message types.

**Prevention:**
Track rendered message type names in a stack during recursive rendering. When the same type name appears in its own ancestor chain, render a collapsed "add nested [TypeName]" placeholder button instead of expanding inline. Users can expand on demand. Cap render depth at 5 levels regardless of recursion.

**Detection:**
Test with any proto containing a field whose type is the same message, or a pair of messages referencing each other (e.g., `User` with a `repeated Group groups` and `Group` with a `User owner`).

**Phase:** Dynamic form generation phase.

---

### 4. RabbitMQ Management API unavailability in production environments

**What goes wrong:**
The Management Plugin (port 15672) is not enabled by default on all RabbitMQ deployments. Many production, cloud-managed, or containerised RabbitMQ instances run without it. If queue/exchange listing is built exclusively on the HTTP management API, the feature silently breaks for a significant subset of real team environments.

The AMQP protocol itself does not provide a "list all queues" or "list all exchanges" method. The only queue-level AMQP introspection is `queue.declare-ok`, which returns `message_count` and `consumer_count` for a queue you already know the name of.

**Why it happens:**
The management API is convenient and familiar (it's what Postman-style tools use). Developers design around it without verifying it's available in the environments the tool will actually be used in.

**Consequences:**
The AMQP connection works fine but the queue/exchange dropdown is empty with no clear error. Users assume the tool is broken.

**Prevention:**
Make the Management API URL configurable and optional in the connection profile. If the management API is unavailable, degrade gracefully: show an empty dropdown with a text input for manual queue/exchange name entry, and display a clear status indicator ("Management API unavailable — enter queue name manually"). Detect management API absence by catching HTTP connection errors, not by treating an empty list as valid.

**Phase:** Connection profile + queue/exchange listing phase.

---

## Common Mistakes (waste time but recoverable)

### 5. lapin auto-recovery is experimental and does not restore channels

**What goes wrong:**
lapin's `enable_auto_recover()` is documented as experimental. It handles TCP reconnection but does not automatically recreate channels or consumers after recovery. A `Channel` object becomes invalid after a connection drop. Code that holds onto a `Channel` across a reconnect event will continue to fail silently or panic.

Additionally, `deadpool-lapin` manages connection pools but not channel pools — channels must be created per-publish. The `lapin::Connection.channels` field is private, preventing direct reuse. Creating and destroying a channel per message is the only safe pattern with a small per-publish overhead.

**Prevention:**
For a send-only tool (no long-lived consumers), the simplest model is: establish one connection, create a channel per publish call, close the channel after publish. Wrap the connection in `Arc<Mutex<Option<Connection>>>`. On any publish failure, check if the connection is alive via `connection.status().connected()`. If not, reconnect before retrying. Do not hold channels across command invocations.

**Warning signs:**
`lapin::Error::InvalidChannel` or silent message drops after a broker restart during a session.

**Phase:** AMQP layer.

---

### 6. Tauri 2 IPC serialises everything as JSON by default

**What goes wrong:**
Tauri 2's default IPC serialises return values from Rust commands to JSON via serde. Developers who naively return a `Vec<u8>` (proto-encoded bytes) as a Tauri command return value will see it arrive in the frontend as a JSON array of integers (`[72, 101, 108, 108, ...]`), not a `Uint8Array`. This breaks any binary preview or size display feature.

**Prevention:**
Return binary data from Tauri commands using `tauri::ipc::Response` with a raw binary body, or use the `ArrayBuffer` return path available since Tauri 2.0. Do not return `Vec<u8>` as a JSON-serialised value when the frontend needs binary.

**Warning signs:**
Frontend receives `[72, 101, 108, 108, ...]` instead of a `Uint8Array`. Proto byte count looks correct but the value is not binary-usable.

**Phase:** Proto encode + send preview feature.

---

### 7. Tauri 2 capability/permissions model — commands silently blocked

**What goes wrong:**
In Tauri 2, every `#[command]` must be listed in a capability file under `src-tauri/capabilities/`. If a new command is added to Rust but the capability file is not updated, the `invoke()` call from the frontend appears to succeed (no JS error) but the Rust handler is never called — the response is `null` or an opaque "not allowed" error with no useful diagnostic.

The v1 allowlist in `tauri.conf.json` is gone. Developers using pre-2.0 tutorials or examples will try to enable features in `tauri.conf.json` and nothing will work.

**Prevention:**
After adding any new `#[command]`, immediately add it to the capability file. Use `tauri dev` in verbose mode — it logs permission denials. The permission format is `${plugin-name}:${permission-name}` for plugins and `${permission-name}` for app-defined commands. For the filesystem plugin (`tauri-plugin-fs`), each allowed path scope must also be declared.

**Warning signs:**
`invoke('my_command')` returns `null` or an error referencing "not allowed" without identifying which capability is missing.

**Phase:** Tauri project setup + every subsequent command added.

---

### 8. Manual proto wire encoding: packed repeated fields and field number discipline

**What goes wrong:**
Two common manual encoding bugs:

1. **Packed vs unpacked repeated fields:** In proto3, repeated scalar fields are packed by default. A manual encoder that writes each element as a separate tagged value instead of a single length-delimited record produces parseable but incompatible output — production consumers using proto3 may reject or misparse it.

2. **Field number reuse:** If a `.proto` file is edited to remove a field and a new field is added with the same field number, the wire format becomes ambiguous. Production consumers will misparse messages with no error — values are silently assigned to the wrong fields. The protobuf spec states: "Reusing a field number makes wire-format messages ambiguous."

**Prevention:**
For (1): use `prost-reflect`'s `DynamicMessage.encode()` rather than hand-rolling wire format. It handles packed encoding correctly.
For (2): treat field numbers as immutable once a proto file has been used in production. Document the `reserved` keyword when showing field numbers in the UI.

**Warning signs:**
(1) Consumer logs show parse errors after the tool sends. (2) No error at encoding time, but field values arrive in wrong positions at the consumer.

**Phase:** Proto encoding layer.

---

### 9. Large repeated fields block the UI

**What goes wrong:**
A `repeated` field of a complex message type renders one form row per element. If a user pastes JSON with 500+ elements into a repeated field (bulk import scenario), the form generator eagerly renders 500 sub-trees of React components. This will freeze the browser for seconds or cause a tab crash on low-memory machines.

**Why it happens:**
Naive form generation treats "render all rows" as the correct behaviour for arrays, which works fine for small lists but not for unbounded repeated fields.

**Prevention:**
Virtualize repeated field lists past a threshold (e.g., 50 rows). Use a windowed list renderer (`react-window` or `react-virtual`) or implement lazy row expansion. Show a count badge ("150 items") with collapse/expand controls rather than auto-expanding everything. Allow adding/removing individual rows explicitly.

**Warning signs:**
UI freezes when loading a proto file with a `repeated SubMessage` field and more than ~100 items in the form state.

**Phase:** Dynamic form generation phase.

---

### 10. oneof UX: form state vs wire semantics mismatch

**What goes wrong:**
The protobuf spec is explicit: "Setting a value to any field in the OneOf automatically clears all other fields in that group. Only the last-written field is included in the serialized wire format." A naive form that renders all branches of a `oneof` as visible input fields lets the user type into multiple branches. At submit time, only one branch is encoded — the others are silently dropped. Users who filled in branch A, switched to branch B, then switched back expect branch A's draft to be restored. If the form purges it, the send feels unpredictable.

A secondary edge case: nested `oneof` (a `oneof` containing a message that itself has a `oneof`) is easy to mishandle in the React state shape, producing stale "ghost" values in the unselected branch that differ from what will actually be encoded.

**Prevention:**
Use an explicit branch-selector UI: a radio group or tab strip for the `oneof`, with only the selected branch's fields visible. Preserve all branches' draft state in React state but only pass the selected branch's value to the encoder. Show a clear visual indicator that the unselected branches "will not be sent." Test encoding output to verify the inactive branch produces no bytes on the wire.

**Sources:** proto3 language guide — "Setting any member of the oneof automatically clears all other members." Verified in official protobuf documentation.

**Warning signs:**
Encoding a message with a `oneof` field produces output that the consumer decodes with a different field populated than expected.

**Phase:** Dynamic form generation phase.

---

### 11. macOS notarization and Windows SmartScreen block distribution

**What goes wrong:**
macOS Gatekeeper blocks any app not notarised by Apple on first launch with a non-dismissible error. Notarisation requires:
- A paid Apple Developer account ($99/year)
- A Developer ID Application certificate
- An `Entitlements.plist` with JIT entitlement (required for Tauri's WebView)
- App Store Connect API credentials for the notarisation service

Windows SmartScreen shows a warning for newly-signed binaries until the certificate builds reputation. An EV certificate accelerates this but costs more.

If this is discovered at distribution time, the fix requires account setup, certificate procurement, and CI pipeline changes — days of work.

**Prevention:**
Address code signing in the first distribution milestone, not the last. Set up CI signing scripts early using Tauri's official signing docs. For internal team distribution on macOS, ad hoc signing avoids notarisation for developer machines but cannot be distributed to non-developers publicly.

**Warning signs:**
"App is damaged and can't be opened" on macOS = unsigned/un-notarised. "Windows protected your PC" on Windows = unsigned or low-reputation certificate.

**Phase:** Distribution / packaging phase. Set up signing infrastructure before the first team-wide binary distribution.

---

### 12. Tauri 2 on Linux requires webkit2gtk 4.1 — not available on all distros

**What goes wrong:**
Tauri 2 requires `webkit2gtk-4.1` (API version 4.1). Ubuntu 22.04 LTS ships `webkit2gtk-4.0` only. Ubuntu 24.04 dropped `webkit2gtk-4.0` entirely and only ships `4.1`. This creates a fork: apps built against the 4.0 API do not work on Ubuntu 24+; apps built against 4.1 do not have packages available on Ubuntu 22.

Additionally, the system WebKit on each Linux distribution may have different JavaScript capability levels. A React app built with Vite's defaults may use ES2020+ features not available in older system WebKits.

**Prevention:**
Target `webkit2gtk-4.1` (Tauri 2's stated requirement). Test on Ubuntu 24.04 LTS (current stable). Document the system dependency requirement clearly in distribution notes. Configure the Vite build target conservatively (`["es2019", "chrome87"]`) to avoid syntax not supported in older system WebKits encountered on enterprise Linux.

**Warning signs:**
Blank window on Linux with no console error. Missing `libwebkit2gtk-4.1-dev` build error during CI on older Ubuntu runners.

**Sources:** Tauri 2 prerequisites page lists `libwebkit2gtk-4.1-dev` as the Linux requirement. Tauri GitHub issue #9662 documents `libwebkit2gtk-4.0` removal from Ubuntu 24.

**Phase:** Cross-platform testing pass + CI setup.

---

### 13. Tauri State Mutex deadlock with async commands

**What goes wrong:**
Tauri 2's async commands run on a multi-threaded tokio runtime. All async futures must be `Send`. If AMQP connection state is stored behind a `std::sync::Mutex<T>` and the guard is held across an `.await` point (e.g., while waiting for a publish confirmation), the code either fails to compile ("future is not `Send`") or deadlocks at runtime — `std::sync::MutexGuard` is not `Send`.

**Prevention:**
Use `tokio::sync::Mutex` for state accessed across `.await` points. Alternatively, acquire the lock, extract/clone what is needed, release the lock, then run the async operation with no lock held. The second approach avoids holding a mutex across IO and is generally safer.

**Warning signs:**
Compile error: "future is not `Send`" pointing to a `MutexGuard`. Or: the send command hangs indefinitely when called.

**Phase:** AMQP state management in Tauri commands.

---

## Phase Mapping

| Topic area | Pitfall(s) | Address when |
|------------|-----------|--------------|
| Proto parsing library selection | #1 (prost vs prost-reflect) | Before writing a single line of proto code — foundational |
| Proto parsing: include paths UI | #2 (import path resolution) | When designing the file loading flow — include paths must be first-class |
| Dynamic form generation | #3 (circular/recursive types), #9 (large repeated fields), #10 (oneof UX) | Before implementing the form renderer — depth guard and oneof model from day one |
| AMQP connection layer | #5 (lapin channel lifecycle), #13 (Mutex + async) | AMQP integration milestone |
| Queue/exchange listing | #4 (management API unavailability) | Connection profile feature — text-input fallback is the primary path, API listing is an enhancement |
| Proto encoding | #8 (packed fields, field number reuse) | Encoding implementation — use prost-reflect's encoder, do not hand-roll |
| Tauri project setup | #7 (capabilities model) | Day one — add every command to capabilities immediately after defining it |
| Tauri IPC binary data | #6 (JSON serialisation of Vec<u8>) | Proto encode + send preview feature |
| Distribution | #11 (code signing, notarisation), #12 (WebKitGTK Linux) | First distribution milestone — do not leave for last |
| Cross-platform CI | #12 (WebKitGTK Linux) | CI pipeline setup, not just final QA |

---

## Sources

- prost README: https://github.com/tokio-rs/prost/blob/master/README.md
- prost-reflect docs: https://docs.rs/prost-reflect/latest/prost_reflect/
- prost-reflect CHANGELOG: https://github.com/andrewhickman/prost-reflect/blob/main/CHANGELOG.md
- protox GitHub: https://github.com/andrewhickman/protox
- lapin README (auto_recover experimental): https://github.com/amqp-rs/lapin/blob/main/README.md
- lapin reconnect issue: https://github.com/amqp-rs/lapin/issues/420
- deadpool-lapin channel pooling limitation: https://github.com/deadpool-rs/deadpool/issues/47
- Tauri v1 to v2 migration guide: https://v2.tauri.app/start/migrate/from-tauri-1/
- Tauri 2 permissions: https://v2.tauri.app/security/permissions/
- Tauri 2 capabilities: https://v2.tauri.app/security/capabilities/
- Tauri 2 distribution: https://v2.tauri.app/distribute/
- Tauri macOS signing: https://v2.tauri.app/distribute/sign/macos/
- Tauri Windows signing: https://v2.tauri.app/distribute/sign/windows/
- Tauri prerequisites (webkit2gtk-4.1): https://v2.tauri.app/start/prerequisites/
- Tauri webkit2gtk issue (Ubuntu 24 dropping 4.0): https://github.com/tauri-apps/tauri/issues/9662
- Tauri IPC binary data issue: https://github.com/tauri-apps/tauri/issues/7127
- Protobuf encoding guide: https://protobuf.dev/programming-guides/encoding/
- Protobuf field number reuse: https://protobuf.dev/programming-guides/proto3/
- Protobuf oneof wire semantics: https://protobuf.dev/programming-guides/proto3/ ("Setting any member of the oneof automatically clears all other members")
- Circular reference infinite loop (protobuf-swift #38): https://github.com/alexeyxo/protobuf-swift/issues/38
- Kafka UI recursive schema error: https://github.com/provectus/kafka-ui/issues/2824
- RabbitMQ Management Plugin docs: https://www.rabbitmq.com/docs/management
- protobufjs import resolution issue: https://github.com/protobufjs/protobuf.js/issues/368
