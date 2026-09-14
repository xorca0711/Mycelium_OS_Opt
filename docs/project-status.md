# Project status

Updated: 2026-09-14. Working branch: `codex/local-setup`.

## Current checkpoint

The Windows ARM64 desktop application launches; the user confirmed the earlier development launch.
Stage 8 database management and Notion/file imports are implemented on top of the
personal settings and reliability work. Stage 7 Windows ARM64 and x64 NSIS installers
are built. The ARM64 app is installed and passes standalone startup checks; the x64
executable's architecture is verified. Remaining interactive checks are listed below.

The application root is `O_neash Dash/`. Baseline commit
`30808848abb2dd650e064ae6917a1984842fb544` imported upstream
`eb93cd9d5b8c34569b95fff0169ffbb0b9196244` while preserving repository history.
Commit `178a332` recorded the earlier steps 4–5 progress checkpoint.
Commit `e6e6a4f` preserved the verified step 5 changes and architecture gallery.

## Implemented

| Area | Result |
|---|---|
| Window behavior | Centered, resizable 1100 × 720 window with native title bar; minimum 800 × 600; fullscreen disabled |
| Windows distribution | Separate native ARM64 and Intel/AMD x64 installers; per-user installation with Start menu/desktop shortcuts and WebView2 bootstrapper; no Vite or development tools required after installation |
| Development storage | Native-selected `Documents/O-neash-data-dev`; release retains `Documents/O-neash-data` |
| Database reliability | Versioned migration ledger through v6, legacy routine/wardrobe preservation, native atomic write batches, corrected cascade trigger, six query-backed indexes and environment instance locks |
| Data management | Settings → Data: read-only paginated table browsing, whole-table CSV/JSON exports, validated database/media/preference backups and staged restore with rollback-folder retention |
| Notion and file imports | Explicit preview of selected Notion pages/database rows or mapped CSV/JSON records into Notes; source identity/history, atomic note/provenance writes, incremental body-download skips, local-edit/archive/delete preservation |
| Import boundaries | Memory-only token; no startup Notion requests; sequential pacing, retries and cancellation; Markdown/properties stored as editable text, relations remain IDs; no automatic task mapping, media download or two-way sync |
| Personal settings | Optional name/avatar, home clock timezone, supported regional formats, Planner week start, seven-day capacity, focus/break preferences, module/feed visibility and Analytics data sources |
| Preference history | Validated JSON v1 in SQLite; each explicit save atomically updates the current profile and appends a revision; existing activity records remain intact |
| Personal data controls | Historical sleep-target updates, weather-location clearing, links to habit/project/subject editors and native-selected storage paths |
| Personal planning | Suggestions account for daily availability and breaks; rest days suppress extra suggestions; calendars follow the selected week start |
| Notes | Shared normal/floating state, serialized document and memo saves, retained failed drafts, error/retry feedback, flush-before-backup/close, stable wiki-link IDs and rename aliases |
| Planner/session data | Batched task/group loading, targeted refresh, atomic completion/deletion, accumulated effort, serialized session operations and two-session moves |
| Analytics | Local-calendar boundaries, shared observation times, bounded waking windows, calendar-based IRF lags |
| Startup/feeds | Removed forced splash delay, lazy plugins, unmounted hidden widget panel, cached/coalesced feed requests with stale-data retention |
| Windows PDF | Unsupported export disabled and labelled unavailable |
| Customization | Editable 16-page diagram, SVG gallery, fresh-schema inventory (51 application tables / 46 declared foreign keys), source-linked customization/data guides |

## Verification

- The ARM64 NSIS release installer built successfully and installed for the current
  Windows user with exit code 0. The installed executable has ARM64 PE architecture
  (`0xAA64`), and Start menu/desktop shortcuts exist. A launch from
  `%LOCALAPPDATA%/Mycelium/Mycelium.exe` produced a responsive Mycelium window while
  no development server listened on port 1420. The newly created release database
  initialized through migration 6 with 51 tables including the migration ledger,
  `integrity_check = ok`, zero foreign-key violations and no imported records.
  This verifies native startup and database initialization, not a full native UI workflow.
- The x64 NSIS release installer also built successfully. Its application executable
  has x64 PE architecture (`0x8664`) and uses the generic x64 target with no custom
  CPU flags. Both executables' static imports reference Windows system libraries.
  The x64 installer was not installed over the native ARM64 copy; runtime verification
  on an Intel/AMD PC remains pending. Both builds use the same schema and backup format.
- The development executable was also rebuilt with the new native Data commands;
  the existing development launcher can reopen it with Vite.
- TypeScript checks and Vite production build passed. Vite still warns about chunks
  larger than 500 kB; the rich-text editor and shared startup code can be split further.
- All 84 JavaScript regression tests passed. They cover real in-memory SQLite rollback, task query
  counts, session accounting, time-zone boundaries, notes save races, stable links,
  save-before-close logic, feed caching, analytics windows, concurrent session actions,
  settings validation/history/rollback, avatar bounds, feature gates, weekly capacity,
  week ordering, deduplicated capacity reservations for scheduled/overdue/session work,
  weather-location notifications, CSV/JSON parsing, Notion request cancellation/timeouts/retry cleanup,
  unchanged-page body skips, import identity/conflicts/atomic rollback, memo flushing,
  preference handoff rollback and measured before/after query plans on synthetic rows.
- Nine native SQLite migration tests passed with `cargo test --offline --locked --lib
  database_tests` from `O_neash Dash/src-tauri`. They cover fresh/legacy upgrade,
  repeat migration, interruption rollback, related-data preservation, batch rollback,
  cascade behavior, development-directory isolation, settings migration and v6 provenance rollback/preservation.
- Eleven native data-management tests pass against temporary fixtures: database/media checksums,
  required schema tables, staged transfer and media relinking, interrupted rename recovery,
  atomic sidecar publication, rollback receipts, environment locks, browse/export validation,
  pool reopening after backup failure, and byte-preserving restore of imported notes and
  literal path text. Together with the migration suite, 20 native tests pass. No personal
  data was used in these tests.
- An isolated Data component preview at 800 × 600 verified table rendering, CSV field mapping,
  explicit preview and import completion feedback. Database operations were mocked; real
  import transactions are covered by the SQLite tests. This does not verify a live Notion account.
- The AGENTS.md scanner `npx @Codex-flow/cli@latest security scan` was attempted but npm
  returned E404: the named package is unavailable and uppercase package names are invalid.
  No successful result from that scanner is claimed. The repository has no npm lint script.
- An isolated browser component preview at 1100 × 720 and 800 × 600 verified Settings
  layout and scrolling, saving synthetic preferences, retaining drafts across Settings
  tabs, and discarding changes. Its DB/location adapters were mocked; this is not a
  native persistence test. No personal settings or history were edited for this check.
- `pnpm tauri dev` compiled and launched on Windows ARM64. Startup was visually
  inspected before the window-mode change.
- On 2026-09-14, the development command rebuilt and launched the current native
  app at the user's request. Windows reported a responsive `Mycelium` window and
  the Vite server listening on local port 1420. This did not repeat the full native
  profile-editing/restart workflow.
- The [native smoke script](../O_neash%20Dash/scripts/native-smoke.mjs) invoked the
  running WebView's actual TypeScript modules, Tauri IPC, SQLite and filesystem APIs.
  It created labelled `[TEST]` samples only after asserting the development directory.
  Arc → project → completed task, session/pause, linked Korean document, rename-safe
  link, sleep entry, habit log, native image decoding, font setting and foreign-key
  integrity all passed.
- At the step 5 restart for the window-mode configuration change, those records,
  image and setting persisted. Migration versions then remained 1–4.
- Diagram XML/geometry, all 16 pages' table coverage and source links were validated;
  the original previews and changed runtime/storage/preferences/import/backup previews
  were visually inspected.
  Source schema was loaded only into an in-memory
  database; no personal database content is included in the diagrams.

## Remaining interactive checks

Computer Use was stopped with the physical Escape key during step 5. No further
native UI click automation was performed; later requested launches used commands,
including the installed release executable. Full click-through verification of both note editors,
native image selection, pending-save window closure, window resizing/layout,
and whole-app offline operation remains pending. Stage 6 native click-through/restart
with a user-chosen profile is also pending. Logic/API and browser component tests do not
substitute for those checks. macOS/Linux runtime behavior has not been tested here.

## Local data and resume instructions

The development database is `Documents/O-neash-data-dev/oneash-DB.db`, with images
beneath that directory. `[TEST]` records are verification samples. No personal
history was imported. Git preserves source, lockfiles, tests, diagrams and this
status record; it does not preserve a running process, local databases/media,
WebView preferences, dependencies or build output.

For standalone daily use, open **Mycelium** from the Start menu or desktop shortcut.
The installed executable is `%LOCALAPPDATA%/Mycelium/Mycelium.exe`, and its database
is `Documents/O-neash-data/oneash-DB.db`. No development records were copied into it.
The ARM64 installer is `O_neash Dash/src-tauri/target/aarch64-pc-windows-msvc/release/bundle/nsis/Mycelium_0.1.0_arm64-setup.exe`
(11,206,749 bytes; SHA-256 `3E6F9C3C9BBFA8B89923DF5C0EAF80507E8D312C8BFD4DE7F455426C8091D06F`).
The Intel/AMD x64 installer is `O_neash Dash/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/Mycelium_0.1.0_x64-setup.exe`
(11,931,662 bytes; SHA-256 `FBCAA46785BE3E3515EE437D8810AE43A181A11C42344263B65BFEA1A1229297`).
These local installers are ignored build outputs, not uploaded GitHub release assets.

For development, from a new terminal in `O_neash Dash/`:

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

For development reopening after a native build, use `O_neash Dash/scripts/Launch-Mycelium.cmd`.
It starts an owned background Vite process and the existing debug executable; `-StopServer`
stops only the server recorded by that launcher, after app windows are closed. It does
not install dependencies or rebuild Rust. See the [launch and navigation manual](../README.md#everyday-launch-on-windows).

See the [diagram gallery](architecture/previews.md),
[customization map](architecture/customization-map.md), and
[raw-data/connection guide](architecture/local-data-connections.md).
Open **Settings → Personal**, edit the desired fields and choose **Save personal settings**.
Defaults use a blank name, the existing mascot, system regional settings and all modules/feeds
enabled. The first load inherits legacy daily capacity/focus hours when available.
The timezone setting affects the home clock; task/log dates remain device-local.
Regional formatting does not translate the interface. Focus preferences affect suggestions
and estimates; they do not automatically start/pause work sessions.

Use **Settings → Data** for backup/restore, table inspection/export and imports. Restoring a
development backup into an installed app explicitly replaces the destination workspace after
restart and retains the previous folder. No personal backup has been restored automatically.
Notion account setup remains user-specific: grant Read content access to a selected source and
enter its token in the app. No token or source was supplied for live-account verification.
The first importer accepts up to 100 recently edited Notion rows, 500 file records, one million
characters per note and five million per batch. It does not export the entire Notion workspace.
Storage paths are displayed, not arbitrarily relocated. Preference revision history is stored
for audit; a per-revision profile history browser is not yet implemented.

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
