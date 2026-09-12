use scraper::{Html, Selector, node::Node};

use crate::{
    course::{
        Course, CourseResult, ElectiveResults, ElectiveScheduleRow, Pagination, PaginationLink,
        PlanCourse, PreselectCourse, PreselectedCourse, QueryCourse, SupplementAvailableCourse,
        SupplementPage, SupplementSelectedCourse, Timetable, TimetableCell, TimetableRow,
    },
    error::{ElectiveError, Result},
};

const BASE_URL: &str = "https://elective.pku.edu.cn";

#[derive(Debug, Clone)]
pub struct ParsedCoursePage {
    pub title: Option<String>,
    pub fatal_error: Option<String>,
    pub tips: Option<String>,
    pub courses: Vec<Course>,
    pub next_page_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ParsedSupplementPage {
    pub title: Option<String>,
    pub fatal_error: Option<String>,
    pub tips: Option<String>,
    pub page: SupplementPage,
}

#[derive(Debug, Clone)]
pub struct ParsedPreselectPage {
    pub title: Option<String>,
    pub fatal_error: Option<String>,
    pub courses: Vec<PreselectCourse>,
    pub selected_courses: Vec<PreselectedCourse>,
    pub next_page_url: Option<String>,
    pub pagination: Pagination,
}

#[derive(Debug, Clone)]
pub struct ParsedPlanPage {
    pub title: Option<String>,
    pub fatal_error: Option<String>,
    pub courses: Vec<PlanCourse>,
    pub next_page_url: Option<String>,
    pub pagination: Pagination,
}

#[derive(Debug, Clone)]
pub struct ParsedQueryPage {
    pub title: Option<String>,
    pub fatal_error: Option<String>,
    pub courses: Vec<QueryCourse>,
    pub next_page_url: Option<String>,
    pub pagination: Pagination,
}

#[derive(Debug, Clone)]
pub struct ParsedResultsPage {
    pub title: Option<String>,
    pub fatal_error: Option<String>,
    pub results: ElectiveResults,
}

pub fn parse_course_page(html: &str) -> Result<ParsedCoursePage> {
    let document = Html::parse_document(html);
    let title = page_title(&document)?;

    let fatal_error = detect_fatal_error(html)?;
    let tips = detect_tips(html)?;
    let courses = parse_courses(&document)?;
    let pagination = parse_pagination(&document)?;
    let next_page_url = pagination.next_url.clone();

    Ok(ParsedCoursePage {
        title,
        fatal_error,
        tips,
        courses,
        next_page_url,
    })
}

pub fn parse_supplement_page(html: &str) -> Result<ParsedSupplementPage> {
    let document = Html::parse_document(html);
    let pagination = parse_pagination(&document)?;
    let mut page = parse_supplement(&document)?;
    page.pagination = pagination;
    Ok(ParsedSupplementPage {
        title: page_title(&document)?,
        fatal_error: detect_fatal_error(html)?,
        tips: detect_tips(html)?,
        page,
    })
}

pub fn parse_preselect_page(html: &str) -> Result<ParsedPreselectPage> {
    let document = Html::parse_document(html);
    let pagination = parse_pagination(&document)?;
    Ok(ParsedPreselectPage {
        title: page_title(&document)?,
        fatal_error: detect_fatal_error(html)?,
        courses: parse_preselect_courses(&document)?,
        selected_courses: parse_preselected_courses(&document)?,
        next_page_url: pagination.next_url.clone(),
        pagination,
    })
}

pub fn parse_plan_page(html: &str) -> Result<ParsedPlanPage> {
    let document = Html::parse_document(html);
    let pagination = parse_pagination(&document)?;
    Ok(ParsedPlanPage {
        title: page_title(&document)?,
        fatal_error: detect_fatal_error(html)?,
        courses: parse_plan_courses(&document)?,
        next_page_url: pagination.next_url.clone(),
        pagination,
    })
}

pub fn parse_query_page(html: &str) -> Result<ParsedQueryPage> {
    let document = Html::parse_document(html);
    let pagination = parse_pagination(&document)?;
    Ok(ParsedQueryPage {
        title: page_title(&document)?,
        fatal_error: detect_fatal_error(html)?,
        courses: parse_query_courses(&document)?,
        next_page_url: pagination.next_url.clone(),
        pagination,
    })
}

pub fn parse_results_page(html: &str) -> Result<ParsedResultsPage> {
    let document = Html::parse_document(html);
    let pagination = parse_pagination(&document)?;
    let mut results = parse_results(&document)?;
    results.pagination = pagination;
    Ok(ParsedResultsPage {
        title: page_title(&document)?,
        fatal_error: detect_fatal_error(html)?,
        results,
    })
}

pub fn detect_fatal_error(html: &str) -> Result<Option<String>> {
    let document = Html::parse_document(html);
    let selectors = [
        r#"td[background="/elective2008/resources/images/11-1.png"] td.black"#,
        r#"[background="/elective2008/resources/images/11-1.png"] .black"#,
    ];

    for value in selectors {
        if let Some(node) = document.select(&selector(value)?).next() {
            return Ok(Some(normalized_text(node)));
        }
    }

    Ok(None)
}

pub fn detect_tips(html: &str) -> Result<Option<String>> {
    let document = Html::parse_document(html);
    Ok(document
        .select(&selector(r#"#msgTips td[width="100%"]"#)?)
        .next()
        .map(normalized_text))
}

fn parse_courses(document: &Html) -> Result<Vec<Course>> {
    let row_selector = selector("tr.datagrid-all, tr.datagrid-odd, tr.datagrid-even")?;
    let course_id_selector = selector("td:nth-of-type(1) span")?;
    let name_selector = selector("td:nth-of-type(2) span")?;
    let teacher_selector = selector("td:nth-of-type(6) span")?;
    let class_selector = selector("td:nth-of-type(7) span")?;
    let select_selector = selector(
        r#"a[href^="/elective2008/edu/pku/stu/elective/controller/supplement/electSupplement.do"]"#,
    )?;
    let elected_selector = selector(r#"td span[id^="electedNum"]"#)?;

    let mut courses = Vec::new();
    for row in document.select(&row_selector) {
        let Some(select_link) = row.select(&select_selector).next() else {
            continue;
        };

        let course_id = row
            .select(&course_id_selector)
            .next()
            .map(normalized_text)
            .ok_or_else(|| ElectiveError::Parse("missing course id".into()))?;
        let name = row
            .select(&name_selector)
            .next()
            .map(normalized_text)
            .ok_or_else(|| ElectiveError::Parse("missing course name".into()))?;
        let teacher = row
            .select(&teacher_selector)
            .next()
            .map(normalized_text)
            .unwrap_or_default();
        let class_id = row
            .select(&class_selector)
            .next()
            .map(normalized_text)
            .ok_or_else(|| ElectiveError::Parse("missing class id".into()))?;

        let count_text = row
            .select(&elected_selector)
            .next()
            .map(normalized_text)
            .ok_or_else(|| ElectiveError::Parse("missing elected count".into()))?;

        let (volume_cnt, elected_cnt) = parse_count_pair(&count_text)?;
        let elected_cnt = if elected_cnt == 0 {
            volume_cnt
        } else {
            elected_cnt
        };

        let select_url = select_link
            .value()
            .attr("href")
            .map(|path| format!("{BASE_URL}{path}"))
            .ok_or_else(|| ElectiveError::Parse("missing select url".into()))?;

        courses.push(Course {
            course_id,
            name,
            class_id,
            teacher,
            select_url,
            volume_cnt,
            elected_cnt,
        });
    }

    Ok(courses)
}

fn parse_supplement(document: &Html) -> Result<SupplementPage> {
    let table_selector = selector("table.datagrid")?;
    let header_selector = selector("tr.datagrid-header th")?;
    let row_selector = selector("tr.datagrid-all, tr.datagrid-odd, tr.datagrid-even")?;
    let message_selector = selector(".message_success + td, .errmsg")?;
    let remark_selector = selector(".pkuportal-remark")?;

    let mut page = SupplementPage {
        notices: document
            .select(&message_selector)
            .map(cell_text)
            .filter(|text| !text.is_empty())
            .collect(),
        ..SupplementPage::default()
    };

    for remark in document.select(&remark_selector) {
        let text = cell_text(remark);
        if let Some((_, credits)) = text.split_once("当前已选总学分为：") {
            page.selected_credits = Some(credits.trim().to_string());
        }
    }

    for table in document.select(&table_selector) {
        let headers = table
            .select(&header_selector)
            .map(normalized_text)
            .collect::<Vec<_>>();

        if headers.iter().any(|header| header == "补选") {
            for row in table.select(&row_selector) {
                if let Some(course) = parse_supplement_available_row(row)? {
                    page.available_courses.push(course);
                }
            }
        } else if headers.iter().any(|header| header == "退选") {
            for row in table.select(&row_selector) {
                if let Some(course) = parse_supplement_selected_row(row)? {
                    page.selected_courses.push(course);
                }
            }
        }
    }

    Ok(page)
}

fn parse_supplement_available_row(
    row: scraper::ElementRef<'_>,
) -> Result<Option<SupplementAvailableCourse>> {
    let cell_selector = selector("td")?;
    let action_selector = selector(
        r#"a[href*="/elective2008/edu/pku/stu/elective/controller/supplement/electSupplement.do"]"#,
    )?;
    let cells = row.select(&cell_selector).collect::<Vec<_>>();
    if cells.len() < 13 {
        return Ok(None);
    }

    let action_link = row.select(&action_selector).next();
    let count_text = cell_text(cells[11]);
    let (volume_cnt, elected_cnt) = parse_count_pair(&count_text)?;

    Ok(Some(SupplementAvailableCourse {
        course_id: cell_text(cells[0]),
        name: cell_text(cells[1]),
        category: cell_text(cells[2]),
        credits: cell_text(cells[3]),
        weekly_hours: cell_text(cells[4]),
        teacher: cell_text(cells[5]),
        class_id: cell_text(cells[6]),
        department: cell_text(cells[7]),
        grade: cell_text(cells[8]),
        schedule: cell_text_with_breaks(cells[9]),
        pnp_status: parse_pnp_status(cells[10]),
        volume_cnt,
        elected_cnt,
        action_label: action_link.map(normalized_text).unwrap_or_default(),
        select_url: action_link
            .and_then(|link| link.value().attr("href"))
            .map(absolute_url),
        detail_url: course_detail_url(row),
    }))
}

fn parse_supplement_selected_row(
    row: scraper::ElementRef<'_>,
) -> Result<Option<SupplementSelectedCourse>> {
    let cell_selector = selector("td")?;
    let action_selector = selector(
        r#"a[href*="/elective2008/edu/pku/stu/elective/controller/supplement/cancelCourse.do"]"#,
    )?;
    let cells = row.select(&cell_selector).collect::<Vec<_>>();
    if cells.len() < 14 {
        return Ok(None);
    }

    let count_text = cell_text(cells[11]);
    let (volume_cnt, elected_cnt) = parse_count_pair(&count_text)?;

    Ok(Some(SupplementSelectedCourse {
        course_id: cell_text(cells[0]),
        name: cell_text(cells[1]),
        category: cell_text(cells[2]),
        credits: cell_text(cells[3]),
        weekly_hours: cell_text(cells[4]),
        teacher: cell_text(cells[5]),
        class_id: cell_text(cells[6]),
        department: cell_text(cells[7]),
        grade: cell_text(cells[8]),
        schedule: cell_text_with_breaks(cells[9]),
        pnp_status: parse_pnp_status(cells[10]),
        volume_cnt,
        elected_cnt,
        status: cell_text(cells[12]),
        cancel_url: row
            .select(&action_selector)
            .next()
            .and_then(|link| link.value().attr("href"))
            .map(absolute_url),
        detail_url: course_detail_url(row),
    }))
}

fn parse_preselect_courses(document: &Html) -> Result<Vec<PreselectCourse>> {
    let row_selector = selector("tr.datagrid-all, tr.datagrid-odd, tr.datagrid-even")?;
    let cell_selector = selector("td")?;
    let input_selector = selector(r#"input[type="text"]"#)?;
    let link_selector = selector(r#"a[href*="/electiveWork/electCourse.do"]"#)?;

    let mut courses = Vec::new();
    for row in document.select(&row_selector) {
        let cells = row.select(&cell_selector).collect::<Vec<_>>();
        if cells.len() < 14 {
            continue;
        }

        let Some(select_link) = row.select(&link_selector).next() else {
            continue;
        };

        let count_text = cell_text(cells[11]);
        let (volume_cnt, elected_cnt) = parse_count_pair(&count_text)?;
        let preference_value = cells[12]
            .select(&input_selector)
            .next()
            .and_then(|input| input.value().attr("value"))
            .map(str::to_string)
            .unwrap_or_else(|| cell_text(cells[12]));

        courses.push(PreselectCourse {
            course_id: cell_text(cells[0]),
            name: cell_text(cells[1]),
            category: cell_text(cells[2]),
            credits: cell_text(cells[3]),
            weekly_hours: cell_text(cells[4]),
            teacher: cell_text(cells[5]),
            class_id: cell_text(cells[6]),
            department: cell_text(cells[7]),
            grade: cell_text(cells[8]),
            schedule: cell_text_with_breaks(cells[9]),
            pnp_status: cell_text(cells[10]),
            volume_cnt,
            elected_cnt,
            preference_value,
            select_url: absolute_url(
                select_link
                    .value()
                    .attr("href")
                    .ok_or_else(|| ElectiveError::Parse("missing preselect url".into()))?,
            ),
            detail_url: course_detail_url(row),
        });
    }

    Ok(courses)
}

fn parse_preselected_courses(document: &Html) -> Result<Vec<PreselectedCourse>> {
    let row_selector = selector("tr.datagrid-all, tr.datagrid-odd, tr.datagrid-even")?;
    let cell_selector = selector("td")?;
    let input_selector = selector(r#"input[type="text"]"#)?;
    let link_selector = selector(r#"a[href*="/electiveWork/cancelCourse.do"]"#)?;
    let mut courses = Vec::new();

    for row in document.select(&row_selector) {
        let cells = row.select(&cell_selector).collect::<Vec<_>>();
        if cells.len() < 14 {
            continue;
        }
        let Some(cancel_link) = row.select(&link_selector).next() else {
            continue;
        };
        let (volume_cnt, elected_cnt) = parse_count_pair(&cell_text(cells[11]))?;
        let cancel_url = cancel_link
            .value()
            .attr("href")
            .ok_or_else(|| ElectiveError::Parse("missing preselect cancel url".into()))?;
        courses.push(PreselectedCourse {
            course_id: cell_text(cells[0]),
            name: cell_text(cells[1]),
            category: cell_text(cells[2]),
            credits: cell_text(cells[3]),
            weekly_hours: cell_text(cells[4]),
            teacher: cell_text(cells[5]),
            class_id: cell_text(cells[6]),
            department: cell_text(cells[7]),
            grade: cell_text(cells[8]),
            schedule: cell_text_with_breaks(cells[9]),
            pnp_status: cell_text(cells[10]),
            volume_cnt,
            elected_cnt,
            preference_value: cells[12]
                .select(&input_selector)
                .next()
                .and_then(|input| input.value().attr("value"))
                .map(str::to_string)
                .unwrap_or_else(|| cell_text(cells[12])),
            cancel_url: absolute_url(cancel_url),
            detail_url: course_detail_url(row),
        });
    }
    Ok(courses)
}

fn parse_plan_courses(document: &Html) -> Result<Vec<PlanCourse>> {
    let row_selector = selector("tr.datagrid-all, tr.datagrid-odd, tr.datagrid-even")?;
    let cell_selector = selector("td")?;
    let link_selector = selector(r#"a[href*="/electivePlan/deleElecPlanCurriclum.do"]"#)?;

    let mut courses = Vec::new();
    for row in document.select(&row_selector) {
        let cells = row.select(&cell_selector).collect::<Vec<_>>();
        if cells.len() < 11 {
            continue;
        }

        let delete_url = row
            .select(&link_selector)
            .next()
            .and_then(|link| link.value().attr("href"))
            .map(absolute_url);

        courses.push(PlanCourse {
            course_id: cell_text(cells[0]),
            name: cell_text(cells[1]),
            class_id: cell_text(cells[2]),
            category: cell_text(cells[3]),
            grade: cell_text(cells[4]),
            credits: cell_text(cells[5]),
            weekly_hours: cell_text(cells[6]),
            total_hours: cell_text(cells[7]),
            schedule: cell_text_with_breaks(cells[8]),
            pnp_status: cell_text(cells[9]),
            selection_mark: cell_text(cells[10]),
            delete_url,
            detail_url: course_detail_url_in_cell(cells[0], "/electivePlan/goNested.do"),
        });
    }

    Ok(courses)
}

fn parse_query_courses(document: &Html) -> Result<Vec<QueryCourse>> {
    let row_selector = selector("tr.datagrid-all, tr.datagrid-odd, tr.datagrid-even")?;
    let cell_selector = selector("td")?;
    let link_selector = selector(r#"a[href*="/courseQuery/addToPlan.do"]"#)?;

    let mut courses = Vec::new();
    for row in document.select(&row_selector) {
        let cells = row.select(&cell_selector).collect::<Vec<_>>();
        if cells.len() < 14 {
            continue;
        }

        let count_text = cell_text(cells[10]);
        let (volume_cnt, elected_cnt) = parse_count_pair(&count_text)?;
        let add_to_plan_url = row
            .select(&link_selector)
            .next()
            .and_then(|link| link.value().attr("href"))
            .map(absolute_url);

        courses.push(QueryCourse {
            course_id: cell_text(cells[0]),
            name: cell_text(cells[1]),
            category: cell_text(cells[2]),
            credits: cell_text(cells[3]),
            teacher: cell_text(cells[4]),
            class_id: cell_text(cells[5]),
            department: cell_text(cells[6]),
            major: cell_text(cells[7]),
            grade: cell_text(cells[8]),
            schedule: cell_text_with_breaks(cells[9]),
            volume_cnt,
            elected_cnt,
            pnp_status: cell_text(cells[11]),
            note: cell_text(cells[12]),
            add_to_plan_url,
            detail_url: course_detail_url_in_cell(cells[0], "/courseQuery/goNested.do"),
        });
    }

    Ok(courses)
}

pub fn parse_elective_schedule(html: &str) -> Result<Vec<ElectiveScheduleRow>> {
    let document = Html::parse_document(html);
    let table_selector = selector("table.datagrid")?;
    let header_selector = selector("tr.datagrid-header th")?;
    let row_selector = selector("tr.datagrid-all, tr.datagrid-odd, tr.datagrid-even")?;
    let cell_selector = selector("td")?;

    for table in document.select(&table_selector) {
        let headers = table
            .select(&header_selector)
            .map(cell_text)
            .collect::<Vec<_>>();
        if headers != ["选课阶段", "开始时间", "结束时间", "备注"] {
            continue;
        }

        return Ok(table
            .select(&row_selector)
            .filter_map(|row| {
                let cells = row.select(&cell_selector).collect::<Vec<_>>();
                (cells.len() >= 4).then(|| ElectiveScheduleRow {
                    stage: cell_text(cells[0]),
                    start_time: cell_text(cells[1]),
                    end_time: cell_text(cells[2]),
                    note: cell_text(cells[3]),
                })
            })
            .collect());
    }

    Err(ElectiveError::Parse(
        "missing elective schedule table".into(),
    ))
}

fn course_detail_url(row: scraper::ElementRef<'_>) -> Option<String> {
    let detail_selector = selector(r#"a[href*="/electiveWork/goNested.do"]"#).ok()?;
    row.select(&detail_selector)
        .next()
        .and_then(|link| link.value().attr("href"))
        .map(absolute_url)
}

fn course_detail_url_in_cell(
    cell: scraper::ElementRef<'_>,
    controller_path: &str,
) -> Option<String> {
    let detail_selector = selector(&format!(r#"a[href*="{controller_path}"]"#)).ok()?;
    cell.select(&detail_selector)
        .next()
        .and_then(|link| link.value().attr("href"))
        .map(absolute_url)
}

fn parse_results(document: &Html) -> Result<ElectiveResults> {
    let result_table_selector = selector("table.datagrid")?;
    let result_row_selector = selector("tr.datagrid-all, tr.datagrid-odd, tr.datagrid-even")?;
    let cell_selector = selector("td")?;
    let remark_selector = selector("p.pkuportal-remark")?;
    let timetable_selector = selector("#classAssignment")?;
    let timetable_header_selector = selector("tr.course-header th")?;
    let timetable_row_selector = selector("tr.course-even, tr.course-odd")?;
    let timetable_cell_selector = selector("td")?;
    let caption_selector = selector("caption")?;
    let export_selector = selector(r#"a[href*="/electiveWork/createExcel.do"]"#)?;

    let summary = document
        .select(&remark_selector)
        .next()
        .map(cell_text)
        .filter(|text| !text.is_empty());
    let notice = document
        .select(&remark_selector)
        .last()
        .map(cell_text)
        .filter(|text| !text.is_empty());
    let export_url = document
        .select(&export_selector)
        .next()
        .and_then(|node| node.value().attr("href"))
        .map(absolute_url);

    let mut courses = Vec::new();
    if let Some(table) = document.select(&result_table_selector).next() {
        for row in table.select(&result_row_selector) {
            let cells = row.select(&cell_selector).collect::<Vec<_>>();
            if cells.len() < 13 {
                continue;
            }

            courses.push(CourseResult {
                course_id: cell_text(cells[0]),
                name: cell_text(cells[1]),
                category: cell_text(cells[2]),
                credits: cell_text(cells[3]),
                weekly_hours: cell_text(cells[4]),
                teacher: cell_text(cells[5]),
                class_id: cell_text(cells[6]),
                department: cell_text(cells[7]),
                classroom_info: cell_text_with_breaks(cells[8]),
                pnp_status: cell_text(cells[9]),
                result: cell_text(cells[10]),
                ip_address: cell_text(cells[11]),
                operation_time: cell_text(cells[12]),
            });
        }
    }

    let timetable = document.select(&timetable_selector).next().map(|table| {
        let caption = table
            .select(&caption_selector)
            .next()
            .map(cell_text)
            .filter(|text| !text.is_empty());
        let headers = table
            .select(&timetable_header_selector)
            .map(cell_text)
            .collect::<Vec<_>>();
        let rows = table
            .select(&timetable_row_selector)
            .filter_map(|row| {
                let cells = row.select(&timetable_cell_selector).collect::<Vec<_>>();
                if cells.len() < 2 {
                    return None;
                }

                Some(TimetableRow {
                    section: cell_text(cells[0]),
                    cells: cells
                        .iter()
                        .skip(1)
                        .map(|cell| TimetableCell {
                            text: cell_text(*cell),
                            background_color: cell
                                .value()
                                .attr("style")
                                .and_then(extract_background_color)
                                .or_else(|| {
                                    cell.value()
                                        .attr("bgcolor")
                                        .map(str::trim)
                                        .filter(|value| !value.is_empty())
                                        .map(ToOwned::to_owned)
                                }),
                        })
                        .collect(),
                })
            })
            .collect::<Vec<_>>();

        Timetable {
            caption,
            headers,
            rows,
        }
    });

    Ok(ElectiveResults {
        summary,
        notice,
        export_url,
        courses,
        timetable,
        ..ElectiveResults::default()
    })
}

fn parse_pagination(document: &Html) -> Result<Pagination> {
    let mut pagination = Pagination::default();
    let (summary_current, summary_total) = parse_page_summary(&cell_text(document.root_element()));
    pagination.current_page = summary_current.unwrap_or(1);
    pagination.total_pages = summary_total.unwrap_or(1);

    for link in document.select(&selector("a")?) {
        let label = normalized_text(link);
        let Some(href) = link.value().attr("href") else {
            continue;
        };
        if !href.contains("netui_row") {
            continue;
        }
        let Some(url) = resolve_site_url(href) else {
            continue;
        };
        match label.as_str() {
            "Next" => pagination.next_url = Some(url),
            "Previous" => pagination.previous_url = Some(url),
            _ => {
                if let Ok(page) = label.parse::<usize>() {
                    pagination.pages.push(PaginationLink { page, url });
                }
            }
        }
    }

    if let Some(form) = document
        .select(&selector(r#"form[name="pageForm"]"#)?)
        .next()
        && let Some(action) = form.value().attr("action").and_then(resolve_site_url)
    {
        let options = form
            .select(&selector(r#"select[name="netui_row"] option"#)?)
            .collect::<Vec<_>>();
        if let Some(selected_index) = options
            .iter()
            .position(|option| option.value().attr("selected").is_some())
            .or((!options.is_empty()).then_some(0))
        {
            pagination.current_page = selected_index + 1;
        }
        pagination.total_pages = pagination.total_pages.max(options.len().max(1));

        for (index, option) in options.iter().enumerate() {
            let Some(value) = option.value().attr("value") else {
                continue;
            };
            let page = normalized_text(*option)
                .parse::<usize>()
                .unwrap_or(index + 1);
            if !pagination.pages.iter().any(|link| link.page == page)
                && let Some(url) = replace_query_value(&action, "netui_row", value)
            {
                pagination.pages.push(PaginationLink { page, url });
            }
        }

        if pagination.previous_url.is_none() && pagination.current_page > 1 {
            pagination.previous_url = pagination
                .pages
                .iter()
                .find(|link| link.page + 1 == pagination.current_page)
                .map(|link| link.url.clone());
        }
        if pagination.next_url.is_none() {
            pagination.next_url = pagination
                .pages
                .iter()
                .find(|link| link.page == pagination.current_page + 1)
                .map(|link| link.url.clone());
        }
    }

    pagination.pages.sort_by_key(|link| link.page);
    pagination.total_pages = pagination.total_pages.max(
        pagination
            .pages
            .iter()
            .map(|link| link.page)
            .max()
            .unwrap_or(1),
    );
    Ok(pagination)
}

fn resolve_site_url(raw: &str) -> Option<String> {
    let base = reqwest::Url::parse(BASE_URL).ok()?;
    let url = base.join(raw).ok()?;
    (url.scheme() == "https" && url.host_str() == Some("elective.pku.edu.cn"))
        .then(|| url.to_string())
}

fn replace_query_value(raw_url: &str, key: &str, value: &str) -> Option<String> {
    let mut url = reqwest::Url::parse(raw_url).ok()?;
    let pairs = url
        .query_pairs()
        .filter(|(name, _)| name != key)
        .map(|(name, value)| (name.into_owned(), value.into_owned()))
        .collect::<Vec<_>>();
    url.set_query(None);
    {
        let mut query = url.query_pairs_mut();
        for (name, value) in pairs {
            query.append_pair(&name, &value);
        }
        query.append_pair(key, value);
    }
    Some(url.to_string())
}

fn parse_page_summary(text: &str) -> (Option<usize>, Option<usize>) {
    let Some(rest) = text.split_once("Page").map(|(_, rest)| rest.trim_start()) else {
        return (None, None);
    };
    let current_text = rest
        .chars()
        .take_while(char::is_ascii_digit)
        .collect::<String>();
    let Some(total_rest) = rest
        .get(current_text.len()..)
        .map(str::trim_start)
        .and_then(|value| value.strip_prefix("of"))
    else {
        return (None, None);
    };
    let total_text = total_rest
        .trim_start()
        .chars()
        .take_while(char::is_ascii_digit)
        .collect::<String>();
    (current_text.parse().ok(), total_text.parse().ok())
}

fn page_title(document: &Html) -> Result<Option<String>> {
    Ok(document
        .select(&selector("title")?)
        .next()
        .map(|node| node.text().collect::<String>().trim().to_string()))
}

fn parse_count_pair(raw: &str) -> Result<(u32, u32)> {
    let normalized = raw.replace(' ', "");
    let mut parts = normalized.split('/');
    let volume = parts
        .next()
        .ok_or_else(|| ElectiveError::Parse("missing volume count".into()))?
        .parse::<u32>()
        .map_err(|_| ElectiveError::Parse(format!("invalid volume count: {raw}")))?;

    let elected_raw = parts
        .next()
        .ok_or_else(|| ElectiveError::Parse("missing elected count".into()))?;
    let elected = elected_raw
        .split('/')
        .next()
        .unwrap_or(elected_raw)
        .parse::<u32>()
        .map_err(|_| ElectiveError::Parse(format!("invalid elected count: {raw}")))?;

    Ok((volume, elected))
}

fn normalized_text(element: scraper::ElementRef<'_>) -> String {
    element
        .text()
        .collect::<Vec<_>>()
        .join("")
        .split_whitespace()
        .collect::<String>()
}

fn cell_text(element: scraper::ElementRef<'_>) -> String {
    element
        .text()
        .collect::<Vec<_>>()
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Preserve the semantic line breaks used by the elective site while still
/// normalizing indentation and other incidental HTML whitespace.
fn cell_text_with_breaks(element: scraper::ElementRef<'_>) -> String {
    let mut text = String::new();
    for node in element.descendants() {
        match node.value() {
            Node::Text(value) => text.push_str(value),
            Node::Element(value) if value.name() == "br" => text.push('\n'),
            _ => {}
        }
    }

    text.lines()
        .map(|line| line.split_whitespace().collect::<Vec<_>>().join(" "))
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join("\n")
}

fn parse_pnp_status(element: scraper::ElementRef<'_>) -> String {
    let class = element.value().attr("class").unwrap_or_default();
    if class.contains("pku-art-pnp-invalid") {
        "不可选".to_string()
    } else if class.contains("pku-art-pnp-valid") {
        "可选".to_string()
    } else {
        cell_text(element)
    }
}

fn absolute_url(path: &str) -> String {
    if path.starts_with("http://") || path.starts_with("https://") {
        path.to_string()
    } else {
        format!("{BASE_URL}{path}")
    }
}

fn extract_background_color(style: &str) -> Option<String> {
    style
        .split(';')
        .filter_map(|part| part.split_once(':'))
        .find_map(|(key, value)| {
            if key.trim().eq_ignore_ascii_case("background-color") {
                Some(value.trim().to_string())
            } else if key.trim().eq_ignore_ascii_case("background")
                && !value.trim().to_ascii_lowercase().contains("url(")
            {
                Some(value.trim().to_string())
            } else {
                None
            }
        })
        .filter(|value| !value.is_empty())
}

fn selector(value: &str) -> Result<Selector> {
    Selector::parse(value).map_err(|_| ElectiveError::Parse(format!("invalid selector: {value}")))
}

#[cfg(test)]
mod tests {
    use super::{
        cell_text_with_breaks, detect_tips, parse_course_page, parse_elective_schedule,
        parse_pagination, parse_plan_page, parse_preselect_page, parse_query_page,
        parse_results_page, parse_supplement_page, selector,
    };
    use scraper::Html;

    #[test]
    fn preserves_explicit_cell_line_breaks() {
        let document = Html::parse_fragment(
            "<table><tr><td>周一1~2节<br>考试方式：堂考<br/>地点：二教</td></tr></table>",
        );
        let cell = document
            .select(&selector("td").expect("valid selector"))
            .next()
            .expect("cell should exist");

        assert_eq!(
            cell_text_with_breaks(cell),
            "周一1~2节\n考试方式：堂考\n地点：二教"
        );
    }

    #[test]
    fn parses_courses_and_next_page() {
        let html = r#"
        <html>
          <head><title>补选退选</title></head>
          <body>
            <table>
              <tr class="datagrid-odd">
                <td><span>04830010</span></td>
                <td><span>计算机系统导论</span></td>
                <td></td><td></td><td></td>
                <td><span>张老师</span></td>
                <td><span>1</span></td>
                <td><span id="electedNum1">100 / 99</span></td>
                <td><a href="/elective2008/edu/pku/stu/elective/controller/supplement/electSupplement.do?id=1">选课</a></td>
              </tr>
            </table>
            <a href="/elective2008/page2">Next</a>
          </body>
        </html>
        "#;

        let parsed = parse_course_page(html).expect("parser should succeed");
        assert_eq!(parsed.title.as_deref(), Some("补选退选"));
        assert_eq!(parsed.courses.len(), 1);
        assert_eq!(parsed.courses[0].course_id, "04830010");
        assert_eq!(parsed.courses[0].class_id, "1");
        assert_eq!(parsed.courses[0].name, "计算机系统导论");
        assert_eq!(parsed.courses[0].remaining(), 1);
        assert_eq!(
            parsed.next_page_url.as_deref(),
            Some("https://elective.pku.edu.cn/elective2008/page2")
        );
    }

    #[test]
    fn pagination_prefers_complete_next_link() {
        let document = Html::parse_document(
            r#"
            <html><body>
              Page 1 of 2
              <form name="pageForm" action="/elective2008/edu/pku/stu/elective/controller/supplement/supplement.jsp">
                <select name="netui_row">
                  <option value="electableListGrid;0" selected="true">1</option>
                  <option value="electableListGrid;20">2</option>
                </select>
              </form>
              <a href="/elective2008/edu/pku/stu/elective/controller/supplement/supplement.jsp?netui_pagesize=electableListGrid%3B20&amp;xh=2400011461&amp;netui_row=electableListGrid%3B20">Next</a>
            </body></html>
        "#,
        );
        let pagination = parse_pagination(&document).expect("pagination should parse");
        assert_eq!(pagination.current_page, 1);
        assert_eq!(pagination.total_pages, 2);
        assert_eq!(
            pagination.next_url.as_deref(),
            Some(
                "https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/supplement/supplement.jsp?netui_pagesize=electableListGrid%3B20&xh=2400011461&netui_row=electableListGrid%3B20"
            )
        );
    }

    #[test]
    fn pagination_uses_exact_page_form_option_values() {
        let document = Html::parse_document(
            r#"
            <html><body>
              Page 2 of 3
              <form name="pageForm" action="https://elective.pku.edu.cn/elective2008/edu/pku/stu/elective/controller/courseQuery/queryCurriculum.jsp?keep=yes&amp;netui_row=stale">
                <select name="netui_row">
                  <option value="syllabusListGrid;0">1</option>
                  <option value="syllabusListGrid;37" selected="true">2</option>
                  <option value="syllabusListGrid;91">3</option>
                </select>
              </form>
            </body></html>
        "#,
        );
        let pagination = parse_pagination(&document).expect("pagination should parse");
        assert_eq!(pagination.current_page, 2);
        assert_eq!(pagination.total_pages, 3);
        assert!(pagination.pages[2].url.contains("keep=yes"));
        assert!(
            pagination.pages[2]
                .url
                .contains("netui_row=syllabusListGrid%3B91")
        );
        assert!(!pagination.pages[2].url.contains("stale"));
    }

    #[test]
    fn pagination_ignores_numeric_course_ids() {
        let document = Html::parse_document(
            r#"
            <html><body>
              Page 1 of 2
              <a href="/elective2008/course/131470">131470</a>
              <a href="/elective2008/course/6232000">6232000</a>
              <a href="/elective2008/edu/pku/stu/elective/controller/supplement/supplement.jsp?netui_row=electableListGrid%3B20">Next</a>
              <form name="pageForm" action="/elective2008/supplement.jsp">
                <select name="netui_row">
                  <option value="electableListGrid;0" selected="true">1</option>
                  <option value="electableListGrid;20">2</option>
                </select>
              </form>
            </body></html>
        "#,
        );
        let pagination = parse_pagination(&document).expect("pagination should parse");
        assert_eq!(pagination.current_page, 1);
        assert_eq!(pagination.total_pages, 2);
        assert!(pagination.pages.is_empty() || pagination.pages.iter().all(|p| p.page <= 2));
    }

    #[test]
    fn parses_tips() {
        let html = r#"
        <div id="msgTips">
          <table>
            <tr><td width="100%">成功，请查看已选上列表确认</td></tr>
          </table>
        </div>
        "#;
        let tips = detect_tips(html).expect("tips parse should succeed");
        assert_eq!(tips.as_deref(), Some("成功，请查看已选上列表确认"));
    }

    #[test]
    fn parses_example_preselect_page() {
        let html = include_str!("../../../example/选课.html");
        let parsed = parse_preselect_page(html).expect("preselect page should parse");
        assert_eq!(parsed.title.as_deref(), Some("选课"));
        assert!(!parsed.courses.is_empty());
        assert_eq!(parsed.courses[0].course_id, "00437151");
        assert_eq!(parsed.courses[0].class_id, "1");
    }

    #[test]
    fn parses_example_plan_page() {
        let html = include_str!("../../../example/选课计划.html");
        let parsed = parse_plan_page(html).expect("plan page should parse");
        assert_eq!(parsed.title.as_deref(), Some("选课计划"));
        assert!(!parsed.courses.is_empty());
        assert_eq!(parsed.courses[0].course_id, "00437151");
        assert!(parsed.courses[0].delete_url.is_some());
        assert!(
            parsed.courses[0]
                .detail_url
                .as_deref()
                .is_some_and(|url| url.contains("/electivePlan/goNested.do"))
        );
    }

    #[test]
    fn parses_example_elective_schedule() {
        let html = include_str!("../../../example/帮助-总体流程.html");
        let schedule = parse_elective_schedule(html).expect("elective schedule should parse");
        assert!(!schedule.is_empty());
        assert_eq!(schedule[0].stage, "维护选课计划");
        assert!(schedule.iter().any(|row| row.stage == "预选"));
    }

    #[test]
    fn parses_example_query_page() {
        let html = include_str!("../../../example/课程查询.html");
        let parsed = parse_query_page(html).expect("query page should parse");
        assert_eq!(parsed.title.as_deref(), Some("课程查询"));
        assert!(!parsed.courses.is_empty());
        assert_eq!(parsed.courses[0].course_id, "01235260");
        assert!(parsed.courses[0].add_to_plan_url.is_some());
        assert!(
            parsed.courses[0]
                .detail_url
                .as_deref()
                .is_some_and(|url| url.contains("/courseQuery/goNested.do"))
        );
    }

    #[test]
    fn parses_example_results_page() {
        let html = include_str!("../../../example/选课结果.html");
        let parsed = parse_results_page(html).expect("results page should parse");
        assert_eq!(parsed.title.as_deref(), Some("选课结果"));
        assert_eq!(parsed.results.courses.len(), 1);
        assert_eq!(parsed.results.courses[0].course_id, "01233170");
        assert_eq!(parsed.results.courses[0].result, "待抽签");
        assert!(parsed.results.timetable.is_some());
        assert_eq!(
            parsed
                .results
                .timetable
                .as_ref()
                .expect("timetable should exist")
                .rows[0]
                .section,
            "第一节"
        );
    }

    #[test]
    fn parses_example_supplement_page() {
        let html = include_str!("../../../example/补选退选.html");
        let parsed = parse_supplement_page(html).expect("supplement page should parse");
        assert_eq!(parsed.title.as_deref(), Some("补选退选"));
        assert_eq!(parsed.page.available_courses[0].course_id, "00432011");
        assert_eq!(parsed.page.available_courses[0].action_label, "补选");
        assert!(parsed.page.available_courses[0].select_url.is_some());
        assert_eq!(parsed.page.selected_courses[0].name, "广义相对论");
        assert_eq!(parsed.page.selected_courses[0].status, "已选上");
        assert!(parsed.page.selected_courses[0].cancel_url.is_some());
        assert_eq!(parsed.page.selected_credits.as_deref(), Some("22.0"));
    }
}
