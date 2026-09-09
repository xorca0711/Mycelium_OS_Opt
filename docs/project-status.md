# Project status

Updated: 2026-09-09. Working branch: `codex/local-setup`.

## Current checkpoint

The Windows ARM64 desktop application launches; the user confirmed the launch.
Step 5 reliability/performance changes are implemented. Step 4 has passed native
data/persistence checks, with remaining interactive checks explicitly listed below.
No installer has been produced.

The application root is `O_neash Dash/`. Baseline commit
`30808848abb2dd650e064ae6917a1984842fb544` imported upstream
`eb93cd9d5b8c34569b95fff0169ffbb0b9196244` while preserving repository history.
Commit `178a332` recorded the earlier steps 4–5 progress checkpoint.

## Implemented

| Area | Result |
|---|---|
| Window behavior | Centered, resizable 1100 × 720 window with native title bar; minimum 800 × 600; fullscreen disabled |
| Development storage | Native-selected `Documents/O-neash-data-dev`; release retains `Documents/O-neash-data` |
| Database reliability | Versioned migration ledger through v4, legacy routine/wardrobe preservation, native atomic write batches, corrected cascade trigger |
| Notes | Shared normal/floating state, serialized debounced saves, error/retry feedback, save-before-close, stable wiki-link IDs and rename aliases |
| Planner/session data | Batched task/group loading, targeted refresh, atomic completion/deletion, accumulated effort, serialized session operations and two-session moves |
| Analytics | Local-calendar boundaries, shared observation times, bounded waking windows, calendar-based IRF lags |
| Startup/feeds | Removed forced splash delay, lazy plugins, unmounted hidden widget panel, cached/coalesced feed requests with stale-data retention |
| Windows PDF | Unsupported export disabled and labelled unavailable |
| Customization | Editable 12-page diagram, SVG gallery, fresh-schema inventory (46 tables / 43 declared foreign keys), source-linked customization/data guides |

## Verification

- TypeScript checks and Vite production build passed. Vite still warns about chunks
  larger than 500 kB; the rich-text editor and shared startup code can be split further.
- All 33 JavaScript regression tests passed. They cover real in-memory SQLite rollback, task query
  counts, session accounting, time-zone boundaries, notes save races, stable links,
  save-before-close logic, feed caching, analytics windows, and concurrent session actions.
- Seven native SQLite tests passed with `cargo test --offline --locked --lib
  database_tests` from `O_neash Dash/src-tauri`. They cover fresh/legacy upgrade,
  repeat migration, interruption rollback, related-data preservation, batch rollback,
  cascade behavior, and development-directory isolation.
- `pnpm tauri dev` compiled and launched on Windows ARM64. Startup was visually
  inspected before the window-mode change.
- The [native smoke script](../O_neash%20Dash/scripts/native-smoke.mjs) invoked the
  running WebView's actual TypeScript modules, Tauri IPC, SQLite and filesystem APIs.
  It created labelled `[TEST]` samples only after asserting the development directory.
  Arc → project → completed task, session/pause, linked Korean document, rename-safe
  link, sleep entry, habit log, native image decoding, font setting and foreign-key
  integrity all passed.
- After restart for the window-mode configuration change, those records, image and
  setting persisted. Migration versions remained 1–4.
- Diagram XML/geometry, table coverage and source links were validated; all 12 SVG
  previews were visually inspected. Source schema was loaded only into an in-memory
  database; no personal database content is included in the diagrams.

## Remaining interactive checks

Computer Use was stopped with the physical Escape key. No further desktop
automation was performed. Full click-through verification of both note editors,
native image selection, pending-save window closure, window resizing/layout,
and whole-app offline operation remains pending. Logic/API tests above do not
substitute for those checks. macOS/Linux runtime behavior has not been tested here.

## Local data and resume instructions

The development database is `Documents/O-neash-data-dev/oneash-DB.db`, with images
beneath that directory. `[TEST]` records are verification samples. No personal
history was imported. Git preserves source, lockfiles, tests, diagrams and this
status record; it does not preserve a running process, local databases/media,
WebView preferences, dependencies or build output.

From a new terminal in `O_neash Dash/`:

```powershell
pnpm tauri dev
```

This starts Vite on port 1420 and the native executable. Keep the terminal open.
No SQLite server, Docker, Notion or Obsidian process is required. Windows ARM64
needs Rust/Cargo, MSVC ARM64 Build Tools, Windows SDK, Clang and WebView2 as
documented in the [README](../README.md).

For repeatable checks, run `pnpm test`, `pnpm typecheck`, `pnpm build` and the native
test command above. The native smoke script additionally requires the development
WebView debugging port 9223; its seed phase creates sample data and refuses release
storage. Use `verify` after an existing sample run.

See the [diagram gallery](architecture/previews.md),
[customization map](architecture/customization-map.md), and
[raw-data/connection guide](architecture/local-data-connections.md).
Personal-profile settings (step 6), installer packaging (step 7), and personal
history import/backup tooling (step 8) remain future work.

## GitHub ownership and visibility

`xorca0711/Mycelium_OS_Opt` is a public, independent GitHub repository (`isFork:
false`), with local `origin` pointing to it. The `upstream` remote points to
`hanjae-Oneash823/Mycelium` for reference. Original-author commits remain visible
because their history was imported. Publicly pushed local fixes are viewable by
anyone, including the original author, but do not modify the original repository.

[PR #1](https://github.com/xorca0711/Mycelium_OS_Opt/pull/1) was merged into this
repository's own `main` at `5bfb3e8`. It was not a submission to the original author.
No pull request from `xorca0711:codex/local-setup` exists against the original
repository as of this checkpoint. New work is preserved on `codex/local-setup`;
merging this checkpoint into `main` is a separate action.
