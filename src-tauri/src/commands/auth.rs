use heed_core::{Credentials, ElectiveSession};
use tauri::{AppHandle, State};

use crate::app_state::AppState;
use crate::auth_persistence::{self, LoginPersistenceOptions};
use crate::commands::snapshot::AuthStateView;
use crate::emit::{emit_message, emit_snapshot_events};
use crate::logger;
use crate::session_persistence::{clear_session_and_auth, persist_session};

#[tauri::command]
pub async fn login(
    username: String,
    password: String,
    channel: Option<String>,
    remember_password: bool,
    auto_login: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AuthStateView, String> {
    logger::info("command: login");
    emit_message(&app, "info", "正在验证账号…")?;
    let credentials =
        Credentials::try_from_parts(username, password, channel).map_err(|err| err.to_string())?;

    let session = ElectiveSession::login(&credentials)
        .await
        .map_err(|err| err.to_string())?;
    persist_session(&app, &session).await?;
    let effective_prefs = auth_persistence::persist_login_artifacts(
        &app,
        &state,
        &credentials,
        LoginPersistenceOptions {
            remember_password,
            auto_login,
        },
    )
    .await?;

    state
        .set_auth_state(
            Some(credentials.clone()),
            session,
            credentials.username.clone(),
        )
        .await;
    crate::elective_preload::spawn(app.clone());
    let _ = emit_snapshot_events(&app, &state).await?;
    if remember_password && !effective_prefs.remember_password {
        emit_message(
            &app,
            "warn",
            "登录成功，但当前平台凭据存储不可用，未能保存密码。",
        )?;
    }
    emit_message(&app, "success", "登录成功。")?;

    Ok(AuthStateView {
        logged_in: true,
        username: Some(credentials.username),
        saved_username: effective_prefs.saved_username,
        saved_channel: auth_persistence::auth_preferences_to_channel_string(
            effective_prefs.saved_channel.as_ref(),
        ),
        remember_password: effective_prefs.remember_password,
        auto_login: effective_prefs.auto_login,
        auth_restoring: false,
        secure_store_available: auth_persistence::secure_store_available(),
    })
}

#[tauri::command]
pub async fn logout(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<crate::commands::snapshot::SnapshotView, String> {
    logger::info("command: logout");
    clear_session_and_auth(&app, &state).await?;
    auth_persistence::disable_auto_login(&app, &state).await?;
    emit_message(&app, "info", "已退出登录。")?;

    emit_snapshot_events(&app, &state).await
}
