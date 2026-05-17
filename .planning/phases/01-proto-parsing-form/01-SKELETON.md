# Walking Skeleton — Proto Sender

**Phase:** 1
**Generated:** 2026-05-17

## Capability Proven End-to-End

User clicks "Open .proto file" → native file dialog returns a path → include-path dialog appears (pre-populated with parent dir) → user confirms → Rust parses the file with `protox` + `prost-reflect` → message type names appear in the sidebar dropdown → user selects a message type → at least one string scalar field renders in the form → form value changes trigger a debounced `encode_message` Rust call → hex bytes appear in the bottom preview strip.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Desktop framework | Tauri 2.x | Specified by project (D-13) |
| Backend language | Rust | Tauri standard |
| Frontend | React + Vite + TypeScript | Specified by project (D-13) |
| Proto parsing | protox 0.9.1 + prost-reflect 0.16.3 | Verified in RESEARCH.md; prost resolves to 0.14.0 |
| Form rendering | react-hook-form 7.76.0 + zod ^3.24.2 + shadcn/ui | Specified by project (D-13); zod v3 ONLY |
| State | Zustand 5.0.13 | Specified by project (D-13) |
| Profile storage | tauri-plugin-store 2.4.3 | Specified by project (D-13) |
| CSS | Tailwind CSS 4.3.0 | Specified by project (D-13); uses @import not tailwind.config.js |
| Directory layout | src-tauri/ (Rust backend) + src/ (React frontend) | Tauri 2 convention |
| Form schema bridge | Rust serializes FieldDescriptor → JSON; TypeScript mirrors with discriminated unions | Specified in RESEARCH.md Pattern 2 |
| Encoding | prost-reflect DynamicMessage + prost::Message::encode_to_vec() | Binary wire format only (D-17) |
| Include path UX | Inline modal dialog after file pick; persisted via tauri-plugin-store keyed by absolute path | Specified by D-08, D-09 |
| oneof fields | Radio group with conditional branch mount; _selected discriminant | Specified by D-14 |
| Depth cap | Hard cap at 5 levels; DepthCapPlaceholder component | Specified by D-15 |
| Layout | 240px fixed sidebar + flex main panel | Specified by D-01, D-02 |
| Hex preview | Collapsible bottom strip, expanded by default, debounced 200ms | Specified by D-04, D-05, D-06, D-07 |

## Stack Touched in Phase 1

- [x] Project scaffold (Tauri 2 init via `npm create tauri-app@latest`, React+TypeScript+Vite, Cargo.toml with protox/prost-reflect/lapin/serde/thiserror/tracing, all plugins registered, shadcn/ui init with zinc preset, TailwindCSS 4 via @tailwindcss/vite, build compiles)
- [x] IPC — `parse_proto` and `encode_message` `#[tauri::command]` functions callable from JS via typed wrappers in `src/lib/ipc.ts`
- [x] File access — native file picker via @tauri-apps/plugin-dialog + `fs:scope allow **/*` capability + macOS entitlement
- [x] Proto parsing — protox reads a .proto file (with include paths), prost-reflect extracts field descriptors, serialized to ProtoSchema JSON for the frontend
- [x] Form schema — full FieldKind extraction (scalar/message/enum/oneof/well_known) in extractor.rs; TypeScript types mirror in src/lib/types.ts
- [x] UI — sidebar (240px fixed, file section, message type selector, connection placeholder), main panel (form area + hex preview strip), Include Path dialog
- [x] Form rendering — all field types: scalar (all 16 variants), nested messages, repeated fields, enum dropdowns, oneof radio groups, WellKnownType controls (Timestamp + Duration)
- [x] Validation — zod per-field schemas, structural validation via encode_message error path
- [x] Full-stack run — `npm run tauri dev` works on macOS

## Out of Scope (Deferred to Later Slices)

- RabbitMQ AMQP connection (Phase 2)
- Connection profiles and credential storage (Phase 2)
- Publish to queues/exchanges (Phase 2)
- Message history and replay (Phase 3)
- Multi-proto-file support simultaneously (Phase 3)
- OS keychain credential storage (Phase 2)
- Advanced AMQP message properties (Phase 3)
- google.protobuf.Any control (Phase 3, PROT-03)
- Remaining WellKnownTypes beyond Timestamp+Duration (Phase 3, PROT-03)
- bytes field with base64 helper (Phase 2/v2, FORM-V2-01)
- map<K,V> fields (v2, FORM-V2-02)

## Subsequent Slice Plan

- Phase 2: Connect to RabbitMQ, save connection profiles with OS keychain password storage, publish encoded messages to queues and exchanges with live queue/exchange discovery
- Phase 3: Message history with replay, advanced AMQP properties, remaining WellKnownType controls (Any + others), multi-proto-file support within one session
