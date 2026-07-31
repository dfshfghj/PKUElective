mod app_state;
mod auth_persistence;
mod commands;
mod course_reviews;
mod elective_preload;
mod emit;
mod inject;
mod logger;
mod session_persistence;

use crate::app_state::AppState;
use crate::emit::emit_snapshot_events;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(mobile)]
    let _ = rustls::crypto::ring::default_provider().install_default();

    logger::install_panic_hook();

    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            let log_path = logger::init(&app.handle())?;
            logger::info(format!(
                "application starting; log file at {}",
                log_path.display()
            ));
            if let Err(err) = auth_persistence::initialize_secure_store() {
                logger::warn(format!(
                    "failed to initialize secure credential store: {err}"
                ));
            }
            logger::info(format!(
                "secure credential backend configured as {} (available: {})",
                auth_persistence::secure_store_backend_name(),
                auth_persistence::secure_store_available()
            ));

            app.manage(AppState::default());
            app.manage(course_reviews::CourseReviewState::new());
            let handle = app.handle().clone();
            let review_handle = handle.clone();
            tauri::async_runtime::spawn(async move {
                let state = review_handle.state::<course_reviews::CourseReviewState>();
                course_reviews::initialize(review_handle.clone(), state.inner()).await;
            });
            tauri::async_runtime::spawn(async move {
                let state = handle.state::<AppState>();
                match auth_persistence::restore_auth_on_startup(&handle, state.inner()).await {
                    Ok(restored) => {
                        if restored {
                            logger::info("auth restored on startup");
                            elective_preload::spawn(handle.clone());
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
            commands::elective::fetch_course_detail,
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
            course_reviews::find_course_review,
            course_reviews::open_course_review_webview,
            course_reviews::resize_course_review_webview,
            course_reviews::show_course_review_webview,
            course_reviews::hide_course_review_webview,
            course_reviews::close_course_review_webview,
            commands::settings::get_app_info,
            commands::settings::export_app_log,
            commands::settings::clear_app_log,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|err| {
            logger::error(format!("error while running tauri application: {err}"));
            panic!("error while running tauri application: {err}");
        });
}
