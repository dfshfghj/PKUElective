use heed_core::{AppConfig, Credentials, ElectiveSession, Orchestrator};
use tokio::sync::Mutex;

use crate::auth_persistence::AuthPreferences;

pub struct AppState {
    pub orchestrator: Mutex<Orchestrator>,
    pub credentials: Mutex<Option<Credentials>>,
    pub manual_session: Mutex<Option<ElectiveSession>>,
    pub auth_username: Mutex<Option<String>>,
    pub auth_preferences: Mutex<AuthPreferences>,
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
    }

    pub async fn clear_auth_state(&self) {
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
    }
}
