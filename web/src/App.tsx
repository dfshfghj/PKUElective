import { createPortal } from "react-dom";
import { type ReactNode, useEffect, useState } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Toaster } from "sonner";

import { AppProvider, useAppModel } from "./app-model";
import { AppSidebar } from "./AppSidebar";
import { HIDE_AUTOMATION } from "./build-flags";
import { AppTitlebar } from "./components";
import { PullToRefreshIndicator, usePullToRefresh } from "./components/pull-to-refresh";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { ScrollArea } from "./components/ui/scroll-area";
import { TooltipProvider } from "./components/ui/tooltip";
import { useIsMobile } from "./hooks/use-mobile";
import { CoursesPage } from "./pages/CoursesPage";
import { CourseQueryPage } from "./pages/CourseQueryPage";
import { CourseDetailPage } from "./pages/CourseDetailPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ResultsPage } from "./pages/ResultsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AppSettingsPage } from "./pages/AppSettingsPage";
import { SupplementPage } from "./pages/SupplementPage";
import { WishlistPage } from "./pages/WishlistPage";
import { useThemeMode } from "./theme";
import { UpdateProvider } from "./update-context";

export function App() {
  const themeMode = useThemeMode();
  const isMobile = useIsMobile();

  return (
    <AppProvider>
      <UpdateProvider>
        <TooltipProvider>
          <AppRoutes />
          <Toaster
            closeButton
            richColors
            position={isMobile ? "top-center" : "bottom-right"}
            theme={themeMode}
          />
        </TooltipProvider>
      </UpdateProvider>
    </AppProvider>
  );
}

function AppRoutes() {
  const { snapshot } = useAppModel();

  return (
    <Routes>
      <Route element={<GuestRoute />} path="/login">
        <Route element={<LoginPage />} index />
      </Route>
      <Route element={<ProtectedLayout />}>
        <Route element={<DashboardPage />} path="/" />
        <Route element={<DetailParentRoute page={<CoursesPage />} />} path="/preselect">
          <Route element={<CourseDetailPage />} path="course-detail" />
        </Route>
        <Route element={<DetailParentRoute page={<WishlistPage />} />} path="/plan">
          <Route element={<CourseDetailPage />} path="course-detail" />
        </Route>
        <Route element={<SupplementPage />} path="/supplement" />
        <Route element={<ResultsPage />} path="/results" />
        <Route element={<DetailParentRoute page={<CourseQueryPage />} />} path="/query">
          <Route element={<CourseDetailPage />} path="course-detail" />
        </Route>
        <Route element={<Navigate replace to="/preselect" />} path="/course-detail" />
        {!HIDE_AUTOMATION && <Route element={<SettingsPage />} path="/automation" />}
        <Route element={<AppSettingsPage />} path="/settings" />
      </Route>
      <Route
        element={<Navigate replace to={snapshot.auth.logged_in ? "/" : "/login"} />}
        path="*"
      />
    </Routes>
  );
}

function GuestRoute() {
  const { snapshot, loading, message } = useAppModel();

  if (loading) {
    return <LoadingScreen message={message} />;
  }

  if (snapshot.auth.logged_in) {
    return <Navigate replace to="/" />;
  }

  return <Outlet />;
}

function ProtectedLayout() {
  const model = useAppModel();
  const { snapshot, loading, message } = model;
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const locationBreadcrumbs = breadcrumbsForLocation(pathname, searchParams);
  const mobileTitle = locationBreadcrumbs[locationBreadcrumbs.length - 1]?.label ?? "PKUElective";
  const isMobile = useIsMobile();
  const pullToRefresh = usePullToRefresh({
    enabled: isMobile && !loading,
    busy: model.pending !== null,
    onRefresh: () => refreshActionForPath(pathname, model)?.() ?? Promise.resolve(),
  });

  if (loading) {
    return <LoadingScreen message={message} />;
  }

  if (!snapshot.auth.logged_in) {
    return <Navigate replace to="/login" />;
  }

  return (
    <SidebarProvider className="h-dvh overflow-hidden">
      <div className="flex h-dvh w-full overflow-hidden bg-transparent">
        <AppSidebar />
        <SidebarInset className="min-w-0 overflow-hidden">
          <AppTitlebar breadcrumbs={locationBreadcrumbs} />
          <div className="mobile-app-bar flex items-center gap-2 border-b border-stone-200/80 bg-white/80 px-4 pb-2 backdrop-blur dark:border-stone-800 dark:bg-stone-950/80 md:hidden">
            {pathname.endsWith("/course-detail") ? (
              <Link
                aria-label="返回课程列表"
                className="inline-flex size-8 items-center justify-center rounded-md text-stone-600 transition hover:bg-stone-100 hover:text-stone-950 dark:text-stone-300 dark:hover:bg-stone-900 dark:hover:text-stone-50"
                to={pathname.slice(0, -"/course-detail".length)}
              >
                <ChevronLeft className="size-4" />
              </Link>
            ) : null}
            <h2 className="min-w-0 flex-1 truncate text-lg font-semibold leading-none text-stone-950 dark:text-stone-100">
              {mobileTitle}
            </h2>
            <SidebarTrigger />
          </div>
          <main
            className="relative min-h-0 min-w-0 flex w-full flex-1 overflow-hidden"
            id="app-main-content"
          >
            {isMobile && (
              <PullToRefreshIndicator
                pull={pullToRefresh.pull}
                refreshing={pullToRefresh.refreshing}
              />
            )}
            <ScrollArea
              className="h-full w-full"
              viewportClassName="overscroll-contain"
              viewportId="app-main-scroll-viewport"
            >
              <div className="app-content-safe min-h-full w-full space-y-4 px-4 md:space-y-6 md:px-8 md:pb-8">
                <Outlet />
              </div>
            </ScrollArea>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function refreshActionForPath(pathname: string, model: ReturnType<typeof useAppModel>) {
  const base = pathname.endsWith("/course-detail")
    ? pathname.slice(0, -"/course-detail".length)
    : pathname;

  switch (base) {
    case "/":
      return () => model.handleRefresh();
    case "/preselect":
      return () => model.handleRefreshPreselect();
    case "/plan":
      return () => model.handleRefreshPlan();
    case "/supplement":
      return () => model.handleRefreshSupplement();
    case "/results":
      return () => model.handleRefreshResults();
    case "/query":
      return () => model.handleSearchQuery(model.snapshot.query_filters);
    case "/automation":
      return () => model.handleRefreshAutomationCourses();
    default:
      return undefined;
  }
}

function breadcrumbsForLocation(pathname: string, searchParams: URLSearchParams) {
  if (pathname.endsWith("/course-detail")) {
    const parentPath = pathname.slice(0, -"/course-detail".length);
    const parentLabels: Record<string, string> = {
      "/preselect": "预选",
      "/plan": "选课计划",
      "/query": "课程查询",
    };
    return [
      { label: parentLabels[parentPath] ?? "课程列表", to: parentPath },
      { label: searchParams.get("name") || "课程详情" },
    ];
  }

  const labels: Record<string, string> = {
    "/": "概览",
    "/preselect": "预选",
    "/plan": "选课计划",
    "/supplement": "补选退选",
    "/results": "选课结果",
    "/query": "课程查询",
    "/automation": "自动化",
    "/settings": "设置",
  };

  return [{ label: labels[pathname] ?? "PKUElective" }];
}

function DetailParentRoute({ page }: { page: ReactNode }) {
  const { pathname } = useLocation();
  const showingDetail = pathname.endsWith("/course-detail");
  const [mainContent, setMainContent] = useState<HTMLElement | null>(() =>
    document.getElementById("app-main-content"),
  );

  useEffect(() => {
    if (!mainContent) setMainContent(document.getElementById("app-main-content"));
  }, [mainContent]);

  return (
    <>
      {page}
      {showingDetail && mainContent
        ? createPortal(
            <div className="detail-content-safe absolute inset-0 z-10 overflow-hidden bg-background px-4 backdrop-blur-sm md:px-8 md:pb-8">
              <Outlet />
            </div>,
            mainContent,
          )
        : null}
    </>
  );
}

function LoadingScreen(props: { message: string }) {
  const title = props.message.includes("自动登录") ? "正在自动登录" : "正在连接后端";

  return (
    <div className="full-screen-safe flex min-h-dvh items-center justify-center bg-transparent px-4">
      <div className="w-full max-w-sm rounded-[2rem] bg-white/88 p-8 backdrop-blur dark:bg-stone-950/88">
        <div className="flex items-center justify-center">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-stone-300 border-t-stone-700 dark:border-stone-700 dark:border-t-stone-300" />
          </div>
        </div>
        <div className="mt-5 space-y-2 text-center">
          <p className="text-base font-semibold text-stone-900 dark:text-stone-100">
            {title}
          </p>
          <p className="text-sm leading-6 text-stone-500 dark:text-stone-400">
            {props.message || "首次启动或网络较慢时会多等一会儿，页面会在状态恢复后自动进入。"}
          </p>
        </div>
      </div>
    </div>
  );
}
