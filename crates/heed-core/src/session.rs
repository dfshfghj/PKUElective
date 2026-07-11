use std::sync::{Arc, Mutex};

use reqwest::{Url, header::REFERER};
use serde::{Deserialize, Serialize};

use crate::{
    auth::{AuthSession, Credentials, authenticate},
    course::{Course, ElectiveResults, PlanCourse, PreselectCourse, PreselectedCourse, QueryCourse, SupplementPage},
    error::{HeedError, Result},
    parser::{
        parse_course_page, parse_plan_page, parse_preselect_page, parse_query_page,
        parse_results_page, parse_supplement_page,
    },
};

const SUPPLY_CANCEL_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/SupplyCancel.do";
const CAPTCHA_URL: &str = "https://elective.pku.edu.cn/elective2008/DrawServlet";
const CAPTCHA_VERIFY_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/validate.do";
const ELECTIVE_PLAN_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/electivePlan/ElectivePlanController.jpf";
const COURSE_QUERY_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/courseQuery/CourseQueryController.jpf";
const COURSE_QUERY_FORM_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/courseQuery/getCurriculmByForm.do";
const PRESELECT_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/electiveWork/ElectiveWorkController.jpf";
const RESULTS_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/electiveWork/showResults.do";
const INITIAL_REFERER: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/help/HelpController.jpf";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectResult {
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CourseQueryFilters {
    pub course_setting_type: Option<String>,
    pub course_id: Option<String>,
    pub course_name: Option<String>,
    pub dept_id: Option<String>,
    pub course_day: Option<String>,
    pub course_time: Option<String>,
    pub query_date_flag: bool,
}

#[derive(Clone)]
pub struct ElectiveSession {
    auth: AuthSession,
    last_page_url: Arc<Mutex<String>>,
}

impl ElectiveSession {
    pub async fn login(credentials: &Credentials) -> Result<Self> {
        Ok(Self {
            auth: authenticate(credentials).await?,
            last_page_url: Arc::new(Mutex::new(INITIAL_REFERER.to_string())),
        })
    }

    pub fn new(auth: AuthSession) -> Self {
        Self {
            auth,
            last_page_url: Arc::new(Mutex::new(INITIAL_REFERER.to_string())),
        }
    }

    pub fn auth_session(&self) -> &AuthSession {
        &self.auth
    }

    fn current_referer(&self) -> String {
        self.last_page_url
            .lock()
            .map(|url| url.clone())
            .unwrap_or_else(|_| INITIAL_REFERER.to_string())
    }

    fn set_current_page(&self, url: String) {
        if let Ok(mut current) = self.last_page_url.lock() {
            *current = url;
        }
    }

    pub fn reset_to_preselect_page(&self) {
        self.set_current_page(PRESELECT_URL.to_string());
    }

    pub async fn refresh_courses(&self) -> Result<Vec<Course>> {
        let mut courses = Vec::new();
        let mut next_url = Some(format!("{SUPPLY_CANCEL_URL}?xh={}", self.auth.username()));
        let mut page_count = 0usize;

        while let Some(url) = next_url.take() {
            page_count += 1;
            if page_count > 16 {
                return Err(HeedError::Fatal("pagination depth exceeded".into()));
            }

            let response = self
                .auth
                .client()
                .get(&url)
                .query(&[("xh", self.auth.username())])
                .send()
                .await?
                .error_for_status()?;
            let body = response.text().await?;
            let page = parse_course_page(&body)?;

            if let Some(error) = page.fatal_error {
                return Err(HeedError::Fatal(error));
            }
            if page.title.as_deref() != Some("补选退选") {
                return Err(HeedError::SessionExpired);
            }

            courses.extend(page.courses);
            next_url = page.next_page_url;
        }

        Ok(courses)
    }

    pub async fn refresh_supplement_page(&self) -> Result<SupplementPage> {
        let body = self
            .auth
            .client()
            .get(SUPPLY_CANCEL_URL)
            .query(&[("xh", self.auth.username())])
            .send()
            .await?
            .error_for_status()?
            .text()
            .await?;
        let page = parse_supplement_page(&body)?;

        if let Some(error) = page.fatal_error {
            return Err(HeedError::Fatal(error));
        }
        if page.title.as_deref() != Some("补选退选") {
            return Err(HeedError::SessionExpired);
        }

        Ok(page.page)
    }

    pub async fn fetch_captcha(&self) -> Result<Vec<u8>> {
        let response = self
            .auth
            .client()
            .get(CAPTCHA_URL)
            .query(&[("Rand", "0.1")])
            .send()
            .await?
            .error_for_status()?;
        Ok(response.bytes().await?.to_vec())
    }

    pub async fn verify_captcha(&self, code: &str) -> Result<()> {
        let response = self
            .auth
            .client()
            .post(CAPTCHA_VERIFY_URL)
            .form(&[("validCode", code), ("xh", self.auth.username())])
            .send()
            .await?
            .error_for_status()?;
        let body: serde_json::Value = response.json().await?;
        match body.get("valid").and_then(|value| value.as_str()) {
            Some("2") => Ok(()),
            _ => Err(HeedError::CaptchaInvalid),
        }
    }

    pub async fn refresh_preselect_courses(&self) -> Result<Vec<PreselectCourse>> {
        let mut courses = Vec::new();
        let mut next_url = Some(PRESELECT_URL.to_string());
        let mut page_count = 0usize;

        while let Some(url) = next_url.take() {
            page_count += 1;
            if page_count > 16 {
                return Err(HeedError::Fatal("pagination depth exceeded".into()));
            }

            let body = self.fetch_html(&url).await?;
            let page = parse_preselect_page(&body)?;

            if let Some(error) = page.fatal_error {
                return Err(HeedError::Fatal(error));
            }
            if page.title.as_deref() != Some("选课") {
                return Err(HeedError::SessionExpired);
            }

            courses.extend(page.courses);
            next_url = page.next_page_url;
        }

        Ok(courses)
    }

    pub async fn refresh_preselected_courses(&self) -> Result<Vec<PreselectedCourse>> {
        let body = self.fetch_html(PRESELECT_URL).await?;
        let page = parse_preselect_page(&body)?;
        if let Some(error) = page.fatal_error {
            return Err(HeedError::Fatal(error));
        }
        if page.title.as_deref() != Some("选课") {
            return Err(HeedError::SessionExpired);
        }
        Ok(page.selected_courses)
    }

    pub async fn refresh_plan_courses(&self) -> Result<Vec<PlanCourse>> {
        let mut courses = Vec::new();
        let mut next_url = Some(ELECTIVE_PLAN_URL.to_string());
        let mut page_count = 0usize;

        while let Some(url) = next_url.take() {
            page_count += 1;
            if page_count > 16 {
                return Err(HeedError::Fatal("pagination depth exceeded".into()));
            }

            let body = self.fetch_html(&url).await?;
            let page = parse_plan_page(&body)?;

            if let Some(error) = page.fatal_error {
                return Err(HeedError::Fatal(error));
            }
            if page.title.as_deref() != Some("选课计划") {
                return Err(HeedError::SessionExpired);
            }

            courses.extend(page.courses);
            next_url = page.next_page_url;
        }

        Ok(courses)
    }

    pub async fn refresh_query_courses(&self) -> Result<Vec<QueryCourse>> {
        let mut courses = Vec::new();
        let mut next_url = Some(COURSE_QUERY_URL.to_string());
        let mut page_count = 0usize;

        while let Some(url) = next_url.take() {
            page_count += 1;
            if page_count > 16 {
                return Err(HeedError::Fatal("pagination depth exceeded".into()));
            }

            let body = self.fetch_html(&url).await?;
            let page = parse_query_page(&body)?;

            if let Some(error) = page.fatal_error {
                return Err(HeedError::Fatal(error));
            }
            if page.title.as_deref() != Some("课程查询") {
                return Err(HeedError::SessionExpired);
            }

            courses.extend(page.courses);
            next_url = page.next_page_url;
        }

        Ok(courses)
    }

    pub async fn refresh_results(&self) -> Result<ElectiveResults> {
        let body = self.fetch_html(RESULTS_URL).await?;
        let page = parse_results_page(&body)?;

        if let Some(error) = page.fatal_error {
            return Err(HeedError::Fatal(error));
        }
        if page.title.as_deref() != Some("选课结果") {
            return Err(HeedError::SessionExpired);
        }

        Ok(page.results)
    }

    pub async fn search_query_courses(
        &self,
        filters: &CourseQueryFilters,
    ) -> Result<Vec<QueryCourse>> {
        let mut form = vec![
            (
                "wlw-radio_button_group_key:{actionForm.courseSettingType}".to_string(),
                filters
                    .course_setting_type
                    .clone()
                    .unwrap_or_else(|| "speciality".to_string()),
            ),
            (
                "{actionForm.courseID}".to_string(),
                filters.course_id.clone().unwrap_or_default(),
            ),
            (
                "{actionForm.courseName}".to_string(),
                filters.course_name.clone().unwrap_or_default(),
            ),
            (
                "wlw-select_key:{actionForm.deptID}OldValue".to_string(),
                "true".to_string(),
            ),
            (
                "wlw-select_key:{actionForm.deptID}".to_string(),
                filters.dept_id.clone().unwrap_or_else(|| "ALL".to_string()),
            ),
            (
                "wlw-select_key:{actionForm.courseDay}OldValue".to_string(),
                "true".to_string(),
            ),
            (
                "wlw-select_key:{actionForm.courseDay}".to_string(),
                filters.course_day.clone().unwrap_or_default(),
            ),
            (
                "wlw-select_key:{actionForm.courseTime}OldValue".to_string(),
                "true".to_string(),
            ),
            (
                "wlw-select_key:{actionForm.courseTime}".to_string(),
                filters.course_time.clone().unwrap_or_default(),
            ),
            (
                "wlw-checkbox_key:{actionForm.queryDateFlag}OldValue".to_string(),
                "false".to_string(),
            ),
            (
                "deptIdHide".to_string(),
                filters.dept_id.clone().unwrap_or_else(|| "ALL".to_string()),
            ),
        ];

        if filters.query_date_flag {
            form.push((
                "wlw-checkbox_key:{actionForm.queryDateFlag}".to_string(),
                "true".to_string(),
            ));
        }

        let body = self
            .auth
            .client()
            .post(COURSE_QUERY_FORM_URL)
            .form(&form)
            .send()
            .await?
            .error_for_status()?
            .text()
            .await?;
        let page = parse_query_page(&body)?;

        if let Some(error) = page.fatal_error {
            return Err(HeedError::Fatal(error));
        }
        if page.title.as_deref() != Some("课程查询") {
            return Err(HeedError::SessionExpired);
        }

        Ok(page.courses)
    }

    pub async fn add_course_to_plan(&self, add_url: &str) -> Result<()> {
        self.visit_action(add_url).await
    }

    pub async fn remove_plan_course(&self, delete_url: &str) -> Result<()> {
        self.visit_action(delete_url).await
    }

    pub async fn preselect_course(
        &self,
        select_url: &str,
        preference: Option<u32>,
    ) -> Result<SelectResult> {
        let final_url = with_optional_query(select_url, "random", preference)?;
        let body = self
            .fetch_html_with_referer(&final_url, &self.current_referer())
            .await?;
        let page = parse_preselect_page(&body)?;

        if let Some(error) = page.fatal_error {
            return Ok(SelectResult {
                ok: false,
                message: error,
            });
        }
        if page.title.as_deref() != Some("选课") {
            return Err(HeedError::SessionExpired);
        }

        Ok(SelectResult {
            ok: true,
            message: "预选请求已提交。".to_string(),
        })
    }

    pub async fn cancel_preselect_course(&self, cancel_url: &str) -> Result<SelectResult> {
        let body = self
            .fetch_html_with_referer(cancel_url, &self.current_referer())
            .await?;
        let page = parse_preselect_page(&body)?;

        if let Some(error) = page.fatal_error {
            return Ok(SelectResult { ok: false, message: error });
        }
        if page.title.as_deref() != Some("选课") {
            return Err(HeedError::SessionExpired);
        }

        Ok(SelectResult {
            ok: true,
            message: "预选取消请求已提交。".to_string(),
        })
    }

    pub async fn select_course(&self, select_url: &str) -> Result<SelectResult> {
        let response = self
            .auth
            .client()
            .post(select_url)
            .send()
            .await?
            .error_for_status()?;
        let body = response.text().await?;
        let page = parse_course_page(&body)?;

        if let Some(error) = page.fatal_error {
            return Ok(SelectResult {
                ok: false,
                message: error,
            });
        }

        let message = page.tips.unwrap_or_default();
        let ok = body.contains("成功，请查看已选上列表确认");
        Ok(SelectResult { ok, message })
    }

    pub async fn select_supplement_course(&self, select_url: &str) -> Result<SelectResult> {
        let response = self
            .auth
            .client()
            .post(select_url)
            .send()
            .await?
            .error_for_status()?;
        let body = response.text().await?;
        let page = parse_supplement_page(&body)?;

        if let Some(error) = page.fatal_error {
            return Ok(SelectResult {
                ok: false,
                message: error,
            });
        }

        let message = page.tips.unwrap_or_else(|| "补选请求已完成。".to_string());
        Ok(SelectResult {
            ok: !message.contains("失败"),
            message,
        })
    }

    pub async fn cancel_supplement_course(&self, cancel_url: &str) -> Result<SelectResult> {
        let body = self.fetch_html(cancel_url).await?;
        let page = parse_supplement_page(&body)?;

        if let Some(error) = page.fatal_error {
            return Ok(SelectResult {
                ok: false,
                message: error,
            });
        }

        let message = page.tips.unwrap_or_else(|| "退选请求已提交。".to_string());
        Ok(SelectResult {
            ok: !message.contains("失败"),
            message,
        })
    }

    async fn fetch_html(&self, url: &str) -> Result<String> {
        let referer = self.current_referer();
        let response = self
            .auth
            .client()
            .get(url)
            .header(REFERER, &referer)
            .send()
            .await?;
        let status = response.status();
        let final_url = response.url().to_string();
        let body = response.text().await?;
        self.set_current_page(final_url.clone());
        if !status.is_success() {
            return Err(HeedError::Fatal(format!("http status {status}")));
        }
        Ok(body)
    }

    async fn fetch_html_with_referer(&self, url: &str, referer: &str) -> Result<String> {
        let response = self
            .auth
            .client()
            .get(url)
            .header(REFERER, referer)
            .send()
            .await?;
        let status = response.status();
        let final_url = response.url().to_string();
        let body = response.text().await?;
        self.set_current_page(final_url.clone());
        if !status.is_success() {
            return Err(HeedError::Fatal(format!("http status {status}")));
        }
        Ok(body)
    }

    async fn visit_action(&self, url: &str) -> Result<()> {
        let body = self.fetch_html(url).await?;
        if let Some(error) = parse_course_page(&body)?.fatal_error {
            return Err(HeedError::Selection(error));
        }
        Ok(())
    }
}

fn with_optional_query(url: &str, key: &str, value: Option<u32>) -> Result<String> {
    let Some(value) = value else {
        return Ok(url.to_string());
    };

    let mut parsed =
        Url::parse(url).map_err(|err| HeedError::Config(format!("invalid action url: {err}")))?;
    parsed
        .query_pairs_mut()
        .append_pair(key, &value.to_string());
    Ok(parsed.to_string())
}
