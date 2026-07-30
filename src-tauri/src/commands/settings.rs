use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::logger;

const PROJECT_URL: &str = "https://github.com/dfshfghj/PKUElective";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfoView {
    version: String,
    build_channel: &'static str,
    project_url: &'static str,
    platform: String,
    architecture: &'static str,
    log_path: String,
    log_size_bytes: u64,
}

#[tauri::command]
pub fn get_app_info(app: AppHandle) -> Result<AppInfoView, String> {
    let log_path = logger::log_file_path(&app)?;
    Ok(AppInfoView {
        version: app.package_info().version.to_string(),
        build_channel: option_env!("HEED_BUILD_CHANNEL").unwrap_or(if cfg!(debug_assertions) {
            "Dev"
        } else {
            "Release"
        }),
        project_url: PROJECT_URL,
        platform: std::env::consts::OS.to_string(),
        architecture: std::env::consts::ARCH,
        log_path: log_path.display().to_string(),
        log_size_bytes: logger::size_bytes()?,
    })
}

#[tauri::command]
pub fn export_app_log(app: AppHandle) -> Result<String, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| err.to_string())?
        .as_secs();
    let destination = app
        .path()
        .download_dir()
        .map_err(|err| err.to_string())?
        .join(format!("HEED-log-{timestamp}.log"));
    logger::export_to(&destination)?;
    logger::info(format!(
        "exported application log to {}",
        destination.display()
    ));
    Ok(destination.display().to_string())
}

#[tauri::command]
pub fn clear_app_log() -> Result<(), String> {
    logger::clear()
}
