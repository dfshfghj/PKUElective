use elective_core::{CourseDetail, CourseQueryFilters, ElectiveService};
use tauri::{AppHandle, State};

use crate::app_state::AppState;
use crate::commands::snapshot::AppStateView;
use crate::emit::{emit_app_state_events, emit_message};
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
) -> Result<AppStateView, String> {
    logger::info("command: search_query_courses");
    let service = {
        let guard = state.manual_session.lock().await;
        ElectiveService::new(guard.clone().ok_or_else(|| "not logged in".to_string())?)
    };

    emit_message(&app, "info", "正在查询课程…")?;
    let page =
        handle_session_result(service.search_query(&filters).await, &app, &state).await?;
    let mut pages = state.page_state.lock().await;
    pages.query_courses = page.courses;
    pages.query_pagination = page.pagination;
    drop(pages);
    emit_message(&app, "success", "课程查询已更新。")?;
    emit_app_state_events(&app, &state).await
}

#[tauri::command]
pub async fn fetch_course_detail(
    detail_url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<CourseDetail, String> {
    logger::info("command: fetch_course_detail");
    let service = {
        let guard = state.manual_session.lock().await;
        ElectiveService::new(guard.clone().ok_or_else(|| "not logged in".to_string())?)
    };

    handle_session_result(service.fetch_course_detail(&detail_url).await, &app, &state).await
}

async fn manual_service(state: &AppState) -> Result<ElectiveService, String> {
    state
        .manual_session
        .lock()
        .await
        .clone()
        .map(ElectiveService::new)
        .ok_or_else(|| "not logged in".to_string())
}

#[tauri::command]
pub async fn refresh_schedule(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppStateView, String> {
    logger::info("command: refresh_schedule");
    let service = manual_service(&state).await?;
    let schedule = handle_session_result(service.refresh_schedule().await, &app, &state).await?;
    *state.elective_schedule.lock().await = schedule;
    emit_app_state_events(&app, &state).await
}

#[tauri::command]
pub async fn paginate_preselect(
    url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppStateView, String> {
    let service = manual_service(&state).await?;
    let referer = state.page_state.lock().await.preselect_pagination.current_url.clone();
    let page = handle_session_result(
        service.paginate_preselect(&url, &referer).await,
        &app,
        &state,
    )
    .await?;
    let mut pages = state.page_state.lock().await;
    pages.preselect_courses = page.courses;
    if !page.selected_courses.is_empty() {
        pages.preselected_courses = page.selected_courses;
    }
    pages.preselect_pagination = page.pagination;
    drop(pages);
    emit_app_state_events(&app, &state).await
}

#[tauri::command]
pub async fn paginate_plan(
    url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppStateView, String> {
    let service = manual_service(&state).await?;
    let referer = state.page_state.lock().await.plan_pagination.current_url.clone();
    let page =
        handle_session_result(service.paginate_plan(&url, &referer).await, &app, &state).await?;
    let mut pages = state.page_state.lock().await;
    pages.plan_courses = page.courses;
    pages.plan_pagination = page.pagination;
    drop(pages);
    emit_app_state_events(&app, &state).await
}

#[tauri::command]
pub async fn paginate_query(
    url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppStateView, String> {
    let service = manual_service(&state).await?;
    let referer = state.page_state.lock().await.query_pagination.current_url.clone();
    let page =
        handle_session_result(service.paginate_query(&url, &referer).await, &app, &state).await?;
    let mut pages = state.page_state.lock().await;
    pages.query_courses = page.courses;
    pages.query_pagination = page.pagination;
    drop(pages);
    emit_app_state_events(&app, &state).await
}

#[tauri::command]
pub async fn paginate_supplement(
    url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppStateView, String> {
    let service = manual_service(&state).await?;
    let referer = state.page_state.lock().await.supplement.pagination.current_url.clone();
    let mut page = handle_session_result(
        service.paginate_supplement(&url, &referer).await,
        &app,
        &state,
    )
    .await?;
    let mut pages = state.page_state.lock().await;
    let current = &pages.supplement;
    if page.selected_courses.is_empty() {
        page.selected_courses = current.selected_courses.clone();
        page.selected_credits = current.selected_credits.clone();
    }
    pages.supplement = page;
    drop(pages);
    emit_app_state_events(&app, &state).await
}

#[tauri::command]
pub async fn paginate_results(
    url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppStateView, String> {
    let service = manual_service(&state).await?;
    let referer = state.page_state.lock().await.results.pagination.current_url.clone();
    let mut results = handle_session_result(
        service.paginate_results(&url, &referer).await,
        &app,
        &state,
    )
    .await?;
    let mut pages = state.page_state.lock().await;
    let current = &pages.results;
    if results.timetable.is_none() {
        results.timetable = current.timetable.clone();
        results.summary = current.summary.clone();
        results.notice = current.notice.clone();
        results.export_url = current.export_url.clone();
    }
    pages.results = results;
    drop(pages);
    emit_app_state_events(&app, &state).await
}

#[tauri::command]
pub async fn refresh_supplement_page(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppStateView, String> {
    logger::info("command: refresh_supplement_page");
    let service = {
        let guard = state.manual_session.lock().await;
        ElectiveService::new(guard.clone().ok_or_else(|| "not logged in".to_string())?)
    };

    emit_message(&app, "info", "正在刷新补选退选…")?;
    let supplement =
        handle_session_result(service.refresh_supplement().await, &app, &state).await?;
    let captcha = handle_session_result(service.fetch_captcha().await, &app, &state).await?;
    state.page_state.lock().await.supplement = supplement;
    *state.manual_captcha_image_b64.lock().await = Some(encode_captcha(&captcha));
    recognize_supplement_captcha(&state, &captcha).await;
    emit_message(&app, "success", "补选退选列表已更新。")?;
    emit_app_state_events(&app, &state).await
}

#[tauri::command]
pub async fn refresh_supplement_captcha(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppStateView, String> {
    logger::info("command: refresh_supplement_captcha");
    let service = {
        let guard = state.manual_session.lock().await;
        ElectiveService::new(guard.clone().ok_or_else(|| "not logged in".to_string())?)
    };

    emit_message(&app, "info", "正在刷新验证码…")?;
    let captcha = handle_session_result(service.fetch_captcha().await, &app, &state).await?;
    {
        let mut image = state.manual_captcha_image_b64.lock().await;
        *image = Some(encode_captcha(&captcha));
    }
    recognize_supplement_captcha(&state, &captcha).await;
    emit_message(&app, "success", "验证码已刷新。")?;
    emit_app_state_events(&app, &state).await
}

#[tauri::command]
pub async fn add_course_to_plan(
    add_url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppStateView, String> {
    logger::info("command: add_course_to_plan");
    let service = {
        let guard = state.manual_session.lock().await;
        ElectiveService::new(guard.clone().ok_or_else(|| "not logged in".to_string())?)
    };

    emit_message(&app, "info", "正在加入选课计划…")?;
    handle_session_result(service.add_course_to_plan(&add_url).await, &app, &state).await?;
    let plan = handle_session_result(service.refresh_plan().await, &app, &state).await?;
    let query = handle_session_result(service.refresh_query().await, &app, &state).await?;
    let preselect =
        handle_session_result(service.refresh_preselect().await, &app, &state).await?;
    let mut pages = state.page_state.lock().await;
    pages.plan_courses = plan.courses;
    pages.plan_pagination = plan.pagination;
    pages.query_courses = query.courses;
    pages.query_pagination = query.pagination;
    pages.preselect_courses = preselect.courses;
    pages.preselected_courses = preselect.selected_courses;
    pages.preselect_pagination = preselect.pagination;
    drop(pages);
    emit_message(&app, "success", "课程已加入选课计划。")?;
    emit_app_state_events(&app, &state).await
}

#[tauri::command]
pub async fn remove_plan_course(
    delete_url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppStateView, String> {
    logger::info("command: remove_plan_course");
    let service = {
        let guard = state.manual_session.lock().await;
        ElectiveService::new(guard.clone().ok_or_else(|| "not logged in".to_string())?)
    };

    emit_message(&app, "info", "正在移出选课计划…")?;
    handle_session_result(service.remove_plan_course(&delete_url).await, &app, &state).await?;
    let plan = handle_session_result(service.refresh_plan().await, &app, &state).await?;
    let preselect =
        handle_session_result(service.refresh_preselect().await, &app, &state).await?;
    let mut pages = state.page_state.lock().await;
    pages.plan_courses = plan.courses;
    pages.plan_pagination = plan.pagination;
    pages.preselect_courses = preselect.courses;
    pages.preselected_courses = preselect.selected_courses;
    pages.preselect_pagination = preselect.pagination;
    drop(pages);
    emit_message(&app, "success", "课程已移出选课计划。")?;
    emit_app_state_events(&app, &state).await
}

#[tauri::command]
pub async fn preselect_course(
    select_url: String,
    preference: Option<u32>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppStateView, String> {
    logger::info("command: preselect_course");
    let service = {
        let guard = state.manual_session.lock().await;
        ElectiveService::new(guard.clone().ok_or_else(|| "not logged in".to_string())?)
    };

    emit_message(&app, "info", "正在提交预选…")?;
    logger::info(format!(
        "preselect stage=action preference_present={}",
        preference.is_some()
    ));
    logger::info("preselect stage=atomic_operation");
    let operation = handle_session_result(
        service.preselect_course(&select_url, preference).await,
        &app,
        &state,
    )
    .await?;
    let result = operation.result;
    let page = handle_session_result(service.refresh_preselect().await, &app, &state).await?;
    logger::info(format!("preselect stage=action complete ok={}", result.ok));
    logger::info(format!(
        "preselect stage=refresh_preselect complete course_count={}",
        operation.courses.len()
    ));
    let mut pages = state.page_state.lock().await;
    pages.preselect_courses = page.courses;
    pages.preselected_courses = page.selected_courses;
    pages.preselect_pagination = page.pagination;
    drop(pages);
    emit_message(
        &app,
        if result.ok { "success" } else { "error" },
        if result.message.is_empty() {
            "预选请求已完成。".to_string()
        } else {
            result.message
        },
    )?;
    emit_app_state_events(&app, &state).await
}

#[tauri::command]
pub async fn cancel_preselect_course(
    cancel_url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppStateView, String> {
    let service = {
        let guard = state.manual_session.lock().await;
        ElectiveService::new(guard.clone().ok_or_else(|| "not logged in".to_string())?)
    };

    emit_message(&app, "info", "正在取消预选…")?;
    let operation = handle_session_result(
        service.cancel_preselect_course(&cancel_url).await,
        &app,
        &state,
    )
    .await?;
    let result = operation.result;
    let page = handle_session_result(service.refresh_preselect().await, &app, &state).await?;
    let mut pages = state.page_state.lock().await;
    pages.preselect_courses = page.courses;
    pages.preselected_courses = page.selected_courses;
    pages.preselect_pagination = page.pagination;
    drop(pages);
    emit_message(
        &app,
        if result.ok { "success" } else { "error" },
        result.message,
    )?;
    emit_app_state_events(&app, &state).await
}

#[tauri::command]
pub async fn supplement_select_course(
    select_url: String,
    captcha_code: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppStateView, String> {
    logger::info("command: supplement_select_course");
    let service = {
        let guard = state.manual_session.lock().await;
        ElectiveService::new(guard.clone().ok_or_else(|| "not logged in".to_string())?)
    };

    emit_message(&app, "info", "正在提交补选…")?;
    if captcha_code.trim().is_empty() {
        return Err("验证码不能为空。".to_string());
    }
    handle_session_result(
        service.verify_captcha(captcha_code.trim()).await,
        &app,
        &state,
    )
    .await?;
    let result = handle_session_result(
        service.select_supplement_course(&select_url).await,
        &app,
        &state,
    )
    .await?;
    let supplement =
        handle_session_result(service.refresh_supplement().await, &app, &state).await?;
    state.page_state.lock().await.supplement = supplement;
    if result.ok {
        let captcha = handle_session_result(service.fetch_captcha().await, &app, &state).await?;
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
    emit_app_state_events(&app, &state).await
}

#[tauri::command]
pub async fn refresh_supplement_limit(
    select_url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppStateView, String> {
    logger::info("command: refresh_supplement_limit");
    let service = {
        let guard = state.manual_session.lock().await;
        ElectiveService::new(guard.clone().ok_or_else(|| "not logged in".to_string())?)
    };

    emit_message(&app, "info", "正在刷新课程名额…")?;
    let (limit, elected) = handle_session_result(
        service.refresh_supplement_limit(&select_url).await,
        &app,
        &state,
    )
    .await?;
    {
        let mut pages = state.page_state.lock().await;
        if let Some(course) = pages
            .supplement
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
    emit_app_state_events(&app, &state).await
}

#[tauri::command]
pub async fn supplement_cancel_course(
    cancel_url: String,
    captcha_code: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppStateView, String> {
    logger::info("command: supplement_cancel_course");
    let service = {
        let guard = state.manual_session.lock().await;
        ElectiveService::new(guard.clone().ok_or_else(|| "not logged in".to_string())?)
    };

    emit_message(&app, "info", "正在提交退选…")?;
    if captcha_code.trim().is_empty() {
        return Err("验证码不能为空。".to_string());
    }
    handle_session_result(
        service.verify_captcha(captcha_code.trim()).await,
        &app,
        &state,
    )
    .await?;
    let result = handle_session_result(
        service.cancel_supplement_course(&cancel_url).await,
        &app,
        &state,
    )
    .await?;
    let supplement =
        handle_session_result(service.refresh_supplement().await, &app, &state).await?;
    state.page_state.lock().await.supplement = supplement;
    if result.ok {
        let captcha = handle_session_result(service.fetch_captcha().await, &app, &state).await?;
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
    emit_app_state_events(&app, &state).await
}
