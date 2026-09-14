use std::{path::Path, time::Duration};

use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{sqlite::SqliteConnectOptions, Connection, SqliteConnection, SqlitePool};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_sql::{DbInstances, DbPool};

pub(crate) mod migrations;
mod wardrobe;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataLocation {
    pub directory: String,
    pub database_url: String,
    pub development: bool,
}

pub(crate) fn data_directory(documents: &Path, development: bool) -> std::path::PathBuf {
    documents.join(if development { "O-neash-data-dev" } else { "O-neash-data" })
}

#[tauri::command]
pub fn get_data_location(app: AppHandle) -> Result<DataLocation, String> {
    let development = cfg!(debug_assertions);
    let directory = data_directory(&app.path().document_dir().map_err(|e| e.to_string())?, development);
    let database_url = format!("sqlite:{}", directory.join("oneash-DB.db").to_string_lossy());
    Ok(DataLocation { directory: directory.to_string_lossy().into_owned(), database_url, development })
}

#[tauri::command]
pub async fn initialize_database(app: AppHandle) -> Result<DataLocation, String> {
    // Initialization owns its connection on a worker, keeping migration work and
    // filesystem access off the webview thread until the database is ready.
    tauri::async_runtime::spawn_blocking(move || {
        tauri::async_runtime::block_on(initialize_on_worker(app))
    }).await.map_err(|error| error.to_string())?
}

async fn initialize_on_worker(app: AppHandle) -> Result<DataLocation, String> {
    let location = get_data_location(app.clone())?;
    let instances = app.state::<DbInstances>();
    let mut databases = instances.0.write().await;
    if databases.contains_key(&location.database_url) { return Ok(location); }
    crate::data_management::prepare_startup(Path::new(&location.directory)).await?;
    std::fs::create_dir_all(&location.directory).map_err(|e| e.to_string())?;
    let options = SqliteConnectOptions::new()
        .filename(Path::new(&location.directory).join("oneash-DB.db"))
        .create_if_missing(true)
        .foreign_keys(true)
        .busy_timeout(Duration::from_secs(10));
    let mut connection = SqliteConnection::connect_with(&options).await.map_err(|e| e.to_string())?;
    migrations::migrate(&mut connection).await.map_err(|e| e.to_string())?;
    connection.close().await.map_err(|e| e.to_string())?;
    let pool = sqlx::sqlite::SqlitePoolOptions::new().max_connections(5)
        .connect_with(options).await.map_err(|e| e.to_string())?;
    databases.insert(location.database_url.clone(), DbPool::Sqlite(pool));
    Ok(location)
}

#[derive(Debug, Deserialize)]
pub struct SqlStatement {
    pub sql: String,
    #[serde(default)]
    pub values: Vec<Value>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteResult {
    pub rows_affected: u64,
    pub last_insert_id: i64,
}

fn validate_statements(statements: &[SqlStatement]) -> Result<(), String> {
    if statements.len() > 10_000 { return Err("Too many statements in one transaction".into()); }
    for statement in statements {
        let sql = statement.sql.trim().trim_end_matches(';').trim_end();
        let verb = sql.split_whitespace().next().unwrap_or_default().to_ascii_uppercase();
        if !matches!(verb.as_str(), "INSERT" | "UPDATE" | "DELETE" | "REPLACE") || sql.contains(';') {
            return Err("Each batch entry must be a single INSERT, UPDATE, DELETE, or REPLACE statement".into());
        }
        if statement.values.iter().any(|value| value.is_array() || value.is_object()) {
            return Err("SQL parameters must be strings, numbers, booleans, or null".into());
        }
    }
    Ok(())
}

pub(crate) async fn write_batch(pool: &SqlitePool, statements: &[SqlStatement]) -> Result<Vec<WriteResult>, String> {
    validate_statements(statements)?;
    if statements.is_empty() { return Ok(Vec::new()); }
    let mut transaction = pool.begin().await.map_err(|e| e.to_string())?;
    let mut results = Vec::with_capacity(statements.len());
    for statement in statements {
        let mut query = sqlx::query(&statement.sql);
        for value in &statement.values {
            query = match value {
                Value::Null => query.bind(None::<String>),
                Value::Bool(value) => query.bind(*value),
                Value::Number(value) => if let Some(integer) = value.as_i64() {
                    query.bind(integer)
                } else {
                    query.bind(value.as_f64().ok_or("Invalid numeric parameter")?)
                },
                Value::String(value) => query.bind(value.clone()),
                _ => return Err("Invalid SQL parameter".into()),
            };
        }
        match query.execute(&mut *transaction).await {
            Ok(result) => results.push(WriteResult {
                rows_affected: result.rows_affected(),
                last_insert_id: result.last_insert_rowid(),
            }),
            Err(error) => {
                transaction.rollback().await.map_err(|e| e.to_string())?;
                return Err(error.to_string());
            }
        }
    }
    transaction.commit().await.map_err(|e| e.to_string())?;
    Ok(results)
}

#[tauri::command]
pub async fn execute_batch(
    app: AppHandle,
    instances: State<'_, DbInstances>,
    statements: Vec<SqlStatement>,
) -> Result<Vec<WriteResult>, String> {
    let location = get_data_location(app)?;
    let pool = {
        let databases = instances.0.read().await;
        match databases.get(&location.database_url) {
            Some(DbPool::Sqlite(pool)) => pool.clone(),
            None => return Err("Database is not initialized".into()),
        }
    };
    write_batch(&pool, &statements).await
}
