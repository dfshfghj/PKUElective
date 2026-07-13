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
  preselectCourse,
  refreshBotCaptcha,
  refreshSupplementPage,
  refreshSupplementCaptcha,
  refreshPlanCourses,
  refreshPreselectCourses,
  refreshResults,
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
  verifySupplementCaptcha,
} from "./api";
import { subscribeToAppEvents } from "./events";
import type { ConfigPatch, CourseQueryFilters, MessageEvent, SnapshotView } from "./types";

const emptySnapshot: SnapshotView = {
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
  elective_data_preloading: false,
  bots: [],
  courses: [],
  preselect_courses: [],
  preselected_courses: [],
  plan_courses: [],
  query_courses: [],
  supplement: {
    notices: [],
    available_courses: [],
    selected_courses: [],
    selected_credits: null,
  },
  supplement_captcha_image_b64: null,
  supplement_captcha_verified: false,
  results: {
    summary: null,
    notice: null,
    export_url: null,
    courses: [],
    timetable: null,
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
  name: string;
  classId: string;
};

type AppModel = {
  snapshot: SnapshotView;
  loading: boolean;
  pending: string | null;
  message: string;
  error: string | null;
  loginForm: LoginFormState;
  wishlistForm: WishlistFormState;
  courseRows: Array<
    SnapshotView["courses"][number] & { selectable: boolean; wanted: boolean; remaining: number }
  >;
  setLoginForm: (updater: (current: LoginFormState) => LoginFormState) => void;
  setWishlistForm: (updater: (current: WishlistFormState) => WishlistFormState) => void;
  syncSnapshot: (message?: string) => Promise<void>;
  runAction: (label: string, action: () => Promise<SnapshotView>) => Promise<void>;
  handleLogin: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleLogout: () => Promise<void>;
  handleAddBot: () => Promise<void>;
  handleRefreshAutomationCourses: () => Promise<void>;
  handleRefreshBotCaptcha: (botId: string) => Promise<void>;
  handleVerifyBotCaptcha: (botId: string, code: string) => Promise<void>;
  handleRefresh: () => Promise<void>;
  handleRefreshPreselect: () => Promise<void>;
  handleRefreshPlan: () => Promise<void>;
  handleRefreshResults: () => Promise<void>;
  handleRefreshSupplement: () => Promise<void>;
  handleRefreshSupplementCaptcha: () => Promise<void>;
  handleVerifySupplementCaptcha: (code: string) => Promise<void>;
  handleConfigToggle: (key: "auto_refresh" | "auto_captcha" | "notifications") => Promise<void>;
  handleConfigSave: (patch: ConfigPatch) => Promise<void>;
  handleConfigNumberSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleAddWishlist: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  handleAddWishlistDirect: (name: string, classId: string) => Promise<void>;
  handleRemoveWishlist: (name: string, classId: string) => Promise<void>;
  handleSearchQuery: (filters: CourseQueryFilters) => Promise<void>;
  handleAddCourseToPlan: (addUrl: string) => Promise<void>;
  handleRemovePlanCourse: (deleteUrl: string) => Promise<void>;
  handlePreselectCourse: (selectUrl: string, preference?: number | null) => Promise<void>;
  handleCancelPreselectCourse: (cancelUrl: string) => Promise<void>;
  handleSupplementSelectCourse: (selectUrl: string) => Promise<void>;
  handleSupplementCancelCourse: (cancelUrl: string) => Promise<void>;
};

const AppModelContext = createContext<AppModel | null>(null);

export function AppProvider(props: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<SnapshotView>(emptySnapshot);
  const [loginFormState, setLoginFormState] = useState<LoginFormState>({
    username: "",
    password: "",
    channel: "",
    rememberPassword: false,
    autoLogin: false,
  });
  const [wishlistFormState, setWishlistFormState] = useState<WishlistFormState>({
    name: "",
    classId: "",
  });
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [message, setMessage] = useState("正在连接后端…");
  const [error, setError] = useState<string | null>(null);
  const authRestorePollTimer = useRef<number | null>(null);

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
      onSnapshot(payload) {
        if (!disposed) setSnapshot(payload);
      },
      onAuth(payload) {
        if (!disposed) setSnapshot((current) => ({ ...current, auth: payload }));
      },
      onBots(payload) {
        if (!disposed) setSnapshot((current) => ({ ...current, bots: payload }));
      },
      onCourses(payload) {
        if (!disposed) setSnapshot((current) => ({ ...current, courses: payload }));
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

    let nextSnapshot: SnapshotView | null = null;
    try {
      nextSnapshot = await getSnapshot();
      setSnapshot(nextSnapshot);
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

  async function runAction(label: string, action: () => Promise<SnapshotView>) {
    setPending(label);
    setError(null);
    setMessage(`${label}中…`);
    try {
      const nextSnapshot = await action();
      setSnapshot(nextSnapshot);
    } catch (err) {
      const message = toErrorMessage(err);
      setError(message);
      setMessage(`${label}失败。`);
      toast.error(message);
    } finally {
      setPending(null);
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

        let nextSnapshot = await getSnapshot();
        setSnapshot(nextSnapshot);

        nextSnapshot = await refreshPreselectCourses();
        setSnapshot(nextSnapshot);
        nextSnapshot = await refreshPlanCourses();
        setSnapshot(nextSnapshot);
        nextSnapshot = await refreshResults();
        setSnapshot(nextSnapshot);
        setMessage("登录成功，课程数据已就绪。");
        toast.success("登录成功，已自动完成初始化");
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
    await runAction("刷新可抢课程", refreshAutomationCourses);
  }

  async function handleRefreshBotCaptcha(botId: string) {
    await runAction("刷新 Bot 验证码", () => refreshBotCaptcha(botId));
  }

  async function handleVerifyBotCaptcha(botId: string, code: string) {
    await runAction("验证 Bot 验证码", () => verifyBotCaptcha(botId, code));
  }

  async function handleRefresh() {
    await runAction("刷新课程", refreshNow);
  }

  async function handleRefreshPreselect() {
    await runAction("刷新预选列表", refreshPreselectCourses);
  }

  async function handleRefreshPlan() {
    await runAction("刷新选课计划", refreshPlanCourses);
  }

  async function handleRefreshResults() {
    await runAction("刷新选课结果", refreshResults);
  }

  async function handleRefreshSupplement() {
    await runAction("刷新补选退选", refreshSupplementPage);
  }

  async function handleRefreshSupplementCaptcha() {
    await runAction("刷新验证码", refreshSupplementCaptcha);
  }

  async function handleVerifySupplementCaptcha(code: string) {
    await runAction("验证验证码", () => verifySupplementCaptcha(code));
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
    if (!wishlistFormState.name.trim() || !wishlistFormState.classId.trim()) {
      const message = "请先填写课程名和班号。";
      setError(message);
      toast.error(message);
      return;
    }

    await handleAddWishlistDirect(wishlistFormState.name.trim(), wishlistFormState.classId.trim());
    setWishlistFormState({ name: "", classId: "" });
  }

  async function handleAddWishlistDirect(name: string, classId: string) {
    await runAction("加入待选列表", () => addWishlist(name, classId));
  }

  async function handleRemoveWishlist(name: string, classId: string) {
    await runAction("移出待选列表", () => removeWishlist(name, classId));
  }

  async function handleSearchQuery(filters: CourseQueryFilters) {
    await runAction("查询课程", () => searchQueryCourses(filters));
  }

  async function handleAddCourseToPlan(addUrl: string) {
    await runAction("加入选课计划", () => addCourseToPlan(addUrl));
  }

  async function handleRemovePlanCourse(deleteUrl: string) {
    await runAction("移出选课计划", () => removePlanCourse(deleteUrl));
  }

  async function handlePreselectCourse(selectUrl: string, preference?: number | null) {
    await runAction("提交预选", () => preselectCourse(selectUrl, preference));
  }

  async function handleCancelPreselectCourse(cancelUrl: string) {
    await runAction("取消预选", () => cancelPreselectCourse(cancelUrl));
  }

  async function handleSupplementSelectCourse(selectUrl: string) {
    await runAction("提交补选", () => supplementSelectCourse(selectUrl));
  }

  async function handleSupplementCancelCourse(cancelUrl: string) {
    await runAction("提交退选", () => supplementCancelCourse(cancelUrl));
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
          (item) => item.name === course.name && item.class_id === course.class_id,
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
    handleLogin,
    handleLogout,
    handleAddBot,
    handleRefreshAutomationCourses,
    handleRefreshBotCaptcha,
    handleVerifyBotCaptcha,
    handleRefresh,
    handleRefreshPreselect,
    handleRefreshPlan,
    handleRefreshResults,
    handleRefreshSupplement,
    handleRefreshSupplementCaptcha,
    handleVerifySupplementCaptcha,
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

function toErrorMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return "发生了未知错误。";
}
