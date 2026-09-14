# SQLite schema inventory

Generated from source schema and additive migrations through version 6. **51 tables including the migration ledger, one SQLite file.** Internal SQLite tables (for example sqlite_sequence) are excluded. No personal database was inspected.

Fresh-install constraints are shown. Existing databases retain historical columns/tables; adding an old missing column does not recreate fresh-schema foreign keys. `routine_occurrences` is preserved when present, but not created by the current schema. `note_task_links` is referenced by legacy planner code but is not declared by the current schema; its existence and constraints are not assumed. The version ledger is `mycelium_schema_migrations`, not a `schema_version` table.

## academic_canvas_edges

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| canvas_id | TEXT | PK(1); FK → academic_canvases.id / DELETE CASCADE | NOT NULL | — |
| from_node_id | TEXT | PK(2); FK → nodes.id / DELETE CASCADE | NOT NULL | — |
| to_node_id | TEXT | PK(3); FK → nodes.id / DELETE CASCADE | NOT NULL | — |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_ace_canvas | canvas_id | Secondary | — |
| sqlite_autoindex_academic_canvas_edges_1 | canvas_id, from_node_id, to_node_id | Primary key | — |

## academic_canvas_nodes

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| canvas_id | TEXT | PK(1); FK → academic_canvases.id / DELETE CASCADE | NOT NULL | — |
| node_id | TEXT | PK(2); FK → nodes.id / DELETE CASCADE | NOT NULL | — |
| day | TEXT |  | NOT NULL | — |
| x_slot | INTEGER |  | — | 0 |
| is_deadline | INTEGER |  | — | 0 |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_acn_canvas | canvas_id | Secondary | — |
| sqlite_autoindex_academic_canvas_nodes_1 | canvas_id, node_id | Primary key | — |

## academic_canvases

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| project_id | TEXT |  | NOT NULL | — |
| name | TEXT |  | NOT NULL | — |
| created_at | TEXT |  | — | datetime('now') |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_ac_project | project_id | Secondary | — |
| sqlite_autoindex_academic_canvases_1 | id | Primary key | — |

## academic_subjects

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| project_id | TEXT | PK(1) | — | — |
| sort_order | INTEGER |  | — | 0 |
| created_at | TEXT |  | — | datetime('now') |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| sqlite_autoindex_academic_subjects_1 | project_id | Primary key | — |

## arcs

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| name | TEXT |  | NOT NULL | — |
| color_hex | TEXT |  | — | '#00c4a7' |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |
| description | TEXT |  | — | '' |
| status | TEXT |  | NOT NULL | 'active' |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| sqlite_autoindex_arcs_1 | id | Primary key | — |

## dispatch_locations

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| name | TEXT |  | NOT NULL | — |
| color | TEXT |  | NOT NULL | '#666666' |
| created_at | TEXT |  | — | datetime('now') |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| sqlite_autoindex_dispatch_locations_1 | id | Primary key | — |

## dispatch_node_placements

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| work_block_id | TEXT | FK → dispatch_work_blocks.id / DELETE CASCADE | NOT NULL | — |
| node_id | TEXT | FK → nodes.id / DELETE CASCADE | NOT NULL | — |
| start_offset | INTEGER |  | NOT NULL | 0 |
| duration_override | INTEGER |  | — | — |
| created_at | TEXT |  | — | datetime('now') |
| updated_at | TEXT |  | — | datetime('now') |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_dispatch_np_node | node_id | Secondary | — |
| idx_dispatch_np_block | work_block_id | Secondary | — |
| sqlite_autoindex_dispatch_node_placements_1 | id | Primary key | — |

## dispatch_work_blocks

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| date | TEXT |  | NOT NULL | — |
| start_time | INTEGER |  | NOT NULL | — |
| end_time | INTEGER |  | NOT NULL | — |
| location_id | TEXT | FK → dispatch_locations.id / DELETE SET NULL | — | — |
| created_at | TEXT |  | — | datetime('now') |
| updated_at | TEXT |  | — | datetime('now') |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_dispatch_wb_date | date | Secondary | — |
| sqlite_autoindex_dispatch_work_blocks_1 | id | Primary key | — |

## doc_comments

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| doc_id | TEXT | FK → notes.id / DELETE CASCADE | NOT NULL | — |
| mark_id | TEXT |  | NOT NULL | — |
| body | TEXT |  | NOT NULL | — |
| resolved | INTEGER |  | — | 0 |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_comments_doc | doc_id | Secondary | — |
| sqlite_autoindex_doc_comments_1 | id | Primary key | — |

## filmneg_cameras

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| name | TEXT |  | NOT NULL | — |
| type | TEXT |  | NOT NULL | 'digital' |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_filmneg_cameras_type | type | Secondary | — |
| sqlite_autoindex_filmneg_cameras_1 | id | Primary key | — |

## filmneg_photo_tags

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| photo_id | TEXT | PK(1); FK → filmneg_photos.id / DELETE CASCADE | NOT NULL | — |
| tag_id | TEXT | PK(2); FK → filmneg_tags.id / DELETE CASCADE | NOT NULL | — |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_filmneg_pt_tag | tag_id | Secondary | — |
| idx_filmneg_pt_photo | photo_id | Secondary | — |
| sqlite_autoindex_filmneg_photo_tags_1 | photo_id, tag_id | Primary key | — |

## filmneg_photos

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

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

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_filmneg_photos_camera | camera_id | Secondary | — |
| idx_filmneg_photos_geo | lat, lng | Secondary | — |
| idx_filmneg_photos_favorite | is_favorite | Secondary | — |
| idx_filmneg_photos_taken | taken_at | Secondary | — |
| sqlite_autoindex_filmneg_photos_1 | id | Primary key | — |

## filmneg_tags

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| name | TEXT |  | NOT NULL | — |
| color | TEXT |  | NOT NULL | '#64c8ff' |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| sqlite_autoindex_filmneg_tags_2 | name | Unique | — |
| sqlite_autoindex_filmneg_tags_1 | id | Primary key | — |

## filmneg_trail_photos

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| trail_id | TEXT | PK(1); FK → filmneg_trails.id / DELETE CASCADE | NOT NULL | — |
| photo_id | TEXT | PK(2); FK → filmneg_photos.id / DELETE CASCADE | NOT NULL | — |
| sort_order | INTEGER |  | NOT NULL | 0 |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_filmneg_tp_photo | photo_id | Secondary | — |
| idx_filmneg_tp_trail | trail_id, sort_order | Secondary | — |
| sqlite_autoindex_filmneg_trail_photos_1 | trail_id, photo_id | Primary key | — |

## filmneg_trails

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| name | TEXT |  | NOT NULL | — |
| description | TEXT |  | — | — |
| color | TEXT |  | NOT NULL | '#e8a94f' |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| sqlite_autoindex_filmneg_trails_1 | id | Primary key | — |

## habit_logs

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| habit_id | TEXT | FK → habits.id / DELETE CASCADE | NOT NULL | — |
| date | TEXT |  | NOT NULL | — |
| created_at | TEXT |  | — | datetime('now') |
| value | REAL |  | — | — |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_habit_logs_date | date | Secondary | — |
| idx_habit_logs_habit | habit_id | Secondary | — |
| sqlite_autoindex_habit_logs_2 | habit_id, date | Unique | — |
| sqlite_autoindex_habit_logs_1 | id | Primary key | — |

## habits

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

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

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| sqlite_autoindex_habits_1 | id | Primary key | — |

## import_records

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/data.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| source_id | TEXT | PK(1); FK → import_sources.id / DELETE RESTRICT | NOT NULL | — |
| external_id | TEXT | PK(2) | NOT NULL | — |
| note_id | TEXT | FK → notes.id / DELETE SET NULL | — | — |
| content_hash | TEXT |  | NOT NULL | — |
| source_updated_at | TEXT |  | — | — |
| imported_at | TEXT |  | NOT NULL | CURRENT_TIMESTAMP |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_import_records_note | note_id | Secondary | — |
| sqlite_autoindex_import_records_1 | source_id, external_id | Primary key | — |

## import_runs

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/data.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | NOT NULL | — |
| source_id | TEXT | FK → import_sources.id / DELETE RESTRICT | NOT NULL | — |
| started_at | TEXT |  | NOT NULL | CURRENT_TIMESTAMP |
| completed_at | TEXT |  | — | — |
| created_count | INTEGER |  | NOT NULL | 0 |
| updated_count | INTEGER |  | NOT NULL | 0 |
| skipped_count | INTEGER |  | NOT NULL | 0 |
| status | TEXT |  | NOT NULL | 'running' |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_import_runs_source_started | source_id, started_at | Secondary | — |
| sqlite_autoindex_import_runs_1 | id | Primary key | — |

## import_sources

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/data.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | NOT NULL | — |
| kind | TEXT |  | NOT NULL | — |
| source_id | TEXT |  | NOT NULL | — |
| label | TEXT |  | NOT NULL | '' |
| created_at | TEXT |  | NOT NULL | CURRENT_TIMESTAMP |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| sqlite_autoindex_import_sources_2 | kind, source_id | Unique | — |
| sqlite_autoindex_import_sources_1 | id | Primary key | — |

## journal_entries

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| date | TEXT |  | NOT NULL | — |
| content | TEXT |  | NOT NULL | '' |
| images | TEXT |  | NOT NULL | '[]' |
| created_at | TEXT |  | — | datetime('now') |
| updated_at | TEXT |  | — | datetime('now') |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_journal_date | date | Secondary | — |
| sqlite_autoindex_journal_entries_2 | date | Unique | — |
| sqlite_autoindex_journal_entries_1 | id | Primary key | — |

## mycelium_schema_migrations

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/migrations.rs)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| version | INTEGER | PK(1) | — | — |
| applied_at | TEXT |  | NOT NULL | CURRENT_TIMESTAMP |

## node_groups

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| node_id | TEXT | PK(1); FK → nodes.id / DELETE CASCADE | NOT NULL | — |
| group_id | TEXT | PK(2); FK → planner_groups.id / DELETE CASCADE | NOT NULL | — |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_ng_group | group_id | Secondary | — |
| idx_ng_node | node_id | Secondary | — |
| sqlite_autoindex_node_groups_1 | node_id, group_id | Primary key | — |

## nodes

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

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

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_nodes_is_routine | is_routine | Secondary | — |
| idx_nodes_routine_id | routine_id | Secondary | — |
| idx_nodes_overdue | is_overdue | Secondary | — |
| idx_nodes_completed | is_completed | Secondary | — |
| idx_nodes_planned | planned_start_at | Secondary | — |
| idx_nodes_due | due_at | Secondary | — |
| idx_nodes_arc | arc_id | Secondary | — |
| idx_nodes_project | project_id | Secondary | — |
| sqlite_autoindex_nodes_1 | id | Primary key | — |

## note_groups

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| note_id | TEXT | PK(1); FK → notes.id / DELETE CASCADE | NOT NULL | — |
| group_id | TEXT | PK(2); FK → planner_groups.id / DELETE CASCADE | NOT NULL | — |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_note_groups_group | group_id | Secondary | — |
| idx_ng_note | note_id | Secondary | — |
| sqlite_autoindex_note_groups_1 | note_id, group_id | Primary key | — |

## note_links

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| source_id | TEXT | PK(1); FK → notes.id / DELETE CASCADE | NOT NULL | — |
| target_id | TEXT | PK(2); FK → notes.id / DELETE CASCADE | NOT NULL | — |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_links_target | target_id | Secondary | — |
| sqlite_autoindex_note_links_1 | source_id, target_id | Primary key | — |

## note_title_aliases

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/migrations.rs)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| target_id | TEXT | PK(1); FK → notes.id / DELETE CASCADE | NOT NULL | — |
| title | TEXT | PK(2) | NOT NULL | — |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_note_title_aliases_title | title | Secondary | — |
| sqlite_autoindex_note_title_aliases_1 | target_id, title | Primary key | — |

## notes

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

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

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_notes_status_order | status, pinned, updated_at | Secondary | — |
| idx_notes_type_status_order | note_type, status, pinned, updated_at | Secondary | — |
| idx_notes_project | project_id | Secondary | — |
| idx_notes_arc | arc_id | Secondary | — |
| idx_notes_status | note_type, status | Secondary | — |
| idx_notes_type | note_type | Secondary | — |
| sqlite_autoindex_notes_1 | id | Primary key | — |

## personal_settings

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/settings.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| revision | INTEGER |  | NOT NULL | — |
| schema_version | INTEGER |  | NOT NULL | — |
| settings_json | TEXT |  | NOT NULL | — |
| saved_at | TEXT |  | NOT NULL | — |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| sqlite_autoindex_personal_settings_1 | id | Primary key | — |

## personal_settings_history

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/settings.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| revision | INTEGER | PK(1) | — | — |
| schema_version | INTEGER |  | NOT NULL | — |
| settings_json | TEXT |  | NOT NULL | — |
| saved_at | TEXT |  | NOT NULL | — |

## planner_groups

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| name | TEXT |  | NOT NULL | — |
| color_hex | TEXT |  | — | '#64c8ff' |
| sort_order | INTEGER |  | — | 0 |
| is_ungrouped | BOOLEAN |  | — | 0 |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| sqlite_autoindex_planner_groups_1 | id | Primary key | — |

## productivity_logs

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| node_id | TEXT | FK → nodes.id / DELETE SET NULL | — | — |
| completed_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |
| duration_actual | INTEGER |  | — | — |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_productivity_logs_node | node_id | Secondary | — |
| sqlite_autoindex_productivity_logs_1 | id | Primary key | — |

## projects

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

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

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_projects_arc | arc_id | Secondary | — |
| sqlite_autoindex_projects_1 | id | Primary key | — |

## routine_groups

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| routine_id | TEXT | PK(1); FK → routines.id / DELETE CASCADE | NOT NULL | — |
| group_id | TEXT | PK(2); FK → planner_groups.id / DELETE CASCADE | NOT NULL | — |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_rg_group | group_id | Secondary | — |
| idx_rg_routine | routine_id | Secondary | — |
| sqlite_autoindex_routine_groups_1 | routine_id, group_id | Primary key | — |

## routine_rules

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

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

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_routine_rules_routine | routine_id | Secondary | — |
| sqlite_autoindex_routine_rules_1 | id | Primary key | — |

## routines

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

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

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_routines_project | project_id | Secondary | — |
| idx_routines_arc | arc_id | Secondary | — |
| sqlite_autoindex_routines_1 | id | Primary key | — |

## session_nodes

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| session_id | TEXT | PK(1); FK → work_sessions.id / DELETE CASCADE | NOT NULL | — |
| node_id | TEXT | PK(2) | NOT NULL | — |
| sort_order | INTEGER |  | NOT NULL | 0 |
| status | TEXT |  | NOT NULL | 'queued' |
| time_started | TEXT |  | — | — |
| time_finished | TEXT |  | — | — |
| total_minutes | REAL |  | — | — |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_session_nodes_effort | node_id, total_minutes | Secondary | total_minutes > 0 |
| idx_sn_session | session_id | Secondary | — |
| sqlite_autoindex_session_nodes_1 | session_id, node_id | Primary key | — |

## session_pauses

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| session_id | TEXT | FK → work_sessions.id / DELETE CASCADE | NOT NULL | — |
| paused_at | TEXT |  | NOT NULL | — |
| resumed_at | TEXT |  | — | — |
| pause_type | TEXT |  | NOT NULL | 'manual' |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_sp_session | session_id | Secondary | — |
| sqlite_autoindex_session_pauses_1 | id | Primary key | — |

## session_pomo_blocks

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| session_id | TEXT | FK → work_sessions.id / DELETE CASCADE | NOT NULL | — |
| started_at | TEXT |  | NOT NULL | — |
| ended_at | TEXT |  | — | — |
| block_type | TEXT |  | NOT NULL | — |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_spb_session | session_id | Secondary | — |
| sqlite_autoindex_session_pomo_blocks_1 | id | Primary key | — |

## sleep_entries

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | INTEGER | PK(1) | — | — |
| date | TEXT |  | NOT NULL | — |
| sleep_start | TEXT |  | NOT NULL | — |
| wake_time | TEXT |  | NOT NULL | — |
| is_nap | INTEGER |  | — | 0 |
| notes | TEXT |  | — | — |
| created_at | TEXT |  | — | datetime('now') |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_sleep_entries_start | sleep_start | Secondary | — |
| idx_sleep_entries_date | date | Secondary | — |

## sleep_targets

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | INTEGER | PK(1) | — | — |
| target_sleep_start | TEXT |  | NOT NULL | — |
| target_duration | REAL |  | NOT NULL | — |
| set_at | TEXT |  | — | datetime('now') |

## sub_tasks

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| node_id | TEXT | FK → nodes.id / DELETE CASCADE | NOT NULL | — |
| title | TEXT |  | NOT NULL | — |
| is_completed | BOOLEAN |  | — | 0 |
| sort_order | INTEGER |  | — | 0 |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_subtasks_node | node_id | Secondary | — |
| sqlite_autoindex_sub_tasks_1 | id | Primary key | — |

## tendril_edges

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| project_id | TEXT |  | NOT NULL | — |
| source_id | TEXT | FK → nodes.id / DELETE CASCADE | NOT NULL | — |
| target_id | TEXT | FK → nodes.id / DELETE CASCADE | NOT NULL | — |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_te_project | project_id | Secondary | — |
| sqlite_autoindex_tendril_edges_1 | id | Primary key | — |

## user_capacity

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/planner.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | 'default' |
| daily_minutes | INTEGER |  | — | 480 |
| peak_start | TEXT |  | — | '09:00' |
| peak_end | TEXT |  | — | '12:00' |
| updated_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| sqlite_autoindex_user_capacity_1 | id | Primary key | — |

## wardrobe_items

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

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

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_wardrobe_items_status | status | Secondary | — |
| idx_wardrobe_items_type | item_type | Secondary | — |
| sqlite_autoindex_wardrobe_items_1 | id | Primary key | — |

## wardrobe_ootd_logs

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| date | TEXT |  | NOT NULL | — |
| item_ids | TEXT |  | NOT NULL | '[]' |
| note | TEXT |  | — | — |
| photo_path | TEXT |  | — | — |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_wardrobe_ootd_date | date | Secondary | — |
| sqlite_autoindex_wardrobe_ootd_logs_2 | date | Unique | — |
| sqlite_autoindex_wardrobe_ootd_logs_1 | id | Primary key | — |

## wardrobe_wiki_entries

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

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

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_wardrobe_wiki_category | category | Secondary | — |
| sqlite_autoindex_wardrobe_wiki_entries_1 | id | Primary key | — |

## wardrobe_wiki_gallery_images

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| entry_id | TEXT | FK → wardrobe_wiki_entries.id / DELETE CASCADE | NOT NULL | — |
| image_path | TEXT |  | NOT NULL | — |
| note | TEXT |  | — | — |
| sort_order | INTEGER |  | — | 0 |
| created_at | TIMESTAMP |  | — | CURRENT_TIMESTAMP |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_wardrobe_gallery_entry | entry_id | Secondary | — |
| sqlite_autoindex_wardrobe_wiki_gallery_images_1 | id | Primary key | — |

## wardrobe_wiki_links

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/collections.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| source_id | TEXT | PK(1); FK → wardrobe_wiki_entries.id / DELETE CASCADE | NOT NULL | — |
| target_id | TEXT | PK(2); FK → wardrobe_wiki_entries.id / DELETE CASCADE | NOT NULL | — |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_wardrobe_wiki_links_target | target_id | Secondary | — |
| sqlite_autoindex_wardrobe_wiki_links_1 | source_id, target_id | Primary key | — |

## work_locations

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

| Column | SQLite type | Key | Required | Default |
|---|---|---|---|---|
| id | TEXT | PK(1) | — | — |
| name | TEXT |  | NOT NULL | — |
| created_at | TEXT |  | — | datetime('now') |

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| sqlite_autoindex_work_locations_2 | name | Unique | — |
| sqlite_autoindex_work_locations_1 | id | Primary key | — |

## work_sessions

[Schema source](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/src-tauri/src/database/schema/personal.sql)

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

| Index | Columns | Kind | Partial predicate |
|---|---|---|---|
| idx_ws_date_created | planned_date, created_at | Secondary | — |
| idx_ws_date | planned_date | Secondary | — |
| idx_ws_status | status | Secondary | — |
| sqlite_autoindex_work_sessions_1 | id | Primary key | — |

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

## Migration 6 query-index evidence

[Source-extracted SQLite tests](https://github.com/xorca0711/Mycelium_OS_Opt/blob/main/O_neash%20Dash/tests/dataIndexes.test.mjs) compare plans and results against 2,000 synthetic records per main fixture table. These are query-plan observations, not measured application speedups. Existing indexes remain intact.

| Added index | Existing query / observed plan change |
|---|---|
| idx_notes_type_status_order | Typed active-note list: removes temporary ORDER BY sort |
| idx_notes_status_order | All active notes: scan plus sort becomes status index search |
| idx_ws_date_created | Session history: removes temporary sort of the second ORDER BY term |
| idx_session_nodes_effort | Positive effort aggregate: covering partial-index scan removes GROUP BY sort |
| idx_productivity_logs_node | Uncomplete task log deletion: scan becomes node-ID search |
| idx_note_groups_group | Group deletion FK lookup: note_groups scan becomes group-ID search; fixes the old index-name collision |

Equal timestamps have no explicit ID tie-breaker in current note/session queries; their relative order remains unspecified. Timestamp-expression indexes and foreign-key rebuilds were deferred.
