# Project status

Updated: 2026-09-09. Working branch: `codex/local-setup`.

## Verified baseline — steps 1–3 complete

Commit `30808848abb2dd650e064ae6917a1984842fb544` imports upstream Mycelium
`eb93cd9d5b8c34569b95fff0169ffbb0b9196244` while preserving both repositories' history.
The application root is `O_neash Dash/`.

Windows ARM64 prerequisites are installed: Rust/Cargo, MSVC Build Tools, Windows SDK,
Clang, and WebView2. Node 24.18.0 and pnpm 11.19.0 are available.

Passed at the baseline: frozen pnpm install, TypeScript checks, Vite production build,
locked native Cargo check, and Tauri environment validation. The baseline has a large
frontend bundle warning and had not been launched.

## Current work — steps 4–5 in progress

| Area | Current state | Completion evidence still required |
|---|---|---|
| Development storage | Separate native-selected database and media directory being implemented | Native launch uses development directory; restart preserves samples |
| Database reliability | Versioned migrations and native atomic batch API being implemented | Legacy upgrade, repeat migration, rollback and foreign-key tests |
| Notes | Shared document state, serialized autosave, stable links and Windows PDF availability being implemented | Concurrent save/link tests and both editor workflows |
| Planner and analytics | Batched hydration, targeted refresh, accumulated session time and date-window fixes being implemented | Query, duration, rollback and boundary tests |
| Startup and feeds | Readiness-based splash, lazy plugins, hidden-widget unmounting and feed cache implemented locally | Final integrated build/native checks; five isolated cache tests already pass |
| Customization diagrams | Architecture and joined-table diagrams requested | Source-linked diagrams generated and checked against final schema |

The implementation work above is not yet an accepted build. This checkpoint records
progress; the preceding baseline commit remains the last fully verified code snapshot.
Development samples must stay separate from personal data and outside Git.

## Next verification

1. Finish targeted regression tests and integrate the changes.
2. Run TypeScript, frontend build, and native checks.
3. Launch with `pnpm tauri dev` and verify arc/project/task/session/note/sleep/habit
   workflows, Korean text, images, settings, offline behavior and restart persistence.
4. Update this file with observed results and push the verified implementation.

Personal-profile settings are step 6. Windows installer packaging is step 7. Personal
history import and backup/restore are step 8. These have not been performed.

## Running locally

After steps 4–5, use `pnpm tauri dev` from `O_neash Dash/`. It starts Vite and launches
the native development executable. A standalone Windows installer and Start-menu
launcher are produced during step 7; macOS uses an application bundle/DMG instead.
