use heed_core::CourseQueryFilters;
use tauri::{AppHandle, State};

use crate::app_state::AppState;
use crate::commands::snapshot::SnapshotView;
use crate::emit::{emit_message, emit_snapshot_events};

#[tauri::command]
pub async fn search_query_courses(
    filters: CourseQueryFilters,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    let session = {
        let guard = state.manual_session.lock().await;
        guard
            .clone()
            .ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在查询课程…")?;
    let query_courses = session
        .search_query_courses(&filters)
        .await
        .map_err(|err| err.to_string())?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_query_courses(query_courses);
    }
    emit_message(&app, "success", "课程查询已更新。")?;
    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn add_course_to_plan(
    add_url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    let session = {
        let guard = state.manual_session.lock().await;
        guard
            .clone()
            .ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在加入选课计划…")?;
    session
        .add_course_to_plan(&add_url)
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
    let preselect_courses = session
        .refresh_preselect_courses()
        .await
        .map_err(|err| err.to_string())?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_plan_courses(plan_courses);
        orchestrator.set_latest_query_courses(query_courses);
        orchestrator.set_latest_preselect_courses(preselect_courses);
    }
    emit_message(&app, "success", "课程已加入选课计划。")?;
    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn remove_plan_course(
    delete_url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    let session = {
        let guard = state.manual_session.lock().await;
        guard
            .clone()
            .ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在移出选课计划…")?;
    session
        .remove_plan_course(&delete_url)
        .await
        .map_err(|err| err.to_string())?;
    let plan_courses = session
        .refresh_plan_courses()
        .await
        .map_err(|err| err.to_string())?;
    let preselect_courses = session
        .refresh_preselect_courses()
        .await
        .map_err(|err| err.to_string())?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_plan_courses(plan_courses);
        orchestrator.set_latest_preselect_courses(preselect_courses);
    }
    emit_message(&app, "success", "课程已移出选课计划。")?;
    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn preselect_course(
    select_url: String,
    preference: Option<u32>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    let session = {
        let guard = state.manual_session.lock().await;
        guard
            .clone()
            .ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在提交预选…")?;
    let result = session
        .preselect_course(&select_url, preference)
        .await
        .map_err(|err| err.to_string())?;
    let preselect_courses = session
        .refresh_preselect_courses()
        .await
        .map_err(|err| err.to_string())?;
    let plan_courses = session
        .refresh_plan_courses()
        .await
        .map_err(|err| err.to_string())?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_preselect_courses(preselect_courses);
        orchestrator.set_latest_plan_courses(plan_courses);
    }
    emit_message(
        &app,
        if result.ok { "success" } else { "error" },
        if result.message.is_empty() {
            "预选请求已完成。".to_string()
        } else {
            result.message
        },
    )?;
    emit_snapshot_events(&app, &state).await
}
