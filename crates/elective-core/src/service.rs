use crate::{
    CourseDetail, ElectiveResults, ElectiveScheduleRow, ElectiveSession, PlanPageData,
    PreselectOperationResult, PreselectPageData, QueryPageData, Result, SelectResult,
    SupplementPage,
};

use crate::session::CourseQueryFilters;

/// Platform-neutral application API shared by desktop adapters and future CLIs.
///
/// This layer owns business-level request composition while callers remain
/// responsible for persistence, presentation, and application state.
#[derive(Clone)]
pub struct ElectiveService {
    session: ElectiveSession,
}

impl ElectiveService {
    pub fn new(session: ElectiveSession) -> Self {
        Self { session }
    }

    pub async fn login(credentials: &crate::Credentials) -> Result<Self> {
        Ok(Self::new(ElectiveSession::login(credentials).await?))
    }

    pub fn session(&self) -> &ElectiveSession {
        &self.session
    }

    pub async fn refresh_courses(&self) -> Result<Vec<crate::Course>> {
        self.session.refresh_courses().await
    }

    pub async fn refresh_preselect_courses(&self) -> Result<Vec<crate::PreselectCourse>> {
        self.session.refresh_preselect_courses().await
    }

    pub async fn refresh_plan_courses(&self) -> Result<Vec<crate::PlanCourse>> {
        self.session.refresh_plan_courses().await
    }

    pub async fn refresh_query_courses(&self) -> Result<Vec<crate::QueryCourse>> {
        self.session.refresh_query_courses().await
    }

    pub async fn refresh_schedule(&self) -> Result<Vec<ElectiveScheduleRow>> {
        self.session.fetch_elective_schedule().await
    }

    pub async fn refresh_preselect(&self) -> Result<PreselectPageData> {
        self.session.refresh_preselect_page().await
    }

    pub async fn refresh_plan(&self) -> Result<PlanPageData> {
        self.session.refresh_plan_page().await
    }

    pub async fn refresh_query(&self) -> Result<QueryPageData> {
        self.session.refresh_query_page().await
    }

    pub async fn search_query(&self, filters: &CourseQueryFilters) -> Result<QueryPageData> {
        self.session.search_query_courses(filters).await
    }

    pub async fn refresh_results(&self) -> Result<ElectiveResults> {
        self.session.refresh_results().await
    }

    pub async fn refresh_supplement(&self) -> Result<SupplementPage> {
        self.session.refresh_supplement_page().await
    }

    pub async fn fetch_course_detail(&self, detail_url: &str) -> Result<CourseDetail> {
        self.session.fetch_course_detail(detail_url).await
    }

    pub async fn paginate_preselect(&self, url: &str, referer: &str) -> Result<PreselectPageData> {
        self.session.fetch_preselect_page(url, referer).await
    }

    pub async fn paginate_plan(&self, url: &str, referer: &str) -> Result<PlanPageData> {
        self.session.fetch_plan_page(url, referer).await
    }

    pub async fn paginate_query(&self, url: &str, referer: &str) -> Result<QueryPageData> {
        self.session.fetch_query_page(url, referer).await
    }

    pub async fn paginate_supplement(&self, url: &str, referer: &str) -> Result<SupplementPage> {
        self.session.fetch_supplement_page(url, referer).await
    }

    pub async fn paginate_results(&self, url: &str, referer: &str) -> Result<ElectiveResults> {
        self.session.fetch_results_page(url, referer).await
    }

    pub async fn fetch_captcha(&self) -> Result<Vec<u8>> {
        self.session.fetch_captcha().await
    }

    pub async fn verify_captcha(&self, code: &str) -> Result<()> {
        self.session.verify_captcha(code).await
    }

    pub async fn refresh_supplement_limit(&self, select_url: &str) -> Result<(u32, u32)> {
        self.session.refresh_supplement_limit(select_url).await
    }

    pub async fn add_course_to_plan(&self, add_url: &str) -> Result<()> {
        self.session.add_course_to_plan(add_url).await
    }

    pub async fn remove_plan_course(&self, delete_url: &str) -> Result<()> {
        self.session.remove_plan_course(delete_url).await
    }

    pub async fn preselect_course(
        &self,
        select_url: &str,
        preference: Option<u32>,
    ) -> Result<PreselectOperationResult> {
        self.session.preselect_course(select_url, preference).await
    }

    pub async fn cancel_preselect_course(
        &self,
        cancel_url: &str,
    ) -> Result<PreselectOperationResult> {
        self.session.cancel_preselect_course(cancel_url).await
    }

    pub async fn select_supplement_course(&self, select_url: &str) -> Result<SelectResult> {
        self.session.select_supplement_course(select_url).await
    }

    pub async fn cancel_supplement_course(&self, cancel_url: &str) -> Result<SelectResult> {
        self.session.cancel_supplement_course(cancel_url).await
    }
}
