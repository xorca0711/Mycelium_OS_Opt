use std::collections::BTreeSet;

use sqlx::{Connection, Row, SqliteConnection};

use super::wardrobe::upgrade_wardrobe;

const CURRENT_VERSION: i64 = 4;
type ForeignKeyViolation = (String, Option<i64>, String, i64);

async fn foreign_key_violations(
    connection: &mut SqliteConnection,
) -> Result<BTreeSet<ForeignKeyViolation>, sqlx::Error> {
    Ok(sqlx::query_as("PRAGMA foreign_key_check")
        .fetch_all(connection)
        .await?
        .into_iter()
        .collect())
}

async fn add_column(
    connection: &mut SqliteConnection,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<(), sqlx::Error> {
    let columns = sqlx::query(&format!("PRAGMA table_info({table})"))
        .fetch_all(&mut *connection)
        .await?;
    if !columns.iter().any(|row| row.get::<String, _>("name") == column) {
        sqlx::query(&format!("ALTER TABLE {table} ADD COLUMN {column} {definition}"))
            .execute(connection)
            .await?;
    }
    Ok(())
}

async fn apply_version(connection: &mut SqliteConnection, version: i64) -> Result<(), sqlx::Error> {
    match version {
        1 => {
            for schema in [
                include_str!("schema/planner.sql"),
                include_str!("schema/personal.sql"),
                include_str!("schema/collections.sql"),
            ] {
                sqlx::raw_sql(schema).execute(&mut *connection).await?;
            }
        }
        2 => {
            for (table, column, definition) in [
                ("nodes", "is_routine", "INTEGER DEFAULT 0"),
                ("nodes", "routine_id", "TEXT"),
                ("habits", "value_type", "TEXT NOT NULL DEFAULT 'boolean'"),
                ("habits", "goal_type", "TEXT NOT NULL DEFAULT 'none'"),
                ("habits", "goal_value", "INTEGER"),
                ("habit_logs", "value", "REAL"),
                ("habits", "source", "TEXT NOT NULL DEFAULT 'manual'"),
                ("arcs", "description", "TEXT DEFAULT ''"),
                ("arcs", "status", "TEXT NOT NULL DEFAULT 'active'"),
                ("projects", "description", "TEXT DEFAULT ''"),
                ("projects", "status", "TEXT NOT NULL DEFAULT 'active'"),
                ("projects", "start_date", "TEXT"),
                ("projects", "end_date", "TEXT"),
                ("filmneg_photos", "camera_id", "TEXT"),
            ] {
                add_column(connection, table, column, definition).await?;
            }
            sqlx::raw_sql(
                "CREATE INDEX IF NOT EXISTS idx_nodes_routine_id ON nodes(routine_id);
                 CREATE INDEX IF NOT EXISTS idx_nodes_is_routine ON nodes(is_routine);
                 CREATE INDEX IF NOT EXISTS idx_filmneg_photos_camera ON filmneg_photos(camera_id);",
            )
            .execute(&mut *connection)
            .await?;
        }
        3 => {
            // Keep historical routine_occurrences and duplicate routine nodes intact.
            upgrade_wardrobe(connection).await?;
            sqlx::raw_sql(
                "DROP TRIGGER IF EXISTS readd_ungrouped_if_empty;
                 CREATE TRIGGER readd_ungrouped_if_empty AFTER DELETE ON node_groups
                 BEGIN
                   INSERT OR IGNORE INTO node_groups(node_id, group_id)
                   SELECT OLD.node_id, id FROM planner_groups
                   WHERE is_ungrouped = 1
                     AND EXISTS (SELECT 1 FROM nodes WHERE id = OLD.node_id)
                     AND NOT EXISTS (SELECT 1 FROM node_groups WHERE node_id = OLD.node_id);
                 END;",
            )
            .execute(&mut *connection)
            .await?;
        }
        4 => {
            sqlx::raw_sql(
                "CREATE TABLE IF NOT EXISTS note_title_aliases (
                   target_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
                   title TEXT NOT NULL,
                   PRIMARY KEY(target_id, title)
                 );
                 CREATE INDEX IF NOT EXISTS idx_note_title_aliases_title ON note_title_aliases(title);",
            )
            .execute(connection)
            .await?;
        }
        _ => return Err(sqlx::Error::Protocol(format!("Unknown migration {version}"))),
    }
    Ok(())
}

pub async fn migrate(connection: &mut SqliteConnection) -> Result<(), sqlx::Error> {
    migrate_with_failure(connection, None).await
}

// The failure injection is private to this module and native tests, never exposed over IPC.
pub(crate) async fn migrate_with_failure(
    connection: &mut SqliteConnection,
    fail_after: Option<i64>,
) -> Result<(), sqlx::Error> {
    // This dedicated connection has not entered the application pool. Disabling FKs
    // here permits SQLite's table-rebuild procedure without cascading child deletes.
    sqlx::query("PRAGMA foreign_keys = OFF").execute(&mut *connection).await?;
    let outcome = async {
        let mut transaction = connection.begin_with("BEGIN IMMEDIATE").await?;
        let result = async {
            sqlx::raw_sql(
                "CREATE TABLE IF NOT EXISTS mycelium_schema_migrations (
                   version INTEGER PRIMARY KEY,
                   applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                 );",
            )
            .execute(&mut *transaction)
            .await?;
            let versions: Vec<i64> = sqlx::query_scalar(
                "SELECT version FROM mycelium_schema_migrations ORDER BY version",
            )
            .fetch_all(&mut *transaction)
            .await?;
            if versions.iter().any(|version| *version > CURRENT_VERSION) {
                return Err(sqlx::Error::Protocol("Database was created by a newer Mycelium version".into()));
            }
            if versions.iter().enumerate().any(|(index, version)| *version != index as i64 + 1) {
                return Err(sqlx::Error::Protocol("Database migration history is inconsistent".into()));
            }
            if versions.len() == CURRENT_VERSION as usize {
                return Ok(());
            }
            let before = foreign_key_violations(&mut transaction).await?;
            for version in 1..=CURRENT_VERSION {
                if versions.contains(&version) {
                    continue;
                }
                apply_version(&mut transaction, version).await?;
                if fail_after == Some(version) {
                    return Err(sqlx::Error::Protocol("Injected migration failure".into()));
                }
                sqlx::query("INSERT INTO mycelium_schema_migrations(version) VALUES (?)")
                    .bind(version)
                    .execute(&mut *transaction)
                    .await?;
            }
            let after = foreign_key_violations(&mut transaction).await?;
            if !after.is_subset(&before) {
                return Err(sqlx::Error::Protocol("Migration introduced broken foreign-key links".into()));
            }
            Ok(())
        }
        .await;
        match result {
            Ok(()) => transaction.commit().await,
            Err(error) => {
                transaction.rollback().await?;
                Err(error)
            }
        }
    }
    .await;
    sqlx::query("PRAGMA foreign_keys = ON").execute(connection).await?;
    outcome
}
