use elective_core::{
    AppConfig, BotStatus, Course, ElectiveResults, ElectiveScheduleRow, Pagination, PlanCourse,
    PreselectCourse, PreselectedCourse, QueryCourse, SupplementPage, WishlistItem,
};
use serde::Serialize;
use tauri::State;

use crate::{app_state::AppState, auth_persistence};

#[derive(Debug, Clone, Serialize)]
pub struct AuthStateView {
    pub logged_in: bool,
    pub username: Option<String>,
    pub saved_username: Option<String>,
    pub saved_channel: Option<String>,
    pub remember_password: bool,
    pub auto_login: bool,
    pub auth_restoring: bool,
    pub secure_store_available: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct BotView {
    pub id: String,
    pub status: BotStatus,
    pub last_error: Option<String>,
    pub last_loop_unix_ms: Option<u128>,
    pub captcha_image_b64: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AppStateView {
    pub auth: AuthStateView,
    pub config: AppConfig,
    pub automation_running: bool,
    pub elective_schedule: Vec<ElectiveScheduleRow>,
    pub bots: Vec<BotView>,
    pub courses: Vec<Course>,
    pub preselect_courses: Vec<PreselectCourse>,
    pub preselected_courses: Vec<PreselectedCourse>,
    pub preselect_pagination: Pagination,
    pub plan_courses: Vec<PlanCourse>,
    pub plan_pagination: Pagination,
    pub query_courses: Vec<QueryCourse>,
    pub query_pagination: Pagination,
    pub supplement: SupplementPage,
    pub supplement_captcha_image_b64: Option<String>,
    pub supplement_captcha_recognized: Option<String>,
    pub supplement_captcha_recognition_error: Option<String>,
    pub captcha_model_error: Option<String>,
    pub results: ElectiveResults,
    pub wishlist: Vec<WishlistItem>,
}

pub async fn build_app_state(state: &AppState) -> AppStateView {
    let auth = {
        let username = state.auth_username.lock().await.clone();
        let preferences = state.auth_preferences.lock().await.clone();
        let auth_restoring = *state.auth_restoring.lock().await;
        AuthStateView {
            logged_in: username.is_some(),
            username,
            saved_username: preferences.saved_username,
            saved_channel: auth_persistence::auth_preferences_to_channel_string(
                preferences.saved_channel.as_ref(),
            ),
            remember_password: preferences.remember_password,
            auto_login: preferences.auto_login,
            auth_restoring,
            secure_store_available: auth_persistence::secure_store_available(),
        }
    };

    let elective_schedule = state.elective_schedule.lock().await.clone();
    let orchestrator = state.automation.lock().await;
    let page_state = state.page_state.lock().await;
    let automation_running = *state.automation_running.lock().await;
    let supplement_captcha_image_b64 = state.manual_captcha_image_b64.lock().await.clone();
    let supplement_captcha_recognized = state.supplement_captcha_recognized.lock().await.clone();
    let supplement_captcha_recognition_error = state
        .supplement_captcha_recognition_error
        .lock()
        .await
        .clone();
    let captcha_model_error = state.captcha_model_error();
    let bots = orchestrator
        .bots()
        .map(|bot| BotView {
            id: bot.id().to_string(),
            status: bot.status().clone(),
            last_error: bot.last_error().map(str::to_string),
            last_loop_unix_ms: bot.last_loop_time().and_then(|time| {
                time.duration_since(std::time::UNIX_EPOCH)
                    .ok()
                    .map(|duration| duration.as_millis())
            }),
            captcha_image_b64: bot.captcha_image().map(|bytes| {
                base64::Engine::encode(&base64::engine::general_purpose::STANDARD, bytes)
            }),
        })
        .collect();

    AppStateView {
        auth,
        config: orchestrator.config().clone(),
        automation_running,
        elective_schedule,
        bots,
        courses: page_state.courses.clone(),
        preselect_courses: page_state.preselect_courses.clone(),
        preselected_courses: page_state.preselected_courses.clone(),
        preselect_pagination: page_state.preselect_pagination.clone(),
        plan_courses: page_state.plan_courses.clone(),
        plan_pagination: page_state.plan_pagination.clone(),
        query_courses: page_state.query_courses.clone(),
        query_pagination: page_state.query_pagination.clone(),
        supplement: page_state.supplement.clone(),
        supplement_captcha_image_b64,
        supplement_captcha_recognized,
        supplement_captcha_recognition_error,
        captcha_model_error,
        results: page_state.results.clone(),
        wishlist: orchestrator.wishlist().to_vec(),
    }
}

#[tauri::command]
pub async fn get_app_state(state: State<'_, AppState>) -> Result<AppStateView, String> {
    Ok(build_app_state(&state).await)
}
