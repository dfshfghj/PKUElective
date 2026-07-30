use elective_core::{
    AppConfig, Course, Orchestrator, WishlistItem,
    parser::{detect_fatal_error, parse_course_page},
};

#[test]
fn parser_detects_fatal_error() {
    let html = r#"
    <table background="/elective2008/resources/images/11-1.png">
      <tr><td class="black">目前不是补退选时间</td></tr>
    </table>
    "#;
    let error = detect_fatal_error(html).expect("fatal error parsing should succeed");
    assert_eq!(error.as_deref(), Some("目前不是补退选时间"));
}

#[test]
fn wishlist_matches_course() {
    let course = Course {
        name: "计算机系统导论".into(),
        class_id: "1".into(),
        teacher: "张老师".into(),
        select_url: "https://example.com/select".into(),
        volume_cnt: 100,
        elected_cnt: 99,
    };
    let item = WishlistItem::new("计算机系统导论", "1");
    assert!(item.matches_course(&course));
}

#[test]
fn orchestrator_keeps_wishlist_unique() {
    let mut orchestrator = Orchestrator::new(AppConfig::default());
    orchestrator.add_wishlist(WishlistItem::new("计算机系统导论", "1"));
    orchestrator.add_wishlist(WishlistItem::new("计算机系统导论", "1"));
    assert_eq!(orchestrator.wishlist().len(), 1);
}

#[test]
fn parser_normalizes_buggy_zero_enrollment() {
    let html = r#"
    <html>
      <head><title>补选退选</title></head>
      <body>
        <table>
          <tr class="datagrid-even">
            <td><span>3</span></td>
            <td><span>离散数学</span></td>
            <td></td><td></td><td></td>
            <td><span>李老师</span></td>
            <td><span id="electedNum2">80 / 0</span></td>
            <td><a href="/elective2008/edu/pku/stu/elective/controller/supplement/electSupplement.do?id=3">选课</a></td>
          </tr>
        </table>
      </body>
    </html>
    "#;

    let parsed = parse_course_page(html).expect("course page parsing should succeed");
    assert_eq!(parsed.courses[0].elected_cnt, 80);
    assert!(!parsed.courses[0].selectable());
}
