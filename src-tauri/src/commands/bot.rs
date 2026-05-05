use tauri::{AppHandle, State};

use crate::app_state::AppState;
use crate::commands::snapshot::SnapshotView;
use crate::emit::{emit_message, emit_snapshot_events};

#[tauri::command]
pub async fn add_bot(app: AppHandle, state: State<'_, AppState>) -> Result<SnapshotView, String> {
    let credentials = {
        let guard = state.credentials.lock().await;
        guard.clone().ok_or_else(|| "not logged in".to_string())?
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
    let session = {
        let guard = state.manual_session.lock().await;
        guard
            .clone()
            .ok_or_else(|| "not logged in".to_string())?
    };

    let courses = session.refresh_courses().await.map_err(|err| err.to_string())?;
    let preselect_courses = session
        .refresh_preselect_courses()
        .await
        .map_err(|err| err.to_string())?;
    let plan_courses = session
        .refresh_plan_courses()
        .await
        .map_err(|err| err.to_string())?;
    let query_courses = session
        .refresh_query_courses()
        .await
        .map_err(|err| err.to_string())?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_courses(courses);
        orchestrator.set_latest_preselect_courses(preselect_courses);
        orchestrator.set_latest_plan_courses(plan_courses);
        orchestrator.set_latest_query_courses(query_courses);
    }
    emit_message(&app, "success", "课程列表已更新。")?;

    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn refresh_preselect_courses(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    let session = {
        let guard = state.manual_session.lock().await;
        guard
            .clone()
            .ok_or_else(|| "not logged in".to_string())?
    };

    let preselect_courses = session
        .refresh_preselect_courses()
        .await
        .map_err(|err| err.to_string())?;
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
    let session = {
        let guard = state.manual_session.lock().await;
        guard
            .clone()
            .ok_or_else(|| "not logged in".to_string())?
    };

    let plan_courses = session
        .refresh_plan_courses()
        .await
        .map_err(|err| err.to_string())?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_plan_courses(plan_courses);
    }

    emit_snapshot_events(&app, &state).await
}
