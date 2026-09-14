use std::{collections::BTreeMap, fs, path::{Path, PathBuf}};
use serde_json::json;
use sqlx::{Connection, SqliteConnection, sqlite::SqliteConnectOptions};
use crate::{database::migrations, data_management::{backup, browse, files, restore}};

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("mycelium-data-test-{}", files::token()));
        fs::create_dir(&root).unwrap(); Self(root)
    }
    fn folder(&self, name: &str) -> PathBuf { let path = self.0.join(name); fs::create_dir(&path).unwrap(); path }
}
impl Drop for Fixture { fn drop(&mut self) { let _ = fs::remove_dir_all(&self.0); } }

async fn synthetic_data(path: &Path, title: &str) {
    let mut db = SqliteConnection::connect_with(&SqliteConnectOptions::new().filename(path.join(files::DATABASE)).create_if_missing(true)).await.unwrap();
    migrations::migrate(&mut db).await.unwrap();
    sqlx::query("INSERT INTO nodes(id,title,estimated_duration_minutes) VALUES ('task',?,45)").bind(title).execute(&mut db).await.unwrap();
    for dir in files::MEDIA { fs::create_dir(path.join(dir)).unwrap(); }
    fs::write(path.join("notes-images/image.png"), b"synthetic media bytes").unwrap();
    let content = json!({"type":"doc","content":[{"type":"image","attrs":{"src":path.join("notes-images/image.png").to_string_lossy()}}]}).to_string();
    sqlx::query("INSERT INTO notes(id,note_type,title,content_json) VALUES ('note','document',?,?)").bind(title).bind(content).execute(&mut db).await.unwrap();
    db.close().await.unwrap();
}

#[test]
fn backup_verifies_snapshot_media_preferences_and_rejects_tampering() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new(); let data = fixture.folder("data"); let output = fixture.folder("output");
        synthetic_data(&data, "Preserve me").await;
        let prefs = BTreeMap::from([("oneash-font-main".into(), Some("Tamzen".into()))]);
        let created = backup::create(&data, &output, prefs.clone()).await.unwrap();
        let folder = Path::new(&created.path); let manifest = backup::validate(folder).await.unwrap();
        assert_eq!(manifest.preferences, prefs); assert_eq!(manifest.files.len(), 2);
        assert_eq!(manifest.schema_version, migrations::CURRENT_VERSION);
        fs::write(folder.join("notes-images/image.png"), b"changed media").unwrap();
        assert!(backup::validate(folder).await.unwrap_err().contains("checksum"));
        assert_eq!(fs::read(data.join("notes-images/image.png")).unwrap(), b"synthetic media bytes");
    });
}

#[test]
fn restore_is_staged_relinks_media_and_keeps_prior_directory_for_rollback() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new(); let source = fixture.folder("source"); let active = fixture.folder("active"); let output = fixture.folder("output");
        synthetic_data(&source, "Transferred").await; synthetic_data(&active, "Original").await;
        let prefs = BTreeMap::from([("oneash-weather-location".into(), None)]);
        let saved = backup::create(&source, &output, prefs.clone()).await.unwrap();
        let _lease = restore::acquire_lock(&active).unwrap();
        assert!(restore::acquire_lock(&active).is_err());
        let staged = restore::stage(&active, Path::new(&saved.path)).await.unwrap();
        assert!(staged.restart_required); assert!(restore::status(&active).unwrap().pending);
        let before = browse::browse(&active, "nodes", 0, 20).await.unwrap();
        assert_eq!(before.rows[0][before.columns.iter().position(|c| c == "title").unwrap()], "Original");
        restore::apply_pending(&active).await.unwrap();
        restore::apply_pending(&active).await.unwrap();
        let status = restore::status(&active).unwrap();
        assert!(!status.pending); assert_eq!(status.applied_preferences, Some(prefs));
        let rollback = PathBuf::from(status.rollback_path.unwrap()); assert!(rollback.join(files::DATABASE).exists());
        let notes = browse::browse(&active, "notes", 0, 20).await.unwrap();
        let content: serde_json::Value = serde_json::from_str(notes.rows[0][notes.columns.iter().position(|c| c == "content_json").unwrap()].as_str().unwrap()).unwrap();
        let relinked = PathBuf::from(content["content"][0]["attrs"]["src"].as_str().unwrap());
        assert_eq!(fs::canonicalize(relinked).unwrap(), fs::canonicalize(active.join("notes-images/image.png")).unwrap());
        let old = browse::browse(&rollback, "nodes", 0, 20).await.unwrap();
        assert_eq!(old.rows[0][old.columns.iter().position(|c| c == "title").unwrap()], "Original");
        restore::acknowledge(&active).unwrap(); assert!(restore::status(&active).unwrap().applied_preferences.is_none());
    });
}

#[test]
fn restore_preserves_imported_json_and_literal_paths_while_relinking_image_fields() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new(); let source = fixture.folder("source"); let active = fixture.folder("active"); let output = fixture.folder("output");
        synthetic_data(&source, "Transferred").await; synthetic_data(&active, "Original").await;
        let literal = serde_json::to_string(&source.join("notes-images/not-an-image-reference.png").to_string_lossy()).unwrap();
        let imported = format!(r#"{{ "type":"doc", "content":[{{"type":"paragraph","content":[{{"type":"text","text":{literal}}}]}},{{"type":"image","attrs":{{"src":"https://example.test/image.png"}}}}] }}"#);
        let journal_external = r#"[ "https://example.test/journal.png" ]"#;
        let mut db = backup::connection(&source.join(files::DATABASE), false).await.unwrap();
        sqlx::query("INSERT INTO notes(id,note_type,title,content_json,updated_at) VALUES ('imported','document','Imported',?,'2020-01-01')")
            .bind(&imported).execute(&mut db).await.unwrap();
        sqlx::query("INSERT INTO import_sources(id,kind,source_id) VALUES ('source','notion','external-source')").execute(&mut db).await.unwrap();
        sqlx::query("INSERT INTO import_records(source_id,external_id,note_id,content_hash) VALUES ('source','page','imported','unchanged-import-hash')").execute(&mut db).await.unwrap();
        sqlx::query("INSERT INTO journal_entries(id,date,content,images) VALUES ('remote','2026-01-01','',?),('local','2026-01-02','',?)")
            .bind(journal_external).bind(json!([source.join("notes-images/image.png").to_string_lossy()]).to_string())
            .execute(&mut db).await.unwrap();
        db.close().await.unwrap();
        // Literal text names a nonexistent file; it must neither block the backup
        // nor be rewritten. Noncanonical JSON ordering/spacing must also survive.
        let saved = backup::create(&source, &output, BTreeMap::new()).await.unwrap();
        restore::stage(&active, Path::new(&saved.path)).await.unwrap();
        restore::apply_pending(&active).await.unwrap();
        let mut db = backup::connection(&active.join(files::DATABASE), true).await.unwrap();
        let (restored, updated_at, hash): (String, String, String) = sqlx::query_as(
            "SELECT n.content_json,n.updated_at,r.content_hash FROM notes n JOIN import_records r ON r.note_id=n.id WHERE n.id='imported'")
            .fetch_one(&mut db).await.unwrap();
        assert_eq!(restored.as_bytes(), imported.as_bytes()); assert_eq!(updated_at, "2020-01-01"); assert_eq!(hash, "unchanged-import-hash");
        let remote: String = sqlx::query_scalar("SELECT images FROM journal_entries WHERE id='remote'").fetch_one(&mut db).await.unwrap();
        assert_eq!(remote, journal_external);
        let local: String = sqlx::query_scalar("SELECT images FROM journal_entries WHERE id='local'").fetch_one(&mut db).await.unwrap();
        let paths: Vec<String> = serde_json::from_str(&local).unwrap();
        assert_eq!(fs::canonicalize(&paths[0]).unwrap(), fs::canonicalize(active.join("notes-images/image.png")).unwrap());
        let document: String = sqlx::query_scalar("SELECT content_json FROM notes WHERE id='note'").fetch_one(&mut db).await.unwrap();
        let image: serde_json::Value = serde_json::from_str(&document).unwrap();
        assert_eq!(fs::canonicalize(image["content"][0]["attrs"]["src"].as_str().unwrap()).unwrap(), fs::canonicalize(active.join("notes-images/image.png")).unwrap());
        db.close().await.unwrap();
    });
}

#[test]
fn validation_rejects_traversal_future_schema_corruption_and_missing_referenced_media() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new(); let data = fixture.folder("data"); let output = fixture.folder("output");
        synthetic_data(&data, "Data").await;
        let saved = backup::create(&data, &output, BTreeMap::new()).await.unwrap(); let root = Path::new(&saved.path);
        let mut manifest: backup::Manifest = files::read_json(&root.join(files::MANIFEST)).unwrap();
        manifest.files[0].path = "../outside.db".into();
        fs::write(root.join(files::MANIFEST), serde_json::to_vec(&manifest).unwrap()).unwrap();
        assert!(backup::validate(root).await.is_err());
        assert!(files::validate_preferences(&BTreeMap::from([("secret-token".into(), Some("never include".into()))])).is_err());
        let mut db = backup::connection(&data.join(files::DATABASE), false).await.unwrap();
        sqlx::query("INSERT INTO mycelium_schema_migrations(version) VALUES (?)").bind(migrations::CURRENT_VERSION + 1).execute(&mut db).await.unwrap();
        db.close().await.unwrap(); assert!(backup::check_database(&data.join(files::DATABASE)).await.unwrap_err().contains("newer"));
        fs::write(data.join(files::DATABASE), b"not sqlite").unwrap(); assert!(backup::check_database(&data.join(files::DATABASE)).await.is_err());
        let missing = fixture.folder("missing"); synthetic_data(&missing, "Missing").await;
        fs::remove_file(missing.join("notes-images/image.png")).unwrap();
        assert!(backup::create(&missing, &output, BTreeMap::new()).await.is_err());
    });
}

#[test]
fn table_browser_is_bounded_allowlisted_and_exports_lossless_json_and_safe_csv() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new(); let data = fixture.folder("data"); let output = fixture.folder("output");
        synthetic_data(&data, "=HYPERLINK(\"test\")").await;
        assert!(browse::browse(&data, "nodes; DROP TABLE notes", 0, 10).await.is_err());
        assert!(browse::browse(&data, "nodes", -1, 10).await.is_err());
        assert!(browse::browse(&data, "nodes", 0, 201).await.is_err());
        assert!(browse::browse(&data, "nodes", 1, 1).await.unwrap().rows.is_empty());
        let overview = browse::overview(&data).await.unwrap(); assert_eq!(overview.integrity, ["ok"]); assert_eq!(overview.foreign_key_violations, 0);
        let exported = browse::export(&data, "nodes", &output, "json").await.unwrap();
        let parsed: serde_json::Value = serde_json::from_slice(&fs::read(exported.path).unwrap()).unwrap();
        assert_eq!(parsed[0]["title"], "=HYPERLINK(\"test\")");
        let csv = browse::export(&data, "nodes", &output, "csv").await.unwrap();
        assert!(fs::read_to_string(csv.path).unwrap().contains("'=HYPERLINK"));
    });
}

#[test]
fn stale_lock_file_does_not_block_restart_and_cancel_leaves_active_data_unchanged() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new(); let data = fixture.folder("data"); let output = fixture.folder("output");
        synthetic_data(&data, "Unchanged").await;
        let lease = restore::acquire_lock(&data).unwrap(); drop(lease);
        let _next = restore::acquire_lock(&data).unwrap();
        let saved = backup::create(&data, &output, BTreeMap::new()).await.unwrap();
        restore::stage(&data, Path::new(&saved.path)).await.unwrap(); restore::cancel(&data).unwrap();
        assert!(!restore::status(&data).unwrap().pending);
        assert_eq!(browse::browse(&data, "nodes", 0, 10).await.unwrap().total, 1);
    });
}

#[test]
fn interrupted_restore_resumes_after_either_folder_rename() {
    tauri::async_runtime::block_on(async {
        for renamed_stage in [false, true] {
            let fixture = Fixture::new(); let source = fixture.folder("source"); let active = fixture.folder("active"); let output = fixture.folder("output");
            synthetic_data(&source, "Transferred").await; synthetic_data(&active, "Original").await;
            let saved = backup::create(&source, &output, BTreeMap::new()).await.unwrap();
            let result = restore::stage(&active, Path::new(&saved.path)).await.unwrap();
            let pending: serde_json::Value = files::read_json(&fixture.0.join(".active.restore-pending.json")).unwrap();
            let rollback = fixture.0.join(pending["rollback"].as_str().unwrap());
            fs::rename(&active, &rollback).unwrap();
            if renamed_stage { fs::rename(&result.staged_path, &active).unwrap(); }
            restore::apply_pending(&active).await.unwrap();
            assert!(!restore::status(&active).unwrap().pending);
            assert!(rollback.join(files::DATABASE).exists());
            let rows = browse::browse(&active, "nodes", 0, 10).await.unwrap();
            assert_eq!(rows.rows[0][rows.columns.iter().position(|c| c == "title").unwrap()], "Transferred");
        }
    });
}

#[test]
fn backup_failure_reopens_registered_pool_before_returning() {
    tauri::async_runtime::block_on(async {
        use tauri_plugin_sql::{DbInstances, DbPool};
        let fixture = Fixture::new(); let data = fixture.folder("data"); synthetic_data(&data, "Original").await;
        let instances = DbInstances::default();
        let url = format!("sqlite:{}", data.join(files::DATABASE).to_string_lossy());
        let pool = sqlx::sqlite::SqlitePoolOptions::new().max_connections(2).connect(&url).await.unwrap();
        instances.0.write().await.insert(url.clone(), DbPool::Sqlite(pool));
        let location = crate::database::DataLocation { directory: data.to_string_lossy().into_owned(), database_url: url.clone(), development: true };
        assert!(crate::data_management::backup_registered(&location, &instances, &fixture.0.join("missing-output"), BTreeMap::new()).await.is_err());
        let pool = match instances.0.read().await.get(&url).unwrap() { DbPool::Sqlite(pool) => pool.clone() };
        sqlx::query("UPDATE nodes SET title='Still writable' WHERE id='task'").execute(&pool).await.unwrap();
        let value: String = sqlx::query_scalar("SELECT title FROM nodes WHERE id='task'").fetch_one(&pool).await.unwrap();
        assert_eq!(value, "Still writable"); pool.close().await;
    });
}

#[test]
fn sidecar_publication_is_atomic_and_never_overwrites_existing_control_data() {
    use std::io::Write;
    let fixture = Fixture::new(); let path = fixture.0.join("restore-pending.json");
    let failure = files::write_atomic_new(&path, |file| {
        file.write_all(b"{\"stage\":")?;
        Err(std::io::Error::other("injected interrupted write"))
    });
    assert!(failure.is_err()); assert!(!path.exists());
    files::write_json_new(&path, &json!({"stage":"complete"})).unwrap();
    let before = fs::read(&path).unwrap();
    assert!(files::write_json_new(&path, &json!({"stage":"replacement"})).is_err());
    assert_eq!(fs::read(&path).unwrap(), before);
    let read: serde_json::Value = files::read_json(&path).unwrap();
    assert_eq!(read["stage"], "complete");
}

#[test]
fn restore_acknowledgement_retains_only_latest_rollback_receipt_across_reloads() {
    let fixture = Fixture::new(); let data = fixture.folder("data");
    let applied = fixture.0.join(".data.restore-applied.json");
    let receipt = fixture.0.join(".data.restore-receipt.json");
    for name in ["first", "second"] {
        let rollback = fixture.folder(name).to_string_lossy().into_owned();
        files::write_json_new(&applied, &json!({
            "preferences": {"oneash-font-main":"Tamzen"}, "rollbackPath": rollback,
        })).unwrap();
        assert_eq!(restore::status(&data).unwrap().rollback_path.as_deref(), Some(rollback.as_str()));
        restore::acknowledge(&data).unwrap();
        restore::acknowledge(&data).unwrap();
        let status = restore::status(&data).unwrap();
        assert!(status.applied_preferences.is_none()); assert!(!status.pending);
        assert_eq!(status.rollback_path.as_deref(), Some(rollback.as_str()));
        let saved: serde_json::Value = files::read_json(&receipt).unwrap();
        assert_eq!(saved, json!({"rollbackPath": rollback}));
        assert!(!applied.exists());
    }
}

#[test]
fn validation_requires_versioned_tables_but_accepts_older_schemas_and_extra_tables() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new(); let data = fixture.folder("data"); synthetic_data(&data, "Data").await;
        let path = data.join(files::DATABASE);
        let mut db = backup::connection(&path, false).await.unwrap();
        sqlx::raw_sql("CREATE TABLE custom_data(id TEXT); DROP TABLE doc_comments;")
            .execute(&mut db).await.unwrap(); db.close().await.unwrap();
        assert!(backup::check_database(&path).await.unwrap_err().contains("doc_comments"));
        let mut db = backup::connection(&path, false).await.unwrap();
        sqlx::raw_sql(include_str!("../src/database/schema/personal.sql")).execute(&mut db).await.unwrap();
        sqlx::raw_sql("DROP TABLE import_records; DROP TABLE import_runs; DROP TABLE import_sources;
            DROP TABLE personal_settings; DROP TABLE personal_settings_history; DROP TABLE note_title_aliases;
            DELETE FROM mycelium_schema_migrations WHERE version>=4;")
            .execute(&mut db).await.unwrap(); db.close().await.unwrap();
        assert_eq!(backup::check_database(&path).await.unwrap(), 3);
    });
}

#[cfg(unix)]
#[test]
fn backup_rejects_symbolic_links() {
    tauri::async_runtime::block_on(async {
        let fixture = Fixture::new(); let data = fixture.folder("data"); let output = fixture.folder("output");
        synthetic_data(&data, "Data").await;
        std::os::unix::fs::symlink(data.join("notes-images/image.png"), data.join("notes-images/link.png")).unwrap();
        assert!(backup::create(&data, &output, BTreeMap::new()).await.is_err());
    });
}
