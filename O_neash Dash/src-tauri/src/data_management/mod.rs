use std::{path::{Path, PathBuf}, sync::Mutex, time::Duration};
use tauri::{AppHandle, Manager};
use tauri_plugin_sql::{DbInstances, DbPool};

pub(crate) mod backup;
pub(crate) mod browse;
pub(crate) mod files;
pub(crate) mod restore;
mod relink;

static OPERATION: Mutex<()> = Mutex::new(());

async fn worker<T: Send + 'static>(job: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _operation = OPERATION.lock().map_err(|e| e.to_string())?;
        job()
    }).await.map_err(|e| e.to_string())?
}

fn directory(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(PathBuf::from(crate::database::get_data_location(app.clone())?.directory))
}

pub async fn prepare_startup(data: &Path) -> Result<(), String> {
    restore::retain_lock(data)?;
    restore::apply_pending(data).await
}

async fn backup_with_pool(app: AppHandle, destination: PathBuf, preferences: files::Preferences) -> Result<backup::BackupInfo, String> {
    let location = crate::database::get_data_location(app.clone())?;
    let instances = app.state::<DbInstances>();
    backup_registered(&location, &instances, &destination, preferences).await
}

pub(crate) async fn backup_registered(location: &crate::database::DataLocation, instances: &DbInstances,
    destination: &Path, preferences: files::Preferences) -> Result<backup::BackupInfo, String> {
    let data = PathBuf::from(&location.directory);
    let mut databases = instances.0.write().await;
    let pool = match databases.remove(&location.database_url) {
        Some(DbPool::Sqlite(pool)) => pool,
        None => return Err("Database is not initialized".into()),
    };
    // UI maintenance prevents new edits; draining the pool also finishes already acquired SQL work.
    pool.close().await;
    let result = backup::create(&data, destination, preferences).await;
    // Always reopen before releasing the map lock, including snapshot/copy/validation failures.
    let reopened = sqlx::sqlite::SqlitePoolOptions::new().max_connections(5).connect_with(
        sqlx::sqlite::SqliteConnectOptions::new().filename(data.join(files::DATABASE)).foreign_keys(true)
            .busy_timeout(Duration::from_secs(10)),
    ).await;
    match reopened {
        Ok(pool) => { databases.insert(location.database_url.clone(), DbPool::Sqlite(pool)); result }
        Err(error) => Err(format!("The database could not reopen after backup. Restart Mycelium. {error}; backup result: {}", result.err().unwrap_or_default())),
    }
}

#[tauri::command]
pub async fn create_backup(app: AppHandle, destination_directory: String, preferences: files::Preferences) -> Result<backup::BackupInfo, String> {
    worker(move || tauri::async_runtime::block_on(backup_with_pool(app, PathBuf::from(destination_directory), preferences))).await
}

#[tauri::command]
pub async fn validate_backup(backup_directory: String) -> Result<backup::BackupInfo, String> {
    worker(move || tauri::async_runtime::block_on(async {
        let path = files::checked_directory(Path::new(&backup_directory))?;
        Ok(backup::validate(&path).await?.info(&path))
    })).await
}

#[tauri::command]
pub async fn stage_restore(app: AppHandle, backup_directory: String) -> Result<restore::StageResult, String> {
    worker(move || tauri::async_runtime::block_on(restore::stage(&directory(&app)?, Path::new(&backup_directory)))).await
}

#[tauri::command]
pub async fn get_restore_status(app: AppHandle) -> Result<restore::RestoreStatus, String> {
    worker(move || restore::status(&directory(&app)?)).await
}

#[tauri::command]
pub async fn acknowledge_restore(app: AppHandle) -> Result<(), String> {
    worker(move || restore::acknowledge(&directory(&app)?)).await
}

#[tauri::command]
pub async fn cancel_staged_restore(app: AppHandle) -> Result<(), String> {
    worker(move || restore::cancel(&directory(&app)?)).await
}

#[tauri::command]
pub async fn data_overview(app: AppHandle) -> Result<browse::Overview, String> {
    worker(move || tauri::async_runtime::block_on(browse::overview(&directory(&app)?))).await
}

#[tauri::command]
pub async fn browse_table(app: AppHandle, table: String, offset: i64, limit: i64) -> Result<browse::TablePage, String> {
    worker(move || tauri::async_runtime::block_on(browse::browse(&directory(&app)?, &table, offset, limit))).await
}

#[tauri::command]
pub async fn export_table(app: AppHandle, table: String, destination_directory: String, format: String) -> Result<browse::ExportResult, String> {
    worker(move || tauri::async_runtime::block_on(browse::export(&directory(&app)?, &table, Path::new(&destination_directory), &format))).await
}
