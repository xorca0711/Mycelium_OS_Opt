# Mycelium_OS_Opt

Local setup and optimization workspace for [Mycelium](https://github.com/hanjae-Oneash823/Mycelium), imported from upstream commit `eb93cd9d5b8c34569b95fff0169ffbb0b9196244`. The application lives in `O_neash Dash/`.

## Local setup checks

On Windows, install Microsoft C++ Build Tools with the Windows SDK and the compiler matching your architecture. Windows ARM64 requires the ARM64 C++ tools, the `aarch64-pc-windows-msvc` Rust toolchain, and the **C++ Clang Compiler for Windows** component (`Microsoft.VisualStudio.Component.VC.Llvm.Clang`). Clang must be on the terminal's `PATH` for the native `ring` dependency; see its [build requirements](https://github.com/briansmith/ring/blob/main/BUILDING.md). Finish the toolchain installation before running the checks below.

Node 24 and pnpm 11.19.0 are used for this setup; pnpm is pinned in the application manifest. WebView2 is required for the desktop application. Open a new terminal after installing Rust so `cargo` is available.

For the default Visual Studio 2022 Build Tools installation on ARM64, add `C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\Llvm\ARM64\bin` to your user `PATH`, then open a new terminal and verify `clang --version`. Adjust the path if you use another Visual Studio edition or installation directory.

Run from `O_neash Dash/`:

```powershell
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
cargo test --locked --manifest-path .\src-tauri\Cargo.toml --lib database_tests
cargo check --locked --manifest-path .\src-tauri\Cargo.toml
pnpm tauri info
```

The checked-in pnpm build policy permits only esbuild's required install script. These checks build/inspect the code using isolated test databases. Run `pnpm tauri dev` to launch the desktop app in a normal, resizable 1100 × 720 window. It starts Vite on port 1420 and the native executable; no database server is required. Keep that terminal running during development.

See the [verified project status](docs/project-status.md), [architecture diagram gallery](docs/architecture/previews.md), [editable draw.io file](docs/architecture/mycelium-architecture.drawio), [customization map](docs/architecture/customization-map.md), and [local database/data-source guide](docs/architecture/local-data-connections.md).

**Stage 6:** Open **Settings → Personal** to edit your name/avatar, home clock timezone, supported regional formats, Planner week start, daily availability, focus/break preferences, modules, feeds and Analytics sources. Save applies preferences and preserves a SQLite revision history. The same screen exposes sleep targets, weather-location clearing, links to goal editors and the local storage path. Import/backup tools and an installer remain later steps.

## Everyday launch on Windows

After the initial native build, double-click [Launch-Mycelium.cmd](O_neash%20Dash/scripts/Launch-Mycelium.cmd) in File Explorer. It starts Vite in the background and opens the existing native executable. It works without pnpm or Rust on your terminal PATH for daily launches; Node.js, installed project dependencies and the built executable are required. Closing the brief launcher terminal does not stop the app. Errors stay visible in that terminal; server logs are under `O_neash Dash/build/launcher/`.

From the **repository root**, PowerShell:

```powershell
& '.\O_neash Dash\scripts\Launch-Mycelium.cmd'
```

Git Bash:

```bash
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'O_neash Dash/scripts/start-mycelium.ps1'
```

The launcher reuses its server when called again. After closing all Mycelium windows, stop that server with the same command followed by `-StopServer`. A server already started by `pnpm tauri dev` must be stopped in its own terminal before using this launcher.

The debug executable at `O_neash Dash/src-tauri/target/debug/Mycelium.exe` needs Vite on port 1420. Use the launcher for normal reopening. After native Rust/configuration changes, use `pnpm tauri dev` from `O_neash Dash` to rebuild; keep that development terminal open. The quick launcher does not rebuild Rust or install dependencies. A standalone `.exe`/installer without Vite remains stage 7.

## Returning Home and basic controls

| Action | Existing control |
|---|---|
| Return to Home from a module | Move the pointer to the far-left edge of the app's client area, around its vertical middle, then click **HOMEPAGE** in the slide-out menu |
| Switch modules | Use that same left-edge menu, or return Home and choose an app |
| Navigate the Home launcher | Left/Right changes categories; Up/Down changes the selected app; Enter opens it; visible category numbers also work |
| Leave a floating note | Use **← back**, close it, or click its backdrop; pending note saves are flushed first |
| Open Planner command palette | Ctrl+K on Windows (Cmd+K on macOS), while Planner is active |
| Change personal preferences | Settings → Personal → Save personal settings |

There is currently **no global Home keyboard shortcut**. Escape closes certain dialogs/quick-action panels; it is not a universal Home/back action. Home launcher shortcuts do not run while editing text or when a floating editor is open. Number keys inside Settings/Notes/Sleep can switch that module's internal tabs instead. Save or discard personal-settings drafts before navigating to another module.

## Upstream overview
<div align="center">
<img width="70%" alt="image" src="https://github.com/user-attachments/assets/629719a4-f7f5-432b-aeb6-db5b4c9140ec" />
</div>

> A personal operating system. Local-first, terminal-aesthetic, built for people who think in systems.

Mycelium is a native desktop application built on Tauri and React. It replaces the scattered constellation of productivity apps, note-taking tools, trackers, and planners with a single, unified environment that lives entirely on your machine. No subscriptions. No sync accounts. No cloud. One SQLite file.
<div align="center">
  <img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/30873263-1a3a-42b4-8ab2-efbf7f7a0353" />
  <img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/e5e21150-d640-49b3-8cf6-e6ee16b6dec2" />
  <img width="1920" height="1080" alt="image" src="https://github.com/user-attachments/assets/cefad80a-d667-4899-9022-75a9610918a2" />

</div>

---

## Philosophy

### 1. Everything is local
Personal records live in a local SQLite database. Development builds use `Documents/O-neash-data-dev/oneash-DB.db`; release builds use `Documents/O-neash-data/oneash-DB.db`. Images are separate files under the same environment directory, and appearance/layout preferences use WebView localStorage. Weather, news, research feeds, and geocoding make external requests. There is no built-in Notion or Obsidian synchronization.

### 2. Structure before speed
Most productivity apps optimize for fast capture and abandon structure. Mycelium inverts this. Work is organized into a three-tier hierarchy:

```
Arcs  →  Projects  →  Nodes
```

**Arcs** are long-horizon goals — semester plans, research initiatives, career bets. **Projects** are bounded work units under an arc. **Nodes** are individual tasks or events. This hierarchy isn't bureaucracy; it's the map that makes the territory legible. When you know which arc a task belongs to, you know *why* you're doing it.

### 3. Time is multidimensional
A task has several time coordinates: when you plan to work on it (`planned_start_at`), when it is due (`due_at`), expected effort (`estimated_duration_minutes`), and completion time (`actual_completed_at`). Recorded effort is accumulated from `session_nodes.total_minutes` across sessions, including incomplete work carried forward. The current task schema has no `actual_duration_minutes` column.

### 4. Visual weight encodes meaning
In the planner's dot view, **a node is a circle**. Its size encodes effort. Its color encodes urgency — computed from importance level and deadline proximity, not manually set. The goal is a view where the shape of your workload is immediately visible without reading a word.

| Color | Meaning |
|---|---|
| Teal `#00c4a7` | Task — low urgency |
| Green `#4ade80` | Task — important, not urgent |
| Amber `#f5c842` | Assignment — deadline approaching |
| Orange `#ff6b35` | Assignment — important, deadline close |
| Red `#ff3b3b` | Overdue |

### 5. The aesthetic is intentional
Mycelium uses a strict monospace design language: VT323 and HBIOS-SYS fonts, sharp corners, high-contrast dark backgrounds, amber and teal accents. This is not nostalgia. Terminal aesthetics communicate density and precision. They signal that this is a tool for working, not a dashboard for feeling productive about productivity.

### 6. Modules, not monoliths
Each feature is an isolated plugin. The home screen is a launcher that switches between plugins. Plugins share a database but own their own schema tables, state, and UI. Adding a new capability means adding a new plugin — not touching the core.

---

## Who It's For

Mycelium is designed for **one specific type of person**: someone juggling multiple long-horizon projects simultaneously — academic, creative, and professional — who needs a single environment to plan, track, and understand all of them.

Concretely: graduate students, researchers, independent creatives, and knowledge workers who:

- Work across multiple concurrent projects with different deadlines and rhythms
- Keep notes and documentation alongside their planning, not in a separate app
- Prefer explicit structure over "just write it down anywhere"
- Are comfortable with (or attracted to) dense, information-rich interfaces
- Want to own their data

Mycelium is **not** for casual to-do use. The Arc → Project → Node structure has intentional friction — it asks you to categorize before you capture. If you want a quick inbox, use a notepad. Mycelium is for the phase after that: when you have enough work that you need to understand it at a systems level.

---

## Features

### BASIC
| Plugin | Description |
|---|---|
| **Planner** | Core task and project management. Today view with drag-and-drop scheduling, Eisenhower matrix, routine management, On The Clock focus timer with session tracking |
| **Notes** | Rich-text document editor with wiki-link backlinks, inline comments, note groups, and KaTeX math support |
| **Arcs & Projects** | Top-level goal management — arc timelines, project grouping, completion tracking |
| **Journal** | Daily log entries with image attachment support |

### The Lab
| Plugin | Description |
|---|---|
| **Academic Planner** | Subject-scoped planning with a canvas view — a day-band timeline where task nodes drag between dates, support for dependency edges, multi-canvas overview, weekly completion analytics |
| **L'ESRA** | Encyclopedia of Relative and Absolute knowledge — a personal knowledge base with bookshelf, search, entries, articles, and a force-directed network view of concept relationships |

### The Clinic
| Plugin | Description |
|---|---|
| **Habits** | Daily and weekly habit tracking with streak analytics and goal logging |
| **Sleep Tracker** | Sleep entry logging with configurable targets and historical analysis |

### The Studio
| Plugin | Description |
|---|---|
| **Geo Portal** | Location-based travel log and bucket list with MapLibre GL map visualization |

### Home Widgets
The home screen hosts configurable widgets: daily task summary, day/night arc, sleep-last-night readout, recent documents, pressure gauge, and a set of cellular automata simulations (Conway's Life, Brian's Brain, Langton's Ant, Wireworld, CodiCA).

---

## Architecture

### Overview

```
┌──────────────────────────────────────────────────────┐
│                    Tauri Shell (Rust)                 │
│  - Window management                                 │
│  - File system access                                │
│  - SQLite via tauri-plugin-sql                       │
│  - PDF export via WebKit/AppKit (macOS)              │
└───────────────────┬──────────────────────────────────┘
                    │  IPC bridge
┌───────────────────▼──────────────────────────────────┐
│               React Frontend (TypeScript)            │
│                                                      │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Plugin     │  │  Home /      │  │  Always-    │ │
│  │  System     │  │  LaunchMenu  │  │  Visible    │ │
│  └──────┬──────┘  └──────────────┘  │  Layer      │ │
│         │                           └─────────────┘ │
│  ┌──────▼──────────────────────────────────────────┐ │
│  │               Plugins                           │ │
│  │  Planner │ Notes │ Journal │ Academic │ ESRA    │ │
│  │  Habits  │ Sleep │ Geo     │ Projects │ ...     │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  ┌──────────────────────────────────────────────────┐ │
│  │           Shared DB Layer (src/lib/db.ts)        │ │
│  │  SQLite schema migration on startup              │ │
│  │  getDb() singleton — typed select/execute        │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### Directory Structure

```
O_neash Dash/
├── src/
│   ├── always-visible/        # Persistent UI layer (AOT elements, navigator)
│   ├── components/ui/         # Shared Radix-based primitives
│   ├── home/                  # LaunchMenu, HomePage, category definitions
│   ├── lib/
│   │   ├── db.ts              # SQLite bridge and native transaction API
│   │   └── personalSettingsDb.ts # Profile validation/persistence and revisions
│   ├── plugins/
│   │   ├── AcademicPlugin/
│   │   ├── ClockPlugin/
│   │   ├── ESRAPlugin/
│   │   ├── GeoPortalViewPlugin/
│   │   ├── HabitsPlugin/
│   │   ├── JournalPlugin/
│   │   ├── NotesPlugin/
│   │   ├── PlannerPlugin/
│   │   ├── ProjectsPlugin/
│   │   ├── SettingsPlugin/
│   │   ├── SleepTrackerPlugin/
│   │   └── registry.ts        # Plugin manifest
│   ├── store/                 # Global Zustand stores (plugin, widget state)
│   ├── types/                 # Shared TypeScript interfaces
│   └── widgets/               # Home screen widget components
├── src-tauri/
│   ├── src/
│   │   ├── main.rs            # Tauri entry point
│   │   ├── lib.rs             # Plugin setup and IPC registration
│   │   └── database/          # Native initialization, v1–v5 migrations and schema
│   ├── Cargo.toml             # Rust dependencies
│   └── tauri.conf.json        # App config (window, permissions, SQL)
```

### Database

Domain records and personal settings share one SQLite file per environment. The Rust database module runs versioned migrations before the frontend obtains the shared pool. The current fresh schema has 48 tables and 43 declared foreign keys; media files and WebView appearance/layout settings have separate storage. See the [schema inventory](docs/architecture/schema-inventory.md) for exact columns and constraints.

Key tables:

| Table | Owns |
|---|---|
| `arcs` | Long-horizon goal containers |
| `projects` | Work units under arcs |
| `nodes` | Tasks and events (the universal work unit) |
| `sub_tasks` | Checklist items within nodes |
| `tendril_edges` | Dependency graph between nodes |
| `routines / routine_rules` | Recurring task definitions |
| `notes / note_links` | Rich documents with backlinks |
| `planner_groups / node_groups` | Many-to-many node tagging |
| `habits / habit_logs` | Habit definitions and daily completions |
| `sleep_entries` | Sleep session records |
| `academic_subjects` | Projects designated as academic subjects |
| `academic_canvases` | Per-subject planning canvases |
| `academic_canvas_nodes` | Node placements on canvas (day, x_slot) |
| `academic_canvas_edges` | Dependency arrows on canvas |
| `work_sessions / productivity_logs` | On The Clock focus sessions |
| `journal_entries` | Daily log records |
| `personal_settings / personal_settings_history` | Current personal profile/preferences and atomic revision snapshots |

### State Management

Each plugin manages its own state. The Planner uses two Zustand stores:

- `usePlannerStore` — node/arc/project data and all DB mutations
- `useViewStore` — UI state (active view, open forms, edit context)

Global stores:

- `usePluginStore` — which plugin is currently active
- `useWidgetStore` — home widget configuration
- `usePersonalSettingsStore` — validated profile/preferences, readiness and serialized saves

### Frontend Stack

| Concern | Library |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite 7 |
| Styling | Tailwind CSS + inline styles |
| Primitives | Radix UI (dialog, select, popover, checkbox, slider) |
| Animations | Framer Motion |
| State | Zustand |
| Charts | Recharts |
| Rich text | Tiptap with KaTeX, highlight, code blocks, tasks |
| Maps | MapLibre GL + react-map-gl + PMTiles |
| Graph/canvas | XYFlow (React Flow) |
| Drag-and-drop | dnd-kit + custom mouse-event implementations |
| Icons | Pixelarticons |
| Toasts | Sonner |

### Backend (Tauri / Rust)

The Rust layer is intentionally thin. It handles:

- **Window management** — resizable single window with native title bar
- **SQLite** — via `tauri-plugin-sql`, configured to load the database at a user-specific path
- **File system** — separate native-selected development/release data directories
- **Schema and transactions** — versioned migrations, shared SQLite pool and atomic write batches
- **PDF export** — macOS-only: uses `objc2-app-kit` and `objc2-web-kit` to print a `WKWebView` to PDF

The frontend owns scheduling, editing and analytics logic. Rust owns storage initialization, schema upgrades and related-write transactions.

### Plugin Structure

Each plugin follows a consistent pattern:

```
PluginName/
├── PluginName.tsx         # Root component, data loading, top-level state
├── PluginName.css         # Plugin-scoped styles
├── lib/
│   └── pluginDb.ts        # All SQL queries for this plugin
├── store/
│   └── usePluginStore.ts  # Zustand store (if needed)
├── components/            # Shared sub-components
├── views/                 # Full-page view components
└── types.ts               # Plugin-local TypeScript types
```

---

## Running Locally

**Prerequisites:** Node.js ≥ 20, Rust (stable), pnpm

```bash
# Install dependencies
pnpm install

# Development (hot reload)
pnpm tauri dev

# Production build
pnpm tauri build
```

The app opens in a resizable 1100 × 720 window (minimum 800 × 600). The database is created automatically: development uses `Documents/O-neash-data-dev/oneash-DB.db`; packaged release uses `Documents/O-neash-data/oneash-DB.db`. No SQLite server is needed.

---

## Roadmap

### Phase 1 — Core ✓
Planner, Notes, Journal, Arcs & Projects. The foundational loop: capture → organize → review.

### Phase 2 — Knowledge & Study ✓ / in progress
Academic Planner with canvas view and multi-subject tracking. L'ESRA knowledge base with network view. These form the "lab" — tools for structured learning and research.

### Phase 3 — Health & Routine ✓ / in progress
Habits tracker, Sleep Tracker. The clinic modules: understanding the physical inputs that affect cognitive output.

### Phase 4 — Studio (next)
- **Film Neg Lab** — photo archive and analog film log
- **Open Canvas** — freeform moodboard / inspiration board
- **Geo Portal** — expand travel log with richer entry types and offline maps

### Phase 5 — Lab Extensions (planned)
- **Protocol Manager** — experimental protocol archive for structured research workflows
- **Paper Library** — academic paper database with RSS feed ingestion and citation management
- **Diet Log** — meal planning and nutritional tracking

### Phase 6 — System Layer (planned)
- **System Resource Monitor** — embedded system stats panel
- Inter-plugin cross-references (link a note to a node, link a journal entry to a project)
- Import/export to standard formats (Markdown, CSV, iCal)
- Configurable widget layout with drag-to-reorder

---

## Name

The name comes from the biological structure that inspired the app's architecture: mycelium — the underground fungal network that connects and feeds individual organisms without centralizing control. Each plugin is an organism. The shared database is the network. Nothing is in the cloud because the network is local, by design.
