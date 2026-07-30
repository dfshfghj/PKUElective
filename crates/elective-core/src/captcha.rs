use async_trait::async_trait;

use crate::error::Result;

#[async_trait]
pub trait CaptchaProvider: Send + Sync {
    async fn recognize(&self, image: &[u8]) -> Result<String>;
}

pub struct NoopCaptchaProvider;

#[async_trait]
impl CaptchaProvider for NoopCaptchaProvider {
    async fn recognize(&self, _image: &[u8]) -> Result<String> {
        Ok(String::new())
    }
}
