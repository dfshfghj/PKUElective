use thiserror::Error;

pub type Result<T> = std::result::Result<T, HeedError>;

#[derive(Debug, Error)]
pub enum HeedError {
    #[error("authentication failed: {0}")]
    AuthFailed(String),
    #[error("captcha required")]
    CaptchaRequired,
    #[error("captcha invalid")]
    CaptchaInvalid,
    #[error("session expired")]
    SessionExpired,
    #[error("network error: {0}")]
    Network(String),
    #[error("parse error: {0}")]
    Parse(String),
    #[error("fatal course system error: {0}")]
    Fatal(String),
    #[error("selection failed: {0}")]
    Selection(String),
    #[error("configuration error: {0}")]
    Config(String),
}

impl From<reqwest::Error> for HeedError {
    fn from(value: reqwest::Error) -> Self {
        Self::Network(value.to_string())
    }
}
