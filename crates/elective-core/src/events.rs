use serde::{Deserialize, Serialize};

use crate::{BotStatus, Course, WishlistItem};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum AppEvent {
    BotStatusChanged {
        bot_id: String,
        status: BotStatus,
    },
    CoursesUpdated {
        bot_id: String,
        courses: Vec<Course>,
    },
    WishlistUpdated {
        items: Vec<WishlistItem>,
    },
    CaptchaRequired {
        bot_id: String,
        image_b64: String,
    },
    LogEntry(LogEntry),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub ts: i64,
    pub level: String,
    pub source: String,
    pub message: String,
    pub bot_id: Option<String>,
}
