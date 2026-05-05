use std::{
    fs,
    path::{Path, PathBuf},
};

use heed_core::{AuthSession, Channel, ElectiveSession, HeedError};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::{app_state::AppState, logger};

const SESSION_FILE_NAME: &str = "session.json";

#[derive(Debug, Serialize, Deserialize)]
struct PersistedSession {
    username: String,
    channel: Option<Channel>,
    cookies_json: String,
}

pub async fn persist_session(app: &AppHandle, session: &ElectiveSession) -> Result<(), String> {
    let auth = session.auth_session();
    let path = session_file_path(app)?;
    let cookies_json = auth.persist_cookies_json().map_err(|err| err.to_string())?;
    let persisted = PersistedSession {
        username: auth.username().to_string(),
        channel: auth.channel().cloned(),
        cookies_json,
    };
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let json = serde_json::to_vec_pretty(&persisted).map_err(|err| err.to_string())?;
    fs::write(&path, json).map_err(|err| err.to_string())?;
    logger::info(format!(
        "persisted session for user {} to {} with {} cookies",
        persisted.username,
        path.display(),
        count_cookie_records(&persisted.cookies_json)
    ));
    Ok(())
}

pub fn clear_persisted_session(app: &AppHandle) -> Result<(), String> {
    let path = session_file_path(app)?;
    match fs::remove_file(&path) {
        Ok(()) => {
            logger::info(format!("cleared persisted session file {}", path.display()));
            Ok(())
        }
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}

pub async fn restore_session_on_startup(
    app: &AppHandle,
    state: &AppState,
) -> Result<bool, String> {
    let Some(persisted) = load_persisted_session(app)? else {
        logger::info("no persisted session file found");
        return Ok(false);
    };
    logger::info(format!(
        "attempting to restore session for user {} with {} cookies",
        persisted.username,
        count_cookie_records(&persisted.cookies_json)
    ));

    let auth = match AuthSession::from_persisted_cookies(
        persisted.username.clone(),
        persisted.channel.clone(),
        &persisted.cookies_json,
    ) {
        Ok(auth) => auth,
        Err(err) => {
            logger::warn(format!(
                "persisted session cookies were invalid for user {}; clearing session file: {}",
                persisted.username, err
            ));
            clear_persisted_session(app)?;
            return Ok(false);
        }
    };

    let session = ElectiveSession::new(auth);
    match session.auth_session().verify_alive().await {
        Ok(_) => {
            {
                let mut guard = state.manual_session.lock().await;
                *guard = Some(session);
            }
            {
                let mut guard = state.auth_username.lock().await;
                *guard = Some(persisted.username);
            }
            logger::info("persisted session verified successfully on startup");
            Ok(true)
        }
        Err(HeedError::SessionExpired) | Err(HeedError::AuthFailed(_)) => {
            logger::warn("persisted session was expired or rejected during startup verification; clearing session file");
            clear_persisted_session(app)?;
            Ok(false)
        }
        Err(err) => {
            logger::error(format!("failed to refresh persisted session on startup: {err}"));
            Err(err.to_string())
        }
    }
}

pub async fn clear_session_and_auth(app: &AppHandle, state: &AppState) -> Result<(), String> {
    state.clear_auth_state().await;
    clear_persisted_session(app)
}

pub async fn handle_session_result<T>(
    result: Result<T, HeedError>,
    app: &AppHandle,
    state: &AppState,
) -> Result<T, String> {
    match result {
        Ok(value) => Ok(value),
        Err(HeedError::SessionExpired) => {
            logger::warn("session expired during command execution");
            clear_session_and_auth(app, state).await?;
            Err("session expired".to_string())
        }
        Err(err) => {
            logger::error(format!("session command failed: {err}"));
            Err(err.to_string())
        }
    }
}

fn load_persisted_session(app: &AppHandle) -> Result<Option<PersistedSession>, String> {
    let path = session_file_path(app)?;
    if !path.exists() {
        return Ok(None);
    }

    let bytes = fs::read(&path).map_err(|err| err.to_string())?;
    logger::info(format!(
        "loading persisted session from {} ({} bytes)",
        path.display(),
        bytes.len()
    ));
    serde_json::from_slice(&bytes)
        .map(Some)
        .map_err(|err| err.to_string())
}

fn session_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    Ok(dir.join(Path::new(SESSION_FILE_NAME)))
}

fn count_cookie_records(cookies_json: &str) -> usize {
    serde_json::from_str::<Vec<serde_json::Value>>(cookies_json)
        .map(|items| items.len())
        .unwrap_or(0)
}
