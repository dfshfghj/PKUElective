use std::sync::atomic::Ordering;

use base64::Engine;
use tauri::{AppHandle, Manager};

use crate::{app_state::AppState, emit::emit_snapshot_events, logger};

pub fn spawn(app: AppHandle) {
    let state = app.state::<AppState>();
    if state
        .elective_data_preloading
        .compare_exchange(false, true, Ordering::AcqRel, Ordering::Relaxed)
        .is_err()
    {
        return;
    }
    let generation = state.auth_generation.load(Ordering::Acquire);

    tauri::async_runtime::spawn(async move {
        preload(app.clone(), generation).await;
        let state = app.state::<AppState>();
        if state.auth_generation.load(Ordering::Acquire) != generation {
            return;
        }
        state
            .elective_data_preloading
            .store(false, Ordering::Release);
        if let Err(err) = emit_snapshot_events(&app, state.inner()).await {
            logger::error(format!(
                "failed to emit completed elective preload snapshot: {err}"
            ));
        }
    });
}

async fn preload(app: AppHandle, generation: u64) {
    let state = app.state::<AppState>();
    let (session, username) = {
        let session = state.manual_session.lock().await.clone();
        let username = state.auth_username.lock().await.clone();
        let (Some(session), Some(username)) = (session, username) else {
            return;
        };
        (session, username)
    };

    logger::info("starting background elective data preload");

    match session.fetch_elective_schedule().await {
        Ok(schedule) if is_current_user(&state, &username, generation).await => {
            *state.elective_schedule.lock().await = schedule;
            emit_progress(&app, &state, "schedule").await;
        }
        Ok(_) => return,
        Err(err) => logger::warn(format!("failed to preload schedule data: {err}")),
    }

    match session.refresh_preselect_data().await {
        Ok((courses, selected_courses)) if is_current_user(&state, &username, generation).await => {
            let mut orchestrator = state.orchestrator.lock().await;
            orchestrator.set_latest_preselect_courses(courses);
            orchestrator.set_latest_preselected_courses(selected_courses);
            drop(orchestrator);
            emit_progress(&app, &state, "preselect").await;
        }
        Ok(_) => return,
        Err(err) => logger::warn(format!("failed to preload preselect data: {err}")),
    }

    match session.refresh_plan_courses().await {
        Ok(courses) if is_current_user(&state, &username, generation).await => {
            state
                .orchestrator
                .lock()
                .await
                .set_latest_plan_courses(courses);
            emit_progress(&app, &state, "plan").await;
        }
        Ok(_) => return,
        Err(err) => logger::warn(format!("failed to preload plan data: {err}")),
    }

    match session.refresh_supplement_page().await {
        Ok(page) if is_current_user(&state, &username, generation).await => {
            state
                .orchestrator
                .lock()
                .await
                .set_latest_supplement_page(page);
            if let Ok(captcha) = session.fetch_captcha().await
                && is_current_user(&state, &username, generation).await
            {
                *state.manual_captcha_image_b64.lock().await =
                    Some(base64::engine::general_purpose::STANDARD.encode(captcha));
            }
            emit_progress(&app, &state, "supplement").await;
        }
        Ok(_) => return,
        Err(err) => logger::warn(format!("failed to preload supplement data: {err}")),
    }

    match session.refresh_results().await {
        Ok(results) if is_current_user(&state, &username, generation).await => {
            state.orchestrator.lock().await.set_latest_results(results);
            emit_progress(&app, &state, "results").await;
        }
        Ok(_) => return,
        Err(err) => logger::warn(format!("failed to preload results data: {err}")),
    }

    logger::info("background elective data preload finished");
}

async fn is_current_user(state: &AppState, username: &str, generation: u64) -> bool {
    state.auth_generation.load(Ordering::Acquire) == generation
        && state.auth_username.lock().await.as_deref() == Some(username)
}

async fn emit_progress(app: &AppHandle, state: &AppState, section: &str) {
    logger::info(format!("preloaded elective {section} data"));
    if let Err(err) = emit_snapshot_events(app, state).await {
        logger::error(format!(
            "failed to emit elective preload snapshot for {section}: {err}"
        ));
    }
}
