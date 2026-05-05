use heed_core::{AppConfig, Credentials, ElectiveSession, Orchestrator};
use tokio::sync::Mutex;

pub struct AppState {
    pub orchestrator: Mutex<Orchestrator>,
    pub credentials: Mutex<Option<Credentials>>,
    pub manual_session: Mutex<Option<ElectiveSession>>,
    pub auth_username: Mutex<Option<String>>,
}

impl Default for AppState {
    fn default() -> Self {
        let config = AppConfig::default();
        Self {
            orchestrator: Mutex::new(Orchestrator::new(config)),
            credentials: Mutex::new(None),
            manual_session: Mutex::new(None),
            auth_username: Mutex::new(None),
        }
    }
}
