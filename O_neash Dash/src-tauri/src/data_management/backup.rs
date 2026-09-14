use std::{fs, path::Path, time::Duration};
use serde::{Deserialize, Serialize};
use sqlx::{Connection, SqliteConnection, sqlite::SqliteConnectOptions};
use super::files::*;
use crate::database::migrations::CURRENT_VERSION;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Manifest {
    pub format_version: u32, pub app_version: String, pub schema_version: i64,
    pub created_at: u64, pub source_directory: String, pub preferences: Preferences,
    pub files: Vec<FileEntry>, pub directories: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo { pub path: String, pub created_at: u64, pub schema_version: i64, pub files: usize, pub bytes: u64, pub preferences: Preferences }

impl Manifest {
    pub fn info(&self, path: &Path) -> BackupInfo { BackupInfo {
        path: path.to_string_lossy().into_owned(), created_at: self.created_at, schema_version: self.schema_version,
        files: self.files.len(), bytes: self.files.iter().map(|f| f.bytes).sum(), preferences: self.preferences.clone(),
    } }
}

pub async fn connection(path: &Path, readonly: bool) -> Result<SqliteConnection, String> {
    no_link(path)?;
    SqliteConnection::connect_with(&SqliteConnectOptions::new().filename(path).read_only(readonly)
        .foreign_keys(true).busy_timeout(Duration::from_secs(10)))
        .await.map_err(|e| e.to_string())
}

pub async fn schema_version(connection: &mut SqliteConnection) -> Result<i64, String> {
    let versions: Vec<i64> = sqlx::query_scalar("SELECT version FROM mycelium_schema_migrations ORDER BY version")
        .fetch_all(connection).await.map_err(|e| format!("Missing or invalid migration history: {e}"))?;
    if versions.is_empty() || versions.iter().enumerate().any(|(i, v)| *v != i as i64 + 1) { return Err("Inconsistent migration history".into()); }
    let version = *versions.last().unwrap();
    if version > CURRENT_VERSION { return Err("Backup requires a newer Mycelium version".into()); }
    Ok(version)
}

pub async fn check_database(path: &Path) -> Result<i64, String> {
    let mut db = connection(path, true).await?;
    let result = async {
        let checks: Vec<String> = sqlx::query_scalar("PRAGMA integrity_check").fetch_all(&mut db).await.map_err(|e| e.to_string())?;
        if checks != ["ok"] { return Err("SQLite integrity check failed".into()); }
        let version = schema_version(&mut db).await?;
        // Require each version's application tables, while permitting additional
        // legacy/custom tables and leaving column upgrades to staged migrations.
        let mut schemas = vec![include_str!("../database/schema/planner.sql"),
            include_str!("../database/schema/personal.sql"), include_str!("../database/schema/collections.sql")];
        if version >= 5 { schemas.push(include_str!("../database/schema/settings.sql")); }
        if version >= 6 { schemas.push(include_str!("../database/schema/data.sql")); }
        let mut required: Vec<&str> = schemas.iter().flat_map(|schema| schema.split("CREATE TABLE IF NOT EXISTS ").skip(1))
            .filter_map(|suffix| suffix.trim_start().split(|c: char| c.is_whitespace() || c == '(').next()).collect();
        if version >= 4 { required.push("note_title_aliases"); }
        for table in required {
            let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?")
                .bind(table).fetch_one(&mut db).await.map_err(|e| e.to_string())?;
            if exists != 1 { return Err(format!("Backup is missing required table {table}")); }
        }
        let violations = sqlx::query("PRAGMA foreign_key_check").fetch_all(&mut db).await.map_err(|e| e.to_string())?;
        if !violations.is_empty() { return Err("Backup has broken foreign-key relationships".into()); }
        Ok(version)
    }.await;
    db.close().await.map_err(|e| e.to_string())?; result
}

pub async fn validate(root: &Path) -> Result<Manifest, String> {
    let root = checked_directory(root)?;
    let manifest: Manifest = read_json(&root.join(MANIFEST))?;
    if manifest.format_version != 1 { return Err("Unsupported backup format".into()); }
    if manifest.source_directory.is_empty() || manifest.source_directory.len() > 4096 { return Err("Invalid source directory".into()); }
    validate_preferences(&manifest.preferences)?;
    if manifest.files.len() + manifest.directories.len() > 100_000 { return Err("Backup manifest has too many entries".into()); }
    for entry in &manifest.files {
        relative(&entry.path)?;
        if entry.path != DATABASE && !allowed_media(&entry.path) { return Err("Backup includes an unsupported file".into()); }
    }
    for directory in &manifest.directories { relative(directory)?; if !allowed_media(directory) { return Err("Invalid media directory".into()); } }
    let (files, directories) = inventory(&root)?;
    if files != manifest.files || directories != manifest.directories { return Err("Backup is incomplete or a file checksum does not match".into()); }
    if !files.iter().any(|f| f.path == DATABASE) || MEDIA.iter().any(|d| !directories.contains(&d.to_string())) { return Err("Backup is missing its database or media folders".into()); }
    let version = check_database(&root.join(DATABASE)).await?;
    if version != manifest.schema_version { return Err("Backup schema version does not match its manifest".into()); }
    super::relink::check_media(&root, &manifest.source_directory).await?;
    Ok(manifest)
}

pub async fn create(source: &Path, destination: &Path, preferences: Preferences) -> Result<BackupInfo, String> {
    validate_preferences(&preferences)?;
    let source = checked_directory(source)?; let destination = checked_directory(destination)?;
    if destination.starts_with(&source) { return Err("Choose a backup folder outside the active data folder".into()); }
    let root = destination.join(format!("mycelium-backup-{}", token()));
    fs::create_dir(&root).map_err(|e| e.to_string())?;
    let result = async {
        let mut db = connection(&source.join(DATABASE), false).await?;
        let snapshot = sqlx::query("VACUUM INTO ?").bind(root.join(DATABASE).to_string_lossy().as_ref())
            .execute(&mut db).await.map_err(|e| e.to_string());
        db.close().await.map_err(|e| e.to_string())?; snapshot?;
        copy_media(&source, &root)?;
        let schema_version = check_database(&root.join(DATABASE)).await?;
        let (files, directories) = inventory(&root)?;
        let manifest = Manifest { format_version: 1, app_version: env!("CARGO_PKG_VERSION").into(), schema_version,
            created_at: now(), source_directory: source.to_string_lossy().into_owned(), preferences, files, directories };
        write_json_new(&root.join(MANIFEST), &manifest)?;
        validate(&root).await?;
        Ok(manifest.info(&root))
    }.await;
    if result.is_err() {
        // The unique incomplete folder is retained for inspection, but cannot validate as a backup.
        let _ = fs::rename(root.join(MANIFEST), root.join("incomplete-manifest.json"));
    }
    result
}

pub fn copy_validated(source: &Path, destination: &Path, manifest: &Manifest) -> Result<(), String> {
    fs::create_dir(destination).map_err(|e| e.to_string())?;
    for directory in &manifest.directories { fs::create_dir_all(destination.join(relative(directory)?)).map_err(|e| e.to_string())?; }
    for file in &manifest.files {
        let rel = relative(&file.path)?; no_link(&source.join(&rel))?;
        fs::copy(source.join(&rel), destination.join(&rel)).map_err(|e| e.to_string())?;
    }
    write_json_new(&destination.join(MANIFEST), manifest)
}

pub fn refresh_manifest(root: &Path, mut manifest: Manifest, source: &Path, version: i64) -> Result<Manifest, String> {
    let (files, directories) = inventory(root)?;
    manifest.files = files; manifest.directories = directories; manifest.schema_version = version;
    manifest.source_directory = source.to_string_lossy().into_owned();
    let temporary = root.join("manifest.next"); write_json_new(&temporary, &manifest)?;
    fs::remove_file(root.join(MANIFEST)).map_err(|e| e.to_string())?;
    fs::rename(temporary, root.join(MANIFEST)).map_err(|e| e.to_string())?;
    Ok(manifest)
}
