import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useSearchParams } from "react-router-dom";
import { Toaster } from "sonner";

import { AppProvider, useAppModel } from "./app-model";
import { AppSidebar } from "./AppSidebar";
import { AppTitlebar } from "./components";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { ScrollArea } from "./components/ui/scroll-area";
import { TooltipProvider } from "./components/ui/tooltip";
import { CoursesPage } from "./pages/CoursesPage";
import { CourseQueryPage } from "./pages/CourseQueryPage";
import { CourseDetailPage } from "./pages/CourseDetailPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ResultsPage } from "./pages/ResultsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SupplementPage } from "./pages/SupplementPage";
import { WishlistPage } from "./pages/WishlistPage";
import { useThemeMode } from "./theme";

export function App() {
  const themeMode = useThemeMode();

  return (
    <AppProvider>
      <TooltipProvider>
        <AppRoutes />
        <Toaster closeButton richColors position="bottom-right" theme={themeMode} />
      </TooltipProvider>
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
        <Route element={<PreselectRoute />} path="/preselect">
          <Route element={<CourseDetailPage />} path="course-detail" />
        </Route>
        <Route element={<WishlistPage />} path="/plan" />
        <Route element={<SupplementPage />} path="/supplement" />
        <Route element={<ResultsPage />} path="/results" />
        <Route element={<CourseQueryPage />} path="/query" />
        <Route element={<Navigate replace to="/preselect" />} path="/course-detail" />
        <Route element={<SettingsPage />} path="/automation" />
        <Route element={<Navigate replace to="/automation" />} path="/settings" />
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
  const { snapshot, loading, message } = useAppModel();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

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
          <AppTitlebar breadcrumbs={breadcrumbsForLocation(pathname, searchParams)} />
          <div className="border-b border-stone-200/80 bg-white/70 px-4 py-3 backdrop-blur dark:border-stone-800 dark:bg-stone-950/70 md:hidden">
            <SidebarTrigger />
          </div>
          <main
            className="relative min-h-0 min-w-0 flex w-full flex-1 overflow-hidden"
            id="app-main-content"
          >
            <ScrollArea
              className="h-full w-full"
              viewportClassName="overscroll-contain"
              viewportId="app-main-scroll-viewport"
            >
              <div className="min-h-full w-full space-y-6 px-4 pb-8 md:px-8">
              <Outlet />
              </div>
            </ScrollArea>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function breadcrumbsForLocation(pathname: string, searchParams: URLSearchParams) {
  if (pathname === "/preselect/course-detail") {
    return [
      { label: "预选", to: "/preselect" },
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
  };

  return [{ label: labels[pathname] ?? "HEED" }];
}

function PreselectRoute() {
  const { pathname } = useLocation();
  const showingDetail = pathname === "/preselect/course-detail";
  const [mainContent, setMainContent] = useState<HTMLElement | null>(() =>
    document.getElementById("app-main-content"),
  );

  useEffect(() => {
    if (!mainContent) setMainContent(document.getElementById("app-main-content"));
  }, [mainContent]);

  return (
    <>
      <CoursesPage />
      {showingDetail && mainContent
        ? createPortal(
            <div className="absolute inset-0 z-10 overflow-auto overscroll-contain bg-stone-50/95 px-4 pb-8 backdrop-blur-sm dark:bg-stone-950/95 md:px-8">
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
    <div className="flex min-h-screen items-center justify-center bg-transparent px-4">
      <div className="w-full max-w-sm rounded-[2rem] border border-orange-200/70 bg-white/88 p-8 shadow-xl shadow-orange-100/60 backdrop-blur dark:border-stone-800 dark:bg-stone-950/88 dark:shadow-black/20">
        <div className="flex items-center justify-center">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div className="absolute h-16 w-16 rounded-full border border-orange-200 dark:border-stone-700" />
            <div className="absolute h-16 w-16 animate-ping rounded-full bg-orange-200/40 dark:bg-stone-700/40" />
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-stone-300 border-t-orange-500 dark:border-stone-700 dark:border-t-orange-400" />
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
