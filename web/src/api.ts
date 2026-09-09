import { invoke } from "@tauri-apps/api/core";

import type { AppStateView, AuthStateView, ConfigPatch, CourseDetail, CourseQueryFilters } from "./types";

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

export async function refreshNow(): Promise<AppStateView> {
  return invoke<AppStateView>("refresh_now");
}

export async function refreshSchedule(): Promise<AppStateView> {
  return invoke<AppStateView>("refresh_schedule");
}

export async function refreshAutomationCourses(): Promise<AppStateView> {
  return invoke<AppStateView>("refresh_automation_courses");
}

export async function refreshPreselectCourses(): Promise<AppStateView> {
  return invoke<AppStateView>("refresh_preselect_courses");
}

export async function refreshPlanCourses(): Promise<AppStateView> {
  return invoke<AppStateView>("refresh_plan_courses");
}

export async function refreshResults(): Promise<AppStateView> {
  return invoke<AppStateView>("refresh_results");
}

export async function addWishlist(
  courseId: string,
  name: string,
  classId: string,
  teacher: string,
): Promise<AppStateView> {
  return invoke<AppStateView>("add_wishlist", {
    courseId,
    name,
    classId,
    teacher,
  });
}

export async function paginatePreselect(url: string): Promise<AppStateView> {
  return invoke<AppStateView>("paginate_preselect", { url });
}

export async function paginatePlan(url: string): Promise<AppStateView> {
  return invoke<AppStateView>("paginate_plan", { url });
}

export async function paginateQuery(url: string): Promise<AppStateView> {
  return invoke<AppStateView>("paginate_query", { url });
}

export async function paginateSupplement(url: string): Promise<AppStateView> {
  return invoke<AppStateView>("paginate_supplement", { url });
}

export async function paginateResults(url: string): Promise<AppStateView> {
  return invoke<AppStateView>("paginate_results", { url });
}

export async function removeWishlist(courseId: string, classId: string): Promise<AppStateView> {
  return invoke<AppStateView>("remove_wishlist", {
    courseId,
    classId,
  });
}

export async function updateConfig(patch: ConfigPatch): Promise<AppStateView> {
  return invoke<AppStateView>("update_config", { patch });
}

export async function searchQueryCourses(filters: CourseQueryFilters): Promise<AppStateView> {
  return invoke<AppStateView>("search_query_courses", { filters });
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

export async function refreshSupplementPage(): Promise<AppStateView> {
  return invoke<AppStateView>("refresh_supplement_page");
}

export async function refreshSupplementCaptcha(): Promise<AppStateView> {
  return invoke<AppStateView>("refresh_supplement_captcha");
}

export async function addCourseToPlan(addUrl: string): Promise<AppStateView> {
  return invoke<AppStateView>("add_course_to_plan", { addUrl });
}

export async function removePlanCourse(deleteUrl: string): Promise<AppStateView> {
  return invoke<AppStateView>("remove_plan_course", { deleteUrl });
}

export async function preselectCourse(
  selectUrl: string,
  preference?: number | null,
): Promise<AppStateView> {
  return invoke<AppStateView>("preselect_course", {
    selectUrl,
    preference: preference ?? null,
  });
}

export async function cancelPreselectCourse(cancelUrl: string): Promise<AppStateView> {
  return invoke<AppStateView>("cancel_preselect_course", { cancelUrl });
}

export async function supplementSelectCourse(selectUrl: string, captchaCode: string): Promise<AppStateView> {
  return invoke<AppStateView>("supplement_select_course", { selectUrl, captchaCode });
}

export async function refreshSupplementLimit(selectUrl: string): Promise<AppStateView> {
  return invoke<AppStateView>("refresh_supplement_limit", { selectUrl });
}

export async function supplementCancelCourse(cancelUrl: string, captchaCode: string): Promise<AppStateView> {
  return invoke<AppStateView>("supplement_cancel_course", { cancelUrl, captchaCode });
}
