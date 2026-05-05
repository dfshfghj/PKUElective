use async_trait::async_trait;

use crate::error::Result;

#[async_trait]
pub trait Notifier: Send + Sync {
    async fn notify(&self, message: &str) -> Result<()>;
}

pub struct NoopNotifier;

#[async_trait]
impl Notifier for NoopNotifier {
    async fn notify(&self, _message: &str) -> Result<()> {
        Ok(())
    }
}
