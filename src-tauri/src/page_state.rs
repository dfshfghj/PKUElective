use elective_core::{
    Course, ElectiveResults, Pagination, PlanCourse, PreselectCourse, PreselectedCourse,
    QueryCourse, SupplementPage,
};

#[derive(Default)]
pub struct PageState {
    pub courses: Vec<Course>,
    pub preselect_courses: Vec<PreselectCourse>,
    pub preselected_courses: Vec<PreselectedCourse>,
    pub preselect_pagination: Pagination,
    pub plan_courses: Vec<PlanCourse>,
    pub plan_pagination: Pagination,
    pub query_courses: Vec<QueryCourse>,
    pub query_pagination: Pagination,
    pub supplement: SupplementPage,
    pub results: ElectiveResults,
}
