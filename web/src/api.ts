import { invoke } from "@tauri-apps/api/core";

import type { AuthStateView, ConfigPatch, CourseDetail, CourseQueryFilters, SnapshotView } from "./types";

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

export async function getSnapshot(): Promise<SnapshotView> {
  return invoke<SnapshotView>("get_snapshot");
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

export async function logout(): Promise<SnapshotView> {
  return invoke<SnapshotView>("logout");
}

export async function addBot(): Promise<SnapshotView> {
  return invoke<SnapshotView>("add_bot");
}

export async function refreshBotCaptcha(botId: string): Promise<SnapshotView> {
  return invoke<SnapshotView>("refresh_bot_captcha", { botId });
}

export async function verifyBotCaptcha(botId: string, code: string): Promise<SnapshotView> {
  return invoke<SnapshotView>("verify_bot_captcha", { botId, code });
}

export async function refreshNow(): Promise<SnapshotView> {
  return invoke<SnapshotView>("refresh_now");
}

export async function refreshAutomationCourses(): Promise<SnapshotView> {
  return invoke<SnapshotView>("refresh_automation_courses");
}

export async function refreshPreselectCourses(): Promise<SnapshotView> {
  return invoke<SnapshotView>("refresh_preselect_courses");
}

export async function refreshPlanCourses(): Promise<SnapshotView> {
  return invoke<SnapshotView>("refresh_plan_courses");
}

export async function refreshResults(): Promise<SnapshotView> {
  return invoke<SnapshotView>("refresh_results");
}

export async function addWishlist(name: string, classId: string): Promise<SnapshotView> {
  return invoke<SnapshotView>("add_wishlist", {
    name,
    classId,
  });
}

export async function removeWishlist(name: string, classId: string): Promise<SnapshotView> {
  return invoke<SnapshotView>("remove_wishlist", {
    name,
    classId,
  });
}

export async function updateConfig(patch: ConfigPatch): Promise<SnapshotView> {
  return invoke<SnapshotView>("update_config", { patch });
}

export async function searchQueryCourses(filters: CourseQueryFilters): Promise<SnapshotView> {
  return invoke<SnapshotView>("search_query_courses", { filters });
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

export async function refreshSupplementPage(): Promise<SnapshotView> {
  return invoke<SnapshotView>("refresh_supplement_page");
}

export async function refreshSupplementCaptcha(): Promise<SnapshotView> {
  return invoke<SnapshotView>("refresh_supplement_captcha");
}

export async function verifySupplementCaptcha(code: string): Promise<SnapshotView> {
  return invoke<SnapshotView>("verify_supplement_captcha", { code });
}

export async function addCourseToPlan(addUrl: string): Promise<SnapshotView> {
  return invoke<SnapshotView>("add_course_to_plan", { addUrl });
}

export async function removePlanCourse(deleteUrl: string): Promise<SnapshotView> {
  return invoke<SnapshotView>("remove_plan_course", { deleteUrl });
}

export async function preselectCourse(
  selectUrl: string,
  preference?: number | null,
): Promise<SnapshotView> {
  return invoke<SnapshotView>("preselect_course", {
    selectUrl,
    preference: preference ?? null,
  });
}

export async function cancelPreselectCourse(cancelUrl: string): Promise<SnapshotView> {
  return invoke<SnapshotView>("cancel_preselect_course", { cancelUrl });
}

export async function supplementSelectCourse(selectUrl: string): Promise<SnapshotView> {
  return invoke<SnapshotView>("supplement_select_course", { selectUrl });
}

export async function supplementCancelCourse(cancelUrl: string): Promise<SnapshotView> {
  return invoke<SnapshotView>("supplement_cancel_course", { cancelUrl });
}
