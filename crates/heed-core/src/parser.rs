use scraper::{Html, Selector};

use crate::{
    course::{Course, PlanCourse, PreselectCourse, QueryCourse},
    error::{HeedError, Result},
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
pub struct ParsedPreselectPage {
    pub title: Option<String>,
    pub fatal_error: Option<String>,
    pub courses: Vec<PreselectCourse>,
    pub next_page_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ParsedPlanPage {
    pub title: Option<String>,
    pub fatal_error: Option<String>,
    pub courses: Vec<PlanCourse>,
    pub next_page_url: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ParsedQueryPage {
    pub title: Option<String>,
    pub fatal_error: Option<String>,
    pub courses: Vec<QueryCourse>,
    pub next_page_url: Option<String>,
}

pub fn parse_course_page(html: &str) -> Result<ParsedCoursePage> {
    let document = Html::parse_document(html);
    let title = page_title(&document)?;

    let fatal_error = detect_fatal_error(html)?;
    let tips = detect_tips(html)?;
    let courses = parse_courses(&document)?;
    let next_page_url = find_next_page_url(&document)?;

    Ok(ParsedCoursePage {
        title,
        fatal_error,
        tips,
        courses,
        next_page_url,
    })
}

pub fn parse_preselect_page(html: &str) -> Result<ParsedPreselectPage> {
    let document = Html::parse_document(html);
    Ok(ParsedPreselectPage {
        title: page_title(&document)?,
        fatal_error: detect_fatal_error(html)?,
        courses: parse_preselect_courses(&document)?,
        next_page_url: find_next_page_url(&document)?,
    })
}

pub fn parse_plan_page(html: &str) -> Result<ParsedPlanPage> {
    let document = Html::parse_document(html);
    Ok(ParsedPlanPage {
        title: page_title(&document)?,
        fatal_error: detect_fatal_error(html)?,
        courses: parse_plan_courses(&document)?,
        next_page_url: find_next_page_url(&document)?,
    })
}

pub fn parse_query_page(html: &str) -> Result<ParsedQueryPage> {
    let document = Html::parse_document(html);
    Ok(ParsedQueryPage {
        title: page_title(&document)?,
        fatal_error: detect_fatal_error(html)?,
        courses: parse_query_courses(&document)?,
        next_page_url: find_next_page_url(&document)?,
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
    let class_selector = selector("td:nth-of-type(1) span")?;
    let name_selector = selector("td:nth-of-type(2) span")?;
    let teacher_selector = selector("td:nth-of-type(6) span")?;
    let select_selector = selector(
        r#"a[href^="/elective2008/edu/pku/stu/elective/controller/supplement/electSupplement.do"]"#,
    )?;
    let elected_selector = selector(r#"td span[id^="electedNum"]"#)?;

    let mut courses = Vec::new();
    for row in document.select(&row_selector) {
        let Some(select_link) = row.select(&select_selector).next() else {
            continue;
        };

        let class_id = row
            .select(&class_selector)
            .next()
            .map(normalized_text)
            .ok_or_else(|| HeedError::Parse("missing class id".into()))?;
        let name = row
            .select(&name_selector)
            .next()
            .map(normalized_text)
            .ok_or_else(|| HeedError::Parse("missing course name".into()))?;
        let teacher = row
            .select(&teacher_selector)
            .next()
            .map(normalized_text)
            .unwrap_or_default();

        let count_text = row
            .select(&elected_selector)
            .next()
            .map(normalized_text)
            .ok_or_else(|| HeedError::Parse("missing elected count".into()))?;

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
            .ok_or_else(|| HeedError::Parse("missing select url".into()))?;

        courses.push(Course {
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
            .unwrap_or_default()
            .to_string();

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
            schedule: cell_text(cells[9]),
            pnp_status: cell_text(cells[10]),
            volume_cnt,
            elected_cnt,
            preference_value,
            select_url: absolute_url(
                select_link
                    .value()
                    .attr("href")
                    .ok_or_else(|| HeedError::Parse("missing preselect url".into()))?,
            ),
        });
    }

    Ok(courses)
}

fn parse_plan_courses(document: &Html) -> Result<Vec<PlanCourse>> {
    let row_selector = selector("tr.datagrid-all, tr.datagrid-odd, tr.datagrid-even")?;
    let cell_selector = selector("td")?;
    let link_selector =
        selector(r#"a[href*="/electivePlan/deleElecPlanCurriclum.do"]"#)?;

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
            schedule: cell_text(cells[8]),
            pnp_status: cell_text(cells[9]),
            selection_mark: cell_text(cells[10]),
            delete_url,
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
            schedule: cell_text(cells[9]),
            volume_cnt,
            elected_cnt,
            pnp_status: cell_text(cells[11]),
            note: cell_text(cells[12]),
            add_to_plan_url,
        });
    }

    Ok(courses)
}

fn find_next_page_url(document: &Html) -> Result<Option<String>> {
    let selector = selector("a")?;
    for link in document.select(&selector) {
        let label = normalized_text(link);
        if label == "Next" {
            if let Some(path) = link.value().attr("href") {
                return Ok(Some(format!("{BASE_URL}{path}")));
            }
        }
    }
    Ok(None)
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
        .ok_or_else(|| HeedError::Parse("missing volume count".into()))?
        .parse::<u32>()
        .map_err(|_| HeedError::Parse(format!("invalid volume count: {raw}")))?;

    let elected_raw = parts
        .next()
        .ok_or_else(|| HeedError::Parse("missing elected count".into()))?;
    let elected = elected_raw
        .split('/')
        .next()
        .unwrap_or(elected_raw)
        .parse::<u32>()
        .map_err(|_| HeedError::Parse(format!("invalid elected count: {raw}")))?;

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

fn absolute_url(path: &str) -> String {
    if path.starts_with("http://") || path.starts_with("https://") {
        path.to_string()
    } else {
        format!("{BASE_URL}{path}")
    }
}

fn selector(value: &str) -> Result<Selector> {
    Selector::parse(value).map_err(|_| HeedError::Parse(format!("invalid selector: {value}")))
}

#[cfg(test)]
mod tests {
    use super::{detect_tips, parse_course_page, parse_plan_page, parse_preselect_page, parse_query_page};

    #[test]
    fn parses_courses_and_next_page() {
        let html = r#"
        <html>
          <head><title>补选退选</title></head>
          <body>
            <table>
              <tr class="datagrid-odd">
                <td><span>1</span></td>
                <td><span>计算机系统导论</span></td>
                <td></td><td></td><td></td>
                <td><span>张老师</span></td>
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
        assert_eq!(parsed.courses[0].name, "计算机系统导论");
        assert_eq!(parsed.courses[0].remaining(), 1);
        assert_eq!(
            parsed.next_page_url.as_deref(),
            Some("https://elective.pku.edu.cn/elective2008/page2")
        );
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
    }

    #[test]
    fn parses_example_query_page() {
        let html = include_str!("../../../example/课程查询.html");
        let parsed = parse_query_page(html).expect("query page should parse");
        assert_eq!(parsed.title.as_deref(), Some("课程查询"));
        assert!(!parsed.courses.is_empty());
        assert_eq!(parsed.courses[0].course_id, "01235260");
        assert!(parsed.courses[0].add_to_plan_url.is_some());
    }
}
