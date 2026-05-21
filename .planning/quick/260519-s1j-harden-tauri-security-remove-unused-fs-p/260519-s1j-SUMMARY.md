---
quick_id: 260519-s1j
slug: harden-tauri-security-remove-unused-fs-p
status: complete
adjusted: true
---

# Quick Task 260519-s1j: Harden Tauri Security (adjusted for Phase 15)

## Adjustment from Original Plan

The s1j plan was authored before Phase 15 added `writeTextFile` usage for JSON export. The original plan called for full removal of `tauri-plugin-fs`; the adjusted scope retains the plugin and `fs:allow-write-text-file` while closing the actual security gaps.

## What Was Changed

### src-tauri/capabilities/default.json

- **Removed** `"fs:default"` — broad permission enabling read/write/delete/rename; never needed
- **Removed** `"fs:allow-read-text-file"` — unused; only write is needed for Phase 15 export
- **Narrowed** `fs:scope` from `**/*` (entire disk) to `$HOME/**` (home directory only)
- **Kept** `"fs:allow-write-text-file"` — required for Phase 15 JSON export via `writeTextFile`

### src-tauri/tauri.conf.json

Replaced `"csp": null` with strict Content-Security-Policy:
`default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' ipc: http://ipc.localhost; object-src 'none'; base-uri 'self'; frame-ancestors 'none'`

- `style-src 'unsafe-inline'` retained: required by Radix UI / shadcn inline positioning
- `connect-src ipc: http://ipc.localhost` retained: Tauri 2 IPC requirement

## Verification

- `cargo build`: clean, 0 crates recompiled
- `npm test -- --run`: 29 files, 328 tests, all pass
- `tauri.conf.json` and `default.json`: valid JSON confirmed
- Closes CR-01 (security review finding from Phase 15 code review)
