import {
  FormEvent,
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";

import {
  addBot,
  addCourseToPlan,
  cancelPreselectCourse,
  addWishlist,
  getSnapshot,
  login,
  paginatePlan,
  paginatePreselect,
  paginateQuery,
  paginateResults,
  paginateSupplement,
  preselectCourse,
  refreshBotCaptcha,
  refreshSupplementPage,
  refreshSupplementCaptcha,
  refreshSupplementLimit,
  refreshPlanCourses,
  refreshPreselectCourses,
  refreshResults,
  refreshSchedule,
  refreshAutomationCourses,
  removePlanCourse,
  logout,
  refreshNow,
  removeWishlist,
  searchQueryCourses,
  supplementCancelCourse,
  supplementSelectCourse,
  updateConfig,
  verifyBotCaptcha,
} from "./api";
import { subscribeToAppEvents } from "./events";
import type { AppStateView, ConfigPatch, CourseQueryFilters, MessageEvent, PageDataState } from "./types";

type AppModelState = AppStateView & PageDataState;

export const emptyPagination = {
  current_page: 1,
  total_pages: 1,
  pages: [],
  previous_url: null,
  next_url: null,
  current_url: "",
};

const emptySnapshot: AppModelState = {
  auth: {
    logged_in: false,
    username: null,
    saved_username: null,
    saved_channel: null,
    remember_password: false,
    auto_login: false,
    auth_restoring: true,
    secure_store_available: true,
  },
  config: {
    auto_refresh: false,
    auto_captcha: false,
    notifications: false,
    interval_ms: 5000,
    timeout_ms: 30000,
  },
  automation_running: false,
  elective_schedule: [],
  bots: [],
  courses: [],
  preselect_courses: [],
  preselected_courses: [],
  preselect_pagination: { ...emptyPagination },
  plan_courses: [],
  plan_pagination: { ...emptyPagination },
  query_courses: [],
  query_pagination: { ...emptyPagination },
  query_filters: {
    course_setting_type: "speciality",
    course_id: null,
    course_name: null,
    dept_id: "ALL",
    course_day: null,
    course_time: null,
    query_date_flag: false,
  },
  supplement: {
    notices: [],
    available_courses: [],
    selected_courses: [],
    selected_credits: null,
    pagination: { ...emptyPagination },
  },
  supplement_captcha_image_b64: null,
  supplement_captcha_recognized: null,
  supplement_captcha_recognition_error: null,
  captcha_model_error: null,
  results: {
    summary: null,
    notice: null,
    export_url: null,
    courses: [],
    timetable: null,
    pagination: { ...emptyPagination },
  },
  wishlist: [],
};

type LoginFormState = {
  username: string;
  password: string;
  channel: "" | "bzx" | "bfx";
  rememberPassword: boolean;
  autoLogin: boolean;
};

type WishlistFormState = {
  courseId: string;
  name: string;
  classId: string;
  teacher: string;
};

type AppModel = {
  snapshot: AppModelState;
  loading: boolean;
  pending: string | null;
  message: string;
  error: string | null;
  loginForm: LoginFormState;
  wishlistForm: WishlistFormState;
  courseRows: Array<
    AppModelState["courses"][number] & { selectable: boolean; wanted: boolean; remaining: number }
  >;
  setLoginForm: (updater: (current: LoginFormState) => LoginFormState) => void;
  setWishlistForm: (updater: (current: WishlistFormState) => WishlistFormState) => void;
  syncSnapshot: (message?: string) => Promise<void>;
  runAction: (label: string, action: () => Promise<unknown>, options?: { silent?: boolean; update?: (current: AppModelState, result: unknown) => AppModelState }) => Promise<void>;
  loadPage: (key: string, label: string, clear: (snapshot: AppModelState) => AppModelState, action: () => Promise<unknown>) => Promise<void>;
  handleLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleLogout: () => Promise<void>;
  handleAddBot: () => Promise<void>;
  handleRefreshAutomationCourses: () => Promise<void>;
  handleRefreshSchedule: () => Promise<void>;
  handleRefreshBotCaptcha: (botId: string) => Promise<void>;
  handleVerifyBotCaptcha: (botId: string, code: string) => Promise<void>;
  handleRefresh: () => Promise<void>;
  handleRefreshPreselect: () => Promise<void>;
  handleRefreshPlan: () => Promise<void>;
  handleRefreshResults: () => Promise<void>;
  handleRefreshSupplement: () => Promise<void>;
  handleRefreshSupplementCaptcha: () => Promise<void>;
  handleRefreshSupplementLimit: (selectUrl: string) => Promise<void>;
  handlePaginatePreselect: (page: number) => Promise<void>;
  handlePaginatePlan: (page: number) => Promise<void>;
  handlePaginateQuery: (page: number) => Promise<void>;
  handlePaginateSupplement: (page: number) => Promise<void>;
  handlePaginateResults: (page: number) => Promise<void>;
  handleConfigToggle: (key: "auto_refresh" | "auto_captcha" | "notifications") => Promise<void>;
  handleConfigSave: (patch: ConfigPatch) => Promise<void>;
  handleConfigNumberSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleAddWishlist: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleAddWishlistDirect: (
    courseId: string,
    name: string,
    classId: string,
    teacher: string,
  ) => Promise<void>;
  handleRemoveWishlist: (courseId: string, classId: string) => Promise<void>;
  handleSearchQuery: (filters: CourseQueryFilters) => Promise<void>;
  handleAddCourseToPlan: (addUrl: string) => Promise<void>;
  handleRemovePlanCourse: (deleteUrl: string) => Promise<void>;
  handlePreselectCourse: (selectUrl: string, preference?: number | null) => Promise<void>;
  handleCancelPreselectCourse: (cancelUrl: string) => Promise<void>;
  handleSupplementSelectCourse: (selectUrl: string, captchaCode: string) => Promise<void>;
  handleSupplementCancelCourse: (cancelUrl: string, captchaCode: string) => Promise<void>;
};

const AppModelContext = createContext<AppModel | null>(null);

export function AppProvider(props: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AppModelState>(emptySnapshot);
  const [loginFormState, setLoginFormState] = useState<LoginFormState>({
    username: "",
    password: "",
    channel: "",
    rememberPassword: false,
    autoLogin: false,
  });
  const [wishlistFormState, setWishlistFormState] = useState<WishlistFormState>({
    courseId: "",
    name: "",
    classId: "",
    teacher: "",
  });
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("正在连接后端…");
  const [error, setError] = useState<string | null>(null);
  const authRestorePollTimer = useRef<number | null>(null);
  const pageRequestIds = useRef(new Map<string, number>());

  useEffect(() => {
    void syncSnapshot("正在加载当前状态…");
  }, []);

  useEffect(() => {
    setLoginFormState((current) => ({
      ...current,
      username: snapshot.auth.logged_in
        ? current.username
        : (snapshot.auth.saved_username ?? current.username),
      channel: snapshot.auth.logged_in
        ? current.channel
        : ((snapshot.auth.saved_channel ?? current.channel) as "" | "bzx" | "bfx"),
      rememberPassword: snapshot.auth.remember_password,
      autoLogin: snapshot.auth.auto_login,
    }));
  }, [
    snapshot.auth.auto_login,
    snapshot.auth.logged_in,
    snapshot.auth.remember_password,
    snapshot.auth.saved_channel,
    snapshot.auth.saved_username,
  ]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void subscribeToAppEvents({
      onAppState(payload) {
        if (!disposed) setSnapshot((current) => ({ ...current, ...payload }));
      },
      onAuth(payload) {
        if (!disposed) setSnapshot((current) => ({ ...current, auth: payload }));
      },
      onBots(payload) {
        if (!disposed) setSnapshot((current) => ({ ...current, bots: payload }));
      },
      onWishlist(payload) {
        if (!disposed) setSnapshot((current) => ({ ...current, wishlist: payload }));
      },
      onConfig(payload) {
        if (!disposed) setSnapshot((current) => ({ ...current, config: payload }));
      },
      onMessage(payload) {
        if (!disposed) applyMessage(payload);
      },
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      unlisten = cleanup;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!snapshot.auth.auth_restoring) {
      if (authRestorePollTimer.current !== null) {
        window.clearTimeout(authRestorePollTimer.current);
        authRestorePollTimer.current = null;
      }
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage(snapshot.auth.auto_login ? "正在自动登录…" : "正在恢复登录状态…");

    authRestorePollTimer.current = window.setTimeout(() => {
      authRestorePollTimer.current = null;
      void syncSnapshot(snapshot.auth.auto_login ? "正在自动登录…" : "正在恢复登录状态…");
    }, 900);

    return () => {
      if (authRestorePollTimer.current !== null) {
        window.clearTimeout(authRestorePollTimer.current);
        authRestorePollTimer.current = null;
      }
    };
  }, [snapshot.auth.auth_restoring, snapshot.auth.auto_login]);

  async function syncSnapshot(nextMessage?: string) {
    setError(null);
    if (nextMessage) {
      setMessage(nextMessage);
    }

    let nextSnapshot: AppStateView | null = null;
    try {
      nextSnapshot = await getSnapshot();
      setSnapshot((current) => ({ ...current, ...nextSnapshot }));
      if (nextSnapshot.auth.auth_restoring) {
        setMessage(nextSnapshot.auth.auto_login ? "正在自动登录…" : "正在恢复登录状态…");
      } else {
        setMessage("后端已连接，状态已同步。");
      }
    } catch (err) {
      const message = toErrorMessage(err);
      setError(message);
      setMessage("还没拿到后端状态。");
      toast.error(message);
    } finally {
      if (!nextSnapshot?.auth.auth_restoring) {
        setLoading(false);
      }
    }
  }

  async function runAction(label: string, action: () => Promise<unknown>, options?: { silent?: boolean; update?: (current: AppModelState, result: unknown) => AppModelState }) {
    const silent = options?.silent ?? false;
    if (!silent) {
      setPending(label);
      setMessage(`${label}中…`);
    }
    setError(null);
    try {
      const result = await action();
      if (options?.update) setSnapshot((current) => options.update!(current, result));
    } catch (err) {
      const message = toErrorMessage(err);
      setError(message);
      if (!silent) {
        setMessage(`${label}失败。`);
      }
      toast.error(message);
    } finally {
      if (!silent) {
        setPending(null);
      }
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("登录");
    setError(null);
    setMessage("正在验证账号…");

    try {
      await login(loginFormState);
      try {
        setMessage("登录成功，正在同步会话…");

        const nextSnapshot = await getSnapshot();
        setSnapshot((current) => ({ ...current, ...nextSnapshot }));
        setMessage("登录成功，进入页面后将加载对应数据。");
        toast.success("登录成功");
      } catch (err) {
        const message = toErrorMessage(err);
        setError(message);
        setMessage("登录成功，但自动初始化失败。");
        toast.error(message);
      }
    } catch (err) {
      const message = toErrorMessage(err);
      setError(message);
      setMessage("登录失败。");
      toast.error(message);
    } finally {
      setPending(null);
    }
  }

  async function handleLogout() {
    await runAction("退出登录", logout);
  }

  async function handleAddBot() {
    await runAction("添加 Bot", addBot);
  }

  async function handleRefreshAutomationCourses() {
    await runAction("刷新可抢课程", refreshAutomationCourses, { update: (current, result) => ({ ...current, courses: result as AppModelState["courses"] }) });
  }

  async function loadPage(
    key: string,
    label: string,
    clear: (current: AppModelState) => AppModelState,
    action: () => Promise<unknown>,
  ) {
    const requestId = (pageRequestIds.current.get(key) ?? 0) + 1;
    pageRequestIds.current.set(key, requestId);
    setSnapshot((current) => clear(current));
    setPending(label);
    setError(null);
    setMessage(`${label}中…`);
    try {
      const nextSnapshot = await action();
      if (pageRequestIds.current.get(key) === requestId) {
        setSnapshot((current) => applyPageResult(key, current, nextSnapshot));
      }
    } catch (err) {
      if (pageRequestIds.current.get(key) !== requestId) return;
      const message = toErrorMessage(err);
      setError(message);
      setMessage(`${label}失败。`);
      toast.error(message);
    } finally {
      if (pageRequestIds.current.get(key) === requestId) setPending(null);
    }
  }

  async function handleRefreshSchedule() {
    await runAction("刷新选课时间表", refreshSchedule, { update: (current, result) => ({ ...current, elective_schedule: result as AppModelState["elective_schedule"] }) });
  }

  async function handleRefreshBotCaptcha(botId: string) {
    await runAction("刷新 Bot 验证码", () => refreshBotCaptcha(botId), { silent: true });
  }

  async function handleVerifyBotCaptcha(botId: string, code: string) {
    await runAction("验证 Bot 验证码", () => verifyBotCaptcha(botId, code));
  }

  async function handleRefresh() {
    await runAction("刷新课程", refreshNow);
  }

  async function handleRefreshPreselect() {
    await runAction("刷新预选列表", refreshPreselectCourses, { update: (current, result) => applyPageResult("preselect", current, result) });
  }

  async function handleRefreshPlan() {
    await runAction("刷新选课计划", refreshPlanCourses, { update: (current, result) => ({ ...current, plan_courses: (result as { courses: AppModelState["plan_courses"]; pagination: AppModelState["plan_pagination"] }).courses, plan_pagination: (result as { courses: AppModelState["plan_courses"]; pagination: AppModelState["plan_pagination"] }).pagination }) });
  }

  async function handleRefreshResults() {
    await runAction("刷新选课结果", refreshResults, { update: (current, result) => ({ ...current, results: result as AppModelState["results"] }) });
  }

  async function handleRefreshSupplement() {
    await runAction("刷新补选退选", refreshSupplementPage, { update: (current, result) => ({ ...current, supplement: result as AppModelState["supplement"] }) });
  }

  async function handleRefreshSupplementCaptcha() {
    await runAction("刷新验证码", refreshSupplementCaptcha, { silent: true });
  }

  async function handleConfigToggle(key: "auto_refresh" | "auto_captcha" | "notifications") {
    await runAction("更新配置", () =>
      updateConfig({
        [key]: !snapshot.config[key],
      }),
    );
  }

  async function handleConfigSave(patch: ConfigPatch) {
    await runAction("保存配置", () => updateConfig(patch));
  }

  async function handleConfigNumberSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await handleConfigSave({
      interval_ms: Number(formData.get("interval_ms")),
      timeout_ms: Number(formData.get("timeout_ms")),
    });
  }

  async function handleAddWishlist(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !wishlistFormState.courseId.trim() ||
      !wishlistFormState.name.trim() ||
      !wishlistFormState.classId.trim() ||
      !wishlistFormState.teacher.trim()
    ) {
      const message = "请先填写课程号、课程名、班号和教师。";
      setError(message);
      toast.error(message);
      return;
    }

    await handleAddWishlistDirect(
      wishlistFormState.courseId.trim(),
      wishlistFormState.name.trim(),
      wishlistFormState.classId.trim(),
      wishlistFormState.teacher.trim(),
    );
    setWishlistFormState({ courseId: "", name: "", classId: "", teacher: "" });
  }

  async function handlePaginatePreselect(page: number) {
    await runAction("切换预选页码", () => paginatePreselect(page), { update: (current, result) => applyPageResult("preselect", current, result) });
  }

  async function handlePaginatePlan(page: number) {
    await runAction("切换选课计划页码", () => paginatePlan(page), { update: (current, result) => ({ ...current, plan_courses: (result as { courses: AppModelState["plan_courses"]; pagination: AppModelState["plan_pagination"] }).courses, plan_pagination: (result as { courses: AppModelState["plan_courses"]; pagination: AppModelState["plan_pagination"] }).pagination }) });
  }

  async function handlePaginateQuery(page: number) {
    await runAction("切换课程查询页码", () => paginateQuery(page), { update: (current, result) => ({ ...current, query_courses: (result as { courses: AppModelState["query_courses"]; pagination: AppModelState["query_pagination"] }).courses, query_pagination: (result as { courses: AppModelState["query_courses"]; pagination: AppModelState["query_pagination"] }).pagination }) });
  }

  async function handlePaginateSupplement(page: number) {
    await runAction("切换补选退选页码", () => paginateSupplement(page), { update: (current, result) => ({ ...current, supplement: result as AppModelState["supplement"] }) });
  }

  async function handlePaginateResults(page: number) {
    await runAction("切换选课结果页码", () => paginateResults(page), { update: (current, result) => ({ ...current, results: result as AppModelState["results"] }) });
  }

  async function handleRefreshSupplementLimit(selectUrl: string) {
    await runAction("刷新课程名额", () => refreshSupplementLimit(selectUrl), { silent: true, update: (current, result) => {
      const data = result as { limit: number; elected: number };
      return { ...current, supplement: { ...current.supplement, available_courses: current.supplement.available_courses.map((course) => course.select_url === selectUrl ? { ...course, volume_cnt: data.limit, elected_cnt: data.elected } : course) } };
    } });
  }

  async function handleAddWishlistDirect(
    courseId: string,
    name: string,
    classId: string,
    teacher: string,
  ) {
    await runAction("加入待选列表", () => addWishlist(courseId, name, classId, teacher), { update: (current, result) => ({ ...current, wishlist: result as AppModelState["wishlist"] }) });
  }

  async function handleRemoveWishlist(courseId: string, classId: string) {
    await runAction("移出待选列表", () => removeWishlist(courseId, classId), { update: (current, result) => ({ ...current, wishlist: result as AppModelState["wishlist"] }) });
  }

  async function handleSearchQuery(filters: CourseQueryFilters) {
    setSnapshot((current) => ({
      ...current,
      query_filters: filters,
      query_courses: [],
      query_pagination: { ...emptyPagination },
    }));
    await runAction("查询课程", () => searchQueryCourses(filters), { update: (current, result) => ({ ...current, query_filters: filters, query_courses: (result as { courses: AppModelState["query_courses"]; pagination: AppModelState["query_pagination"] }).courses, query_pagination: (result as { courses: AppModelState["query_courses"]; pagination: AppModelState["query_pagination"] }).pagination }) });
  }

  async function handleAddCourseToPlan(addUrl: string) {
    await runAction("加入选课计划", () => addCourseToPlan(addUrl), { update: (current, result) => applyPageResult("plan-action", current, result) });
  }

  async function handleRemovePlanCourse(deleteUrl: string) {
    await runAction("移出选课计划", () => removePlanCourse(deleteUrl), { update: (current, result) => applyPageResult("plan-mutation", current, result) });
  }

  async function handlePreselectCourse(selectUrl: string, preference?: number | null) {
    await runAction("提交预选", () => preselectCourse(selectUrl, preference), { update: (current, result) => applyPageResult("preselect", current, result) });
  }

  async function handleCancelPreselectCourse(cancelUrl: string) {
    await runAction("取消预选", () => cancelPreselectCourse(cancelUrl), { update: (current, result) => applyPageResult("preselect", current, result) });
  }

  async function handleSupplementSelectCourse(selectUrl: string, captchaCode: string) {
    await runAction("提交补选", () => supplementSelectCourse(selectUrl, captchaCode), { update: (current, result) => ({ ...current, supplement: result as AppModelState["supplement"] }) });
  }

  async function handleSupplementCancelCourse(cancelUrl: string, captchaCode: string) {
    await runAction("提交退选", () => supplementCancelCourse(cancelUrl, captchaCode), { update: (current, result) => ({ ...current, supplement: result as AppModelState["supplement"] }) });
  }

  function applyMessage(payload: MessageEvent) {
    setMessage(payload.text);
    if (payload.kind === "success" || payload.kind === "info") {
      setError(null);
    }
    if (payload.kind === "error") {
      setError(payload.text);
    }

    if (payload.kind === "success") {
      toast.success(payload.text);
      return;
    }

    if (payload.kind === "error") {
      toast.error(payload.text);
      return;
    }

    toast.message(payload.text);
  }

  const courseRows = useMemo(
    () =>
      snapshot.courses.map((course) => {
        const selectable = course.elected_cnt < course.volume_cnt;
        const wanted = snapshot.wishlist.some(
          (item) =>
            item.course_id === course.course_id && item.class_id === course.class_id,
        );
        return {
          ...course,
          selectable,
          wanted,
          remaining: Math.max(course.volume_cnt - course.elected_cnt, 0),
        };
      }),
    [snapshot.courses, snapshot.wishlist],
  );

  const value: AppModel = {
    snapshot,
    loading,
    pending,
    message,
    error,
    loginForm: loginFormState,
    wishlistForm: wishlistFormState,
    courseRows,
    setLoginForm(updater) {
      setLoginFormState((current) => updater(current));
    },
    setWishlistForm(updater) {
      setWishlistFormState((current) => updater(current));
    },
    syncSnapshot,
    runAction,
    loadPage,
    handleLogin,
    handleLogout,
    handleAddBot,
    handleRefreshAutomationCourses,
    handleRefreshSchedule,
    handleRefreshBotCaptcha,
    handleVerifyBotCaptcha,
    handleRefresh,
    handleRefreshPreselect,
    handleRefreshPlan,
    handleRefreshResults,
    handleRefreshSupplement,
    handleRefreshSupplementCaptcha,
    handleRefreshSupplementLimit,
    handlePaginatePreselect,
    handlePaginatePlan,
    handlePaginateQuery,
    handlePaginateSupplement,
    handlePaginateResults,
    handleConfigToggle,
    handleConfigSave,
    handleConfigNumberSubmit,
    handleAddWishlist,
    handleAddWishlistDirect,
    handleRemoveWishlist,
    handleSearchQuery,
    handleAddCourseToPlan,
    handleRemovePlanCourse,
    handlePreselectCourse,
    handleCancelPreselectCourse,
    handleSupplementSelectCourse,
    handleSupplementCancelCourse,
  };

  return <AppModelContext.Provider value={value}>{props.children}</AppModelContext.Provider>;
}

export function useAppModel() {
  const context = useContext(AppModelContext);
  if (!context) {
    throw new Error("useAppModel must be used within AppProvider");
  }
  return context;
}

function applyPageResult(key: string, current: AppModelState, next: unknown): AppModelState {
  switch (key) {
    case "dashboard":
      return { ...current, elective_schedule: next as AppModelState["elective_schedule"] };
    case "preselect":
    case "preselect-action":
      return {
        ...current,
        preselect_courses: (next as { courses: AppModelState["preselect_courses"] }).courses,
        preselected_courses: (next as { selected_courses: AppModelState["preselected_courses"] }).selected_courses,
        preselect_pagination: (next as { pagination: AppModelState["preselect_pagination"] }).pagination,
      };
    case "plan-action": {
      const data = next as { plan: { courses: AppModelState["plan_courses"]; pagination: AppModelState["plan_pagination"] }; query: { courses: AppModelState["query_courses"]; pagination: AppModelState["query_pagination"] }; preselect: { courses: AppModelState["preselect_courses"]; selected_courses: AppModelState["preselected_courses"]; pagination: AppModelState["preselect_pagination"] } };
      return { ...current, plan_courses: data.plan.courses, plan_pagination: data.plan.pagination, query_courses: data.query.courses, query_pagination: data.query.pagination, preselect_courses: data.preselect.courses, preselected_courses: data.preselect.selected_courses, preselect_pagination: data.preselect.pagination };
    }
    case "plan-mutation": {
      const data = next as { plan: { courses: AppModelState["plan_courses"]; pagination: AppModelState["plan_pagination"] }; preselect: { courses: AppModelState["preselect_courses"]; selected_courses: AppModelState["preselected_courses"]; pagination: AppModelState["preselect_pagination"] } };
      return { ...current, plan_courses: data.plan.courses, plan_pagination: data.plan.pagination, preselect_courses: data.preselect.courses, preselected_courses: data.preselect.selected_courses, preselect_pagination: data.preselect.pagination };
    }
    case "plan":
      return { ...current, plan_courses: (next as { courses: AppModelState["plan_courses"] }).courses, plan_pagination: (next as { pagination: AppModelState["plan_pagination"] }).pagination };
    case "supplement":
      return { ...current, supplement: next as AppModelState["supplement"] };
    case "results":
      return { ...current, results: next as AppModelState["results"] };
    case "automation":
      return { ...current, courses: next as AppModelState["courses"] };
    case "query":
      return { ...current, query_courses: (next as { courses: AppModelState["query_courses"] }).courses, query_pagination: (next as { pagination: AppModelState["query_pagination"] }).pagination };
    default:
      return current;
  }
}

function toErrorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "发生了未知错误。";
}
