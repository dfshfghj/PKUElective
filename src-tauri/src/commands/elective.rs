use heed_core::CourseQueryFilters;
use tauri::{AppHandle, State};

use crate::app_state::AppState;
use crate::commands::snapshot::SnapshotView;
use crate::emit::{emit_message, emit_snapshot_events};
use crate::logger;
use crate::session_persistence::handle_session_result;

fn encode_captcha(bytes: &[u8]) -> String {
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, bytes)
}

#[tauri::command]
pub async fn search_query_courses(
    filters: CourseQueryFilters,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: search_query_courses");
    let session = {
        let guard = state.manual_session.lock().await;
        guard.clone().ok_or_else(|| "not logged in".to_string())?
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
pub async fn refresh_supplement_page(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: refresh_supplement_page");
    let session = {
        let guard = state.manual_session.lock().await;
        guard.clone().ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在刷新补选退选…")?;
    let supplement =
        handle_session_result(session.refresh_supplement_page().await, &app, &state).await?;
    let captcha =
        handle_session_result(session.fetch_captcha().await, &app, &state).await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_supplement_page(supplement);
    }
    {
        let mut image = state.manual_captcha_image_b64.lock().await;
        *image = Some(encode_captcha(&captcha));
    }
    {
        let mut verified = state.manual_captcha_verified.lock().await;
        *verified = false;
    }
    emit_message(&app, "success", "补选退选列表已更新。")?;
    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn refresh_supplement_captcha(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: refresh_supplement_captcha");
    let session = {
        let guard = state.manual_session.lock().await;
        guard.clone().ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在刷新验证码…")?;
    let captcha = handle_session_result(session.fetch_captcha().await, &app, &state).await?;
    {
        let mut image = state.manual_captcha_image_b64.lock().await;
        *image = Some(encode_captcha(&captcha));
    }
    {
        let mut verified = state.manual_captcha_verified.lock().await;
        *verified = false;
    }
    emit_message(&app, "success", "验证码已刷新。")?;
    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn verify_supplement_captcha(
    code: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: verify_supplement_captcha");
    let session = {
        let guard = state.manual_session.lock().await;
        guard.clone().ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在验证验证码…")?;
    handle_session_result(session.verify_captcha(code.trim()).await, &app, &state).await?;
    {
        let mut verified = state.manual_captcha_verified.lock().await;
        *verified = true;
    }
    emit_message(&app, "success", "验证码验证通过。")?;
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
        guard.clone().ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在加入选课计划…")?;
    handle_session_result(session.add_course_to_plan(&add_url).await, &app, &state).await?;
    let plan_courses =
        handle_session_result(session.refresh_plan_courses().await, &app, &state).await?;
    let query_courses =
        handle_session_result(session.refresh_query_courses().await, &app, &state).await?;
    let preselect_courses =
        handle_session_result(session.refresh_preselect_courses().await, &app, &state).await?;
    let preselected_courses =
        handle_session_result(session.refresh_preselected_courses().await, &app, &state).await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_plan_courses(plan_courses);
        orchestrator.set_latest_query_courses(query_courses);
        orchestrator.set_latest_preselect_courses(preselect_courses);
        orchestrator.set_latest_preselected_courses(preselected_courses);
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
        guard.clone().ok_or_else(|| "not logged in".to_string())?
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
        guard.clone().ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在提交预选…")?;
    logger::info(format!(
        "preselect stage=action preference_present={}",
        preference.is_some()
    ));
    let action = session.preselect_course(&select_url, preference).await;
    let result = handle_session_result(
        action,
        &app,
        &state,
    )
    .await?;
    logger::info(format!("preselect stage=action complete ok={}", result.ok));
    if result.ok {
        logger::info("preselect stage=reset_navigation_to_standard_preselect_page");
        session.reset_to_preselect_page();
    }
    logger::info("preselect stage=refresh_preselect");
    let refreshed_preselect = session.refresh_preselect_courses().await;
    let preselect_courses = handle_session_result(refreshed_preselect, &app, &state).await?;
    let refreshed_selected = session.refresh_preselected_courses().await;
    let preselected_courses = handle_session_result(refreshed_selected, &app, &state).await?;
    logger::info(format!(
        "preselect stage=refresh_preselect complete course_count={}",
        preselect_courses.len()
    ));
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_preselect_courses(preselect_courses);
        orchestrator.set_latest_preselected_courses(preselected_courses);
    }
    session.reset_to_preselect_page();
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

#[tauri::command]
pub async fn cancel_preselect_course(
    cancel_url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    let session = {
        let guard = state.manual_session.lock().await;
        guard.clone().ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在取消预选…")?;
    let action = session.cancel_preselect_course(&cancel_url).await;
    let result = handle_session_result(action, &app, &state).await?;
    if result.ok {
        logger::info("cancel_preselect stage=reset_navigation_to_standard_preselect_page");
        session.reset_to_preselect_page();
    }
    let refreshed_preselect = session.refresh_preselect_courses().await;
    let preselect_courses = handle_session_result(refreshed_preselect, &app, &state).await?;
    let refreshed_selected = session.refresh_preselected_courses().await;
    let preselected_courses = handle_session_result(refreshed_selected, &app, &state).await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_preselect_courses(preselect_courses);
        orchestrator.set_latest_preselected_courses(preselected_courses);
    }
    session.reset_to_preselect_page();
    emit_message(&app, if result.ok { "success" } else { "error" }, result.message)?;
    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn supplement_select_course(
    select_url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: supplement_select_course");
    let session = {
        let guard = state.manual_session.lock().await;
        guard.clone().ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在提交补选…")?;
    let captcha_verified = *state.manual_captcha_verified.lock().await;
    if !captcha_verified {
        return Err("请先完成验证码验证。".to_string());
    }
    let result = handle_session_result(
        session.select_supplement_course(&select_url).await,
        &app,
        &state,
    )
    .await?;
    let supplement =
        handle_session_result(session.refresh_supplement_page().await, &app, &state).await?;
    let captcha = handle_session_result(session.fetch_captcha().await, &app, &state).await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_supplement_page(supplement);
    }
    {
        let mut image = state.manual_captcha_image_b64.lock().await;
        *image = Some(encode_captcha(&captcha));
    }
    {
        let mut verified = state.manual_captcha_verified.lock().await;
        *verified = false;
    }
    emit_message(
        &app,
        if result.ok { "success" } else { "error" },
        if result.message.is_empty() {
            "补选请求已完成。".to_string()
        } else {
            result.message
        },
    )?;
    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn supplement_cancel_course(
    cancel_url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: supplement_cancel_course");
    let session = {
        let guard = state.manual_session.lock().await;
        guard.clone().ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在提交退选…")?;
    let captcha_verified = *state.manual_captcha_verified.lock().await;
    if !captcha_verified {
        return Err("请先完成验证码验证。".to_string());
    }
    let result = handle_session_result(
        session.cancel_supplement_course(&cancel_url).await,
        &app,
        &state,
    )
    .await?;
    let supplement =
        handle_session_result(session.refresh_supplement_page().await, &app, &state).await?;
    let captcha = handle_session_result(session.fetch_captcha().await, &app, &state).await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_supplement_page(supplement);
    }
    {
        let mut image = state.manual_captcha_image_b64.lock().await;
        *image = Some(encode_captcha(&captcha));
    }
    {
        let mut verified = state.manual_captcha_verified.lock().await;
        *verified = false;
    }
    emit_message(
        &app,
        if result.ok { "success" } else { "error" },
        if result.message.is_empty() {
            "退选请求已完成。".to_string()
        } else {
            result.message
        },
    )?;
    emit_snapshot_events(&app, &state).await
}
