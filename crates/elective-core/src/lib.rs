pub mod auth;
pub mod automation;
pub mod bot;
pub mod captcha;
pub mod config;
pub mod course;
pub mod error;
pub mod events;
pub mod notifier;
pub mod parser;
pub mod session;
pub mod service;
pub mod types;

pub use auth::{AuthSession, Credentials};
pub use automation::{AutomationManager, AutomationTick};
pub use bot::{BotStatus, ElectiveBot};
pub use config::AppConfig;
pub use course::{
    Course, CourseDetail, CourseResult, ElectiveResults, ElectiveScheduleRow, Pagination,
    PaginationLink, PlanCourse, PreselectCourse, PreselectedCourse, QueryCourse,
    SupplementAvailableCourse, SupplementPage, SupplementSelectedCourse, Timetable, TimetableCell,
    TimetableRow, WishlistItem,
};
pub use error::{ElectiveError, Result};
pub use session::{
    CourseQueryFilters, ElectiveSession, PlanPageData, PreselectOperationResult,
    PreselectPageData, QueryPageData, SelectResult,
};
pub use service::ElectiveService;
pub use types::{BotId, Channel};
