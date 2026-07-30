pub mod auth;
pub mod bot;
pub mod captcha;
pub mod config;
pub mod course;
pub mod error;
pub mod events;
pub mod notifier;
pub mod orchestrator;
pub mod parser;
pub mod session;
pub mod types;

pub use auth::{AuthSession, Credentials};
pub use bot::{BotStatus, ElectiveBot};
pub use config::AppConfig;
pub use course::{
    Course, CourseDetail, CourseResult, ElectiveResults, ElectiveScheduleRow, PlanCourse, PreselectCourse, PreselectedCourse, QueryCourse,
    SupplementAvailableCourse, SupplementPage, SupplementSelectedCourse, Timetable, TimetableCell,
    TimetableRow, WishlistItem,
};
pub use error::{ElectiveError, Result};
pub use orchestrator::Orchestrator;
pub use session::{CourseQueryFilters, ElectiveSession, SelectResult};
pub use types::{BotId, Channel};
