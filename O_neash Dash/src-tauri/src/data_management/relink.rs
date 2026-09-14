use std::path::Path;
use serde_json::Value;
use sqlx::{Connection, Row};
use super::{backup, files::{DATABASE, MEDIA, relative, no_link}};

enum MediaField { NoteDocument, ImageList, Path }

const COLUMNS: [(&str, &str, MediaField); 7] = [
    ("notes", "content_json", MediaField::NoteDocument), ("journal_entries", "images", MediaField::ImageList),
    ("wardrobe_wiki_entries", "cover_image", MediaField::Path), ("wardrobe_wiki_gallery_images", "image_path", MediaField::Path),
    ("wardrobe_items", "image_path", MediaField::Path), ("wardrobe_ootd_logs", "photo_path", MediaField::Path), ("filmneg_photos", "image_path", MediaField::Path),
];

fn normalized(value: &str) -> String { value.trim_start_matches("\\\\?\\").replace('\\', "/").trim_end_matches('/').to_string() }

fn path_value(value: &str, old_root: &str, new_root: &Path, files_root: &Path) -> Result<String, String> {
    let normalized_value = normalized(value); let old = normalized(old_root);
    let prefix = format!("{old}/");
    if let Some(rel) = normalized_value.strip_prefix(&prefix) {
        if MEDIA.iter().any(|directory| rel.starts_with(&format!("{directory}/"))) {
            let relative = relative(rel)?; let actual = files_root.join(&relative); no_link(&actual)?;
            if !actual.is_file() { return Err(format!("Backup is missing referenced media: {rel}")); }
            return Ok(new_root.join(relative).to_string_lossy().into_owned());
        }
    }
    Ok(value.to_owned())
}

fn image_path(value: &mut Value, old: &str, new: &Path, files: &Path) -> Result<bool, String> {
    let Some(original) = value.as_str() else { return Ok(false); };
    let updated = path_value(original, old, new, files)?;
    if updated == original { return Ok(false); }
    *value = Value::String(updated);
    Ok(true)
}

fn note_images(node: &mut Value, old: &str, new: &Path, files: &Path) -> Result<bool, String> {
    let mut changed = false;
    if node.get("type").and_then(Value::as_str) == Some("image") {
        if let Some(source) = node.get_mut("attrs").and_then(|attrs| attrs.get_mut("src")) {
            changed |= image_path(source, old, new, files)?;
        }
    }
    // Tiptap children live only in content; text, marks and unrelated attributes
    // may contain literal paths and must never be interpreted as media references.
    if let Some(children) = node.get_mut("content").and_then(Value::as_array_mut) {
        for child in children { changed |= note_images(child, old, new, files)?; }
    }
    Ok(changed)
}

fn journal_images(value: &mut Value, old: &str, new: &Path, files: &Path) -> Result<bool, String> {
    let images = value.as_array_mut().ok_or("Journal images must be an array")?;
    let mut changed = false;
    for image in images {
        if !image.is_string() { return Err("Journal image paths must be strings".into()); }
        changed |= image_path(image, old, new, files)?;
    }
    Ok(changed)
}

async fn process(files_root: &Path, old_root: &str, new_root: &Path, write: bool) -> Result<(), String> {
    let mut db = backup::connection(&files_root.join(DATABASE), !write).await?;
    let result = async {
        let mut transaction = db.begin().await.map_err(|e| e.to_string())?;
        for (table, column, field) in COLUMNS {
            let exists: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?")
                .bind(table).fetch_one(&mut *transaction).await.map_err(|e| e.to_string())?;
            if exists == 0 { continue; }
            // Identifiers are exclusively the fixed application schema columns above.
            let rows = sqlx::query(&format!("SELECT id,\"{column}\" AS value FROM \"{table}\" WHERE \"{column}\" IS NOT NULL"))
                .fetch_all(&mut *transaction).await.map_err(|e| e.to_string())?;
            for row in rows {
                let original: String = row.try_get("value").map_err(|e| e.to_string())?;
                let updated = if !matches!(field, MediaField::Path) {
                    if original.is_empty() { continue; }
                    let mut value: Value = serde_json::from_str(&original).map_err(|e| format!("Invalid media document in {table}: {e}"))?;
                    let changed = match field {
                        MediaField::NoteDocument => note_images(&mut value, old_root, new_root, files_root)?,
                        MediaField::ImageList => journal_images(&mut value, old_root, new_root, files_root)?,
                        MediaField::Path => unreachable!(),
                    };
                    // Preserve serialized content (and import hashes) exactly when
                    // relocation did not change an actual managed image source.
                    if !changed { continue; }
                    serde_json::to_string(&value).map_err(|e| e.to_string())?
                } else { path_value(&original, old_root, new_root, files_root)? };
                if write && updated != original {
                    let id: String = row.try_get("id").map_err(|e| e.to_string())?;
                    sqlx::query(&format!("UPDATE \"{table}\" SET \"{column}\"=? WHERE id=?"))
                        .bind(updated).bind(id).execute(&mut *transaction).await.map_err(|e| e.to_string())?;
                }
            }
        }
        transaction.commit().await.map_err(|e| e.to_string())
    }.await;
    db.close().await.map_err(|e| e.to_string())?; result
}

pub async fn check_media(root: &Path, source: &str) -> Result<(), String> { process(root, source, Path::new(source), false).await }
pub async fn relocate(root: &Path, source: &str, destination: &Path) -> Result<(), String> { process(root, source, destination, true).await }
