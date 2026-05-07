use tauri::{AppHandle, State};

use crate::app_state::AppState;
use crate::commands::snapshot::SnapshotView;
use crate::emit::{emit_message, emit_snapshot_events};
use crate::logger;
use crate::session_persistence::handle_session_result;

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
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator
            .add_bot(&credentials)
            .await
            .map_err(|err| err.to_string())?;
    }
    emit_message(&app, "success", "Bot 已添加。")?;

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

    let preselect_courses =
        handle_session_result(session.refresh_preselect_courses().await, &app, &state).await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_preselect_courses(preselect_courses);
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
