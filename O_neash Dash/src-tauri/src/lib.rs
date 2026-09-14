mod database;
mod data_management;

#[cfg(test)]
#[path = "../tests/database.rs"]
mod database_tests;

#[cfg(test)]
#[path = "../tests/data_management.rs"]
mod data_management_tests;

// ── macOS: native WKWebView PDF export ───────────────────────────────────────
//
// Uses NSPrintOperation to generate a properly paginated multi-page A4 PDF.
// WKWebView._printOperationWithPrintInfo: is a private-but-stable selector
// used by Safari, Obsidian, and many other apps. It handles WebKit's internal
// pagination so content flows correctly across A4 pages.
// NSPrintSaveJob + NSPrintJobSavingURL writes directly to disk — no dialog.

#[cfg(target_os = "macos")]
#[tauri::command]
async fn export_pdf_native(
    window: tauri::WebviewWindow,
    save_path: String,
) -> Result<(), String> {
    use std::sync::mpsc;
    use objc2::msg_send;
    use objc2::rc::Retained;
    use objc2::MainThreadMarker;
    use objc2_app_kit::{NSPrintInfo, NSPrintJobDisposition, NSPrintJobSavingURL, NSPrintSaveJob};
    use objc2_core_foundation::CGSize;
    use objc2_foundation::{NSString, NSURL};
    use objc2_web_kit::WKWebView;

    let (tx, rx) = mpsc::channel::<Result<(), String>>();

    window
        .with_webview(move |wv| {
            let tx = tx.clone();
            unsafe {
                let wkwv: &WKWebView = &*wv.inner().cast::<WKWebView>();

                // ── 1. Configure NSPrintInfo for A4 with no margins ──────────
                let shared: Retained<NSPrintInfo> = NSPrintInfo::sharedPrintInfo();
                let print_info: Retained<NSPrintInfo> = msg_send![&*shared, copy];

                // A4 in points (72 dpi): 595 × 842
                let a4: CGSize = CGSize { width: 595.0, height: 842.0 };
                print_info.setPaperSize(a4);
                print_info.setTopMargin(0.0);
                print_info.setBottomMargin(0.0);
                print_info.setLeftMargin(0.0);
                print_info.setRightMargin(0.0);

                // ── 2. Set output destination to file (no print dialog) ──────
                let dict = print_info.dictionary();
                let path_ns = NSString::from_str(&save_path);
                let url: Retained<NSURL> = NSURL::fileURLWithPath(&path_ns);

                // dict is NSMutableDictionary — use msg_send! for setObject:forKey:
                let _: () = msg_send![&*dict,
                    setObject: &*NSPrintSaveJob
                    forKey:  &*NSPrintJobDisposition
                ];
                let _: () = msg_send![&*dict,
                    setObject: &*url
                    forKey:  &*NSPrintJobSavingURL
                ];

                // ── 3. Create and run the print operation ────────────────────
                // _printOperationWithPrintInfo: is WKWebView's private method
                // that gives a properly paginating NSPrintOperation.
                use objc2_app_kit::NSPrintOperation;
                let op: Retained<NSPrintOperation> =
                    msg_send![wkwv, _printOperationWithPrintInfo: &*print_info];

                op.setShowsPrintPanel(false);
                op.setShowsProgressPanel(false);

                let success: bool = op.runOperation();
                tx.send(if success {
                    Ok(())
                } else {
                    Err("NSPrintOperation failed".into())
                })
                .ok();
            }
        })
        .map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        rx.recv().map_err(|e: std::sync::mpsc::RecvError| e.to_string())?
    })
    .await
    .map_err(|e| e.to_string())??;

    Ok(())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
async fn export_pdf_native(
    _window: tauri::WebviewWindow,
    _save_path: String,
) -> Result<(), String> {
    Err("Native PDF export is only available on macOS.".into())
}

// ── App entry point ───────────────────────────────────────────────────────────

#[tauri::command]
fn supports_pdf_export() -> bool {
    cfg!(target_os = "macos")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            export_pdf_native,
            supports_pdf_export,
            database::get_data_location,
            database::initialize_database,
            database::execute_batch,
            data_management::create_backup,
            data_management::validate_backup,
            data_management::stage_restore,
            data_management::get_restore_status,
            data_management::acknowledge_restore,
            data_management::cancel_staged_restore,
            data_management::data_overview,
            data_management::browse_table,
            data_management::export_table,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
