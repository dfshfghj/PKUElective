use heed_core::CourseQueryFilters;
use tauri::{AppHandle, State};

use crate::app_state::AppState;
use crate::commands::snapshot::SnapshotView;
use crate::emit::{emit_message, emit_snapshot_events};
use crate::logger;
use crate::session_persistence::handle_session_result;

#[tauri::command]
pub async fn search_query_courses(
    filters: CourseQueryFilters,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: search_query_courses");
    let session = {
        let guard = state.manual_session.lock().await;
        guard
            .clone()
            .ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在查询课程…")?;
    let query_courses =
        handle_session_result(session.search_query_courses(&filters).await, &app, &state).await?;
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
    logger::info("command: add_course_to_plan");
    let session = {
        let guard = state.manual_session.lock().await;
        guard
            .clone()
            .ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在加入选课计划…")?;
    handle_session_result(session.add_course_to_plan(&add_url).await, &app, &state).await?;
    let plan_courses =
        handle_session_result(session.refresh_plan_courses().await, &app, &state).await?;
    let query_courses =
        handle_session_result(session.refresh_query_courses().await, &app, &state).await?;
    let preselect_courses =
        handle_session_result(session.refresh_preselect_courses().await, &app, &state).await?;
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
    logger::info("command: remove_plan_course");
    let session = {
        let guard = state.manual_session.lock().await;
        guard
            .clone()
            .ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在移出选课计划…")?;
    handle_session_result(session.remove_plan_course(&delete_url).await, &app, &state).await?;
    let plan_courses =
        handle_session_result(session.refresh_plan_courses().await, &app, &state).await?;
    let preselect_courses =
        handle_session_result(session.refresh_preselect_courses().await, &app, &state).await?;
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
    logger::info("command: preselect_course");
    let session = {
        let guard = state.manual_session.lock().await;
        guard
            .clone()
            .ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在提交预选…")?;
    let result =
        handle_session_result(session.preselect_course(&select_url, preference).await, &app, &state)
            .await?;
    let preselect_courses =
        handle_session_result(session.refresh_preselect_courses().await, &app, &state).await?;
    let plan_courses =
        handle_session_result(session.refresh_plan_courses().await, &app, &state).await?;
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
