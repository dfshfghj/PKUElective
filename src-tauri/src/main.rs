#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_state;
mod auth_persistence;
mod commands;
mod emit;
mod logger;
mod session_persistence;

use crate::app_state::AppState;
use tauri::Manager;

fn main() {
    logger::install_panic_hook();

    tauri::Builder::default()
        .setup(|app| {
            let log_path = logger::init(&app.handle())?;
            logger::info(format!("application starting; log file at {}", log_path.display()));
            logger::info(format!(
                "secure credential backend configured as {}",
                auth_persistence::secure_store_backend_name()
            ));

            app.manage(AppState::default());
            let handle = app.handle().clone();
            let state = app.state::<AppState>();
            tauri::async_runtime::block_on(async move {
                match auth_persistence::restore_auth_on_startup(&handle, state.inner()).await {
                    Ok(restored) => {
                        if restored {
                            logger::info("auth restored on startup");
                        } else {
                            logger::info("no persisted auth restored on startup");
                        }
                    }
                    Err(err) => {
                        logger::error(format!("failed to restore session on startup: {err}"));
                    }
                }
            });
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
        .unwrap_or_else(|err| {
            logger::error(format!("error while running tauri application: {err}"));
            panic!("error while running tauri application: {err}");
        });
}
