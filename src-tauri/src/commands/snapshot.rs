use heed_core::{
    AppConfig, BotStatus, Course, ElectiveResults, PlanCourse, PreselectCourse, QueryCourse,
    SupplementPage, WishlistItem,
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
}

#[derive(Debug, Clone, Serialize)]
pub struct SnapshotView {
    pub auth: AuthStateView,
    pub config: AppConfig,
    pub automation_running: bool,
    pub bots: Vec<BotView>,
    pub courses: Vec<Course>,
    pub preselect_courses: Vec<PreselectCourse>,
    pub plan_courses: Vec<PlanCourse>,
    pub query_courses: Vec<QueryCourse>,
    pub supplement: SupplementPage,
    pub results: ElectiveResults,
    pub wishlist: Vec<WishlistItem>,
}

pub async fn build_snapshot(state: &AppState) -> SnapshotView {
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

    let orchestrator = state.orchestrator.lock().await;
    let automation_running = *state.automation_running.lock().await;
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
        })
        .collect();

    SnapshotView {
        auth,
        config: orchestrator.config().clone(),
        automation_running,
        bots,
        courses: orchestrator.latest_courses().to_vec(),
        preselect_courses: orchestrator.latest_preselect_courses().to_vec(),
        plan_courses: orchestrator.latest_plan_courses().to_vec(),
        query_courses: orchestrator.latest_query_courses().to_vec(),
        supplement: orchestrator.latest_supplement_page().clone(),
        results: orchestrator.latest_results().clone(),
        wishlist: orchestrator.wishlist().to_vec(),
    }
}

#[tauri::command]
pub async fn get_snapshot(state: State<'_, AppState>) -> Result<SnapshotView, String> {
    Ok(build_snapshot(&state).await)
}
