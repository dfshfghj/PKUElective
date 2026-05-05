mod app_state;
mod commands;
mod emit;

use crate::app_state::AppState;
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            app.manage(AppState::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::login,
            commands::auth::logout,
            commands::snapshot::get_snapshot,
            commands::bot::add_bot,
            commands::bot::refresh_now,
            commands::bot::refresh_preselect_courses,
            commands::bot::refresh_plan_courses,
            commands::elective::search_query_courses,
            commands::elective::add_course_to_plan,
            commands::elective::remove_plan_course,
            commands::elective::preselect_course,
            commands::wishlist::add_wishlist,
            commands::wishlist::remove_wishlist,
            commands::config::update_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
