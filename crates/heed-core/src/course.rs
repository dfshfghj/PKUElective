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
