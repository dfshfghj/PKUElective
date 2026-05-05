use std::{
    fs,
    path::{Path, PathBuf},
};

use heed_core::{Channel, Credentials, ElectiveSession};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

use crate::{app_state::AppState, logger, session_persistence};

const AUTH_PREFERENCES_FILE_NAME: &str = "auth_preferences.json";
const PASSWORD_SERVICE_SUFFIX: &str = ".elective.password";

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AuthPreferences {
    pub saved_username: Option<String>,
    pub saved_channel: Option<Channel>,
    pub remember_password: bool,
    pub auto_login: bool,
}

#[derive(Debug, Clone, Copy)]
pub struct LoginPersistenceOptions {
    pub remember_password: bool,
    pub auto_login: bool,
}

pub async fn initialize_auth_preferences(app: &AppHandle, state: &AppState) -> Result<(), String> {
    let preferences = load_auth_preferences(app)?;
    let mut guard = state.auth_preferences.lock().await;
    *guard = preferences;
    Ok(())
}

pub async fn persist_login_artifacts(
    app: &AppHandle,
    state: &AppState,
    credentials: &Credentials,
    options: LoginPersistenceOptions,
) -> Result<AuthPreferences, String> {
    let previous = state.auth_preferences.lock().await.clone();
    let mut effective = AuthPreferences {
        saved_username: Some(credentials.username.clone()),
        saved_channel: credentials.channel.clone(),
        remember_password: options.remember_password,
        auto_login: options.remember_password && options.auto_login,
    };

    if effective.remember_password {
        match store_password(app, &credentials.username, &credentials.password) {
            Ok(()) => {
                logger::info(format!(
                    "stored password in secure credential store for user {} (service: {})",
                    credentials.username,
                    password_service_name(app)
                ));
            }
            Err(err) => {
                logger::warn(format!(
                    "failed to store password in secure credential store for user {} (service: {}): {}",
                    credentials.username,
                    password_service_name(app),
                    err
                ));
                effective.remember_password = false;
                effective.auto_login = false;
            }
        }
    }

    if previous.saved_username.as_deref() != Some(credentials.username.as_str()) {
        if let Some(previous_username) = previous.saved_username.as_deref() {
            let _ = delete_password(app, previous_username);
        }
    }

    if !effective.remember_password {
        let _ = delete_password(app, &credentials.username);
    }

    save_auth_preferences(app, &effective)?;
    {
        let mut guard = state.auth_preferences.lock().await;
        *guard = effective.clone();
    }
    Ok(effective)
}

pub async fn hydrate_credentials_from_secure_store(
    app: &AppHandle,
    state: &AppState,
) -> Result<bool, String> {
    let preferences = state.auth_preferences.lock().await.clone();
    let Some(username) = preferences.saved_username else {
        return Ok(false);
    };
    if !preferences.remember_password {
        return Ok(false);
    }

    match load_password(app, &username)? {
        Some(password) => {
            logger::info(format!(
                "loaded password from secure credential store for user {} (service: {})",
                username,
                password_service_name(app)
            ));
            let credentials = Credentials {
                username,
                password,
                channel: preferences.saved_channel,
            };
            let mut guard = state.credentials.lock().await;
            *guard = Some(credentials);
            Ok(true)
        }
        None => {
            logger::warn(format!(
                "remember_password was enabled but secure credential store had no password (service: {}, user: {})",
                password_service_name(app),
                username
            ));
            Ok(false)
        }
    }
}

pub async fn restore_auth_on_startup(app: &AppHandle, state: &AppState) -> Result<bool, String> {
    initialize_auth_preferences(app, state).await?;

    if session_persistence::restore_session_on_startup(app, state).await? {
        let _ = hydrate_credentials_from_secure_store(app, state).await?;
        return Ok(true);
    }

    let preferences = state.auth_preferences.lock().await.clone();
    if !preferences.auto_login || !preferences.remember_password {
        return Ok(false);
    }

    let Some(username) = preferences.saved_username.clone() else {
        return Ok(false);
    };

    let Some(password) = load_password(app, &username)? else {
        logger::warn(format!(
            "auto login enabled, but no stored password was found (service: {}, user: {})",
            password_service_name(app),
            username
        ));
        let updated = AuthPreferences {
            auto_login: false,
            remember_password: false,
            ..preferences
        };
        save_auth_preferences(app, &updated)?;
        let mut guard = state.auth_preferences.lock().await;
        *guard = updated;
        return Ok(false);
    };

    let credentials = Credentials {
        username: username.clone(),
        password,
        channel: preferences.saved_channel.clone(),
    };
    let session = ElectiveSession::login(&credentials)
        .await
        .map_err(|err| err.to_string())?;
    session_persistence::persist_session(app, &session).await?;
    state
        .set_auth_state(Some(credentials), session, username.clone())
        .await;
    logger::info(format!("restored auth using secure credential store for user {}", username));
    Ok(true)
}

pub async fn disable_auto_login(app: &AppHandle, state: &AppState) -> Result<(), String> {
    let mut preferences = state.auth_preferences.lock().await.clone();
    if !preferences.auto_login {
        return Ok(());
    }
    preferences.auto_login = false;
    save_auth_preferences(app, &preferences)?;
    let mut guard = state.auth_preferences.lock().await;
    *guard = preferences;
    Ok(())
}

pub fn secure_store_available() -> bool {
    cfg!(not(target_os = "android"))
}

pub fn secure_store_backend_name() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "windows-native"
    }
    #[cfg(target_os = "macos")]
    {
        "apple-native"
    }
    #[cfg(target_os = "linux")]
    {
        "linux-native-sync-persistent"
    }
    #[cfg(target_os = "android")]
    {
        "android-adapter-pending"
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux", target_os = "android")))]
    {
        "unsupported"
    }
}

pub fn auth_preferences_to_channel_string(channel: Option<&Channel>) -> Option<String> {
    channel.map(|value| value.as_str().to_string())
}

fn load_auth_preferences(app: &AppHandle) -> Result<AuthPreferences, String> {
    let path = auth_preferences_file_path(app)?;
    if !path.exists() {
        return Ok(AuthPreferences::default());
    }

    let bytes = fs::read(path).map_err(|err| err.to_string())?;
    serde_json::from_slice(&bytes).map_err(|err| err.to_string())
}

fn save_auth_preferences(app: &AppHandle, preferences: &AuthPreferences) -> Result<(), String> {
    let path = auth_preferences_file_path(app)?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let bytes = serde_json::to_vec_pretty(preferences).map_err(|err| err.to_string())?;
    fs::write(path, bytes).map_err(|err| err.to_string())
}

fn auth_preferences_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|err| err.to_string())?;
    Ok(dir.join(Path::new(AUTH_PREFERENCES_FILE_NAME)))
}

#[cfg(not(target_os = "android"))]
fn store_password(app: &AppHandle, username: &str, password: &str) -> Result<(), String> {
    let service = password_service_name(app);
    logger::info(format!(
        "attempting to store password in secure credential store (service: {}, user: {})",
        service, username
    ));
    let entry = keyring::Entry::new(&service, username).map_err(|err| err.to_string())?;
    entry.set_password(password).map_err(|err| err.to_string())?;
    match entry.get_password() {
        Ok(loaded) => {
            if loaded == password {
                logger::info(format!(
                    "verified secure credential round-trip after store (service: {}, user: {})",
                    service, username
                ));
                Ok(())
            } else {
                Err(format!(
                    "secure credential round-trip mismatch after store (service: {}, user: {})",
                    service, username
                ))
            }
        }
        Err(err) => Err(format!(
            "stored password but failed immediate read-back (service: {}, user: {}): {}",
            service, username, err
        )),
    }
}

#[cfg(target_os = "android")]
fn store_password(_app: &AppHandle, _username: &str, _password: &str) -> Result<(), String> {
    Err("android secure credential storage adapter is not wired in this build yet".to_string())
}

#[cfg(not(target_os = "android"))]
fn load_password(app: &AppHandle, username: &str) -> Result<Option<String>, String> {
    let service = password_service_name(app);
    logger::info(format!(
        "attempting to load password from secure credential store (service: {}, user: {})",
        service, username
    ));
    let entry = keyring::Entry::new(&service, username).map_err(|err| err.to_string())?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => {
            logger::warn(format!(
                "secure credential store returned no entry (service: {}, user: {})",
                service, username
            ));
            Ok(None)
        }
        Err(err) => Err(format!(
            "secure credential store read failed (service: {}, user: {}): {}",
            service, username, err
        )),
    }
}

#[cfg(target_os = "android")]
fn load_password(_app: &AppHandle, _username: &str) -> Result<Option<String>, String> {
    Ok(None)
}

#[cfg(not(target_os = "android"))]
fn delete_password(app: &AppHandle, username: &str) -> Result<(), String> {
    let service = password_service_name(app);
    logger::info(format!(
        "attempting to delete password from secure credential store (service: {}, user: {})",
        service, username
    ));
    let entry = keyring::Entry::new(&service, username).map_err(|err| err.to_string())?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(format!(
            "secure credential store delete failed (service: {}, user: {}): {}",
            service, username, err
        )),
    }
}

#[cfg(target_os = "android")]
fn delete_password(_app: &AppHandle, _username: &str) -> Result<(), String> {
    Ok(())
}

fn password_service_name(app: &AppHandle) -> String {
    format!("{}{}", app.config().identifier, PASSWORD_SERVICE_SUFFIX)
}
