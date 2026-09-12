import { invoke } from "@tauri-apps/api/core";

import type {
  AppStateView, AuthStateView, ConfigPatch, Course, CourseDetail, CourseQueryFilters, WishlistItem,
  ElectiveResults, ElectiveScheduleRow, PlanPageData, PreselectPageData, QueryPageData,
  SupplementPage,
} from "./types";

export type PlanActionData = { plan: PlanPageData; query: QueryPageData; preselect: PreselectPageData };
export type PlanMutationData = { plan: PlanPageData; preselect: PreselectPageData };
export type SupplementLimitData = { limit: number; elected: number };

type Channel = "bzx" | "bfx" | "";

export type CourseReviewMatch = {
  courseId: number;
  courseName: string;
  reviewCount: number;
  url: string;
};

export type CourseReviewLookup = {
  exact: boolean;
  matches: CourseReviewMatch[];
};

export type WebviewBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AppInfo = {
  version: string;
  buildChannel: string;
  projectUrl: string;
  platform: string;
  architecture: string;
  logPath: string;
  logSizeBytes: number;
};

export async function getSnapshot(): Promise<AppStateView> {
  return invoke<AppStateView>("get_app_state");
}

export async function login(payload: {
  username: string;
  password: string;
  channel: Channel;
  rememberPassword: boolean;
  autoLogin: boolean;
}): Promise<AuthStateView> {
  return invoke<AuthStateView>("login", {
    username: payload.username,
    password: payload.password,
    channel: payload.channel || null,
    rememberPassword: payload.rememberPassword,
    autoLogin: payload.autoLogin,
  });
}

export async function logout(): Promise<AppStateView> {
  return invoke<AppStateView>("logout");
}

export async function addBot(): Promise<AppStateView> {
  return invoke<AppStateView>("add_bot");
}

export async function refreshBotCaptcha(botId: string): Promise<AppStateView> {
  return invoke<AppStateView>("refresh_bot_captcha", { botId });
}

export async function verifyBotCaptcha(botId: string, code: string): Promise<AppStateView> {
  return invoke<AppStateView>("verify_bot_captcha", { botId, code });
}

export async function refreshNow(): Promise<void> {
  return invoke("refresh_now");
}

export async function refreshSchedule(): Promise<ElectiveScheduleRow[]> {
  return invoke<ElectiveScheduleRow[]>("refresh_schedule");
}

export async function refreshAutomationCourses(): Promise<Course[]> {
  return invoke<Course[]>("refresh_automation_courses");
}

export async function refreshPreselectCourses(): Promise<PreselectPageData> {
  return invoke<PreselectPageData>("refresh_preselect_courses");
}

export async function refreshPlanCourses(): Promise<PlanPageData> {
  return invoke<PlanPageData>("refresh_plan_courses");
}

export async function refreshResults(): Promise<ElectiveResults> {
  return invoke<ElectiveResults>("refresh_results");
}

export async function addWishlist(
  courseId: string,
  name: string,
  classId: string,
  teacher: string,
): Promise<WishlistItem[]> {
  return invoke<WishlistItem[]>("add_wishlist", {
    courseId,
    name,
    classId,
    teacher,
  });
}

export async function paginatePreselect(page: number): Promise<PreselectPageData> {
  return invoke<PreselectPageData>("paginate_preselect", { page });
}

export async function paginatePlan(page: number): Promise<PlanPageData> {
  return invoke<PlanPageData>("paginate_plan", { page });
}

export async function paginateQuery(page: number): Promise<QueryPageData> {
  return invoke<QueryPageData>("paginate_query", { page });
}

export async function paginateSupplement(page: number): Promise<SupplementPage> {
  return invoke<SupplementPage>("paginate_supplement", { page });
}

export async function paginateResults(page: number): Promise<ElectiveResults> {
  return invoke<ElectiveResults>("paginate_results", { page });
}

export async function removeWishlist(courseId: string, classId: string): Promise<WishlistItem[]> {
  return invoke<WishlistItem[]>("remove_wishlist", {
    courseId,
    classId,
  });
}

export async function updateConfig(patch: ConfigPatch): Promise<AppStateView> {
  return invoke<AppStateView>("update_config", { patch });
}

export async function searchQueryCourses(filters: CourseQueryFilters): Promise<QueryPageData> {
  return invoke<QueryPageData>("search_query_courses", { filters });
}

export async function getAppInfo(): Promise<AppInfo> {
  return invoke<AppInfo>("get_app_info");
}

export async function exportAppLog(): Promise<string> {
  return invoke<string>("export_app_log");
}

export async function clearAppLog(): Promise<void> {
  return invoke("clear_app_log");
}

export async function fetchCourseDetail(detailUrl: string): Promise<CourseDetail> {
  return invoke<CourseDetail>("fetch_course_detail", { detailUrl });
}

export async function findCourseReview(courseName: string): Promise<CourseReviewLookup> {
  return invoke<CourseReviewLookup>("find_course_review", { courseName });
}

export async function openCourseReviewWebview(courseId: number, bounds: WebviewBounds): Promise<void> {
  return invoke("open_course_review_webview", { courseId, bounds });
}

export async function resizeCourseReviewWebview(bounds: WebviewBounds): Promise<void> {
  return invoke("resize_course_review_webview", { bounds });
}

export async function showCourseReviewWebview(): Promise<void> {
  return invoke("show_course_review_webview");
}

export async function hideCourseReviewWebview(): Promise<void> {
  return invoke("hide_course_review_webview");
}

export async function closeCourseReviewWebview(): Promise<void> {
  return invoke("close_course_review_webview");
}

export async function refreshSupplementPage(): Promise<SupplementPage> {
  return invoke<SupplementPage>("refresh_supplement_page");
}

export async function refreshSupplementCaptcha(): Promise<void> {
  return invoke("refresh_supplement_captcha");
}

export async function addCourseToPlan(addUrl: string): Promise<PlanActionData> {
  return invoke<PlanActionData>("add_course_to_plan", { addUrl });
}

export async function removePlanCourse(deleteUrl: string): Promise<PlanMutationData> {
  return invoke<PlanMutationData>("remove_plan_course", { deleteUrl });
}

export async function preselectCourse(
  selectUrl: string,
  preference?: number | null,
): Promise<PreselectPageData> {
  return invoke<PreselectPageData>("preselect_course", {
    selectUrl,
    preference: preference ?? null,
  });
}

export async function cancelPreselectCourse(cancelUrl: string): Promise<PreselectPageData> {
  return invoke<PreselectPageData>("cancel_preselect_course", { cancelUrl });
}

export async function supplementSelectCourse(selectUrl: string, captchaCode: string): Promise<SupplementPage> {
  return invoke<SupplementPage>("supplement_select_course", { selectUrl, captchaCode });
}

export async function refreshSupplementLimit(selectUrl: string): Promise<SupplementLimitData> {
  return invoke<SupplementLimitData>("refresh_supplement_limit", { selectUrl });
}

export async function supplementCancelCourse(cancelUrl: string, captchaCode: string): Promise<SupplementPage> {
  return invoke<SupplementPage>("supplement_cancel_course", { cancelUrl, captchaCode });
}
