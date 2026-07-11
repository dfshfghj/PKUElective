use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Course {
    pub name: String,
    pub class_id: String,
    pub teacher: String,
    pub select_url: String,
    pub volume_cnt: u32,
    pub elected_cnt: u32,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct SupplementPage {
    pub notices: Vec<String>,
    pub available_courses: Vec<SupplementAvailableCourse>,
    pub selected_courses: Vec<SupplementSelectedCourse>,
    pub selected_credits: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SupplementAvailableCourse {
    pub course_id: String,
    pub name: String,
    pub category: String,
    pub credits: String,
    pub weekly_hours: String,
    pub teacher: String,
    pub class_id: String,
    pub department: String,
    pub grade: String,
    pub schedule: String,
    pub pnp_status: String,
    pub volume_cnt: u32,
    pub elected_cnt: u32,
    pub action_label: String,
    pub select_url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SupplementSelectedCourse {
    pub course_id: String,
    pub name: String,
    pub category: String,
    pub credits: String,
    pub weekly_hours: String,
    pub teacher: String,
    pub class_id: String,
    pub department: String,
    pub grade: String,
    pub schedule: String,
    pub pnp_status: String,
    pub volume_cnt: u32,
    pub elected_cnt: u32,
    pub status: String,
    pub cancel_url: Option<String>,
}

impl Course {
    pub fn selectable(&self) -> bool {
        self.elected_cnt < self.volume_cnt
    }

    pub fn remaining(&self) -> u32 {
        self.volume_cnt.saturating_sub(self.elected_cnt)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PreselectCourse {
    pub course_id: String,
    pub name: String,
    pub category: String,
    pub credits: String,
    pub weekly_hours: String,
    pub teacher: String,
    pub class_id: String,
    pub department: String,
    pub grade: String,
    pub schedule: String,
    pub pnp_status: String,
    pub volume_cnt: u32,
    pub elected_cnt: u32,
    pub preference_value: String,
    pub select_url: String,
}

impl PreselectCourse {
    pub fn remaining(&self) -> u32 {
        self.volume_cnt.saturating_sub(self.elected_cnt)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PreselectedCourse {
    pub course_id: String,
    pub name: String,
    pub category: String,
    pub credits: String,
    pub weekly_hours: String,
    pub teacher: String,
    pub class_id: String,
    pub department: String,
    pub grade: String,
    pub schedule: String,
    pub pnp_status: String,
    pub volume_cnt: u32,
    pub elected_cnt: u32,
    pub preference_value: String,
    pub cancel_url: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PlanCourse {
    pub course_id: String,
    pub name: String,
    pub class_id: String,
    pub category: String,
    pub grade: String,
    pub credits: String,
    pub weekly_hours: String,
    pub total_hours: String,
    pub schedule: String,
    pub pnp_status: String,
    pub selection_mark: String,
    pub delete_url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct QueryCourse {
    pub course_id: String,
    pub name: String,
    pub category: String,
    pub credits: String,
    pub teacher: String,
    pub class_id: String,
    pub department: String,
    pub major: String,
    pub grade: String,
    pub schedule: String,
    pub volume_cnt: u32,
    pub elected_cnt: u32,
    pub pnp_status: String,
    pub note: String,
    pub add_to_plan_url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CourseResult {
    pub course_id: String,
    pub name: String,
    pub category: String,
    pub credits: String,
    pub weekly_hours: String,
    pub teacher: String,
    pub class_id: String,
    pub department: String,
    pub classroom_info: String,
    pub pnp_status: String,
    pub result: String,
    pub ip_address: String,
    pub operation_time: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimetableCell {
    pub text: String,
    pub background_color: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimetableRow {
    pub section: String,
    pub cells: Vec<TimetableCell>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Timetable {
    pub caption: Option<String>,
    pub headers: Vec<String>,
    pub rows: Vec<TimetableRow>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
pub struct ElectiveResults {
    pub summary: Option<String>,
    pub notice: Option<String>,
    pub export_url: Option<String>,
    pub courses: Vec<CourseResult>,
    pub timetable: Option<Timetable>,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct WishlistItem {
    pub name: String,
    pub class_id: String,
    pub busy: bool,
}

impl WishlistItem {
    pub fn new(name: impl Into<String>, class_id: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            class_id: class_id.into(),
            busy: false,
        }
    }

    pub fn matches_course(&self, course: &Course) -> bool {
        self.name == course.name && self.class_id == course.class_id
    }
}
