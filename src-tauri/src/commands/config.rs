use elective_core::{AppConfig, ElectiveError};
use serde::Deserialize;
use tauri::{AppHandle, Manager, State};

use crate::app_state::AppState;
use crate::commands::bot::auto_verify_bot_captcha;
use crate::commands::snapshot::SnapshotView;
use crate::emit::{emit_message, emit_snapshot_events};
use crate::logger;

#[derive(Debug, Deserialize)]
pub struct ConfigPatch {
    pub auto_refresh: Option<bool>,
    pub auto_captcha: Option<bool>,
    pub notifications: Option<bool>,
    pub interval_ms: Option<u64>,
    pub timeout_ms: Option<u64>,
}

#[tauri::command]
pub async fn update_config(
    patch: ConfigPatch,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<SnapshotView, String> {
    logger::info("command: update_config");
    {
        let mut orchestrator = state.orchestrator.lock().await;
        let current = orchestrator.config().clone();
        let merged = merge_config(current, patch);
        orchestrator.replace_config(merged.clone());
    }

    emit_message(&app, "success", "配置已更新。")?;
    ensure_automation_runner(app.clone()).await;
    emit_snapshot_events(&app, &state).await
}

fn merge_config(current: AppConfig, patch: ConfigPatch) -> AppConfig {
    AppConfig {
        auto_refresh: patch.auto_refresh.unwrap_or(current.auto_refresh),
        auto_captcha: patch.auto_captcha.unwrap_or(current.auto_captcha),
        notifications: patch.notifications.unwrap_or(current.notifications),
        interval_ms: patch.interval_ms.unwrap_or(current.interval_ms),
        timeout_ms: patch.timeout_ms.unwrap_or(current.timeout_ms),
    }
}

async fn ensure_automation_runner(app: AppHandle) {
    let state = app.state::<AppState>();
    let should_run = {
        let orchestrator = state.orchestrator.lock().await;
        orchestrator.config().auto_refresh
    };
    if !should_run {
        return;
    }

    {
        let mut running = state.automation_running.lock().await;
        if *running {
            return;
        }
        *running = true;
    }

    tauri::async_runtime::spawn(async move {
        logger::info("automation runner started");
        loop {
            let state = app.state::<AppState>();
            let (should_continue, interval_ms) = {
                let orchestrator = state.orchestrator.lock().await;
                let config = orchestrator.config().clone();
                (config.auto_refresh, config.interval_ms.max(500))
            };

            if !should_continue {
                break;
            }

            let tick_result = {
                let mut orchestrator = state.orchestrator.lock().await;
                orchestrator.run_automation_once().await
            };

            match tick_result {
                Ok(tick) => {
                    if let Some(course) = tick.selected_course {
                        let message = tick
                            .select_result
                            .as_ref()
                            .map(|result| result.message.as_str())
                            .filter(|message| !message.is_empty())
                            .unwrap_or("补选请求已完成。");
                        let kind = if tick.select_result.as_ref().is_some_and(|result| result.ok) {
                            "success"
                        } else {
                            "warn"
                        };
                        let _ = emit_message(&app, kind, format!("自动抢课：{course}，{message}"));
                    } else {
                        logger::info(format!(
                            "automation tick checked {} courses; no target selected",
                            tick.checked_courses
                        ));
                    }
                }
                Err(err) => {
                    let _ = emit_message(&app, "error", format!("自动化刷新失败：{err}"));
                    if matches!(err, ElectiveError::SessionExpired) {
                        recover_bot_captcha(&app, &state).await;
                    }
                }
            }

            if let Err(err) = emit_snapshot_events(&app, state.inner()).await {
                logger::error(format!("failed to emit automation snapshot events: {err}"));
            }

            tokio::time::sleep(std::time::Duration::from_millis(interval_ms)).await;
        }

        let state = app.state::<AppState>();
        {
            let mut running = state.automation_running.lock().await;
            *running = false;
        }
        logger::info("automation runner stopped");
        if let Err(err) = emit_snapshot_events(&app, state.inner()).await {
            logger::error(format!(
                "failed to emit stopped automation snapshot events: {err}"
            ));
        }
    });
}

async fn recover_bot_captcha(app: &AppHandle, state: &AppState) {
    let (enabled, bot_ids) = {
        let orchestrator = state.orchestrator.lock().await;
        (
            orchestrator.config().auto_captcha,
            orchestrator.bots_requiring_captcha(),
        )
    };
    if !enabled || state.captcha_recognizer().is_none() {
        return;
    }
    for bot_id in bot_ids {
        let refreshed = {
            let mut orchestrator = state.orchestrator.lock().await;
            orchestrator.refresh_bot_captcha(&bot_id).await
        };
        if refreshed.is_err() {
            continue;
        }
        let _ = emit_message(
            app,
            "info",
            format!("{bot_id} session 已失效，正在重新识别验证码…"),
        );
        match auto_verify_bot_captcha(state, &bot_id).await {
            Ok(()) => {
                let _ = emit_message(app, "success", format!("{bot_id} 已恢复验证。"));
            }
            Err(error) => {
                let _ = emit_message(
                    app,
                    "warn",
                    format!("{bot_id} 自动恢复失败，请手动输入：{error}"),
                );
            }
        }
    }
}
