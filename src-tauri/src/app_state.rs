use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

use heed_core::{AppConfig, Credentials, ElectiveSession, Orchestrator};
use tokio::sync::Mutex;

use crate::auth_persistence::AuthPreferences;

pub struct AppState {
    pub orchestrator: Mutex<Orchestrator>,
    pub credentials: Mutex<Option<Credentials>>,
    pub manual_session: Mutex<Option<ElectiveSession>>,
    pub auth_username: Mutex<Option<String>>,
    pub auth_preferences: Mutex<AuthPreferences>,
    pub auth_restoring: Mutex<bool>,
    pub automation_running: Mutex<bool>,
    pub elective_data_preloading: AtomicBool,
    pub auth_generation: AtomicU64,
    pub manual_captcha_image_b64: Mutex<Option<String>>,
    pub manual_captcha_verified: Mutex<bool>,
}

impl Default for AppState {
    fn default() -> Self {
        let config = AppConfig::default();
        Self {
            orchestrator: Mutex::new(Orchestrator::new(config)),
            credentials: Mutex::new(None),
            manual_session: Mutex::new(None),
            auth_username: Mutex::new(None),
            auth_preferences: Mutex::new(AuthPreferences::default()),
            auth_restoring: Mutex::new(true),
            automation_running: Mutex::new(false),
            elective_data_preloading: AtomicBool::new(false),
            auth_generation: AtomicU64::new(0),
            manual_captcha_image_b64: Mutex::new(None),
            manual_captcha_verified: Mutex::new(false),
        }
    }
}

impl AppState {
    pub async fn set_auth_state(
        &self,
        credentials: Option<Credentials>,
        session: ElectiveSession,
        username: String,
    ) {
        self.auth_generation.fetch_add(1, Ordering::AcqRel);
        {
            let mut guard = self.credentials.lock().await;
            *guard = credentials;
        }
        {
            let mut guard = self.manual_session.lock().await;
            *guard = Some(session);
        }
        {
            let mut guard = self.auth_username.lock().await;
            *guard = Some(username);
        }
        {
            let mut guard = self.manual_captcha_image_b64.lock().await;
            *guard = None;
        }
        {
            let mut guard = self.manual_captcha_verified.lock().await;
            *guard = false;
        }
    }

    pub async fn clear_auth_state(&self) {
        self.auth_generation.fetch_add(1, Ordering::AcqRel);
        self.elective_data_preloading.store(false, Ordering::Release);
        {
            let mut credentials = self.credentials.lock().await;
            *credentials = None;
        }
        {
            let mut session = self.manual_session.lock().await;
            *session = None;
        }
        {
            let mut auth_username = self.auth_username.lock().await;
            *auth_username = None;
        }
        {
            let mut orchestrator = self.orchestrator.lock().await;
            orchestrator.clear_runtime_state();
        }
        {
            let mut captcha = self.manual_captcha_image_b64.lock().await;
            *captcha = None;
        }
        {
            let mut verified = self.manual_captcha_verified.lock().await;
            *verified = false;
        }
    }

    pub async fn finish_auth_restore(&self) {
        let mut restoring = self.auth_restoring.lock().await;
        *restoring = false;
    }
}
