use reqwest::{Url, header::REFERER};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::{
    auth::{AuthSession, Credentials, authenticate},
    course::{
        Course, CourseDetail, ElectiveResults, ElectiveScheduleRow, Pagination, PlanCourse,
        PreselectCourse, PreselectedCourse, QueryCourse, SupplementPage,
    },
    error::{ElectiveError, Result},
    parser::{
        parse_course_page, parse_elective_schedule, parse_plan_page, parse_preselect_page,
        parse_query_page, parse_results_page, parse_supplement_page,
    },
};

const SUPPLY_CANCEL_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/SupplyCancel.do";
const ELECT_SUPPLEMENT_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/electSupplement.do";
const CAPTCHA_URL: &str = "https://elective.pku.edu.cn/elective2008/DrawServlet";
const CAPTCHA_VERIFY_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/validate.do";
const REFRESH_LIMIT_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/refreshLimit.do";
const ELECTIVE_PLAN_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/electivePlan/ElectivePlanController.jpf";
const COURSE_QUERY_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/courseQuery/CourseQueryController.jpf";
const QUERY_PAGE_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/courseQuery/queryCurriculum.jsp";
const SUPPLEMENT_PAGE_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/supplement.jsp";
const COURSE_QUERY_FORM_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/courseQuery/getCurriculmByForm.do";
const PRESELECT_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/electiveWork/ElectiveWorkController.jpf";
const RESULTS_URL: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/electiveWork/showResults.do";
const INITIAL_REFERER: &str = "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/help/HelpController.jpf";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectResult {
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreselectOperationResult {
    pub result: SelectResult,
    pub courses: Vec<PreselectCourse>,
    pub selected_courses: Vec<PreselectedCourse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreselectPageData {
    pub courses: Vec<PreselectCourse>,
    pub selected_courses: Vec<PreselectedCourse>,
    pub pagination: Pagination,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanPageData {
    pub courses: Vec<PlanCourse>,
    pub pagination: Pagination,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueryPageData {
    pub courses: Vec<QueryCourse>,
    pub pagination: Pagination,
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
}

impl ElectiveSession {
    pub async fn login(credentials: &Credentials) -> Result<Self> {
        Ok(Self {
            auth: authenticate(credentials).await?,
        })
    }

    pub fn new(auth: AuthSession) -> Self {
        Self { auth }
    }

    pub fn auth_session(&self) -> &AuthSession {
        &self.auth
    }

    pub async fn refresh_courses(&self) -> Result<Vec<Course>> {
        let mut courses = Vec::new();
        let mut next_url = Some(format!("{SUPPLY_CANCEL_URL}?xh={}", self.auth.username()));
        let mut referer = SUPPLY_CANCEL_URL.to_string();
        let mut page_count = 0usize;

        while let Some(url) = next_url.take() {
            page_count += 1;
            if page_count > 16 {
                return Err(ElectiveError::Fatal("pagination depth exceeded".into()));
            }

            let body = self.fetch_html(&url, &referer).await?;
            referer = url;
            let page = parse_course_page(&body)?;

            if let Some(error) = page.fatal_error {
                return Err(ElectiveError::Fatal(error));
            }
            if page.title.as_deref() != Some("补选退选") {
                return Err(ElectiveError::SessionExpired);
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
            .header(REFERER, ELECT_SUPPLEMENT_URL)
            .query(&[("xh", self.auth.username())])
            .send()
            .await?
            .error_for_status()?
            .text()
            .await?;
        let page = parse_supplement_page(&body)?;

        if let Some(error) = page.fatal_error {
            return Err(ElectiveError::Fatal(error));
        }
        if page.title.as_deref() != Some("补选退选") {
            return Err(ElectiveError::SessionExpired);
        }

        let mut result = page.page;
        result.pagination.current_url = SUPPLY_CANCEL_URL.to_string();
        Ok(result)
    }

    pub async fn fetch_supplement_page(&self, page_number: usize) -> Result<SupplementPage> {
        let url = self.pagination_url("supplement", page_number)?;
        validate_page_url(&url, "/controller/supplement/")?;
        let body = self.fetch_html(&url, ELECT_SUPPLEMENT_URL).await?;
        let page = parse_supplement_page(&body)?;
        validate_page(&page.title, "补选退选", page.fatal_error)?;
        let mut result = page.page;
        result.pagination.current_url = url;
        Ok(result)
    }

    pub async fn fetch_captcha(&self) -> Result<Vec<u8>> {
        let rand = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos().to_string())
            .unwrap_or_else(|_| "0".to_string());
        let response = self
            .auth
            .client()
            .get(CAPTCHA_URL)
            .header(REFERER, ELECT_SUPPLEMENT_URL)
            .query(&[("Rand", rand)])
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
            .header(REFERER, ELECT_SUPPLEMENT_URL)
            .form(&[("validCode", code), ("xh", self.auth.username())])
            .send()
            .await?
            .error_for_status()?;
        let body: serde_json::Value = response.json().await?;
        match body.get("valid").and_then(|value| value.as_str()) {
            Some("2") => Ok(()),
            _ => Err(ElectiveError::CaptchaInvalid),
        }
    }

    pub async fn refresh_supplement_limit(&self, select_url: &str) -> Result<(u32, u32)> {
        let url = Url::parse(select_url).map_err(|err| {
            ElectiveError::Config(format!("invalid supplement action url: {err}"))
        })?;
        let index = url
            .query_pairs()
            .find(|(key, _)| key == "index")
            .map(|(_, value)| value.into_owned())
            .ok_or_else(|| ElectiveError::Config("supplement action url lacks index".into()))?;
        let seq = url
            .query_pairs()
            .find(|(key, _)| key == "seq")
            .map(|(_, value)| value.into_owned())
            .ok_or_else(|| ElectiveError::Config("supplement action url lacks seq".into()))?;
        let response: serde_json::Value = self
            .auth
            .client()
            .post(REFRESH_LIMIT_URL)
            .header(REFERER, ELECT_SUPPLEMENT_URL)
            .form(&[
                ("index", index),
                ("seq", seq),
                ("xh", self.auth.username().to_string()),
            ])
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;

        let elected_value = response
            .get("electedNum")
            .ok_or_else(|| ElectiveError::Fatal("刷新课程名额返回格式异常".into()))?;
        if elected_value.as_str() == Some("NA") {
            return Err(ElectiveError::Fatal("刷新频繁，请稍后再试".into()));
        }
        if elected_value.as_str() == Some("NB") {
            return Err(ElectiveError::Fatal("刷新课程名额异常".into()));
        }
        let parse_count = |value: &serde_json::Value| {
            value
                .as_u64()
                .and_then(|number| u32::try_from(number).ok())
                .or_else(|| {
                    value
                        .as_str()
                        .and_then(|text| text.trim().parse::<u32>().ok())
                })
        };
        let elected = parse_count(elected_value)
            .ok_or_else(|| ElectiveError::Fatal("刷新课程名额返回格式异常".into()))?;
        let limit = response
            .get("limitNum")
            .and_then(parse_count)
            .ok_or_else(|| ElectiveError::Fatal("刷新课程名额返回格式异常".into()))?;
        Ok((limit, elected))
    }

    pub async fn refresh_preselect_courses(&self) -> Result<Vec<PreselectCourse>> {
        Ok(self.refresh_preselect_data().await?.0)
    }

    pub async fn refresh_preselect_page(&self) -> Result<PreselectPageData> {
        self.fetch_preselect_page(1)
            .await
    }

    pub async fn fetch_preselect_page(&self, page_number: usize) -> Result<PreselectPageData> {
        let url = self.pagination_url("preselect", page_number)?;
        validate_page_url(&url, "/controller/electiveWork/")?;
        let body = self.fetch_html(&url, PRESELECT_URL).await?;
        let page = parse_preselect_page(&body)?;
        validate_page(&page.title, "选课", page.fatal_error)?;
        let mut pagination = page.pagination;
        pagination.current_url = url;
        Ok(PreselectPageData {
            courses: page.courses,
            selected_courses: page.selected_courses,
            pagination,
        })
    }

    pub async fn refresh_preselect_data(
        &self,
    ) -> Result<(Vec<PreselectCourse>, Vec<PreselectedCourse>)> {
        let mut courses = Vec::new();
        let mut selected_courses = Vec::new();
        let mut next_url = Some(PRESELECT_URL.to_string());
        let mut referer = PRESELECT_URL.to_string();
        let mut page_count = 0usize;

        while let Some(url) = next_url.take() {
            page_count += 1;
            if page_count > 16 {
                return Err(ElectiveError::Fatal("pagination depth exceeded".into()));
            }

            let body = self.fetch_html(&url, &referer).await?;
            referer = url;
            let page = parse_preselect_page(&body)?;

            if let Some(error) = page.fatal_error {
                return Err(ElectiveError::Fatal(error));
            }
            if page.title.as_deref() != Some("选课") {
                return Err(ElectiveError::SessionExpired);
            }

            courses.extend(page.courses);
            if page_count == 1 {
                selected_courses = page.selected_courses;
            }
            next_url = page.next_page_url;
        }

        Ok((courses, selected_courses))
    }

    async fn resolve_preselect_action(&self, stale_url: &str) -> Result<String> {
        let (courses, _) = self.refresh_preselect_data().await?;
        courses
            .iter()
            .find(|course| same_action_identity(&course.select_url, stale_url))
            .map(|course| course.select_url.clone())
            .ok_or_else(|| {
                ElectiveError::Selection("预选列表已更新，未找到对应课程，请刷新后重试".into())
            })
    }

    async fn resolve_preselect_cancel_action(&self, stale_url: &str) -> Result<String> {
        let (_, selected_courses) = self.refresh_preselect_data().await?;
        selected_courses
            .iter()
            .find(|course| same_action_identity(&course.cancel_url, stale_url))
            .map(|course| course.cancel_url.clone())
            .ok_or_else(|| {
                ElectiveError::Selection("预选状态已更新，未找到对应课程，请刷新后重试".into())
            })
    }

    pub async fn refresh_plan_courses(&self) -> Result<Vec<PlanCourse>> {
        let mut courses = Vec::new();
        let mut next_url = Some(ELECTIVE_PLAN_URL.to_string());
        let mut referer = INITIAL_REFERER.to_string();
        let mut page_count = 0usize;

        while let Some(url) = next_url.take() {
            page_count += 1;
            if page_count > 16 {
                return Err(ElectiveError::Fatal("pagination depth exceeded".into()));
            }

            let body = self.fetch_html(&url, &referer).await?;
            referer = url;
            let page = parse_plan_page(&body)?;

            if let Some(error) = page.fatal_error {
                return Err(ElectiveError::Fatal(error));
            }
            if page.title.as_deref() != Some("选课计划") {
                return Err(ElectiveError::SessionExpired);
            }

            courses.extend(page.courses);
            next_url = page.next_page_url;
        }

        Ok(courses)
    }

    pub async fn refresh_plan_page(&self) -> Result<PlanPageData> {
        self.fetch_plan_page(1)
            .await
    }

    pub async fn fetch_plan_page(&self, page_number: usize) -> Result<PlanPageData> {
        if page_number != 1 {
            return Err(ElectiveError::Config("选课计划不支持分页".into()));
        }
        let url = ELECTIVE_PLAN_URL.to_string();
        validate_page_url(&url, "/controller/electivePlan/")?;
        let body = self.fetch_html(&url, INITIAL_REFERER).await?;
        let page = parse_plan_page(&body)?;
        validate_page(&page.title, "选课计划", page.fatal_error)?;
        let mut pagination = Pagination::default();
        pagination.current_url = url;
        Ok(PlanPageData {
            courses: page.courses,
            pagination,
        })
    }

    pub async fn refresh_query_courses(&self) -> Result<Vec<QueryCourse>> {
        let mut courses = Vec::new();
        let mut next_url = Some(COURSE_QUERY_URL.to_string());
        let mut referer = INITIAL_REFERER.to_string();
        let mut page_count = 0usize;

        while let Some(url) = next_url.take() {
            page_count += 1;
            if page_count > 16 {
                return Err(ElectiveError::Fatal("pagination depth exceeded".into()));
            }

            let body = self.fetch_html(&url, &referer).await?;
            referer = url;
            let page = parse_query_page(&body)?;

            if let Some(error) = page.fatal_error {
                return Err(ElectiveError::Fatal(error));
            }
            if page.title.as_deref() != Some("课程查询") {
                return Err(ElectiveError::SessionExpired);
            }

            courses.extend(page.courses);
            next_url = page.next_page_url;
        }

        Ok(courses)
    }

    pub async fn refresh_query_page(&self) -> Result<QueryPageData> {
        self.fetch_query_page(1)
            .await
    }

    pub async fn fetch_query_page(&self, page_number: usize) -> Result<QueryPageData> {
        let url = self.pagination_url("query", page_number)?;
        validate_page_url(&url, "/controller/courseQuery/")?;
        let body = self.fetch_html(&url, COURSE_QUERY_URL).await?;
        let page = parse_query_page(&body)?;
        validate_page(&page.title, "课程查询", page.fatal_error)?;
        let mut pagination = page.pagination;
        pagination.current_url = url;
        Ok(QueryPageData {
            courses: page.courses,
            pagination,
        })
    }

    pub async fn refresh_results(&self) -> Result<ElectiveResults> {
        let body = self.fetch_html(RESULTS_URL, PRESELECT_URL).await?;
        let page = parse_results_page(&body)?;

        if let Some(error) = page.fatal_error {
            return Err(ElectiveError::Fatal(error));
        }
        if page.title.as_deref() != Some("选课结果") {
            return Err(ElectiveError::SessionExpired);
        }

        let mut results = page.results;
        results.pagination.current_url = RESULTS_URL.to_string();
        Ok(results)
    }

    pub async fn fetch_results_page(&self, page_number: usize) -> Result<ElectiveResults> {
        let url = self.pagination_url("results", page_number)?;
        validate_page_url(&url, "/controller/electiveWork/")?;
        let body = self.fetch_html(&url, PRESELECT_URL).await?;
        let page = parse_results_page(&body)?;
        validate_page(&page.title, "选课结果", page.fatal_error)?;
        let mut results = page.results;
        results.pagination.current_url = url;
        Ok(results)
    }

    pub async fn fetch_elective_schedule(&self) -> Result<Vec<ElectiveScheduleRow>> {
        let body = self.fetch_html(INITIAL_REFERER, INITIAL_REFERER).await?;
        if !body.contains("<title>帮助-总体流程</title>") {
            return Err(ElectiveError::SessionExpired);
        }
        parse_elective_schedule(&body)
    }

    pub async fn fetch_course_detail(&self, detail_url: &str) -> Result<CourseDetail> {
        let url = Url::parse(detail_url)
            .map_err(|_| ElectiveError::Fatal("invalid course detail url".into()))?;
        if url.scheme() != "https"
            || url.host_str() != Some("elective.pku.edu.cn")
            || !url.path().ends_with("/goNested.do")
            || !url.query_pairs().any(|(key, _)| key == "course_seq_no")
        {
            return Err(ElectiveError::Fatal("invalid course detail url".into()));
        }

        let body = self.fetch_html(detail_url, INITIAL_REFERER).await?;
        Ok(CourseDetail { html: body })
    }

    pub async fn search_query_courses(
        &self,
        filters: &CourseQueryFilters,
    ) -> Result<QueryPageData> {
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

        let response = self
            .auth
            .client()
            .post(COURSE_QUERY_FORM_URL)
            .header(REFERER, COURSE_QUERY_URL)
            .form(&form)
            .send()
            .await?
            .error_for_status()?;
        let current_url = response.url().to_string();
        let body = response.text().await?;
        let page = parse_query_page(&body)?;
        validate_page(&page.title, "课程查询", page.fatal_error)?;
        let mut pagination = page.pagination;
        pagination.current_url = current_url;
        Ok(QueryPageData {
            courses: page.courses,
            pagination,
        })
    }

    pub async fn add_course_to_plan(&self, add_url: &str) -> Result<()> {
        self.visit_action(add_url, COURSE_QUERY_URL).await
    }

    pub async fn remove_plan_course(&self, delete_url: &str) -> Result<()> {
        self.visit_action(delete_url, ELECTIVE_PLAN_URL).await
    }

    pub async fn preselect_course(
        &self,
        stale_url: &str,
        preference: Option<u32>,
    ) -> Result<PreselectOperationResult> {
        let fresh_url = self.resolve_preselect_action(stale_url).await?;
        let result = self.execute_preselect(&fresh_url, preference).await?;
        let (courses, selected_courses) = self.refresh_preselect_data().await?;
        Ok(PreselectOperationResult {
            result,
            courses,
            selected_courses,
        })
    }

    async fn execute_preselect(
        &self,
        select_url: &str,
        preference: Option<u32>,
    ) -> Result<SelectResult> {
        let final_url = with_optional_query(select_url, "random", preference)?;
        let body = self.fetch_html(&final_url, PRESELECT_URL).await?;
        let page = parse_preselect_page(&body)?;

        if let Some(error) = page.fatal_error {
            return Ok(SelectResult {
                ok: false,
                message: error,
            });
        }
        if page.title.as_deref() != Some("选课") {
            return Err(ElectiveError::SessionExpired);
        }

        Ok(SelectResult {
            ok: true,
            message: "预选请求已提交。".to_string(),
        })
    }

    pub async fn cancel_preselect_course(
        &self,
        stale_url: &str,
    ) -> Result<PreselectOperationResult> {
        let fresh_url = self.resolve_preselect_cancel_action(stale_url).await?;
        let result = self.execute_cancel_preselect(&fresh_url).await?;
        let (courses, selected_courses) = self.refresh_preselect_data().await?;
        Ok(PreselectOperationResult {
            result,
            courses,
            selected_courses,
        })
    }

    async fn execute_cancel_preselect(&self, cancel_url: &str) -> Result<SelectResult> {
        let body = self.fetch_html(cancel_url, PRESELECT_URL).await?;
        let page = parse_preselect_page(&body)?;

        if let Some(error) = page.fatal_error {
            return Ok(SelectResult {
                ok: false,
                message: error,
            });
        }
        if page.title.as_deref() != Some("选课") {
            return Err(ElectiveError::SessionExpired);
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
            .header(REFERER, SUPPLY_CANCEL_URL)
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
            .header(REFERER, ELECT_SUPPLEMENT_URL)
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
        let body = self.fetch_html(cancel_url, ELECT_SUPPLEMENT_URL).await?;
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

    fn pagination_url(&self, key: &'static str, page_number: usize) -> Result<String> {
        if page_number == 0 {
            return Err(ElectiveError::Config("invalid pagination page".into()));
        }
        match key {
            "supplement" => {
                let offset = (page_number - 1) * 20;
                return Ok(if page_number == 1 {
                    SUPPLY_CANCEL_URL.to_string()
                } else {
                    format!("{SUPPLEMENT_PAGE_URL}?netui_row=electableListGrid%3B{offset}")
                });
            }
            "query" => {
                let offset = (page_number - 1) * 100;
                return Ok(if page_number == 1 {
                    COURSE_QUERY_URL.to_string()
                } else {
                    format!("{QUERY_PAGE_URL}?netui_row=syllabusListGrid%3B{offset}")
                });
            }
            "preselect" => {
                let offset = (page_number - 1) * 20;
                Ok(if page_number == 1 {
                    PRESELECT_URL.to_string()
                } else {
                    format!("{PRESELECT_URL}?netui_row=electableListGrid%3B{offset}")
                })
            }
            "results" => {
                let offset = (page_number - 1) * 20;
                Ok(if page_number == 1 {
                    RESULTS_URL.to_string()
                } else {
                    format!("{RESULTS_URL}?netui_row=electableListGrid%3B{offset}")
                })
            }
            "plan" => Err(ElectiveError::Config("选课计划不支持分页".into())),
            _ => Err(ElectiveError::Config("unknown pagination page".into())),
        }
    }

    async fn fetch_html(&self, url: &str, referer: &str) -> Result<String> {
        let response = self
            .auth
            .client()
            .get(url)
            .header(REFERER, referer)
            .send()
            .await?;
        let status = response.status();
        let body = response.text().await?;
        if !status.is_success() {
            return Err(ElectiveError::Fatal(format!("http status {status}")));
        }
        Ok(body)
    }

    async fn visit_action(&self, url: &str, referer: &str) -> Result<()> {
        let body = self.fetch_html(url, referer).await?;
        if let Some(error) = parse_course_page(&body)?.fatal_error {
            return Err(ElectiveError::Selection(error));
        }
        Ok(())
    }
}

fn with_optional_query(url: &str, key: &str, value: Option<u32>) -> Result<String> {
    let Some(value) = value else {
        return Ok(url.to_string());
    };

    let mut parsed = Url::parse(url)
        .map_err(|err| ElectiveError::Config(format!("invalid action url: {err}")))?;
    parsed
        .query_pairs_mut()
        .append_pair(key, &value.to_string());
    Ok(parsed.to_string())
}

fn same_action_identity(candidate: &str, requested: &str) -> bool {
    let (Ok(candidate), Ok(requested)) = (Url::parse(candidate), Url::parse(requested)) else {
        return false;
    };
    ["index", "seq"].into_iter().all(|key| {
        let candidate_value = candidate.query_pairs().find(|(name, _)| name == key);
        let requested_value = requested.query_pairs().find(|(name, _)| name == key);
        candidate_value.is_some() && candidate_value == requested_value
    })
}

fn validate_page_url(raw: &str, controller_path: &str) -> Result<()> {
    let url = Url::parse(raw)
        .map_err(|err| ElectiveError::Config(format!("invalid pagination url: {err}")))?;
    if url.scheme() != "https"
        || url.host_str() != Some("elective.pku.edu.cn")
        || !url.path().contains(controller_path)
    {
        return Err(ElectiveError::Config("invalid pagination url".into()));
    }
    Ok(())
}

fn validate_page(
    title: &Option<String>,
    expected: &str,
    fatal_error: Option<String>,
) -> Result<()> {
    if let Some(error) = fatal_error {
        return Err(ElectiveError::Fatal(error));
    }
    if title.as_deref() != Some(expected) {
        return Err(ElectiveError::SessionExpired);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::same_action_identity;

    #[test]
    fn action_identity_ignores_rotating_tokens() {
        let stale =
            "https://elective.pku.edu.cn/electCourse.do?index=1&seq=course-42&eid=old&rn=0.1";
        let fresh =
            "https://elective.pku.edu.cn/electCourse.do?index=1&seq=course-42&eid=new&rn=0.9";
        assert!(same_action_identity(fresh, stale));
    }

    #[test]
    fn action_identity_distinguishes_duplicate_rows() {
        let requested = "https://elective.pku.edu.cn/electCourse.do?index=1&seq=course-42&eid=old";
        let other_index =
            "https://elective.pku.edu.cn/electCourse.do?index=2&seq=course-42&eid=new";
        let other_sequence =
            "https://elective.pku.edu.cn/electCourse.do?index=1&seq=course-43&eid=new";
        assert!(!same_action_identity(other_index, requested));
        assert!(!same_action_identity(other_sequence, requested));
    }
}
