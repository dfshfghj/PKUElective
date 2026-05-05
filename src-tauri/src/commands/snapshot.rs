use heed_core::{AppConfig, BotStatus, Course, PlanCourse, PreselectCourse, QueryCourse, WishlistItem};
use serde::Serialize;
use tauri::State;

use crate::app_state::AppState;

#[derive(Debug, Clone, Serialize)]
pub struct AuthStateView {
    pub logged_in: bool,
    pub username: Option<String>,
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
    pub bots: Vec<BotView>,
    pub courses: Vec<Course>,
    pub preselect_courses: Vec<PreselectCourse>,
    pub plan_courses: Vec<PlanCourse>,
    pub query_courses: Vec<QueryCourse>,
    pub wishlist: Vec<WishlistItem>,
}

pub async fn build_snapshot(state: &AppState) -> SnapshotView {
    let auth = {
        let username = state.auth_username.lock().await.clone();
        AuthStateView {
            logged_in: username.is_some(),
            username,
        }
    };

    let orchestrator = state.orchestrator.lock().await;
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
        bots,
        courses: orchestrator.latest_courses().to_vec(),
        preselect_courses: orchestrator.latest_preselect_courses().to_vec(),
        plan_courses: orchestrator.latest_plan_courses().to_vec(),
        query_courses: orchestrator.latest_query_courses().to_vec(),
        wishlist: orchestrator.wishlist().to_vec(),
    }
}

#[tauri::command]
pub async fn get_snapshot(state: State<'_, AppState>) -> Result<SnapshotView, String> {
    Ok(build_snapshot(&state).await)
}
