use heed_core::AppConfig;
use serde::Deserialize;
use tauri::{AppHandle, State};

use crate::app_state::AppState;
use crate::commands::snapshot::SnapshotView;
use crate::emit::{emit_message, emit_snapshot_events};
use crate::logger;

#[derive(Debug, Deserialize)]
pub struct ConfigPatch {
    pub auto_refresh: Option<bool>,
    pub auto_captcha: Option<bool>,
    pub notifications: Option<bool>,
    pub interval_ms: Option<u64>,
    pub timeout_ms: Option<u64>,
}

#[tauri::command]
pub async fn update_config(
    patch: ConfigPatch,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: update_config");
    {
        let mut orchestrator = state.orchestrator.lock().await;
        let current = orchestrator.config().clone();
        let merged = merge_config(current, patch);
        orchestrator.replace_config(merged.clone());
    }

    emit_message(&app, "success", "配置已更新。")?;
    emit_snapshot_events(&app, &state).await
}

fn merge_config(current: AppConfig, patch: ConfigPatch) -> AppConfig {
    AppConfig {
        auto_refresh: patch.auto_refresh.unwrap_or(current.auto_refresh),
        auto_captcha: patch.auto_captcha.unwrap_or(current.auto_captcha),
        notifications: patch.notifications.unwrap_or(current.notifications),
        interval_ms: patch.interval_ms.unwrap_or(current.interval_ms),
        timeout_ms: patch.timeout_ms.unwrap_or(current.timeout_ms),
    }
}
