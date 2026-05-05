use heed_core::{Credentials, ElectiveSession};
use tauri::{AppHandle, State};

use crate::app_state::AppState;
use crate::commands::snapshot::AuthStateView;
use crate::emit::{emit_message, emit_snapshot_events};

#[tauri::command]
pub async fn login(
    username: String,
    password: String,
    channel: Option<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AuthStateView, String> {
    emit_message(&app, "info", "正在验证账号…")?;
    let credentials =
        Credentials::try_from_parts(username, password, channel).map_err(|err| err.to_string())?;

    let session = ElectiveSession::login(&credentials)
        .await
        .map_err(|err| err.to_string())?;

    {
        let mut guard = state.credentials.lock().await;
        *guard = Some(credentials.clone());
    }
    {
        let mut guard = state.manual_session.lock().await;
        *guard = Some(session);
    }
    {
        let mut guard = state.auth_username.lock().await;
        *guard = Some(credentials.username.clone());
    }
    let _ = emit_snapshot_events(&app, &state).await?;
    emit_message(&app, "success", "登录成功。")?;

    Ok(AuthStateView {
        logged_in: true,
        username: Some(credentials.username),
    })
}

#[tauri::command]
pub async fn logout(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<crate::commands::snapshot::SnapshotView, String> {
    {
        let mut credentials = state.credentials.lock().await;
        *credentials = None;
    }
    {
        let mut session = state.manual_session.lock().await;
        *session = None;
    }
    {
        let mut auth_username = state.auth_username.lock().await;
        *auth_username = None;
    }
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.clear_runtime_state();
    }
    emit_message(&app, "info", "已退出登录。")?;

    emit_snapshot_events(&app, &state).await
}
