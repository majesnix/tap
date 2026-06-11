# GSD context snapshot (2026-05-26T22:03:39.741Z)

## Top project memories
- [MEM003] (gotcha) tauri-action@v0 creates the GitHub draft release with an EMPTY body — populating the notes is a separate post-workflow step (`gh release edit <tag> -R <repo> --draft --notes-file ...`). Wait for the workflow run to finish before editing to avoid the linux job overwriting the body.
- [MEM001] (architecture) How to handle the unreleased v1.7 tag Chose: Skip v1.7 publication; ship as v1.8.0 directly and acknowledge v1.7 by name in release notes. Rationale: The local v1.7 tag is two-component and does not match the v*.*.* workflow trigger. Retroactively publishing v1.7 would require either force-pushing the tag (rewrites a published ref) or creating a s….
- [MEM002] (architecture) Whether v1.8.0 ships a Windows artifact alongside macOS and Linux Chose: Drop Windows from v1.8.0 scope. Ship macOS (universal-darwin) + Linux only, matching every prior release (v1.5.x through v1.6.1). Windows defers to a future milestone if/when demand surfaces.. Rationale: The current .github/workflows/release.yml has only build-macos and build-linux jobs (139 lines, two jobs verified) — there is no Windows job. Adding one in S03 would significantly expand scope: a Win….

## Recent gsd_exec runs
- [7e111882-2376-4ae1-98aa-77168df9ac71] bash exit:0 — S03 slice verification: tag, draft body, asset set, Gatekeeper
- [87c903dd-51ac-4f5b-ac56-86aa6966ac27] bash exit:0 — S02 slice verification: release notes file structure
- [f5aa0427-2222-43e9-b02d-22fb292566be] bash exit:0 — S01 slice verification: manifests, Cargo.lock, commit subject
- [52385112-7062-418c-ba7b-be81e8775f17] bash exit:0 — S01 verification: grep version 1.8.0 across manifests
- [ce9692fb-a40b-49af-aaf1-d1a1e9205e19] bash exit:0 — Refresh Cargo.lock tap entry to 1.8.0
