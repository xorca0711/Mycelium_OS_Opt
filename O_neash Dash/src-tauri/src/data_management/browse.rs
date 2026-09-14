use std::{fs::{self, OpenOptions}, io::{BufWriter, Write}, path::Path};
use serde::Serialize;
use serde_json::{Value, json};
use sqlx::{Connection, Row, SqliteConnection, TypeInfo, ValueRef};
use super::{backup, files::{DATABASE, checked_directory, token}};

const TABLES: &[&str] = &[
    "arcs", "projects", "planner_groups", "nodes", "node_groups", "sub_tasks", "productivity_logs", "user_capacity", "tendril_edges",
    "routines", "routine_rules", "routine_groups", "routine_occurrences", "notes", "note_groups", "doc_comments", "note_links", "note_title_aliases",
    "sleep_entries", "sleep_targets", "dispatch_locations", "dispatch_work_blocks", "dispatch_node_placements", "habits", "habit_logs", "journal_entries",
    "academic_subjects", "academic_canvases", "academic_canvas_nodes", "academic_canvas_edges", "work_locations", "work_sessions", "session_nodes", "session_pauses", "session_pomo_blocks",
    "wardrobe_wiki_entries", "wardrobe_wiki_links", "wardrobe_wiki_gallery_images", "wardrobe_items", "wardrobe_ootd_logs",
    "filmneg_photos", "filmneg_tags", "filmneg_photo_tags", "filmneg_trails", "filmneg_trail_photos", "filmneg_cameras",
    "personal_settings", "personal_settings_history", "mycelium_schema_migrations", "import_sources", "import_records", "import_runs",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TableInfo { pub name: String, pub rows: i64 }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Overview { pub schema_version: i64, pub database_bytes: u64, pub integrity: Vec<String>, pub foreign_key_violations: usize, pub tables: Vec<TableInfo> }
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TablePage { pub columns: Vec<String>, pub rows: Vec<Vec<Value>>, pub total: i64, pub offset: i64, pub limit: i64 }
#[derive(Serialize)]
pub struct ExportResult { pub path: String, pub rows: i64 }

async fn table_exists(db: &mut SqliteConnection, table: &str) -> Result<(), String> {
    if !TABLES.contains(&table) { return Err("This table is not available in the data browser".into()); }
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?")
        .bind(table).fetch_one(db).await.map_err(|e| e.to_string())?;
    if count != 1 { return Err("Table does not exist in this database".into()); } Ok(())
}

pub async fn overview(data: &Path) -> Result<Overview, String> {
    let path = checked_directory(data)?.join(DATABASE); let mut db = backup::connection(&path, true).await?;
    let result = async {
        let schema_version = backup::schema_version(&mut db).await?;
        let integrity = sqlx::query_scalar("PRAGMA integrity_check").fetch_all(&mut db).await.map_err(|e| e.to_string())?;
        let foreign_key_violations = sqlx::query("PRAGMA foreign_key_check").fetch_all(&mut db).await.map_err(|e| e.to_string())?.len();
        let names: Vec<String> = sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .fetch_all(&mut db).await.map_err(|e| e.to_string())?;
        let mut tables = Vec::new();
        for name in names.into_iter().filter(|name| TABLES.contains(&name.as_str())) {
            let rows = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM \"{name}\"" )).fetch_one(&mut db).await.map_err(|e| e.to_string())?;
            tables.push(TableInfo { name, rows });
        }
        Ok(Overview { schema_version, database_bytes: fs::metadata(path).map_err(|e| e.to_string())?.len(), integrity, foreign_key_violations, tables })
    }.await;
    db.close().await.map_err(|e| e.to_string())?; result
}

async fn page(db: &mut SqliteConnection, table: &str, offset: i64, limit: i64) -> Result<TablePage, String> {
    table_exists(db, table).await?;
    let columns: Vec<String> = sqlx::query(&format!("PRAGMA table_info(\"{table}\")")).fetch_all(&mut *db).await.map_err(|e| e.to_string())?
        .iter().map(|row| row.get("name")).collect();
    let total = sqlx::query_scalar(&format!("SELECT COUNT(*) FROM \"{table}\"" )).fetch_one(&mut *db).await.map_err(|e| e.to_string())?;
    let source = sqlx::query(&format!("SELECT * FROM \"{table}\" ORDER BY rowid LIMIT ? OFFSET ?"))
        .bind(limit).bind(offset).fetch_all(&mut *db).await.map_err(|e| e.to_string())?;
    let mut rows = Vec::new();
    for row in source {
        let mut values = Vec::new();
        for index in 0..row.columns().len() {
            let raw = row.try_get_raw(index).map_err(|e| e.to_string())?;
            let value = if raw.is_null() { Value::Null } else { match raw.type_info().name() {
                "INTEGER" | "BOOLEAN" => json!(row.try_get::<i64, _>(index).map_err(|e| e.to_string())?),
                "REAL" => json!(row.try_get::<f64, _>(index).map_err(|e| e.to_string())?),
                "BLOB" => { let bytes: Vec<u8> = row.try_get(index).map_err(|e| e.to_string())?; json!({"blobHex": bytes.iter().map(|b| format!("{b:02x}")).collect::<String>()}) },
                _ => json!(row.try_get::<String, _>(index).map_err(|e| e.to_string())?),
            } };
            values.push(value);
        }
        rows.push(values);
    }
    Ok(TablePage { columns, rows, total, offset, limit })
}

pub async fn browse(data: &Path, table: &str, offset: i64, limit: i64) -> Result<TablePage, String> {
    if offset < 0 || offset > 100_000_000 || !(1..=200).contains(&limit) { return Err("Use a nonnegative offset and a page size from 1 to 200".into()); }
    let mut db = backup::connection(&checked_directory(data)?.join(DATABASE), true).await?;
    let result = page(&mut db, table, offset, limit).await;
    db.close().await.map_err(|e| e.to_string())?; result
}

fn csv_cell(value: &Value) -> String {
    let mut text = match value { Value::Null => String::new(), Value::String(s) => s.clone(), _ => value.to_string() };
    // Keep text from being interpreted as a spreadsheet formula. JSON exports are lossless.
    if value.is_string() && text.trim_start().starts_with(['=', '+', '-', '@', '\t', '\r']) { text.insert(0, '\''); }
    format!("\"{}\"", text.replace('"', "\"\""))
}

pub async fn export(data: &Path, table: &str, destination: &Path, format: &str) -> Result<ExportResult, String> {
    if !matches!(format, "json" | "csv") { return Err("Export format must be json or csv".into()); }
    let data = checked_directory(data)?; let destination = checked_directory(destination)?;
    if destination.starts_with(&data) { return Err("Choose an export folder outside the active data folder".into()); }
    let mut db = backup::connection(&data.join(DATABASE), true).await?;
    table_exists(&mut db, table).await?;
    let path = destination.join(format!("mycelium-{table}-{}.{}", token(), format));
    let result = async {
        let mut transaction = db.begin().await.map_err(|e| e.to_string())?;
        let mut output = BufWriter::new(OpenOptions::new().write(true).create_new(true).open(&path).map_err(|e| e.to_string())?);
        let mut offset = 0; let mut first = true;
        if format == "json" { output.write_all(b"[\n").map_err(|e| e.to_string())?; }
        loop {
            let batch = page(&mut transaction, table, offset, 200).await?;
            if first && format == "csv" {
                writeln!(output, "{}", batch.columns.iter().map(|s| csv_cell(&json!(s))).collect::<Vec<_>>().join(",")).map_err(|e| e.to_string())?;
            }
            for row in &batch.rows {
                if format == "json" {
                    if !first { output.write_all(b",\n").map_err(|e| e.to_string())?; }
                    let object: serde_json::Map<String, Value> = batch.columns.iter().cloned().zip(row.iter().cloned()).collect();
                    serde_json::to_writer(&mut output, &object).map_err(|e| e.to_string())?;
                } else { writeln!(output, "{}", row.iter().map(csv_cell).collect::<Vec<_>>().join(",")).map_err(|e| e.to_string())?; }
                first = false;
            }
            offset += batch.rows.len() as i64;
            if batch.rows.is_empty() || offset >= batch.total { break; }
        }
        if format == "json" { output.write_all(b"\n]\n").map_err(|e| e.to_string())?; }
        output.flush().map_err(|e| e.to_string())?; output.get_ref().sync_all().map_err(|e| e.to_string())?;
        transaction.commit().await.map_err(|e| e.to_string())?;
        Ok(ExportResult { path: path.to_string_lossy().into_owned(), rows: offset })
    }.await;
    db.close().await.map_err(|e| e.to_string())?;
    if result.is_err() && path.exists() { let _ = fs::rename(&path, path.with_extension(format!("{format}.incomplete"))); }
    result
}
