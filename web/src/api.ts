import { invoke } from "@tauri-apps/api/core";

import type { AuthStateView, ConfigPatch, CourseQueryFilters, SnapshotView } from "./types";

type Channel = "bzx" | "bfx" | "";

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

export async function refreshNow(): Promise<SnapshotView> {
  return invoke<SnapshotView>("refresh_now");
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
