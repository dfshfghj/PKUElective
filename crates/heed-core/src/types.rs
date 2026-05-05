use serde::{Deserialize, Serialize};

pub type BotId = String;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Channel {
    Bzx,
    Bfx,
}

impl Channel {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Bzx => "bzx",
            Self::Bfx => "bfx",
        }
    }
}
