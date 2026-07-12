use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, WebviewBuilder, WebviewUrl, Window};
use tokio::sync::RwLock;

use crate::{inject, logger};

const COURSE_LIST_URL: &str = "https://api.pinzhixiaoyuan.com/api/courses/list";
const COURSE_VIEW_ORIGIN: &str = "https://courses.pinzhixiaoyuan.com";
const CACHE_FILE_NAME: &str = "pinzhi-courses.json";
const WEBVIEW_LABEL: &str = "course-review";

pub struct CourseReviewState {
    courses: RwLock<Vec<CourseMatch>>,
}

impl CourseReviewState {
    pub fn new() -> Self {
        Self {
            courses: RwLock::new(Vec::new()),
        }
    }
}

#[derive(Clone)]
struct CourseMatch {
    id: u64,
    name: String,
    review_count: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseReviewMatch {
    pub course_id: u64,
    pub course_name: String,
    pub review_count: u64,
    pub url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseReviewLookup {
    pub exact: bool,
    pub matches: Vec<CourseReviewMatch>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebviewBounds {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

pub async fn initialize(app: AppHandle, state: &CourseReviewState) {
    let cache_path = match cache_path(&app) {
        Ok(path) => path,
        Err(err) => {
            logger::error(format!("failed to resolve course review cache path: {err}"));
            return;
        }
    };

    if let Ok(cached_json) = std::fs::read_to_string(&cache_path) {
        match parse_course_index(&cached_json) {
            Ok(index) => {
                logger::info(format!("loaded {} cached course review entries", index.len()));
                *state.courses.write().await = index;
            }
            Err(err) => logger::error(format!("failed to load cached course review index: {err}")),
        }
    }

    match refresh_course_list().await {
        Ok(json) => match parse_course_index(&json) {
            Ok(index) => {
                if let Some(parent) = cache_path.parent() {
                    if let Err(err) = std::fs::create_dir_all(parent) {
                        logger::error(format!("failed to create course review cache directory: {err}"));
                    }
                }
                if let Err(err) = std::fs::write(&cache_path, json.as_bytes()) {
                    logger::error(format!("failed to persist course review cache: {err}"));
                }
                logger::info(format!("refreshed {} course review entries", index.len()));
                *state.courses.write().await = index;
            }
            Err(err) => logger::error(format!("invalid course review API response: {err}")),
        },
        Err(err) => logger::error(format!("failed to refresh course review list: {err}")),
    }
}

#[tauri::command]
pub async fn find_course_review(
    course_name: String,
    state: tauri::State<'_, CourseReviewState>,
) -> Result<CourseReviewLookup, String> {
    let courses = state.courses.read().await;
    let query = course_name.trim();
    let mut exact: Vec<&CourseMatch> = courses.iter().filter(|course| course.name == query).collect();
    exact.sort_by_key(|course| std::cmp::Reverse(course.review_count));
    if !exact.is_empty() {
        return Ok(CourseReviewLookup {
            exact: true,
            matches: exact.into_iter().map(review_match_view).collect(),
        });
    }

    let normalized_query = normalize_course_name(query);
    let mut fuzzy: Vec<(u8, &CourseMatch)> = courses
        .iter()
        .filter_map(|course| {
            let normalized_name = normalize_course_name(&course.name);
            let base_name = normalized_name
                .split(['(', '（'])
                .next()
                .unwrap_or(&normalized_name);
            let score = if base_name == normalized_query {
                0
            } else if normalized_name.starts_with(&normalized_query) {
                1
            } else if normalized_name.contains(&normalized_query)
                || normalized_query.contains(&normalized_name)
            {
                2
            } else {
                return None;
            };
            Some((score, course))
        })
        .collect();
    fuzzy.sort_by_key(|(score, course)| (*score, std::cmp::Reverse(course.review_count)));
    fuzzy.truncate(20);
    Ok(CourseReviewLookup {
        exact: false,
        matches: fuzzy.into_iter().map(|(_, course)| review_match_view(course)).collect(),
    })
}

#[tauri::command]
pub async fn open_course_review_webview(
    window: Window,
    course_id: u64,
    bounds: WebviewBounds,
) -> Result<(), String> {
    close_existing_webview(&window)?;
    let url = format!("{COURSE_VIEW_ORIGIN}/courses/view/{course_id}")
        .parse()
        .map_err(|err| format!("invalid course review URL: {err}"))?;
    let builder = WebviewBuilder::new(WEBVIEW_LABEL, WebviewUrl::External(url))
        .initialization_script(inject::COURSE_REVIEW_INITIALIZATION_SCRIPT)
        .on_navigation(|url| {
            matches!(url.scheme(), "http" | "https")
                && url.host_str().is_some_and(|host| {
                    host == "courses.pinzhixiaoyuan.com" || host.ends_with(".pinzhixiaoyuan.com")
                })
        });
    window
        .add_child(
            builder,
            LogicalPosition::new(bounds.x, bounds.y),
            LogicalSize::new(bounds.width.max(1.0), bounds.height.max(1.0)),
        )
        .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn resize_course_review_webview(
    app: AppHandle,
    bounds: WebviewBounds,
) -> Result<(), String> {
    let Some(webview) = app.get_webview(WEBVIEW_LABEL) else {
        return Ok(());
    };
    webview
        .set_position(LogicalPosition::new(bounds.x, bounds.y))
        .map_err(|err| err.to_string())?;
    webview
        .set_size(LogicalSize::new(bounds.width.max(1.0), bounds.height.max(1.0)))
        .map_err(|err| err.to_string())
}

#[tauri::command]
pub fn show_course_review_webview(app: AppHandle) -> Result<(), String> {
    if let Some(webview) = app.get_webview(WEBVIEW_LABEL) {
        webview.show().map_err(|err| err.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn hide_course_review_webview(app: AppHandle) -> Result<(), String> {
    if let Some(webview) = app.get_webview(WEBVIEW_LABEL) {
        webview.hide().map_err(|err| err.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn close_course_review_webview(app: AppHandle) -> Result<(), String> {
    if let Some(webview) = app.get_webview(WEBVIEW_LABEL) {
        webview.close().map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn close_existing_webview(window: &Window) -> Result<(), String> {
    if let Some(webview) = window.app_handle().get_webview(WEBVIEW_LABEL) {
        webview.close().map_err(|err| err.to_string())?;
    }
    Ok(())
}

fn parse_course_index(json: &str) -> Result<Vec<CourseMatch>, String> {
    let value: Value = serde_json::from_str(json).map_err(|err| err.to_string())?;
    let rows = value
        .pointer("/cDatas/rows")
        .and_then(Value::as_array)
        .ok_or_else(|| "missing cDatas.rows".to_owned())?;
    let mut courses = Vec::new();
    for row in rows {
        let Some(columns) = row.as_array() else { continue };
        let (Some(id), Some(name)) = (
            columns.first().and_then(Value::as_u64),
            columns.get(5).and_then(Value::as_str),
        ) else {
            continue;
        };
        let review_count = columns.get(8).and_then(Value::as_u64).unwrap_or(0);
        courses.push(CourseMatch {
            id,
            name: name.trim().to_owned(),
            review_count,
        });
    }
    Ok(courses)
}

fn review_match_view(course: &CourseMatch) -> CourseReviewMatch {
    CourseReviewMatch {
        course_id: course.id,
        course_name: course.name.clone(),
        review_count: course.review_count,
        url: format!("{COURSE_VIEW_ORIGIN}/courses/view/{}", course.id),
    }
}

fn normalize_course_name(name: &str) -> String {
    name.chars()
        .filter(|character| !character.is_whitespace())
        .flat_map(char::to_lowercase)
        .collect()
}

async fn refresh_course_list() -> Result<String, String> {
    let response = reqwest::Client::new()
        .post(COURSE_LIST_URL)
        .timeout(std::time::Duration::from_secs(30))
        .json(&serde_json::json!({
            "sSessionId": "null",
            "fv": 2,
        }))
        .send()
        .await
        .map_err(|err| err.to_string())?
        .error_for_status()
        .map_err(|err| err.to_string())?;
    response.text().await.map_err(|err| err.to_string())
}

fn cache_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|err| err.to_string())?
        .join(CACHE_FILE_NAME))
}
