use std::time::SystemTime;

use serde::{Deserialize, Serialize};

use crate::{
    auth::Credentials,
    error::{HeedError, Result},
    session::{CourseQueryFilters, ElectiveSession, SelectResult},
    types::BotId,
};

const CAPTCHA_URL: &str = "https://elective.pku.edu.cn/elective2008/DrawServlet";
const CAPTCHA_VERIFY_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/validate.do";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BotStatus {
    Init,
    Authenticating,
    WaitingCaptcha,
    Idle,
    Looping,
    Selecting,
    Recovering,
    Dead,
}

#[derive(Clone)]
pub struct ElectiveBot {
    id: BotId,
    session: ElectiveSession,
    status: BotStatus,
    last_loop_time: Option<SystemTime>,
    last_error: Option<String>,
}

impl ElectiveBot {
    pub async fn login(id: impl Into<BotId>, credentials: &Credentials) -> Result<Self> {
        let session = ElectiveSession::login(credentials).await?;
        Ok(Self {
            id: id.into(),
            session,
            status: BotStatus::Idle,
            last_loop_time: None,
            last_error: None,
        })
    }

    pub fn id(&self) -> &str {
        &self.id
    }

    pub fn status(&self) -> &BotStatus {
        &self.status
    }

    pub fn last_loop_time(&self) -> Option<SystemTime> {
        self.last_loop_time
    }

    pub fn last_error(&self) -> Option<&str> {
        self.last_error.as_deref()
    }

    pub async fn fetch_captcha(&mut self) -> Result<Vec<u8>> {
        self.status = BotStatus::WaitingCaptcha;
        let response = self
            .session
            .auth_session()
            .client()
            .get(CAPTCHA_URL)
            .query(&[("Rand", "0.1")])
            .send()
            .await?
            .error_for_status()?;
        Ok(response.bytes().await?.to_vec())
    }

    pub async fn verify_captcha(&mut self, code: &str) -> Result<()> {
        let response = self
            .session
            .auth_session()
            .client()
            .post(CAPTCHA_VERIFY_URL)
            .form(&[
                ("validCode", code),
                ("xh", self.session.auth_session().username()),
            ])
            .send()
            .await?
            .error_for_status()?;
        let body: serde_json::Value = response.json().await?;
        match body.get("valid").and_then(|value| value.as_str()) {
            Some("2") => {
                self.status = BotStatus::Idle;
                Ok(())
            }
            _ => Err(HeedError::CaptchaInvalid),
        }
    }

    pub async fn refresh_courses(&mut self) -> Result<Vec<crate::course::Course>> {
        self.status = BotStatus::Looping;
        self.last_loop_time = Some(SystemTime::now());
        match self.session.refresh_courses().await {
            Ok(courses) => {
                self.last_error = None;
                self.status = BotStatus::Idle;
                Ok(courses)
            }
            Err(err) => self.fail_loop(err),
        }
    }

    pub async fn refresh_preselect_courses(
        &mut self,
    ) -> Result<Vec<crate::course::PreselectCourse>> {
        self.status = BotStatus::Looping;
        self.last_loop_time = Some(SystemTime::now());
        match self.session.refresh_preselect_courses().await {
            Ok(courses) => {
                self.last_error = None;
                self.status = BotStatus::Idle;
                Ok(courses)
            }
            Err(err) => self.fail_loop(err),
        }
    }

    pub async fn refresh_plan_courses(&mut self) -> Result<Vec<crate::course::PlanCourse>> {
        self.status = BotStatus::Looping;
        self.last_loop_time = Some(SystemTime::now());
        match self.session.refresh_plan_courses().await {
            Ok(courses) => {
                self.last_error = None;
                self.status = BotStatus::Idle;
                Ok(courses)
            }
            Err(err) => self.fail_loop(err),
        }
    }

    pub async fn refresh_query_courses(&mut self) -> Result<Vec<crate::course::QueryCourse>> {
        self.status = BotStatus::Looping;
        self.last_loop_time = Some(SystemTime::now());
        match self.session.refresh_query_courses().await {
            Ok(courses) => {
                self.last_error = None;
                self.status = BotStatus::Idle;
                Ok(courses)
            }
            Err(err) => self.fail_loop(err),
        }
    }

    pub async fn refresh_results(&mut self) -> Result<crate::course::ElectiveResults> {
        self.status = BotStatus::Looping;
        self.last_loop_time = Some(SystemTime::now());
        match self.session.refresh_results().await {
            Ok(results) => {
                self.last_error = None;
                self.status = BotStatus::Idle;
                Ok(results)
            }
            Err(err) => self.fail_loop(err),
        }
    }

    pub async fn search_query_courses(
        &mut self,
        filters: &CourseQueryFilters,
    ) -> Result<Vec<crate::course::QueryCourse>> {
        self.status = BotStatus::Looping;
        self.last_loop_time = Some(SystemTime::now());
        match self.session.search_query_courses(filters).await {
            Ok(courses) => {
                self.last_error = None;
                self.status = BotStatus::Idle;
                Ok(courses)
            }
            Err(err) => self.fail_loop(err),
        }
    }

    pub async fn add_course_to_plan(&mut self, add_url: &str) -> Result<()> {
        self.status = BotStatus::Selecting;
        self.finish_select(self.session.add_course_to_plan(add_url).await)
    }

    pub async fn remove_plan_course(&mut self, delete_url: &str) -> Result<()> {
        self.status = BotStatus::Selecting;
        self.finish_select(self.session.remove_plan_course(delete_url).await)
    }

    pub async fn preselect_course(
        &mut self,
        select_url: &str,
        preference: Option<u32>,
    ) -> Result<SelectResult> {
        self.status = BotStatus::Selecting;
        self.finish_select_result(self.session.preselect_course(select_url, preference).await)
    }

    pub async fn select_course(&mut self, select_url: &str) -> Result<SelectResult> {
        self.status = BotStatus::Selecting;
        self.finish_select_result(self.session.select_course(select_url).await)
    }

    fn fail_loop<T>(&mut self, err: HeedError) -> Result<T> {
        self.last_error = Some(err.to_string());
        self.status = match err {
            HeedError::SessionExpired | HeedError::Fatal(_) => BotStatus::Dead,
            _ => BotStatus::Idle,
        };
        Err(err)
    }

    fn finish_select(&mut self, result: Result<()>) -> Result<()> {
        match result {
            Ok(()) => {
                self.status = BotStatus::Idle;
                self.last_error = None;
                Ok(())
            }
            Err(err) => {
                self.status = BotStatus::Idle;
                self.last_error = Some(err.to_string());
                Err(err)
            }
        }
    }

    fn finish_select_result(&mut self, result: Result<SelectResult>) -> Result<SelectResult> {
        match result {
            Ok(value) => {
                self.status = BotStatus::Idle;
                self.last_error = if value.ok {
                    None
                } else {
                    Some(value.message.clone())
                };
                Ok(value)
            }
            Err(err) => {
                self.status = BotStatus::Idle;
                self.last_error = Some(err.to_string());
                Err(err)
            }
        }
    }
}
