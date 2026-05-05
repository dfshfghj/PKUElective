use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub auto_refresh: bool,
    pub auto_captcha: bool,
    pub notifications: bool,
    pub interval_ms: u64,
    pub timeout_ms: u64,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            auto_refresh: false,
            auto_captcha: false,
            notifications: false,
            interval_ms: 5_000,
            timeout_ms: 30_000,
        }
    }
}
