---
phase: 09-routing-key-autocomplete
plan: 01
subsystem: api
tags: [rust, tauri, rabbitmq, reqwest, percent-encoding, management-api]

# Dependency graph
requires:
  - phase: 02-connection-profiles
    provides: fetch_exchanges, load_profile_with_password, ManagementApiUnavailable error variants
provides:
  - ExchangeSummary struct (name + exchange_type) from fetch_exchanges
  - fetch_bindings command returning deduplicated routing keys from /api/exchanges/{vhost}/{exchange}/bindings/source
affects:
  - 09-02 (frontend combobox consumes ExchangeSummary and calls fetch_bindings)
  - 09-03 (routing key autocomplete UX integration)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "percent-encode both vhost and resource name before URL construction (NON_ALPHANUMERIC)"
    - "sort + dedup pattern for deduplicated string collections from RabbitMQ API"
    - "ExchangeSummary public output struct for Management API data crossing IPC boundary"

key-files:
  created: []
  modified:
    - src-tauri/src/commands/connection.rs
    - src-tauri/src/lib.rs

key-decisions:
  - "ExchangeSummary uses snake_case field names (not camelCase) — matches ConnectionProfile convention; frontend plan handles field mapping"
  - "exchange_type stored as-is from RabbitMQ API (lowercase: direct/fanout/topic/headers) — no toLowercase() call to avoid corruption"
  - "fetch_bindings errors not discriminated — frontend silently falls back to plain Input on ANY error (D-10)"
  - "sort() before dedup() — Rust dedup only removes consecutive duplicates"
  - "fetch_bindings registered after fetch_exchanges in invoke_handler to group related commands"

patterns-established:
  - "ExchangeSummary: public output struct pattern for Management API structs crossing IPC boundary"
  - "percent_encoding::utf8_percent_encode(NON_ALPHANUMERIC) for both vhost and resource name in multi-segment URLs"

requirements-completed: [PUBL-01, PUBL-02, PUBL-03, PUBL-04]

# Metrics
duration: 8min
completed: 2026-05-19
---

# Phase 9 Plan 01: Routing Key Autocomplete — Backend Summary

**ExchangeSummary struct with exchange_type field added to fetch_exchanges, plus new fetch_bindings command returning deduplicated routing keys via /api/exchanges/{vhost}/{exchange}/bindings/source**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-19T17:00:00Z
- **Completed:** 2026-05-19T17:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Added `ExchangeSummary` public struct with `name` + `exchange_type` fields; updated `fetch_exchanges` return type from `Vec<String>` to `Vec<ExchangeSummary>`
- Removed unused `#[allow(dead_code)]` from `ExchangeApiInfo.exchange_type` — field is now live in the map chain
- Added `fetch_bindings` Tauri command that calls `/api/exchanges/{vhost}/{exchange}/bindings/source`, filters empty routing keys, sorts, and deduplicates
- Registered `fetch_bindings` in `lib.rs` invoke_handler — frontend `invoke("fetch_bindings", ...)` is now resolvable

## Task Commits

Each task was committed atomically:

1. **Task 1: Add ExchangeSummary struct + update fetch_exchanges + add fetch_bindings** - `48101d0` (feat)
2. **Task 2: Register fetch_bindings in Tauri invoke_handler** - `42afbdd` (feat)

## Files Created/Modified
- `src-tauri/src/commands/connection.rs` - ExchangeSummary struct, updated fetch_exchanges, BindingApiInfo struct, fetch_bindings command
- `src-tauri/src/lib.rs` - fetch_bindings added to generate_handler! list

## Decisions Made
- `ExchangeSummary` uses snake_case (`exchange_type` not `exchangeType`) consistent with `ConnectionProfile` — the frontend wave handles field access accordingly
- `exchange_type` stored as-is from RabbitMQ API (already lowercase per RabbitMQ convention); no `.to_lowercase()` call to avoid silent corruption if API returns mixed-case
- Errors from `fetch_bindings` are not discriminated — frontend design decision D-10 specifies silent fallback to plain Input on any error

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Cargo check produced two "unused" warnings during Task 1 execution (`BindingApiInfo` struct and `fetch_bindings` function) — both expected because the command was not yet registered. Both warnings resolved automatically in Task 2 when `fetch_bindings` was added to the invoke_handler.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend is complete: `fetch_exchanges` now returns exchange type for frontend type-badge rendering and eligibility gating (headers/fanout suppression)
- `fetch_bindings` is callable from frontend via `invoke("fetch_bindings", { profileName, exchangeName })`
- Ready for Plan 09-02: Frontend combobox component consuming ExchangeSummary and calling fetch_bindings

## Threat Surface

No new trust boundaries introduced beyond those documented in the plan threat model (T-09-01-01 through T-09-01-04). All mitigations implemented:
- `exchange_name` percent-encoded via NON_ALPHANUMERIC before URL construction (T-09-01-01)
- Credentials passed via `basic_auth()` header, never in URL string (T-09-01-02)

---
*Phase: 09-routing-key-autocomplete*
*Completed: 2026-05-19*
