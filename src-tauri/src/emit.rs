use tauri::{AppHandle, Emitter};

use crate::{
    app_state::AppState,
    commands::snapshot::{self, AuthStateView, BotView, SnapshotView},
};

pub const EVENT_SNAPSHOT: &str = "app://snapshot";
pub const EVENT_AUTH: &str = "app://auth-updated";
pub const EVENT_BOTS: &str = "app://bots-updated";
pub const EVENT_COURSES: &str = "app://courses-updated";
pub const EVENT_WISHLIST: &str = "app://wishlist-updated";
pub const EVENT_CONFIG: &str = "app://config-updated";
pub const EVENT_MESSAGE: &str = "app://message";

#[derive(Debug, Clone, serde::Serialize)]
pub struct MessageEvent {
    pub kind: String,
    pub text: String,
}

pub async fn emit_snapshot_events(
    app: &AppHandle,
    state: &AppState,
) -> Result<SnapshotView, String> {
    let snapshot = snapshot::build_snapshot(state).await;

    app.emit(EVENT_SNAPSHOT, &snapshot)
        .map_err(|err| err.to_string())?;
    app.emit(EVENT_AUTH, &snapshot.auth)
        .map_err(|err| err.to_string())?;
    app.emit(EVENT_BOTS, &snapshot.bots)
        .map_err(|err| err.to_string())?;
    app.emit(EVENT_COURSES, &snapshot.courses)
        .map_err(|err| err.to_string())?;
    app.emit(EVENT_WISHLIST, &snapshot.wishlist)
        .map_err(|err| err.to_string())?;
    app.emit(EVENT_CONFIG, &snapshot.config)
        .map_err(|err| err.to_string())?;

    Ok(snapshot)
}

pub fn emit_message(
    app: &AppHandle,
    kind: impl Into<String>,
    text: impl Into<String>,
) -> Result<(), String> {
    let payload = MessageEvent {
        kind: kind.into(),
        text: text.into(),
    };
    app.emit(EVENT_MESSAGE, payload)
        .map_err(|err| err.to_string())
}

#[allow(dead_code)]
pub fn _touch_types(_: (&AuthStateView, &BotView)) {}
