# Release notes and upstream comparison

Checkpoint: 2026-09-14, application version **0.1.0**, integrated through
[PR #2](https://github.com/xorca0711/Mycelium_OS_Opt/pull/2) into this repository's
`main`. The PR page records the exact source and merge commits. Build hashes and
remaining verification limits are recorded in [project status](project-status.md).

## Original application and local changes

The reference is [hanjae-Oneash823/Mycelium](https://github.com/hanjae-Oneash823/Mycelium)
at `eb93cd9d5b8c34569b95fff0169ffbb0b9196244`, still its advertised `master` head when
checked on 2026-09-14. Import commit `30808848abb2dd650e064ae6917a1984842fb544`
preserved that history. The original Planner, Notes, trackers, studio tools,
mascot, games and physics/animation work remain the original author's work.
Public changes here can be viewed by that author but do not modify their repository.

| Area | Original/imported behavior | Changes in this repository |
|---|---|---|
| Windows setup | Source primarily developed for macOS; initial portability fixes needed | Pinned dependency setup, ARM64/x64 NSIS packaging, documented toolchains, standalone installation and development launcher |
| Window and navigation | Fullscreen presentation | Centered resizable 1100 × 720 window, minimum 800 × 600; navigation manual and responsive Home/Settings |
| SQLite lifecycle | Initialization lacked the current versioned upgrade and environment protections | Native migrations through v6; separate development/release folders; preserved legacy routine and wardrobe data; instance locks |
| Related writes | Multi-step writes could partially complete | Atomic native batches, corrected cascade behavior, rollback regressions |
| Planner and sessions | Repeated hydration and session settlement races | Batched group reads, targeted refresh, serialized session changes, repeat-safe effort accounting and two-session moves |
| Notes | Normal/floating save races and rename-sensitive links | Shared state, serialized saves, retained failed drafts, retry/close flushing, stable link IDs and rename aliases |
| Personal preferences | Author-specific welcome and scattered preferences | Optional editable name/avatar, regional clock/format choices, availability and focus settings, module/feed controls, atomic preference revision history |
| Imports | No current selected-source import workflow | Explicit Notion/CSV/JSON preview into local Notes, source IDs/hashes/history, atomic imports, preservation of local edits/archives/deletions |
| Data interface | No current unified transfer/inspection screen | Read-only table browsing/export, database/media/preference backups, validated staged restore and retained rollback folder |
| Analytics and queries | Calendar/observation boundary problems and avoidable scans/sorts | Local-calendar fixes, bounded observation windows, six indexes backed by synthetic query-plan comparisons |
| Startup and feeds | Forced splash wait, eager module/feed work | Readiness-based startup, lazy plugins, hidden-panel unmounting, feed cache/coalescing and visibility gates |
| Documentation | Original overview | Launch/data manuals, source-linked 16-page editable architecture and schema inventory, verification and comparison records |

The schema has **51 tables including the migration ledger**, 46 declared foreign
keys, and one SQLite file per environment. Images and WebView appearance/layout
preferences use separate storage. See the [architecture gallery](architecture/previews.md)
and [data connection guide](architecture/local-data-connections.md).

## Review fixes

- Backup/restore now discovers and relinks inline images inside wardrobe wiki
  documents. Missing referenced images cause validation to fail; literal path text
  remains unchanged. Two regressions failed before the fix and pass afterward.
- Adjacent Notion title/rich-text fragments concatenate without extra commas;
  genuine multi-value properties retain their separators. A mocked Notion request
  regression exercises formatted titles, Unicode text and list properties.
- **Edit profile** on Home opens the Personal settings tab and focuses Display name,
  including when Settings was already on Data. The name remains optional and is a
  local display preference, not a Windows administrator account or login identity.
  Launcher shortcuts yield to focused buttons and other interactive controls.
- The restored startup reveal releases its root stacking context after completion,
  preserving the maintenance overlay's precedence over floating-editor portals.

## Mac/Windows appearance review

The comparison found no separate Windows sprite/video replacement. Existing public
art assets were unchanged from the imported baseline before the two font additions
below. Framer Motion remains declared at `^12.34.0`; the normal module transition,
mascot blinking, feed effects and Planner physics were retained. No video element
or video asset was found in the reviewed source; `earthspin.gif` is present but
unreferenced. A custom uploaded avatar is intentionally converted to a still image;
the default mascot keeps its blinking eyes.

There were real presentation differences:

- The old VT323 font definition relied on a locally installed font, with Google
  Fonts elsewhere in the page. VT323 and the Odibee Sans splash title are now bundled
  with their OFL licenses. Default typography no longer needs those fonts installed
  on the computer or downloaded from Google. Some secondary font families elsewhere
  still use Google Fonts; this is not a claim that every feature is network-free.
- The original larger launcher labels and spacing return above the 1350 px
  breakpoint. Smaller windows retain compact labels and a stacked layout. Compare
  equivalent viewport sizes when judging the original fullscreen presentation.
- A short fade/reveal begins when initialization finishes. It respects reduced
  motion and does not restore the original forced 8.2-second wait/typewriter sequence.

The main colour values were not globally recoloured. Matching source colours does
not guarantee identical pixels: [Tauri uses WebView2 on Windows and WKWebView on macOS](https://v2.tauri.app/reference/webview-versions/).
Font rasterization, display scale, monitor gamut, brightness and
[Windows Advanced Color/HDR handling](https://learn.microsoft.com/en-us/windows/win32/direct3darticles/high-dynamic-range)
can change perceived contrast/saturation. This machine's display settings were not
changed, and hardware is not established as the cause. No native Mac comparison,
calibrated same-display comparison or animation frame-rate benchmark was performed.

An isolated browser preview with synthetic preferences verified keyboard entry,
name-field focus, save feedback and the updated Home greeting. Home was inspected at
1100 × 720 and 800 × 600, with wide-layout geometry checked at 1600 × 900. The settled
root has opacity 1 and no transform. This does not substitute for native Mac/Windows
visual parity or native profile persistence tests.

Bundled font provenance: official [Google Fonts repository](https://github.com/google/fonts/tree/809e4d8b8d7e9364a914909bb777679606c178b8/ofl),
pinned at `809e4d8b8d7e9364a914909bb777679606c178b8`:

- `ofl/vt323/VT323-Regular.ttf`, SHA-256 `CF4DE751ADA78CEAC033DBE16A687742939995B77BC2A052AE17A4957958594D`.
- `ofl/odibeesans/OdibeeSans-Regular.ttf`, SHA-256 `4E4006C713F5509F772F64E16C8A0821AD26411A69F688C71B127568355520E8`.
- Their accompanying licenses ship as `public/fonts/VT323-OFL.txt` and
  `public/fonts/OdibeeSans-OFL.txt`.

## Repository hygiene and distribution

Removed the two tracked `.DS_Store` files. Ignore rules now cover OS metadata,
environment files and SQLite files/sidecars, while allowing placeholder-only
`.env.example` templates. Replaced the stale application README with maintained
documentation links and retained upstream attribution. Architecture source links
now point to `main`, so deleting the merged feature branch does not break them.
Personal databases, credentials, dependencies and installers are excluded from Git.
Ignored local data/build artifacts were preserved; repository history was not rewritten.
Cargo's automatic integration-test discovery is disabled because the files under
`src-tauri/tests/` are private unit-test modules included explicitly by `src/lib.rs`.
The standard `cargo test --offline --locked` command now runs all 22 native tests
successfully instead of trying to compile those files again as standalone crates.

The audit examined the then-current 458 tracked files and 1,234 historical text
blobs across 48 commits. Filename checks found no tracked environment files,
databases, installers or private-key files. Credential-pattern checks found old
example literals in agent templates but no recognizable live-token/private-key
signatures. These are bounded heuristic checks, not a security certification.
All 23 ignore-rule probes passed. The configured `@Codex-flow/cli` scanner was
unavailable from npm, so no successful scan from it is claimed.

Both repositories returned no published GitHub releases at this checkpoint. The
ARM64 and Intel/AMD x64 installers are separate local native builds of version
0.1.0, not a universal executable or published release assets. They share the same
schema/backup format. The installed ARM64 app runs without a development server;
the x64 binary's architecture is checked, with Intel/AMD hardware execution pending.
The merge preserves the source needed to rebuild them. See [project status](project-status.md)
for exact installer hashes and [the launch manual](../README.md#standalone-windows-app).

## Limits and future improvements

Notion is an explicit selected-source snapshot into Notes, not a whole-workspace
export, relational mirror or background sync. The first importer previews at most
100 recently edited rows, leaves relations as IDs and attachments as links, and
does not map properties to tasks/habits. No live account token/source was provided
for verification. Backup restore replaces the destination workspace and keeps its
previous folder; it does not merge two databases.

Further DB changes should follow actual query measurements: full-text note search,
stable tie-breakers for equal timestamps, and carefully migrated relationship
normalization remain candidates. The six current indexes improve tested query
plans; no measured whole-app speedup is claimed. Rich-text/startup chunks can be
split further. Native Windows click-through, Intel/AMD runtime and macOS/Linux
runtime verification remain explicit follow-up checks.
