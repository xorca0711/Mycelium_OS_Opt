# Mycelium customization map

Mycelium is a React/TypeScript personal workspace inside a Tauri/Rust desktop shell. Its plugins share **one SQLite file per environment**. They are modules of the same application, not separately hosted services or separate databases.

Open [the editable architecture diagram](mycelium-architecture.drawio) in diagrams.net, draw.io Desktop, or the VS Code draw.io extension. Double-click a shape to edit its text and drag it to reorganize a page. [SVG previews](previews.md) are readable on GitHub and link to source files. The [complete schema inventory](schema-inventory.md) lists every current table and column, primary keys, declared foreign keys, and delete actions; [JSON](schema-inventory.json) supports further tooling.

## Start with the behavior you want to change

For manual data entry, Notion/Obsidian import status, desktop SQLite inspection and local launch commands, see [personal data sources and connection methods](local-data-connections.md).

| Customization | Start here | Follow the data to |
|---|---|---|
| Add or reorder an app | [Plugin registry](../../O_neash%20Dash/src/plugins/registry.ts), [LaunchMenu](../../O_neash%20Dash/src/home/LaunchMenu.tsx) | [Plugin navigation state](../../O_neash%20Dash/src/store/usePluginStore.ts), [PluginBox](../../O_neash%20Dash/src/plugins/PluginBox.tsx) |
| Change startup or readiness | [main](../../O_neash%20Dash/src/main.tsx), [App](../../O_neash%20Dash/src/App.tsx) | [DB initialization bridge](../../O_neash%20Dash/src/lib/db.ts), [native initialization](../../O_neash%20Dash/src-tauri/src/database/mod.rs) |
| Change home widgets/feeds | [HomePage](../../O_neash%20Dash/src/home/HomePage.tsx), [widget registry](../../O_neash%20Dash/src/widgets/registry.ts) | [layout preferences](../../O_neash%20Dash/src/widgets/store/useWidgetStore.ts), [feed cache](../../O_neash%20Dash/src/widgets/lib/feedCache.ts) |
| Change task scheduling and grouping | [Planner store](../../O_neash%20Dash/src/plugins/PlannerPlugin/store/usePlannerStore.ts) | [plannerDb](../../O_neash%20Dash/src/plugins/PlannerPlugin/lib/plannerDb.ts), [planner schema](../../O_neash%20Dash/src-tauri/src/database/schema/planner.sql) |
| Change work/session timing | [Session store](../../O_neash%20Dash/src/plugins/PlannerPlugin/store/useSessionStore.ts) | [onTheClockDb](../../O_neash%20Dash/src/plugins/PlannerPlugin/lib/onTheClockDb.ts), `work_sessions`, `session_nodes`, `session_pauses` |
| Change document save/link behavior | [TypewriterEditor](../../O_neash%20Dash/src/plugins/NotesPlugin/components/TypewriterEditor.tsx), [FloatingEditor](../../O_neash%20Dash/src/components/FloatingEditor.tsx) | [notesDb](../../O_neash%20Dash/src/plugins/NotesPlugin/lib/notesDb.ts), `notes`, `note_links`, `note_title_aliases`, `doc_comments` |
| Change personal analytics | [Analytics hub](../../O_neash%20Dash/src/plugins/AnalyticsPlugin/views/HubView.tsx) | [waking-window rules](../../O_neash%20Dash/src/plugins/AnalyticsPlugin/panels/planner-sleep/sleepWindows.ts), [cluster math](../../O_neash%20Dash/src/plugins/AnalyticsPlugin/panels/planner-sleep/clusterMath.ts) |
| Extend academic planning | [academicDb](../../O_neash%20Dash/src/plugins/AcademicPlugin/lib/academicDb.ts), [canvasDb](../../O_neash%20Dash/src/plugins/AcademicPlugin/lib/canvasDb.ts) | Shared `projects`/`nodes`, plus `academic_*` placement tables |
| Extend wardrobe/photography | [wardrobeDb](../../O_neash%20Dash/src/plugins/WardrobePlugin/lib/wardrobeDb.ts), [filmNegDb](../../O_neash%20Dash/src/plugins/FilmNegLabPlugin/lib/filmNegDb.ts) | [collections schema](../../O_neash%20Dash/src-tauri/src/database/schema/collections.sql), [media location helper](../../O_neash%20Dash/src/lib/dataLocation.ts) |
| Add a persisted field/relation | [native migrations](../../O_neash%20Dash/src-tauri/src/database/migrations.rs) | Domain schema, TypeScript row type, read/write helper, and migration tests |

## How records become a personal operating workspace

`main → App → initialize_database → migrations → shared pool` establishes storage before plugin UI mounts. Plugin actions reach domain helpers through Zustand or component callbacks. `getDb()` uses Tauri's SQL plugin; `executeBatch()` sends related mutations to a native transaction on the same database. Results return through promises, store updates, and domain notifications. SQL views of data and UI caches are not additional databases.

Arcs organize projects and tasks; routines generate task/event occurrences; work sessions attach measured effort to task IDs. Notes attach to arcs/projects and maintain a wiki-link graph, comments, and title aliases. Academic canvases position the same planner task IDs. Habits, sleep and journal records add date-based personal history. Wardrobe and photo collections keep their own domain tables while storing media files beside the database.

The sleep/output join uses a local wake date and the interval `[wake, min(next recorded sleep, now, wake + 20 hours))`. Missing-night gaps beyond that bound are not assigned to the prior night. Numerator and denominator use the same interval. Current waking days enter after 30 minutes and remain provisional. Sleep/task queries share the same calendar cutoff and captured current time; IRF D+1 means the next calendar date, not the next available log. These are descriptive associations; labels do not establish a causal effect of sleep on output. Cluster rolling features remain based on available observations.

## Storage and constraint boundaries

- Debug builds resolve to `Documents/O-neash-data-dev/oneash-DB.db`; release builds resolve to `Documents/O-neash-data/oneash-DB.db`. The native [data-directory function](../../O_neash%20Dash/src-tauri/src/database/mod.rs) is authoritative. The `sqlite:test.db` entry in Tauri configuration is not the domain database selected by `initialize_database`.
- Media lives in `notes-images`, `journal-images`, `wardrobe-images`, and `filmneg-images` beneath the same environment data directory. SQLite stores paths or JSON references. A SQLite-only backup does not include those image files.
- Fonts, arc visibility, widget layout, weather location and quote caching use WebView `localStorage`. News/research feed caches use session memory and retain prior successful articles on refresh failures; they are not offline archives across restarts.
- Solid diagram arrows mean a foreign key declared in the **fresh-install** schema. Dashed arrows mean an application join, a temporal join, or a JSON ID list. Do not infer cascading deletion from dashed arrows.
- `session_nodes.node_id`, academic project IDs, `tendril_edges.project_id`, `filmneg_photos.camera_id`, and outfit JSON item IDs lack declared FKs. Application code maintains those relationships. `nodes.routine_id` has a fresh-schema FK, but migration 2 adds a plain column to old databases; upgraded constraints may differ.
- The migration ledger is `mycelium_schema_migrations`; there is no current `schema_version` table. Migration 4 creates `note_title_aliases`. Historical `routine_occurrences` may remain in existing databases. Legacy [noteLinks](../../O_neash%20Dash/src/plugins/PlannerPlugin/lib/noteLinks.ts) references `note_task_links`, but that table is not created by current migrations and the module has no active callers; it is not shown as an installed relation.

## Regenerate after schema changes

From `O_neash Dash`, run `node scripts/generate-architecture.mjs` with Node 24+ and installed project dependencies. The [generator](../../O_neash%20Dash/scripts/generate-architecture.mjs) executes source schema only against an in-memory SQLite database, applies additive column/table migration declarations, introspects keys, checks complete table coverage, and writes the editable diagram, SVGs, and inventories. It does not inspect personal databases or execute Rust migrations. Review the generator when a migration starts rebuilding tables or adds a new domain; constraints preserved only in historical databases are outside this source snapshot.

This map describes the local `codex/local-setup` implementation. Source links inside SVGs target the same branch in `xorca0711/Mycelium_OS_Opt`; they become available remotely when that branch is pushed. Runtime measurements, personal content, and future architecture proposals are not embedded in these artifacts.
