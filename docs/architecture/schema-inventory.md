# SQLite schema inventory

Generated from source schema and additive migrations through version 5. **48 application tables, one SQLite file.** Internal SQLite tables (for example sqlite_sequence) are excluded. No personal database was inspected.

Fresh-install constraints are shown. Existing databases retain historical columns/tables; adding an old missing column does not recreate fresh-schema foreign keys. `routine_occurrences` is preserved when present, but not created by the current schema. `note_task_links` is referenced by legacy planner code but is not declared by the current schema; its existence and constraints are not assumed. The version ledger is `mycelium_schema_migrations`, not a `schema_version` table.

## academic_canvas_edges

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| canvas_id | TEXT | PK(1); FK → academic_canvases.id / DELETE CASCADE | NOT NULL | — |
| from_node_id | TEXT | PK(2); FK → nodes.id / DELETE CASCADE | NOT NULL | — |
| to_node_id | TEXT | PK(3); FK → nodes.id / DELETE CASCADE | NOT NULL | — |

## academic_canvas_nodes

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| canvas_id | TEXT | PK(1); FK → academic_canvases.id / DELETE CASCADE | NOT NULL | — |
| node_id | TEXT | PK(2); FK → nodes.id / DELETE CASCADE | NOT NULL | — |
| day | TEXT |  | NOT NULL | — |
| x_slot | INTEGER |  | — | 0 |
| is_deadline | INTEGER |  | — | 0 |

## academic_canvases

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| project_id | TEXT |  | NOT NULL | — |
| name | TEXT |  | NOT NULL | — |
| created_at | TEXT |  | — | datetime('now') |

## academic_subjects

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| project_id | TEXT | PK(1) | — | — |
| sort_order | INTEGER |  | — | 0 |
| created_at | TEXT |  | — | datetime('now') |

## arcs

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| name | TEXT |  | NOT NULL | — |
| color_hex | TEXT |  | — | '#00c4a7' |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |
| description | TEXT |  | — | '' |
| status | TEXT |  | NOT NULL | 'active' |

## dispatch_locations

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| name | TEXT |  | NOT NULL | — |
| color | TEXT |  | NOT NULL | '#666666' |
| created_at | TEXT |  | — | datetime('now') |

## dispatch_node_placements

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| work_block_id | TEXT | FK → dispatch_work_blocks.id / DELETE CASCADE | NOT NULL | — |
| node_id | TEXT | FK → nodes.id / DELETE CASCADE | NOT NULL | — |
| start_offset | INTEGER |  | NOT NULL | 0 |
| duration_override | INTEGER |  | — | — |
| created_at | TEXT |  | — | datetime('now') |
| updated_at | TEXT |  | — | datetime('now') |

## dispatch_work_blocks

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| date | TEXT |  | NOT NULL | — |
| start_time | INTEGER |  | NOT NULL | — |
| end_time | INTEGER |  | NOT NULL | — |
| location_id | TEXT | FK → dispatch_locations.id / DELETE SET NULL | — | — |
| created_at | TEXT |  | — | datetime('now') |
| updated_at | TEXT |  | — | datetime('now') |

## doc_comments

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| doc_id | TEXT | FK → notes.id / DELETE CASCADE | NOT NULL | — |
| mark_id | TEXT |  | NOT NULL | — |
| body | TEXT |  | NOT NULL | — |
| resolved | INTEGER |  | — | 0 |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

## filmneg_cameras

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| name | TEXT |  | NOT NULL | — |
| type | TEXT |  | NOT NULL | 'digital' |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

## filmneg_photo_tags

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| photo_id | TEXT | PK(1); FK → filmneg_photos.id / DELETE CASCADE | NOT NULL | — |
| tag_id | TEXT | PK(2); FK → filmneg_tags.id / DELETE CASCADE | NOT NULL | — |

## filmneg_photos

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| title | TEXT |  | — | — |
| image_path | TEXT |  | NOT NULL | — |
| notes | TEXT |  | — | — |
| taken_at | TEXT |  | — | — |
| camera | TEXT |  | — | — |
| film_stock | TEXT |  | — | — |
| lat | REAL |  | — | — |
| lng | REAL |  | — | — |
| location_name | TEXT |  | — | — |
| is_favorite | BOOLEAN |  | NOT NULL | 0 |
| rating | INTEGER |  | — | — |
| width | INTEGER |  | — | — |
| height | INTEGER |  | — | — |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |
| camera_id | TEXT |  | — | — |

## filmneg_tags

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| name | TEXT |  | NOT NULL | — |
| color | TEXT |  | NOT NULL | '#64c8ff' |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

## filmneg_trail_photos

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| trail_id | TEXT | PK(1); FK → filmneg_trails.id / DELETE CASCADE | NOT NULL | — |
| photo_id | TEXT | PK(2); FK → filmneg_photos.id / DELETE CASCADE | NOT NULL | — |
| sort_order | INTEGER |  | NOT NULL | 0 |

## filmneg_trails

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| name | TEXT |  | NOT NULL | — |
| description | TEXT |  | — | — |
| color | TEXT |  | NOT NULL | '#e8a94f' |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

## habit_logs

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| habit_id | TEXT | FK → habits.id / DELETE CASCADE | NOT NULL | — |
| date | TEXT |  | NOT NULL | — |
| created_at | TEXT |  | — | datetime('now') |
| value | REAL |  | — | — |

## habits

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| name | TEXT |  | NOT NULL | — |
| color | TEXT |  | NOT NULL | '#4a8c6e' |
| type | TEXT |  | NOT NULL | 'daily' |
| times_per_week | INTEGER |  | — | — |
| sort_order | INTEGER |  | NOT NULL | 0 |
| created_at | TEXT |  | — | datetime('now') |
| archived_at | TEXT |  | — | — |
| value_type | TEXT |  | NOT NULL | 'boolean' |
| goal_type | TEXT |  | NOT NULL | 'none' |
| goal_value | INTEGER |  | — | — |
| source | TEXT |  | NOT NULL | 'manual' |

## journal_entries

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| date | TEXT |  | NOT NULL | — |
| content | TEXT |  | NOT NULL | '' |
| images | TEXT |  | NOT NULL | '[]' |
| created_at | TEXT |  | — | datetime('now') |
| updated_at | TEXT |  | — | datetime('now') |

## mycelium_schema_migrations

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/migrations.rs)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| version | INTEGER | PK(1) | — | — |
| applied_at | TEXT |  | NOT NULL | CURRENT_TIMESTAMP |

## node_groups

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| node_id | TEXT | PK(1); FK → nodes.id / DELETE CASCADE | NOT NULL | — |
| group_id | TEXT | PK(2); FK → planner_groups.id / DELETE CASCADE | NOT NULL | — |

## nodes

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| project_id | TEXT | FK → projects.id / DELETE SET NULL | — | — |
| arc_id | TEXT | FK → arcs.id / DELETE SET NULL | — | — |
| title | TEXT |  | NOT NULL | — |
| node_type | TEXT |  | NOT NULL | 'task' |
| planned_start_at | DATETIME |  | — | — |
| due_at | DATETIME |  | — | — |
| actual_completed_at | DATETIME |  | — | — |
| estimated_duration_minutes | INTEGER |  | — | — |
| importance_level | INTEGER |  | NOT NULL | 0 |
| computed_urgency_level | INTEGER |  | NOT NULL | 0 |
| is_completed | BOOLEAN |  | — | 0 |
| is_locked | BOOLEAN |  | — | 0 |
| is_overdue | BOOLEAN |  | — | 0 |
| is_pinned | BOOLEAN |  | — | 0 |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |
| is_routine | INTEGER |  | — | 0 |
| routine_id | TEXT | FK → routines.id / DELETE SET NULL | — | — |

## note_groups

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| note_id | TEXT | PK(1); FK → notes.id / DELETE CASCADE | NOT NULL | — |
| group_id | TEXT | PK(2); FK → planner_groups.id / DELETE CASCADE | NOT NULL | — |

## note_links

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| source_id | TEXT | PK(1); FK → notes.id / DELETE CASCADE | NOT NULL | — |
| target_id | TEXT | PK(2); FK → notes.id / DELETE CASCADE | NOT NULL | — |

## note_title_aliases

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/migrations.rs)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| target_id | TEXT | PK(1); FK → notes.id / DELETE CASCADE | NOT NULL | — |
| title | TEXT | PK(2) | NOT NULL | — |

## notes

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| note_type | TEXT |  | NOT NULL | 'memo' |
| title | TEXT |  | — | — |
| content_plain | TEXT |  | — | — |
| content_json | TEXT |  | — | — |
| status | TEXT |  | NOT NULL | 'active' |
| arc_id | TEXT | FK → arcs.id / DELETE SET NULL | — | — |
| project_id | TEXT | FK → projects.id / DELETE SET NULL | — | — |
| pinned | BOOLEAN |  | NOT NULL | 0 |
| color_hex | TEXT |  | — | — |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

## personal_settings

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/settings.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| revision | INTEGER |  | NOT NULL | — |
| schema_version | INTEGER |  | NOT NULL | — |
| settings_json | TEXT |  | NOT NULL | — |
| saved_at | TEXT |  | NOT NULL | — |

## personal_settings_history

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/settings.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| revision | INTEGER | PK(1) | — | — |
| schema_version | INTEGER |  | NOT NULL | — |
| settings_json | TEXT |  | NOT NULL | — |
| saved_at | TEXT |  | NOT NULL | — |

## planner_groups

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| name | TEXT |  | NOT NULL | — |
| color_hex | TEXT |  | — | '#64c8ff' |
| sort_order | INTEGER |  | — | 0 |
| is_ungrouped | BOOLEAN |  | — | 0 |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

## productivity_logs

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| node_id | TEXT | FK → nodes.id / DELETE SET NULL | — | — |
| completed_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |
| duration_actual | INTEGER |  | — | — |

## projects

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| arc_id | TEXT | FK → arcs.id / DELETE SET NULL | — | — |
| name | TEXT |  | NOT NULL | — |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |
| description | TEXT |  | — | '' |
| status | TEXT |  | NOT NULL | 'active' |
| start_date | TEXT |  | — | — |
| end_date | TEXT |  | — | — |

## routine_groups

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| routine_id | TEXT | PK(1); FK → routines.id / DELETE CASCADE | NOT NULL | — |
| group_id | TEXT | PK(2); FK → planner_groups.id / DELETE CASCADE | NOT NULL | — |

## routine_rules

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| routine_id | TEXT | FK → routines.id / DELETE CASCADE | NOT NULL | — |
| sort_order | INTEGER |  | — | 0 |
| freq | TEXT |  | NOT NULL | 'weekly' |
| repeat_interval | INTEGER |  | NOT NULL | 1 |
| days | TEXT |  | — | — |
| start_date | TEXT |  | NOT NULL | — |
| end_mode | TEXT |  | NOT NULL | 'count' |
| end_count | INTEGER |  | — | — |
| end_date | TEXT |  | — | — |
| start_time | TEXT |  | — | — |
| duration_minutes | INTEGER |  | — | — |
| exceptions | TEXT |  | — | — |

## routines

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| title | TEXT |  | NOT NULL | — |
| node_type | TEXT |  | NOT NULL | 'task' |
| arc_id | TEXT | FK → arcs.id / DELETE SET NULL | — | — |
| project_id | TEXT | FK → projects.id / DELETE SET NULL | — | — |
| importance_level | INTEGER |  | NOT NULL | 0 |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

## session_nodes

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| session_id | TEXT | PK(1); FK → work_sessions.id / DELETE CASCADE | NOT NULL | — |
| node_id | TEXT | PK(2) | NOT NULL | — |
| sort_order | INTEGER |  | NOT NULL | 0 |
| status | TEXT |  | NOT NULL | 'queued' |
| time_started | TEXT |  | — | — |
| time_finished | TEXT |  | — | — |
| total_minutes | REAL |  | — | — |

## session_pauses

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| session_id | TEXT | FK → work_sessions.id / DELETE CASCADE | NOT NULL | — |
| paused_at | TEXT |  | NOT NULL | — |
| resumed_at | TEXT |  | — | — |
| pause_type | TEXT |  | NOT NULL | 'manual' |

## session_pomo_blocks

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| session_id | TEXT | FK → work_sessions.id / DELETE CASCADE | NOT NULL | — |
| started_at | TEXT |  | NOT NULL | — |
| ended_at | TEXT |  | — | — |
| block_type | TEXT |  | NOT NULL | — |

## sleep_entries

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | INTEGER | PK(1) | — | — |
| date | TEXT |  | NOT NULL | — |
| sleep_start | TEXT |  | NOT NULL | — |
| wake_time | TEXT |  | NOT NULL | — |
| is_nap | INTEGER |  | — | 0 |
| notes | TEXT |  | — | — |
| created_at | TEXT |  | — | datetime('now') |

## sleep_targets

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | INTEGER | PK(1) | — | — |
| target_sleep_start | TEXT |  | NOT NULL | — |
| target_duration | REAL |  | NOT NULL | — |
| set_at | TEXT |  | — | datetime('now') |

## sub_tasks

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| node_id | TEXT | FK → nodes.id / DELETE CASCADE | NOT NULL | — |
| title | TEXT |  | NOT NULL | — |
| is_completed | BOOLEAN |  | — | 0 |
| sort_order | INTEGER |  | — | 0 |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

## tendril_edges

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| project_id | TEXT |  | NOT NULL | — |
| source_id | TEXT | FK → nodes.id / DELETE CASCADE | NOT NULL | — |
| target_id | TEXT | FK → nodes.id / DELETE CASCADE | NOT NULL | — |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

## user_capacity

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | 'default' |
| daily_minutes | INTEGER |  | — | 480 |
| peak_start | TEXT |  | — | '09:00' |
| peak_end | TEXT |  | — | '12:00' |
| updated_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

## wardrobe_items

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| name | TEXT |  | NOT NULL | — |
| item_type | TEXT |  | NOT NULL | — |
| brand | TEXT |  | — | — |
| purchase_date | TEXT |  | — | — |
| image_path | TEXT |  | — | — |
| sizing_json | TEXT |  | — | — |
| status | TEXT |  | NOT NULL | 'active' |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

## wardrobe_ootd_logs

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| date | TEXT |  | NOT NULL | — |
| item_ids | TEXT |  | NOT NULL | '[]' |
| note | TEXT |  | — | — |
| photo_path | TEXT |  | — | — |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

## wardrobe_wiki_entries

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| category | TEXT |  | NOT NULL | — |
| title | TEXT |  | NOT NULL | — |
| content_plain | TEXT |  | — | — |
| content_json | TEXT |  | — | — |
| cover_image | TEXT |  | — | — |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

## wardrobe_wiki_gallery_images

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| entry_id | TEXT | FK → wardrobe_wiki_entries.id / DELETE CASCADE | NOT NULL | — |
| image_path | TEXT |  | NOT NULL | — |
| note | TEXT |  | — | — |
| sort_order | INTEGER |  | — | 0 |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

## wardrobe_wiki_links

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| source_id | TEXT | PK(1); FK → wardrobe_wiki_entries.id / DELETE CASCADE | NOT NULL | — |
| target_id | TEXT | PK(2); FK → wardrobe_wiki_entries.id / DELETE CASCADE | NOT NULL | — |

## work_locations

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| name | TEXT |  | NOT NULL | — |
| created_at | TEXT |  | — | datetime('now') |

## work_sessions

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/codex/local-setup/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| title | TEXT |  | NOT NULL | — |
| location_id | TEXT | FK → work_locations.id / DELETE SET NULL | — | — |
| planned_date | TEXT |  | NOT NULL | — |
| actual_start | TEXT |  | — | — |
| actual_end | TEXT |  | — | — |
| status | TEXT |  | NOT NULL | 'planned' |
| created_at | TEXT |  | — | datetime('now') |

## Logical joins (not foreign keys)

| From | To | Enforcement |
|---|---|---|
| personal_settings.revision | personal_settings_history.revision | Application / JSON convention |
| tendril_edges.project_id | projects.id | Application / JSON convention |
| session_nodes.node_id | nodes.id | Application / JSON convention |
| academic_subjects.project_id | projects.id | Application / JSON convention |
| academic_canvases.project_id | projects.id | Application / JSON convention |
| wardrobe_ootd_logs.item_ids JSON[] | wardrobe_items.id | Application / JSON convention |
| filmneg_photos.camera_id | filmneg_cameras.id | Application / JSON convention |

Sleep/output analytics joins `sleep_entries.wake_time` to `nodes.actual_completed_at` using bounded local-calendar waking windows; task effort joins `session_nodes.node_id` and sums session minutes. These are not cross-database joins.
