use serde_json::json;
use sqlx::{Connection, Row, SqliteConnection};

use crate::database::{data_directory, migrations, write_batch, SqlStatement};

async fn memory_connection() -> SqliteConnection {
    SqliteConnection::connect("sqlite::memory:").await.unwrap()
}

async fn legacy_database() -> SqliteConnection {
    let mut connection = memory_connection().await;
    for schema in [
        include_str!("../src/database/schema/planner.sql").to_owned(),
        include_str!("../src/database/schema/personal.sql").to_owned(),
        include_str!("../src/database/schema/collections.sql").replace(
            "category      TEXT NOT NULL,",
            "category TEXT NOT NULL CHECK ( category IN ('look','creator','brand','genre')),
             custom_field TEXT,",
        ),
    ] {
        sqlx::raw_sql(&schema).execute(&mut connection).await.unwrap();
    }
    sqlx::raw_sql(
        "INSERT INTO arcs(id,name) VALUES ('a','Personal');
         INSERT INTO projects(id,arc_id,name) VALUES ('p','a','A project');
         INSERT INTO routines(id,title,arc_id,project_id) VALUES ('r','Routine','a','p');
         INSERT INTO nodes(id,title,project_id,routine_id,is_routine,planned_start_at)
         VALUES ('n1','First','p','r',1,'2026-09-10T10:00:00'),
                ('n2','Second','p','r',1,'2026-09-10T12:00:00');
         INSERT INTO sub_tasks(id,node_id,title) VALUES ('sub','n2','Preserve me');
         INSERT INTO productivity_logs(id,node_id,duration_actual) VALUES ('log','n2',35);
         CREATE TABLE routine_occurrences(id TEXT PRIMARY KEY,node_id TEXT REFERENCES nodes(id));
         INSERT INTO routine_occurrences VALUES ('occ','n2');
         INSERT INTO notes(id,note_type,title,project_id) VALUES ('doc','document','Personal note','p');
         INSERT INTO work_sessions(id,title,planned_date) VALUES ('session','Work','2026-09-10');
         INSERT INTO session_nodes(session_id,node_id,total_minutes) VALUES ('session','n2',35);
         INSERT INTO habits(id,name) VALUES ('habit','Walk');
         INSERT INTO habit_logs(id,habit_id,date) VALUES ('habit-log','habit','2026-09-10');
         INSERT INTO wardrobe_wiki_entries(id,category,title,custom_field)
         VALUES ('w1','look','Look','extra information'),('w2','creator','Designer','keep this too');
         INSERT INTO wardrobe_wiki_links(source_id,target_id) VALUES ('w1','w2');
         INSERT INTO wardrobe_wiki_gallery_images(id,entry_id,image_path)
         VALUES ('image','w1','sample-image.png');
         CREATE INDEX custom_wardrobe_title ON wardrobe_wiki_entries(title);",
    ).execute(&mut connection).await.unwrap();
    connection
}

async fn count(connection: &mut SqliteConnection, table: &str) -> i64 {
    sqlx::query_scalar(&format!("SELECT COUNT(*) FROM {table}"))
        .fetch_one(connection).await.unwrap()
}

#[test]
fn fresh_database_has_versioned_schema_and_enforces_foreign_keys() {
    tauri::async_runtime::block_on(async {
        let mut connection = memory_connection().await;
        migrations::migrate(&mut connection).await.unwrap();
        assert_eq!(count(&mut connection, "mycelium_schema_migrations").await, 5);
        let columns = sqlx::query("PRAGMA table_info(habits)").fetch_all(&mut connection).await.unwrap();
        assert!(columns.iter().any(|column| column.get::<String, _>("name") == "source"));
        assert!(sqlx::query("INSERT INTO note_title_aliases VALUES ('missing','Title')")
            .execute(&mut connection).await.is_err());
        let foreign_keys: i64 = sqlx::query_scalar("PRAGMA foreign_keys").fetch_one(&mut connection).await.unwrap();
        assert_eq!(foreign_keys, 1);
    });
}

#[test]
fn legacy_upgrade_and_repeat_preserve_records_relationships_and_extra_columns() {
    tauri::async_runtime::block_on(async {
        let mut connection = legacy_database().await;
        for _ in 0..2 {
            migrations::migrate(&mut connection).await.unwrap();
            for (table, expected) in [
                ("nodes", 2), ("sub_tasks", 1), ("productivity_logs", 1),
                ("routine_occurrences", 1), ("session_nodes", 1), ("notes", 1),
                ("wardrobe_wiki_entries", 2), ("wardrobe_wiki_links", 1),
                ("wardrobe_wiki_gallery_images", 1), ("habit_logs", 1),
            ] { assert_eq!(count(&mut connection, table).await, expected, "{table}"); }
            let entries: Vec<(String, String)> = sqlx::query_as(
                "SELECT category,custom_field FROM wardrobe_wiki_entries ORDER BY id",
            ).fetch_all(&mut connection).await.unwrap();
            assert_eq!(entries, vec![("genre".into(),"extra information".into()),("brand".into(),"keep this too".into())]);
            let indexes: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name='custom_wardrobe_title'",
            ).fetch_one(&mut connection).await.unwrap();
            assert_eq!(indexes, 1);
            let violations = sqlx::query("PRAGMA foreign_key_check").fetch_all(&mut connection).await.unwrap();
            assert!(violations.is_empty());
        }
        sqlx::query("INSERT INTO wardrobe_wiki_entries(id,category,title) VALUES ('w3','new-category','Free category')")
            .execute(&mut connection).await.unwrap();
        sqlx::query("DELETE FROM nodes WHERE id='n2'").execute(&mut connection).await.unwrap_err();
        // The retained historical occurrence still protects its linked task.
        assert_eq!(count(&mut connection, "nodes").await, 2);
    });
}

#[test]
fn migration_failure_rolls_back_schema_data_and_version_records() {
    tauri::async_runtime::block_on(async {
        let mut connection = legacy_database().await;
        assert!(migrations::migrate_with_failure(&mut connection, Some(3)).await.is_err());
        let metadata: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM sqlite_master WHERE name='mycelium_schema_migrations'",
        ).fetch_one(&mut connection).await.unwrap();
        assert_eq!(metadata, 0);
        let category: String = sqlx::query_scalar("SELECT category FROM wardrobe_wiki_entries WHERE id='w1'")
            .fetch_one(&mut connection).await.unwrap();
        assert_eq!(category, "look");
        assert_eq!(count(&mut connection, "wardrobe_wiki_links").await, 1);
        assert_eq!(count(&mut connection, "wardrobe_wiki_gallery_images").await, 1);
        let foreign_keys: i64 = sqlx::query_scalar("PRAGMA foreign_keys").fetch_one(&mut connection).await.unwrap();
        assert_eq!(foreign_keys, 1);
        migrations::migrate(&mut connection).await.unwrap();
        assert_eq!(count(&mut connection, "mycelium_schema_migrations").await, 5);
    });
}

#[test]
fn deleting_task_cascades_without_recreating_an_orphan_group() {
    tauri::async_runtime::block_on(async {
        let mut connection = memory_connection().await;
        migrations::migrate(&mut connection).await.unwrap();
        sqlx::query("INSERT INTO nodes(id,title) VALUES ('delete-me','Task')")
            .execute(&mut connection).await.unwrap();
        assert_eq!(count(&mut connection, "node_groups").await, 1);
        sqlx::query("DELETE FROM nodes WHERE id='delete-me'").execute(&mut connection).await.unwrap();
        assert_eq!(count(&mut connection, "node_groups").await, 0);
    });
}

#[test]
fn legacy_tasks_without_routine_columns_keep_their_values() {
    tauri::async_runtime::block_on(async {
        let mut connection = memory_connection().await;
        let schema = include_str!("../src/database/schema/planner.sql")
            .replace("\r\n", "\n")
            .replace("    is_routine                  INTEGER DEFAULT 0,\n", "")
            .replace("    routine_id                  TEXT,\n", "")
            .replace(",\n    FOREIGN KEY(routine_id)     REFERENCES routines(id)  ON DELETE SET NULL", "");
        sqlx::raw_sql(&schema).execute(&mut connection).await.unwrap();
        sqlx::query("INSERT INTO nodes(id,title,estimated_duration_minutes) VALUES ('legacy','Old task',45)")
            .execute(&mut connection).await.unwrap();
        migrations::migrate(&mut connection).await.unwrap();
        let task: (String, i64, i64, Option<String>) = sqlx::query_as(
            "SELECT title,estimated_duration_minutes,is_routine,routine_id FROM nodes WHERE id='legacy'",
        ).fetch_one(&mut connection).await.unwrap();
        assert_eq!(task, ("Old task".into(),45,0,None));
    });
}

#[test]
fn batch_writes_commit_together_and_rollback_when_a_later_statement_fails() {
    tauri::async_runtime::block_on(async {
        let pool = sqlx::sqlite::SqlitePoolOptions::new().max_connections(2)
            .connect("sqlite::memory:").await.unwrap();
        sqlx::raw_sql("CREATE TABLE parent(id TEXT PRIMARY KEY,value INTEGER);
                       CREATE TABLE child(id TEXT PRIMARY KEY,parent_id TEXT REFERENCES parent(id));")
            .execute(&pool).await.unwrap();
        let successful = [
            SqlStatement { sql: "INSERT INTO parent VALUES (?,?)".into(), values: vec![json!("p"),json!(1)] },
            SqlStatement { sql: "INSERT INTO child VALUES (?,?)".into(), values: vec![json!("c"),json!("p")] },
        ];
        let results = write_batch(&pool, &successful).await.unwrap();
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].rows_affected, 1);
        let failing = [
            SqlStatement { sql: "UPDATE parent SET value=? WHERE id=?".into(), values: vec![json!(99),json!("p")] },
            SqlStatement { sql: "INSERT INTO child VALUES (?,?)".into(), values: vec![json!("invalid"),json!("missing")] },
        ];
        assert!(write_batch(&pool, &failing).await.is_err());
        let value: i64 = sqlx::query_scalar("SELECT value FROM parent WHERE id='p'").fetch_one(&pool).await.unwrap();
        assert_eq!(value, 1);
        assert!(write_batch(&pool, &[SqlStatement { sql: "COMMIT".into(), values: vec![] }]).await.is_err());
        assert!(write_batch(&pool, &[SqlStatement {
            sql: "UPDATE parent SET value=2; COMMIT".into(), values: vec![],
        }]).await.is_err());
        pool.close().await;
    });
}

#[test]
fn development_and_release_directories_are_distinct() {
    let documents = std::path::Path::new("example-documents");
    assert_eq!(data_directory(documents, false), documents.join("O-neash-data"));
    assert_eq!(data_directory(documents, true), documents.join("O-neash-data-dev"));
}

#[test]
fn settings_v5_upgrade_is_atomic_and_repeated_migrations_preserve_revisions() {
    tauri::async_runtime::block_on(async {
        let mut connection = memory_connection().await;
        migrations::migrate(&mut connection).await.unwrap();
        // Reconstruct the exact v4 schema, with existing capacity and a linked task.
        sqlx::raw_sql("DROP TABLE personal_settings; DROP TABLE personal_settings_history;
            DELETE FROM mycelium_schema_migrations WHERE version=5;
            UPDATE user_capacity SET daily_minutes=345,peak_start='10:00' WHERE id='default';
            INSERT INTO nodes(id,title) VALUES ('keep','Existing task');")
            .execute(&mut connection).await.unwrap();
        assert!(migrations::migrate_with_failure(&mut connection, Some(5)).await.is_err());
        assert_eq!(count(&mut connection, "mycelium_schema_migrations").await, 4);
        let tables: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE name LIKE 'personal_settings%'")
            .fetch_one(&mut connection).await.unwrap();
        assert_eq!(tables, 0);
        migrations::migrate(&mut connection).await.unwrap();
        assert_eq!(count(&mut connection, "personal_settings").await, 0);
        let capacity: (i64, String) = sqlx::query_as("SELECT daily_minutes,peak_start FROM user_capacity WHERE id='default'")
            .fetch_one(&mut connection).await.unwrap();
        assert_eq!(capacity, (345, "10:00".into()));
        let document = json!({"schemaVersion": 1, "displayName": "Keep this revision"}).to_string();
        sqlx::query("INSERT INTO personal_settings VALUES ('current',1,1,?,'2026-09-09')")
            .bind(&document).execute(&mut connection).await.unwrap();
        sqlx::query("INSERT INTO personal_settings_history SELECT revision,schema_version,settings_json,saved_at FROM personal_settings")
            .execute(&mut connection).await.unwrap();
        for _ in 0..2 { migrations::migrate(&mut connection).await.unwrap(); }
        assert_eq!(count(&mut connection, "mycelium_schema_migrations").await, 5);
        assert_eq!(count(&mut connection, "nodes").await, 1);
        assert_eq!(count(&mut connection, "node_groups").await, 1);
        for table in ["personal_settings", "personal_settings_history"] {
            assert_eq!(count(&mut connection, table).await, 1);
            let saved: String = sqlx::query_scalar(&format!("SELECT settings_json FROM {table}"))
                .fetch_one(&mut connection).await.unwrap();
            assert_eq!(saved, document);
        }
    });
}
