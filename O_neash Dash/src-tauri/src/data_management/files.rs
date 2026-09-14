use std::{collections::BTreeMap, fs::{self, File, OpenOptions}, io::{Read, Write}, path::{Component, Path, PathBuf}, sync::atomic::{AtomicU64, Ordering}, time::{SystemTime, UNIX_EPOCH}};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

pub const DATABASE: &str = "oneash-DB.db";
pub const MEDIA: [&str; 4] = ["journal-images", "notes-images", "wardrobe-images", "filmneg-images"];
pub const MANIFEST: &str = "manifest.json";
static SEQUENCE: AtomicU64 = AtomicU64::new(0);
pub type Preferences = BTreeMap<String, Option<String>>;

pub fn now() -> u64 { SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis() as u64 }
pub fn token() -> String { format!("{}-{}-{}", now(), std::process::id(), SEQUENCE.fetch_add(1, Ordering::Relaxed)) }

pub fn no_link(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    #[cfg(windows)] {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 { return Err("Links and junctions are not allowed".into()); }
    }
    if metadata.file_type().is_symlink() { return Err("Symbolic links are not allowed".into()); }
    Ok(())
}

pub fn checked_directory(path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() || path.components().any(|c| matches!(c, Component::ParentDir)) { return Err("Choose an absolute folder without parent traversal".into()); }
    for ancestor in path.ancestors() { if ancestor.exists() { no_link(ancestor)?; } }
    let canonical = fs::canonicalize(path).map_err(|e| e.to_string())?;
    if !canonical.is_dir() { return Err("Selected path is not a folder".into()); }
    Ok(canonical)
}

pub fn relative(value: &str) -> Result<PathBuf, String> {
    if value.is_empty() || value.len() > 4096 || value.contains(['\\', ':']) { return Err("Invalid backup relative path".into()); }
    let mut path = PathBuf::new();
    for part in value.split('/') {
        if part.is_empty() || matches!(part, "." | "..") || part.ends_with(['.', ' ']) || part.chars().any(|c| c.is_control()) { return Err("Invalid backup relative path".into()); }
        path.push(part);
    }
    Ok(path)
}

pub fn allowed_media(value: &str) -> bool { MEDIA.iter().any(|dir| value == *dir || value.starts_with(&format!("{dir}/"))) }

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FileEntry { pub path: String, pub bytes: u64, pub sha256: String }

pub fn hash_file(path: &Path) -> Result<(u64, String), String> {
    no_link(path)?;
    if !path.is_file() { return Err("Backup entry is not a regular file".into()); }
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut hash = Sha256::new(); let mut bytes = 0; let mut buffer = [0u8; 65536];
    loop { let read = file.read(&mut buffer).map_err(|e| e.to_string())?; if read == 0 { break; } hash.update(&buffer[..read]); bytes += read as u64; }
    Ok((bytes, format!("{:x}", hash.finalize())))
}

pub fn inventory(root: &Path) -> Result<(Vec<FileEntry>, Vec<String>), String> {
    fn visit(root: &Path, directory: &Path, files: &mut Vec<FileEntry>, dirs: &mut Vec<String>) -> Result<(), String> {
        for entry in fs::read_dir(directory).map_err(|e| e.to_string())? {
            let path = entry.map_err(|e| e.to_string())?.path(); no_link(&path)?;
            let name = path.strip_prefix(root).map_err(|e| e.to_string())?.to_str().ok_or("Non-Unicode backup path")?.replace('\\', "/");
            relative(&name)?;
            if name == MANIFEST { continue; }
            if !allowed_media(&name) && name != DATABASE { return Err(format!("Unexpected backup entry: {name}")); }
            if path.is_dir() { if !allowed_media(&name) { return Err("Invalid backup folder".into()); } dirs.push(name); visit(root, &path, files, dirs)?; }
            else { let (bytes, sha256) = hash_file(&path)?; files.push(FileEntry { path: name, bytes, sha256 }); }
            if files.len() + dirs.len() > 100_000 { return Err("Backup contains too many entries".into()); }
        }
        Ok(())
    }
    let mut files = Vec::new(); let mut dirs = Vec::new(); visit(root, root, &mut files, &mut dirs)?;
    files.sort_by(|a,b| a.path.cmp(&b.path)); dirs.sort(); Ok((files, dirs))
}

pub fn copy_media(source: &Path, destination: &Path) -> Result<(), String> {
    fn copy_tree(from: &Path, to: &Path) -> Result<(), String> {
        no_link(from)?; fs::create_dir(to).map_err(|e| e.to_string())?;
        for entry in fs::read_dir(from).map_err(|e| e.to_string())? {
            let path = entry.map_err(|e| e.to_string())?.path(); no_link(&path)?;
            let output = to.join(path.file_name().ok_or("Invalid filename")?);
            if path.is_dir() { copy_tree(&path, &output)?; }
            else if path.is_file() { fs::copy(path, output).map_err(|e| e.to_string())?; }
            else { return Err("Special files cannot be backed up".into()); }
        }
        Ok(())
    }
    for name in MEDIA {
        let from = source.join(name); let to = destination.join(name);
        if from.exists() { copy_tree(&from, &to)?; } else { fs::create_dir(to).map_err(|e| e.to_string())?; }
    }
    Ok(())
}

pub fn write_json_new(path: &Path, value: &impl Serialize) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?;
    write_atomic_new(path, |file| file.write_all(&bytes))
}

pub(crate) fn write_atomic_new(path: &Path, write: impl FnOnce(&mut File) -> std::io::Result<()>) -> Result<(), String> {
    fn require_absent(path: &Path) -> std::io::Result<()> {
        match fs::symlink_metadata(path) {
            Ok(_) => Err(std::io::Error::new(std::io::ErrorKind::AlreadyExists, "Control file already exists")),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(error),
        }
    }
    require_absent(path).map_err(|e| e.to_string())?;
    let filename = path.file_name().and_then(|s| s.to_str()).ok_or("Invalid control filename")?;
    let temporary = path.with_file_name(format!(".{filename}.writing-{}", token()));
    let mut file = OpenOptions::new().write(true).create_new(true).open(&temporary).map_err(|e| e.to_string())?;
    let written = write(&mut file).and_then(|_| file.sync_all());
    drop(file);
    let result = written.and_then(|_| require_absent(path)).and_then(|_| {
        // Windows rename never replaces an existing file. On Unix a hard link
        // publishes the already synced inode atomically with no replacement.
        #[cfg(windows)] { fs::rename(&temporary, path) }
        #[cfg(not(windows))] { fs::hard_link(&temporary, path) }
    });
    let _ = fs::remove_file(&temporary);
    result.map_err(|e| e.to_string())
}

pub fn read_json<T: serde::de::DeserializeOwned>(path: &Path) -> Result<T, String> {
    no_link(path)?;
    if fs::metadata(path).map_err(|e| e.to_string())?.len() > 16 * 1024 * 1024 { return Err("Manifest is too large".into()); }
    serde_json::from_slice(&fs::read(path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

pub fn validate_preferences(values: &Preferences) -> Result<(), String> {
    const KEYS: [&str; 8] = ["oneash-font-main", "oneash-font-kr", "oneash-font-main-scale", "oneash-font-kr-scale", "oneash-weather-location", "oneash-widgets-v3", "arc-visibility", "planner-view-store"];
    let mut total = 0;
    for (key, value) in values {
        if !KEYS.contains(&key.as_str()) { return Err(format!("Unsupported preference: {key}")); }
        let Some(value) = value else { continue; }; total += value.len();
        if value.len() > 128 * 1024 || total > 512 * 1024 { return Err("Preferences are too large".into()); }
        let valid = match key.as_str() {
            "oneash-font-main" => matches!(value.as_str(), "VT323" | "Tamzen"),
            "oneash-font-kr" => matches!(value.as_str(), "HBIOS-SYS" | "Gulim"),
            "oneash-font-main-scale" | "oneash-font-kr-scale" => value.parse::<f64>().is_ok_and(|n| n.is_finite() && (50.0..=150.0).contains(&n)),
            _ => serde_json::from_str::<serde_json::Value>(value).is_ok_and(|v| v.is_object()),
        };
        if !valid { return Err(format!("Invalid saved preference: {key}")); }
        if key == "oneash-weather-location" {
            let location: serde_json::Value = serde_json::from_str(value).map_err(|e| e.to_string())?;
            if !location["name"].as_str().is_some_and(|s| s.len() <= 200)
                || !location["lat"].as_f64().is_some_and(|n| (-90.0..=90.0).contains(&n))
                || !location["lon"].as_f64().is_some_and(|n| (-180.0..=180.0).contains(&n)) { return Err("Invalid saved weather location".into()); }
        }
    }
    Ok(())
}
