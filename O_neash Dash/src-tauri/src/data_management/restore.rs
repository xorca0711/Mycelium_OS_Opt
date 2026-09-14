use std::{collections::BTreeMap, fs::{self, File, OpenOptions}, path::{Path, PathBuf}, sync::{Mutex, OnceLock}};
use serde::{Deserialize, Serialize};
use sqlx::Connection;
use super::{backup, files::*, relink};
use crate::database::migrations;

static LEASES: OnceLock<Mutex<BTreeMap<PathBuf, File>>> = OnceLock::new();

fn sidecar(data: &Path, suffix: &str) -> Result<PathBuf, String> {
    let parent = checked_directory(data.parent().ok_or("Data folder has no parent")?)?;
    let name = data.file_name().and_then(|n| n.to_str()).ok_or("Invalid data folder name")?;
    Ok(parent.join(format!(".{name}.{suffix}")))
}

pub fn acquire_lock(data: &Path) -> Result<File, String> {
    let path = sidecar(data, "lock")?;
    if path.exists() { no_link(&path)?; }
    let mut options = OpenOptions::new(); options.read(true).write(true).create(true);
    #[cfg(windows)] { use std::os::windows::fs::OpenOptionsExt; options.share_mode(0); }
    let file = options.open(path).map_err(|_| "Another Mycelium instance is using this data environment. Close it before starting again.")?;
    file.try_lock().map_err(|_| "Another Mycelium instance is using this data environment. Close it before starting again.")?;
    Ok(file)
}

pub fn retain_lock(data: &Path) -> Result<(), String> {
    let key = sidecar(data, "lock")?;
    let mut leases = LEASES.get_or_init(|| Mutex::new(BTreeMap::new())).lock().map_err(|e| e.to_string())?;
    if !leases.contains_key(&key) { leases.insert(key, acquire_lock(data)?); }
    Ok(())
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Pending { stage: String, rollback: String, preferences: Preferences }

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Applied { preferences: Preferences, rollback_path: String }

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Receipt { rollback_path: String }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreStatus { pub pending: bool, pub applied_preferences: Option<Preferences>, pub rollback_path: Option<String> }

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StageResult { pub restart_required: bool, pub staged_path: String }

fn pending_paths(data: &Path, pending: &Pending) -> Result<(PathBuf, PathBuf), String> {
    let name = data.file_name().and_then(|s| s.to_str()).ok_or("Invalid data directory")?;
    for (value, kind) in [(&pending.stage, "restore-stage"), (&pending.rollback, "rollback")] {
        let rel = relative(value)?;
        if rel.components().count() != 1 || !value.starts_with(&format!(".{name}.{kind}-")) { return Err("Invalid restore control path".into()); }
    }
    validate_preferences(&pending.preferences)?;
    let parent = checked_directory(data.parent().ok_or("Missing data parent")?)?;
    let stage = parent.join(&pending.stage); let rollback = parent.join(&pending.rollback);
    if stage.exists() { checked_directory(&stage)?; } if rollback.exists() { checked_directory(&rollback)?; }
    Ok((stage, rollback))
}

pub async fn stage(data: &Path, source: &Path) -> Result<StageResult, String> {
    let data = checked_directory(data)?; let source = checked_directory(source)?;
    if source.starts_with(&data) || data.starts_with(&source) { return Err("Choose a separate backup folder".into()); }
    let control = sidecar(&data, "restore-pending.json")?;
    if control.exists() || sidecar(&data, "restore-applied.json")?.exists() { return Err("Finish or cancel the previous restore before staging another".into()); }
    let manifest = backup::validate(&source).await?;
    let name = data.file_name().and_then(|s| s.to_str()).ok_or("Invalid folder name")?;
    let id = token();
    let pending = Pending { stage: format!(".{name}.restore-stage-{id}"), rollback: format!(".{name}.rollback-{id}"), preferences: manifest.preferences.clone() };
    let (staged, _) = pending_paths(&data, &pending)?;
    backup::copy_validated(&source, &staged, &manifest)?;
    // Revalidate the copy: the selected backup could have changed while being copied.
    backup::validate(&staged).await?;
    let mut connection = backup::connection(&staged.join(DATABASE), false).await?;
    let upgraded = migrations::migrate(&mut connection).await.map_err(|e| e.to_string());
    connection.close().await.map_err(|e| e.to_string())?; upgraded?;
    relink::relocate(&staged, &manifest.source_directory, &data).await?;
    backup::refresh_manifest(&staged, manifest, &data, migrations::CURRENT_VERSION)?;
    backup::validate(&staged).await?;
    write_json_new(&control, &pending)?;
    Ok(StageResult { restart_required: true, staged_path: staged.to_string_lossy().into_owned() })
}

/** Called under the persistent environment lock before any SQLite pool is opened. */
pub async fn apply_pending(data: &Path) -> Result<(), String> {
    let control = sidecar(data, "restore-pending.json")?;
    if !control.exists() { return Ok(()); }
    let pending: Pending = read_json(&control)?;
    let (stage, rollback) = pending_paths(data, &pending)?;
    if stage.exists() {
        backup::validate(&stage).await?;
        if data.exists() {
            checked_directory(data)?;
            if rollback.exists() { return Err("Restore recovery found conflicting folders; no data was overwritten".into()); }
            fs::rename(data, &rollback).map_err(|e| format!("Could not retain the current data folder: {e}"))?;
        } else if !rollback.exists() { return Err("Restore recovery is missing its original data folder".into()); }
        if let Err(error) = fs::rename(&stage, data) {
            let recovery = fs::rename(&rollback, data);
            return Err(format!("Could not apply staged restore: {error}; original-folder recovery: {recovery:?}"));
        }
    } else if !data.exists() || !rollback.exists() {
        return Err("Restore recovery is incomplete; no data was overwritten".into());
    }
    // If a process exited after either rename, the folder states above resume safely.
    let applied_path = sidecar(data, "restore-applied.json")?;
    if !applied_path.exists() {
        write_json_new(&applied_path, &Applied { preferences: pending.preferences, rollback_path: rollback.to_string_lossy().into_owned() })?;
    }
    fs::remove_file(control).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn status(data: &Path) -> Result<RestoreStatus, String> {
    let path = sidecar(data, "restore-applied.json")?;
    let applied: Option<Applied> = if path.exists() { Some(read_json(&path)?) } else { None };
    if let Some(value) = &applied { validate_preferences(&value.preferences)?; }
    let receipt_path = sidecar(data, "restore-receipt.json")?;
    let rollback_path = if let Some(value) = &applied { Some(value.rollback_path.clone()) }
        else if receipt_path.exists() { Some(read_json::<Receipt>(&receipt_path)?.rollback_path) } else { None };
    Ok(RestoreStatus { pending: sidecar(data, "restore-pending.json")?.exists(),
        applied_preferences: applied.map(|a| a.preferences), rollback_path })
}

fn retain_receipt(data: &Path, receipt: &Receipt) -> Result<(), String> {
    let path = sidecar(data, "restore-receipt.json")?;
    let previous = if path.exists() {
        if read_json::<Receipt>(&path)?.rollback_path == receipt.rollback_path { return Ok(()); }
        let previous = sidecar(data, &format!("restore-receipt-previous-{}.json", token()))?;
        fs::rename(&path, &previous).map_err(|e| e.to_string())?;
        Some(previous)
    } else { None };
    // The applied record remains authoritative until this synced receipt is
    // atomically published. A crash between rotations is safe to acknowledge again.
    if let Err(error) = write_json_new(&path, receipt) {
        if let Some(previous) = &previous { if !path.exists() { let _ = fs::rename(previous, &path); } }
        return Err(error);
    }
    if let Some(previous) = previous { let _ = fs::remove_file(previous); }
    Ok(())
}

pub fn acknowledge(data: &Path) -> Result<(), String> {
    let path = sidecar(data, "restore-applied.json")?;
    if path.exists() {
        let applied: Applied = read_json(&path)?;
        retain_receipt(data, &Receipt { rollback_path: applied.rollback_path })?;
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn cancel(data: &Path) -> Result<(), String> {
    let control = sidecar(data, "restore-pending.json")?;
    if !control.exists() { return Ok(()); }
    let pending: Pending = read_json(&control)?; let (stage, rollback) = pending_paths(data, &pending)?;
    if !data.exists() || rollback.exists() { return Err("A restore has already started and cannot be canceled".into()); }
    // Preserve the staged copy as an ordinary backup instead of recursively deleting user data.
    if stage.exists() {
        let canceled = sidecar(data, &format!("canceled-restore-{}", token()))?;
        fs::rename(stage, canceled).map_err(|e| e.to_string())?;
    }
    fs::remove_file(control).map_err(|e| e.to_string())
}
