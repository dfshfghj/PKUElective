#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app_state;
mod auth_persistence;
mod commands;
mod emit;
mod logger;
mod session_persistence;

use crate::app_state::AppState;
use crate::emit::emit_snapshot_events;
use tauri::Manager;

fn main() {
    logger::install_panic_hook();

    tauri::Builder::default()
        .setup(|app| {
            let log_path = logger::init(&app.handle())?;
            logger::info(format!(
                "application starting; log file at {}",
                log_path.display()
            ));
            logger::info(format!(
                "secure credential backend configured as {}",
                auth_persistence::secure_store_backend_name()
            ));

            app.manage(AppState::default());
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let state = handle.state::<AppState>();
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
                state.finish_auth_restore().await;
                if let Err(err) = emit_snapshot_events(&handle, state.inner()).await {
                    logger::error(format!("failed to emit startup snapshot events: {err}"));
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::login,
            commands::auth::logout,
            commands::snapshot::get_snapshot,
            commands::bot::add_bot,
            commands::bot::refresh_bot_captcha,
            commands::bot::refresh_now,
            commands::bot::refresh_automation_courses,
            commands::bot::refresh_preselect_courses,
            commands::bot::refresh_plan_courses,
            commands::bot::refresh_results,
            commands::bot::verify_bot_captcha,
            commands::elective::search_query_courses,
            commands::elective::refresh_supplement_page,
            commands::elective::refresh_supplement_captcha,
            commands::elective::add_course_to_plan,
            commands::elective::remove_plan_course,
            commands::elective::preselect_course,
            commands::elective::cancel_preselect_course,
            commands::elective::supplement_select_course,
            commands::elective::supplement_cancel_course,
            commands::elective::verify_supplement_captcha,
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
