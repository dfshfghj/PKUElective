use tauri::{AppHandle, State};

use crate::app_state::AppState;
use crate::commands::snapshot::SnapshotView;
use crate::emit::{emit_message, emit_snapshot_events};
use crate::logger;
use crate::session_persistence::handle_session_result;

const MAX_AUTO_CAPTCHA_ATTEMPTS: usize = 3;

pub(crate) async fn auto_verify_bot_captcha(state: &AppState, bot_id: &str) -> Result<(), String> {
    let mut last_error = None;
    for attempt in 1..=MAX_AUTO_CAPTCHA_ATTEMPTS {
        let image = {
            let orchestrator = state.orchestrator.lock().await;
            orchestrator
                .bot_captcha_image(bot_id)
                .map_err(|err| err.to_string())?
        };
        let code = match state.recognize_captcha(image).await {
            Ok(code) => code,
            Err(err) => {
                last_error = Some(err);
                if attempt < MAX_AUTO_CAPTCHA_ATTEMPTS {
                    let mut orchestrator = state.orchestrator.lock().await;
                    let _ = orchestrator.refresh_bot_captcha(bot_id).await;
                }
                continue;
            }
        };
        match state
            .orchestrator
            .lock()
            .await
            .verify_bot_captcha(bot_id, &code)
            .await
        {
            Ok(()) => return Ok(()),
            Err(err) => {
                last_error = Some(err.to_string());
                if attempt < MAX_AUTO_CAPTCHA_ATTEMPTS {
                    let mut orchestrator = state.orchestrator.lock().await;
                    let _ = orchestrator.refresh_bot_captcha(bot_id).await;
                }
            }
        }
    }
    Err(last_error.unwrap_or_else(|| "自动识别验证码失败。".into()))
}

#[tauri::command]
pub async fn add_bot(app: AppHandle, state: State<'_, AppState>) -> Result<SnapshotView, String> {
    logger::info("command: add_bot");
    let credentials = {
        let guard = state.credentials.lock().await;
        guard.clone().ok_or_else(|| {
            if state
                .auth_username
                .try_lock()
                .ok()
                .and_then(|value| value.clone())
                .is_some()
            {
                "session restored, but adding Bot requires re-login with password".to_string()
            } else {
                "not logged in".to_string()
            }
        })?
    };

    emit_message(&app, "info", "正在创建 Bot…")?;
    let bot_id = {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator
            .add_bot(&credentials)
            .await
            .map_err(|err| err.to_string())?
    };
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator
            .refresh_bot_captcha(&bot_id)
            .await
            .map_err(|err| err.to_string())?;
    }
    let auto_captcha = state.orchestrator.lock().await.config().auto_captcha;
    if auto_captcha {
        if state.captcha_recognizer().is_some() {
            emit_message(&app, "info", format!("正在自动识别 {bot_id} 的验证码…"))?;
            match auto_verify_bot_captcha(&state, &bot_id).await {
                Ok(()) => emit_message(&app, "success", format!("{bot_id} 验证码已自动通过。"))?,
                Err(error) => emit_message(
                    &app,
                    "warn",
                    format!("{bot_id} 自动识别失败，请手动输入：{error}"),
                )?,
            }
        } else if let Some(error) = state.captcha_model_error() {
            emit_message(&app, "warn", error)?;
        }
    }
    emit_message(
        &app,
        "success",
        format!("Bot 已添加，{bot_id} 可继续使用。"),
    )?;

    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn refresh_bot_captcha(
    bot_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: refresh_bot_captcha");
    emit_message(&app, "info", format!("正在刷新 {bot_id} 的验证码…"))?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator
            .refresh_bot_captcha(&bot_id)
            .await
            .map_err(|err| err.to_string())?;
    }
    emit_message(&app, "success", format!("{bot_id} 的验证码已刷新。"))?;
    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn verify_bot_captcha(
    bot_id: String,
    code: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: verify_bot_captcha");
    emit_message(&app, "info", format!("正在验证 {bot_id} 的验证码…"))?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator
            .verify_bot_captcha(&bot_id, code.trim())
            .await
            .map_err(|err| err.to_string())?;
    }
    emit_message(&app, "success", format!("{bot_id} 的验证码验证通过。"))?;
    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn refresh_now(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: refresh_now");
    let session = {
        let guard = state.manual_session.lock().await;
        guard.clone().ok_or_else(|| "not logged in".to_string())?
    };

    let courses = handle_session_result(session.refresh_courses().await, &app, &state).await?;
    let preselect_courses =
        handle_session_result(session.refresh_preselect_courses().await, &app, &state).await?;
    let plan_courses =
        handle_session_result(session.refresh_plan_courses().await, &app, &state).await?;
    let query_courses =
        handle_session_result(session.refresh_query_courses().await, &app, &state).await?;
    let results = handle_session_result(session.refresh_results().await, &app, &state).await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_courses(courses);
        orchestrator.set_latest_preselect_courses(preselect_courses);
        orchestrator.set_latest_plan_courses(plan_courses);
        orchestrator.set_latest_query_courses(query_courses);
        orchestrator.set_latest_results(results);
    }
    emit_message(&app, "success", "课程列表已更新。")?;

    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn refresh_automation_courses(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: refresh_automation_courses");
    let session = {
        let guard = state.manual_session.lock().await;
        guard.clone().ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在刷新可抢课程…")?;
    let courses = handle_session_result(session.refresh_courses().await, &app, &state).await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_courses(courses);
    }
    emit_message(&app, "success", "可抢课程已更新。")?;

    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn refresh_preselect_courses(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: refresh_preselect_courses");
    let session = {
        let guard = state.manual_session.lock().await;
        guard.clone().ok_or_else(|| "not logged in".to_string())?
    };

    let (preselect_courses, preselected_courses) =
        handle_session_result(session.refresh_preselect_data().await, &app, &state).await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_preselect_courses(preselect_courses);
        orchestrator.set_latest_preselected_courses(preselected_courses);
    }
    emit_message(&app, "success", "预选列表已更新。")?;

    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn refresh_plan_courses(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: refresh_plan_courses");
    let session = {
        let guard = state.manual_session.lock().await;
        guard.clone().ok_or_else(|| "not logged in".to_string())?
    };

    let plan_courses =
        handle_session_result(session.refresh_plan_courses().await, &app, &state).await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_plan_courses(plan_courses);
    }

    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn refresh_results(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: refresh_results");
    let session = {
        let guard = state.manual_session.lock().await;
        guard.clone().ok_or_else(|| "not logged in".to_string())?
    };

    let results = handle_session_result(session.refresh_results().await, &app, &state).await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_results(results);
    }
    emit_message(&app, "success", "选课结果已更新。")?;

    emit_snapshot_events(&app, &state).await
}
