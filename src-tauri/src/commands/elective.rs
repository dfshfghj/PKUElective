use elective_core::{CourseDetail, CourseQueryFilters};
use tauri::{AppHandle, State};

use crate::app_state::AppState;
use crate::commands::snapshot::SnapshotView;
use crate::emit::{emit_message, emit_snapshot_events};
use crate::logger;
use crate::session_persistence::handle_session_result;

fn encode_captcha(bytes: &[u8]) -> String {
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, bytes)
}

async fn recognize_supplement_captcha(state: &AppState, captcha: &[u8]) {
    let result = state.recognize_captcha(captcha.to_vec()).await;
    let mut recognized = state.supplement_captcha_recognized.lock().await;
    let mut error = state.supplement_captcha_recognition_error.lock().await;
    match result {
        Ok(value) => {
            *recognized = Some(value);
            *error = None;
        }
        Err(message) => {
            *recognized = None;
            *error = Some(message);
        }
    }
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
    let page =
        handle_session_result(session.search_query_courses(&filters).await, &app, &state).await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_query_courses(page.courses);
        orchestrator.set_latest_query_pagination(page.pagination);
    }
    emit_message(&app, "success", "课程查询已更新。")?;
    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn fetch_course_detail(
    detail_url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<CourseDetail, String> {
    logger::info("command: fetch_course_detail");
    let session = {
        let guard = state.manual_session.lock().await;
        guard.clone().ok_or_else(|| "not logged in".to_string())?
    };

    handle_session_result(session.fetch_course_detail(&detail_url).await, &app, &state).await
}

async fn manual_session(state: &AppState) -> Result<elective_core::ElectiveSession, String> {
    state
        .manual_session
        .lock()
        .await
        .clone()
        .ok_or_else(|| "not logged in".to_string())
}

#[tauri::command]
pub async fn paginate_preselect(
    url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    let session = manual_session(&state).await?;
    let referer = state
        .orchestrator
        .lock()
        .await
        .latest_preselect_pagination()
        .current_url
        .clone();
    let page = handle_session_result(
        session.fetch_preselect_page(&url, &referer).await,
        &app,
        &state,
    )
    .await?;
    let mut orchestrator = state.orchestrator.lock().await;
    orchestrator.set_latest_preselect_courses(page.courses);
    if !page.selected_courses.is_empty() {
        orchestrator.set_latest_preselected_courses(page.selected_courses);
    }
    orchestrator.set_latest_preselect_pagination(page.pagination);
    drop(orchestrator);
    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn paginate_plan(
    url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    let session = manual_session(&state).await?;
    let referer = state
        .orchestrator
        .lock()
        .await
        .latest_plan_pagination()
        .current_url
        .clone();
    let page =
        handle_session_result(session.fetch_plan_page(&url, &referer).await, &app, &state).await?;
    let mut orchestrator = state.orchestrator.lock().await;
    orchestrator.set_latest_plan_courses(page.courses);
    orchestrator.set_latest_plan_pagination(page.pagination);
    drop(orchestrator);
    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn paginate_query(
    url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    let session = manual_session(&state).await?;
    let referer = state
        .orchestrator
        .lock()
        .await
        .latest_query_pagination()
        .current_url
        .clone();
    let page =
        handle_session_result(session.fetch_query_page(&url, &referer).await, &app, &state).await?;
    let mut orchestrator = state.orchestrator.lock().await;
    orchestrator.set_latest_query_courses(page.courses);
    orchestrator.set_latest_query_pagination(page.pagination);
    drop(orchestrator);
    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn paginate_supplement(
    url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    let session = manual_session(&state).await?;
    let referer = state
        .orchestrator
        .lock()
        .await
        .latest_supplement_page()
        .pagination
        .current_url
        .clone();
    let mut page = handle_session_result(
        session.fetch_supplement_page(&url, &referer).await,
        &app,
        &state,
    )
    .await?;
    let mut orchestrator = state.orchestrator.lock().await;
    let current = orchestrator.latest_supplement_page();
    if page.selected_courses.is_empty() {
        page.selected_courses = current.selected_courses.clone();
        page.selected_credits = current.selected_credits.clone();
    }
    orchestrator.set_latest_supplement_page(page);
    drop(orchestrator);
    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn paginate_results(
    url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    let session = manual_session(&state).await?;
    let referer = state
        .orchestrator
        .lock()
        .await
        .latest_results()
        .pagination
        .current_url
        .clone();
    let mut results = handle_session_result(
        session.fetch_results_page(&url, &referer).await,
        &app,
        &state,
    )
    .await?;
    let mut orchestrator = state.orchestrator.lock().await;
    let current = orchestrator.latest_results();
    if results.timetable.is_none() {
        results.timetable = current.timetable.clone();
        results.summary = current.summary.clone();
        results.notice = current.notice.clone();
        results.export_url = current.export_url.clone();
    }
    orchestrator.set_latest_results(results);
    drop(orchestrator);
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
    let captcha = handle_session_result(session.fetch_captcha().await, &app, &state).await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_supplement_page(supplement);
    }
    *state.manual_captcha_image_b64.lock().await = Some(encode_captcha(&captcha));
    recognize_supplement_captcha(&state, &captcha).await;
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
    recognize_supplement_captcha(&state, &captcha).await;
    emit_message(&app, "success", "验证码已刷新。")?;
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
    let plan = handle_session_result(session.refresh_plan_page().await, &app, &state).await?;
    let query = handle_session_result(session.refresh_query_page().await, &app, &state).await?;
    let preselect =
        handle_session_result(session.refresh_preselect_page().await, &app, &state).await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_plan_courses(plan.courses);
        orchestrator.set_latest_plan_pagination(plan.pagination);
        orchestrator.set_latest_query_courses(query.courses);
        orchestrator.set_latest_query_pagination(query.pagination);
        orchestrator.set_latest_preselect_courses(preselect.courses);
        orchestrator.set_latest_preselected_courses(preselect.selected_courses);
        orchestrator.set_latest_preselect_pagination(preselect.pagination);
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
    let plan = handle_session_result(session.refresh_plan_page().await, &app, &state).await?;
    let preselect =
        handle_session_result(session.refresh_preselect_page().await, &app, &state).await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_plan_courses(plan.courses);
        orchestrator.set_latest_plan_pagination(plan.pagination);
        orchestrator.set_latest_preselect_courses(preselect.courses);
        orchestrator.set_latest_preselected_courses(preselect.selected_courses);
        orchestrator.set_latest_preselect_pagination(preselect.pagination);
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
    logger::info("preselect stage=atomic_operation");
    let operation = handle_session_result(
        session.preselect_course(&select_url, preference).await,
        &app,
        &state,
    )
    .await?;
    let result = operation.result;
    let page = handle_session_result(session.refresh_preselect_page().await, &app, &state).await?;
    logger::info(format!("preselect stage=action complete ok={}", result.ok));
    logger::info(format!(
        "preselect stage=refresh_preselect complete course_count={}",
        operation.courses.len()
    ));
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_preselect_courses(page.courses);
        orchestrator.set_latest_preselected_courses(page.selected_courses);
        orchestrator.set_latest_preselect_pagination(page.pagination);
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
    let operation = handle_session_result(
        session.cancel_preselect_course(&cancel_url).await,
        &app,
        &state,
    )
    .await?;
    let result = operation.result;
    let page = handle_session_result(session.refresh_preselect_page().await, &app, &state).await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_preselect_courses(page.courses);
        orchestrator.set_latest_preselected_courses(page.selected_courses);
        orchestrator.set_latest_preselect_pagination(page.pagination);
    }
    emit_message(
        &app,
        if result.ok { "success" } else { "error" },
        result.message,
    )?;
    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn supplement_select_course(
    select_url: String,
    captcha_code: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: supplement_select_course");
    let session = {
        let guard = state.manual_session.lock().await;
        guard.clone().ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在提交补选…")?;
    if captcha_code.trim().is_empty() {
        return Err("验证码不能为空。".to_string());
    }
    handle_session_result(
        session.verify_captcha(captcha_code.trim()).await,
        &app,
        &state,
    )
    .await?;
    let result = handle_session_result(
        session.select_supplement_course(&select_url).await,
        &app,
        &state,
    )
    .await?;
    let supplement =
        handle_session_result(session.refresh_supplement_page().await, &app, &state).await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_supplement_page(supplement);
    }
    if result.ok {
        let captcha = handle_session_result(session.fetch_captcha().await, &app, &state).await?;
        *state.manual_captcha_image_b64.lock().await = Some(encode_captcha(&captcha));
        recognize_supplement_captcha(&state, &captcha).await;
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
pub async fn refresh_supplement_limit(
    select_url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: refresh_supplement_limit");
    let session = {
        let guard = state.manual_session.lock().await;
        guard.clone().ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在刷新课程名额…")?;
    let (limit, elected) = handle_session_result(
        session.refresh_supplement_limit(&select_url).await,
        &app,
        &state,
    )
    .await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        if let Some(course) = orchestrator
            .latest_supplement_page_mut()
            .available_courses
            .iter_mut()
            .find(|course| course.select_url.as_deref() == Some(select_url.as_str()))
        {
            course.volume_cnt = limit;
            course.elected_cnt = elected;
            if elected < limit {
                course.action_label = "补选".to_string();
            }
        }
    }
    emit_message(&app, "success", "课程名额已更新。")?;
    emit_snapshot_events(&app, &state).await
}

#[tauri::command]
pub async fn supplement_cancel_course(
    cancel_url: String,
    captcha_code: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: supplement_cancel_course");
    let session = {
        let guard = state.manual_session.lock().await;
        guard.clone().ok_or_else(|| "not logged in".to_string())?
    };

    emit_message(&app, "info", "正在提交退选…")?;
    if captcha_code.trim().is_empty() {
        return Err("验证码不能为空。".to_string());
    }
    handle_session_result(
        session.verify_captcha(captcha_code.trim()).await,
        &app,
        &state,
    )
    .await?;
    let result = handle_session_result(
        session.cancel_supplement_course(&cancel_url).await,
        &app,
        &state,
    )
    .await?;
    let supplement =
        handle_session_result(session.refresh_supplement_page().await, &app, &state).await?;
    {
        let mut orchestrator = state.orchestrator.lock().await;
        orchestrator.set_latest_supplement_page(supplement);
    }
    if result.ok {
        let captcha = handle_session_result(session.fetch_captcha().await, &app, &state).await?;
        *state.manual_captcha_image_b64.lock().await = Some(encode_captcha(&captcha));
        recognize_supplement_captcha(&state, &captcha).await;
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
