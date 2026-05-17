use std::collections::HashMap;

use crate::{
    auth::Credentials,
    bot::{BotStatus, ElectiveBot},
    config::AppConfig,
    course::{
        Course, ElectiveResults, PlanCourse, PreselectCourse, QueryCourse, SupplementPage,
        WishlistItem,
    },
    error::{HeedError, Result},
    session::{CourseQueryFilters, SelectResult},
    types::BotId,
};

#[derive(Debug, Clone)]
pub struct AutomationTick {
    pub checked_courses: usize,
    pub selected_course: Option<String>,
    pub select_result: Option<SelectResult>,
}

pub struct Orchestrator {
    config: AppConfig,
    bots: HashMap<BotId, ElectiveBot>,
    latest_courses: Vec<Course>,
    latest_preselect_courses: Vec<PreselectCourse>,
    latest_plan_courses: Vec<PlanCourse>,
    latest_query_courses: Vec<QueryCourse>,
    latest_supplement_page: SupplementPage,
    latest_results: ElectiveResults,
    wishlist: Vec<WishlistItem>,
    next_bot_id: usize,
}

impl Orchestrator {
    pub fn new(config: AppConfig) -> Self {
        Self {
            config,
            bots: HashMap::new(),
            latest_courses: Vec::new(),
            latest_preselect_courses: Vec::new(),
            latest_plan_courses: Vec::new(),
            latest_query_courses: Vec::new(),
            latest_supplement_page: SupplementPage::default(),
            latest_results: ElectiveResults::default(),
            wishlist: Vec::new(),
            next_bot_id: 1,
        }
    }

    pub fn config(&self) -> &AppConfig {
        &self.config
    }

    pub fn replace_config(&mut self, config: AppConfig) {
        self.config = config;
    }

    pub fn clear_runtime_state(&mut self) {
        self.bots.clear();
        self.latest_courses.clear();
        self.latest_preselect_courses.clear();
        self.latest_plan_courses.clear();
        self.latest_query_courses.clear();
        self.latest_supplement_page = SupplementPage::default();
        self.latest_results = ElectiveResults::default();
        self.next_bot_id = 1;
    }

    pub fn bots(&self) -> impl Iterator<Item = &ElectiveBot> {
        self.bots.values()
    }

    pub fn latest_courses(&self) -> &[Course] {
        &self.latest_courses
    }

    pub fn wishlist(&self) -> &[WishlistItem] {
        &self.wishlist
    }

    pub fn latest_preselect_courses(&self) -> &[PreselectCourse] {
        &self.latest_preselect_courses
    }

    pub fn latest_plan_courses(&self) -> &[PlanCourse] {
        &self.latest_plan_courses
    }

    pub fn latest_query_courses(&self) -> &[QueryCourse] {
        &self.latest_query_courses
    }

    pub fn latest_results(&self) -> &ElectiveResults {
        &self.latest_results
    }

    pub fn latest_supplement_page(&self) -> &SupplementPage {
        &self.latest_supplement_page
    }

    pub fn set_latest_courses(&mut self, courses: Vec<Course>) {
        self.latest_courses = courses;
    }

    pub fn set_latest_preselect_courses(&mut self, courses: Vec<PreselectCourse>) {
        self.latest_preselect_courses = courses;
    }

    pub fn set_latest_plan_courses(&mut self, courses: Vec<PlanCourse>) {
        self.latest_plan_courses = courses;
    }

    pub fn set_latest_query_courses(&mut self, courses: Vec<QueryCourse>) {
        self.latest_query_courses = courses;
    }

    pub fn set_latest_results(&mut self, results: ElectiveResults) {
        self.latest_results = results;
    }

    pub fn set_latest_supplement_page(&mut self, page: SupplementPage) {
        self.latest_supplement_page = page;
    }

    pub fn add_wishlist(&mut self, item: WishlistItem) {
        if !self
            .wishlist
            .iter()
            .any(|current| current.name == item.name && current.class_id == item.class_id)
        {
            self.wishlist.push(item);
        }
    }

    pub fn remove_wishlist(&mut self, name: &str, class_id: &str) {
        self.wishlist
            .retain(|item| !(item.name == name && item.class_id == class_id));
    }

    pub async fn add_bot(&mut self, credentials: &Credentials) -> Result<BotId> {
        let bot_id = format!("bot-{}", self.next_bot_id);
        self.next_bot_id += 1;
        let bot = ElectiveBot::login(bot_id.clone(), credentials).await?;
        self.bots.insert(bot_id.clone(), bot);
        Ok(bot_id)
    }

    pub async fn refresh_bot_captcha(&mut self, bot_id: &str) -> Result<()> {
        let bot = self
            .bots
            .get_mut(bot_id)
            .ok_or_else(|| HeedError::Config(format!("unknown bot: {bot_id}")))?;
        bot.fetch_captcha().await?;
        Ok(())
    }

    pub async fn verify_bot_captcha(&mut self, bot_id: &str, code: &str) -> Result<()> {
        let bot = self
            .bots
            .get_mut(bot_id)
            .ok_or_else(|| HeedError::Config(format!("unknown bot: {bot_id}")))?;
        bot.verify_captcha(code).await
    }

    pub async fn refresh_with_idle_bot(&mut self) -> Result<&[Course]> {
        let bot_id = self
            .bots
            .iter()
            .find_map(|(id, bot)| (bot.status() == &BotStatus::Idle).then_some(id.clone()))
            .ok_or_else(|| HeedError::Config("no idle bot available".into()))?;

        let bot = self
            .bots
            .get_mut(&bot_id)
            .ok_or_else(|| HeedError::Config("bot disappeared during refresh".into()))?;

        self.latest_courses = bot.refresh_courses().await?;
        self.latest_preselect_courses = bot.refresh_preselect_courses().await?;
        self.latest_plan_courses = bot.refresh_plan_courses().await?;
        self.latest_query_courses = bot.refresh_query_courses().await?;
        self.latest_results = bot.refresh_results().await?;
        Ok(&self.latest_courses)
    }

    pub async fn run_automation_once(&mut self) -> Result<AutomationTick> {
        let courses = {
            let bot = self
                .idle_bot_mut()
                .ok_or_else(|| HeedError::Config("no idle bot available".into()))?;
            bot.refresh_courses().await?
        };
        self.latest_courses = courses.clone();

        let target = courses
            .iter()
            .find(|course| {
                course.selectable()
                    && self
                        .wishlist
                        .iter()
                        .any(|item| !item.busy && item.matches_course(course))
            })
            .cloned();

        let Some(target) = target else {
            return Ok(AutomationTick {
                checked_courses: self.latest_courses.len(),
                selected_course: None,
                select_result: None,
            });
        };

        self.mark_wishlist_busy_by_name(&target.name, true);
        let select_result = {
            let bot = self
                .idle_bot_mut()
                .ok_or_else(|| HeedError::Config("no idle bot available".into()))?;
            bot.select_course(&target.select_url).await
        };

        match select_result {
            Ok(result) => {
                if result.ok {
                    self.remove_wishlist_by_name(&target.name);
                } else {
                    self.mark_wishlist_busy_by_name(&target.name, false);
                }
                Ok(AutomationTick {
                    checked_courses: self.latest_courses.len(),
                    selected_course: Some(format!("{} {}", target.name, target.class_id)),
                    select_result: Some(result),
                })
            }
            Err(err) => {
                self.mark_wishlist_busy_by_name(&target.name, false);
                Err(err)
            }
        }
    }

    pub async fn search_query_with_idle_bot(
        &mut self,
        filters: &CourseQueryFilters,
    ) -> Result<&[QueryCourse]> {
        let bot_id = self
            .bots
            .iter()
            .find_map(|(id, bot)| (bot.status() == &BotStatus::Idle).then_some(id.clone()))
            .ok_or_else(|| HeedError::Config("no idle bot available".into()))?;

        let bot = self
            .bots
            .get_mut(&bot_id)
            .ok_or_else(|| HeedError::Config("bot disappeared during query".into()))?;

        self.latest_query_courses = bot.search_query_courses(filters).await?;
        Ok(&self.latest_query_courses)
    }

    pub async fn add_course_to_plan_with_idle_bot(&mut self, add_url: &str) -> Result<()> {
        let (plan_courses, query_courses, preselect_courses) = {
            let bot = self
                .idle_bot_mut()
                .ok_or_else(|| HeedError::Config("no idle bot available".into()))?;
            bot.add_course_to_plan(add_url).await?;
            (
                bot.refresh_plan_courses().await?,
                bot.refresh_query_courses().await?,
                bot.refresh_preselect_courses().await?,
            )
        };
        self.latest_plan_courses = plan_courses;
        self.latest_query_courses = query_courses;
        self.latest_preselect_courses = preselect_courses;
        Ok(())
    }

    pub async fn remove_plan_course_with_idle_bot(&mut self, delete_url: &str) -> Result<()> {
        let (plan_courses, preselect_courses) = {
            let bot = self
                .idle_bot_mut()
                .ok_or_else(|| HeedError::Config("no idle bot available".into()))?;
            bot.remove_plan_course(delete_url).await?;
            (
                bot.refresh_plan_courses().await?,
                bot.refresh_preselect_courses().await?,
            )
        };
        self.latest_plan_courses = plan_courses;
        self.latest_preselect_courses = preselect_courses;
        Ok(())
    }

    pub async fn preselect_with_idle_bot(
        &mut self,
        select_url: &str,
        preference: Option<u32>,
    ) -> Result<SelectResult> {
        let (result, preselect_courses, plan_courses) = {
            let bot = self
                .idle_bot_mut()
                .ok_or_else(|| HeedError::Config("no idle bot available".into()))?;
            let result = bot.preselect_course(select_url, preference).await?;
            let preselect_courses = bot.refresh_preselect_courses().await?;
            let plan_courses = bot.refresh_plan_courses().await?;
            (result, preselect_courses, plan_courses)
        };
        self.latest_preselect_courses = preselect_courses;
        self.latest_plan_courses = plan_courses;
        Ok(result)
    }

    fn idle_bot_mut(&mut self) -> Option<&mut ElectiveBot> {
        let bot_id = self
            .bots
            .iter()
            .find_map(|(id, bot)| (bot.status() == &BotStatus::Idle).then_some(id.clone()))?;
        self.bots.get_mut(&bot_id)
    }

    fn mark_wishlist_busy_by_name(&mut self, name: &str, busy: bool) {
        for item in &mut self.wishlist {
            if item.name == name {
                item.busy = busy;
            }
        }
    }

    fn remove_wishlist_by_name(&mut self, name: &str) {
        self.wishlist.retain(|item| item.name != name);
    }
}
