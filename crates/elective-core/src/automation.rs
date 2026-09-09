use std::collections::HashMap;

use crate::{
    auth::Credentials,
    bot::{BotStatus, ElectiveBot},
    config::AppConfig,
    course::{Course, WishlistItem},
    error::{ElectiveError, Result},
    session::SelectResult,
    types::BotId,
};

#[derive(Debug, Clone)]
pub struct AutomationTick {
    pub checked_courses: usize,
    pub selected_course: Option<String>,
    pub select_result: Option<SelectResult>,
}

pub struct AutomationManager {
    config: AppConfig,
    bots: HashMap<BotId, ElectiveBot>,
    last_checked_courses: Vec<Course>,
    wishlist: Vec<WishlistItem>,
    next_bot_id: usize,
}

impl AutomationManager {
    pub fn new(config: AppConfig) -> Self {
        Self {
            config,
            bots: HashMap::new(),
            last_checked_courses: Vec::new(),
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
        self.last_checked_courses.clear();
        self.next_bot_id = 1;
    }

    pub fn bots(&self) -> impl Iterator<Item = &ElectiveBot> {
        self.bots.values()
    }

    pub fn wishlist(&self) -> &[WishlistItem] {
        &self.wishlist
    }

    pub fn add_wishlist(&mut self, item: WishlistItem) {
        if !self
            .wishlist
            .iter()
            .any(|current| current.same_target(&item))
        {
            self.wishlist.push(item);
        }
    }

    pub fn remove_wishlist(&mut self, course_id: &str, class_id: &str) {
        self.wishlist
            .retain(|item| !item.matches_identity(course_id, class_id));
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
            .ok_or_else(|| ElectiveError::Config(format!("unknown bot: {bot_id}")))?;
        bot.fetch_captcha().await?;
        Ok(())
    }

    pub async fn verify_bot_captcha(&mut self, bot_id: &str, code: &str) -> Result<()> {
        let bot = self
            .bots
            .get_mut(bot_id)
            .ok_or_else(|| ElectiveError::Config(format!("unknown bot: {bot_id}")))?;
        bot.verify_captcha(code).await
    }

    pub fn bot_captcha_image(&self, bot_id: &str) -> Result<Vec<u8>> {
        self.bots
            .get(bot_id)
            .and_then(|bot| bot.captcha_image().map(ToOwned::to_owned))
            .ok_or_else(|| {
                ElectiveError::Config(format!("captcha image unavailable for bot: {bot_id}"))
            })
    }

    pub fn bots_requiring_captcha(&self) -> Vec<BotId> {
        self.bots
            .iter()
            .filter(|(_, bot)| matches!(bot.status(), BotStatus::Dead))
            .map(|(id, _)| id.clone())
            .collect()
    }

    pub async fn run_automation_once(&mut self) -> Result<AutomationTick> {
        let courses = {
            let bot = self
                .idle_bot_mut()
                .ok_or_else(|| ElectiveError::Config("no idle bot available".into()))?;
            bot.refresh_courses().await?
        };
        self.last_checked_courses = courses.clone();

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
                checked_courses: self.last_checked_courses.len(),
                selected_course: None,
                select_result: None,
            });
        };

        self.mark_wishlist_busy(&target, true);
        let select_result = {
            let bot = self
                .idle_bot_mut()
                .ok_or_else(|| ElectiveError::Config("no idle bot available".into()))?;
            bot.select_course(&target.select_url).await
        };

        match select_result {
            Ok(result) => {
                if result.ok {
                    self.remove_wishlist_target(&target);
                } else {
                    self.mark_wishlist_busy(&target, false);
                }
                Ok(AutomationTick {
                    checked_courses: self.last_checked_courses.len(),
                    selected_course: Some(format!("{} {}", target.name, target.class_id)),
                    select_result: Some(result),
                })
            }
            Err(err) => {
                self.mark_wishlist_busy(&target, false);
                Err(err)
            }
        }
    }

    fn idle_bot_mut(&mut self) -> Option<&mut ElectiveBot> {
        let bot_id = self
            .bots
            .iter()
            .find_map(|(id, bot)| (bot.status() == &BotStatus::Idle).then_some(id.clone()))?;
        self.bots.get_mut(&bot_id)
    }

    fn mark_wishlist_busy(&mut self, course: &Course, busy: bool) {
        for item in &mut self.wishlist {
            if item.matches_course(course) {
                item.busy = busy;
            }
        }
    }

    fn remove_wishlist_target(&mut self, course: &Course) {
        self.wishlist.retain(|item| !item.matches_course(course));
    }
}
