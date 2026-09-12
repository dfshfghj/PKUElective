use elective_core::{
    CourseDetail, CourseQueryFilters, ElectiveResults, ElectiveScheduleRow, ElectiveService,
    PlanPageData, PreselectPageData, QueryPageData, SupplementPage,
};
use serde::Serialize;
use tauri::{AppHandle, State};

use crate::app_state::AppState;
use crate::emit::{emit_app_state_events, emit_message};
use crate::logger;
use crate::session_persistence::handle_session_result;

fn encode_captcha(bytes: &[u8]) -> String {
    base64::Engine::encode(&base64::engine::general_purpose::STANDARD, bytes)
}

#[derive(Debug, Clone, Serialize)]
pub struct PlanActionData {
    pub plan: PlanPageData,
    pub query: QueryPageData,
    pub preselect: PreselectPageData,
}

#[derive(Debug, Clone, Serialize)]
pub struct PlanMutationData {
    pub plan: PlanPageData,
    pub preselect: PreselectPageData,
}

#[derive(Debug, Clone, Serialize)]
pub struct SupplementLimitData {
    pub limit: u32,
    pub elected: u32,
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
) -> Result<QueryPageData, String> {
    logger::info("command: search_query_courses");
    let service = {
        let guard = state.manual_session.lock().await;
        ElectiveService::new(guard.clone().ok_or_else(|| "not logged in".to_string())?)
    };

    emit_message(&app, "info", "正在查询课程…")?;
    let page =
        handle_session_result(service.search_query(&filters).await, &app, &state).await?;
    emit_message(&app, "success", "课程查询已更新。")?;
    Ok(page)
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
) -> Result<Vec<ElectiveScheduleRow>, String> {
    logger::info("command: refresh_schedule");
    let service = manual_service(&state).await?;
    let schedule = handle_session_result(service.refresh_schedule().await, &app, &state).await?;
    Ok(schedule)
}

#[tauri::command]
pub async fn paginate_preselect(
    page: usize,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<PreselectPageData, String> {
    let service = manual_service(&state).await?;
    let page = handle_session_result(
        service.paginate_preselect(page).await,
        &app,
        &state,
    )
    .await?;
    Ok(page)
}

#[tauri::command]
pub async fn paginate_plan(
    page: usize,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<PlanPageData, String> {
    let service = manual_service(&state).await?;
    let page =
        handle_session_result(service.paginate_plan(page).await, &app, &state).await?;
    Ok(page)
}

#[tauri::command]
pub async fn paginate_query(
    page: usize,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<QueryPageData, String> {
    let service = manual_service(&state).await?;
    let page =
        handle_session_result(service.paginate_query(page).await, &app, &state).await?;
    Ok(page)
}

#[tauri::command]
pub async fn paginate_supplement(
    page: usize,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SupplementPage, String> {
    let service = manual_service(&state).await?;
    let page = handle_session_result(
        service.paginate_supplement(page).await,
        &app,
        &state,
    )
    .await?;
    Ok(page)
}

#[tauri::command]
pub async fn paginate_results(
    page: usize,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ElectiveResults, String> {
    let service = manual_service(&state).await?;
    let results = handle_session_result(
        service.paginate_results(page).await,
        &app,
        &state,
    )
    .await?;
    Ok(results)
}

#[tauri::command]
pub async fn refresh_supplement_page(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SupplementPage, String> {
    logger::info("command: refresh_supplement_page");
    let service = {
        let guard = state.manual_session.lock().await;
        ElectiveService::new(guard.clone().ok_or_else(|| "not logged in".to_string())?)
    };

    emit_message(&app, "info", "正在刷新补选退选…")?;
    let supplement =
        handle_session_result(service.refresh_supplement().await, &app, &state).await?;
    let captcha = handle_session_result(service.fetch_captcha().await, &app, &state).await?;
    *state.manual_captcha_image_b64.lock().await = Some(encode_captcha(&captcha));
    recognize_supplement_captcha(&state, &captcha).await;
    emit_message(&app, "success", "补选退选列表已更新。")?;
    emit_app_state_events(&app, &state).await?;
    Ok(supplement)
}

#[tauri::command]
pub async fn refresh_supplement_captcha(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
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
    emit_app_state_events(&app, &state).await?;
    Ok(())
}

#[tauri::command]
pub async fn add_course_to_plan(
    add_url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<PlanActionData, String> {
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
    emit_message(&app, "success", "课程已加入选课计划。")?;
    Ok(PlanActionData { plan, query, preselect })
}

#[tauri::command]
pub async fn remove_plan_course(
    delete_url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<PlanMutationData, String> {
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
    emit_message(&app, "success", "课程已移出选课计划。")?;
    Ok(PlanMutationData { plan, preselect })
}

#[tauri::command]
pub async fn preselect_course(
    select_url: String,
    preference: Option<u32>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<PreselectPageData, String> {
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
    emit_message(
        &app,
        if result.ok { "success" } else { "error" },
        if result.message.is_empty() {
            "预选请求已完成。".to_string()
        } else {
            result.message
        },
    )?;
    Ok(page)
}

#[tauri::command]
pub async fn cancel_preselect_course(
    cancel_url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<PreselectPageData, String> {
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
    emit_message(
        &app,
        if result.ok { "success" } else { "error" },
        result.message,
    )?;
    Ok(page)
}

#[tauri::command]
pub async fn supplement_select_course(
    select_url: String,
    captcha_code: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SupplementPage, String> {
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
    emit_app_state_events(&app, &state).await?;
    Ok(supplement)
}

#[tauri::command]
pub async fn refresh_supplement_limit(
    select_url: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SupplementLimitData, String> {
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
    emit_message(&app, "success", "课程名额已更新。")?;
    Ok(SupplementLimitData { limit, elected })
}

#[tauri::command]
pub async fn supplement_cancel_course(
    cancel_url: String,
    captcha_code: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SupplementPage, String> {
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
    emit_app_state_events(&app, &state).await?;
    Ok(supplement)
}
