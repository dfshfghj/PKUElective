import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { AppProvider, useAppModel } from "./app-model";
import { AppSidebar } from "./AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { TooltipProvider } from "./components/ui/tooltip";
import { CoursesPage } from "./pages/CoursesPage";
import { CourseQueryPage } from "./pages/CourseQueryPage";
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
        <Toaster closeButton richColors position="top-right" theme={themeMode} />
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
        <Route element={<CoursesPage />} path="/preselect" />
        <Route element={<WishlistPage />} path="/plan" />
        <Route element={<SupplementPage />} path="/supplement" />
        <Route element={<ResultsPage />} path="/results" />
        <Route element={<CourseQueryPage />} path="/query" />
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

  if (loading) {
    return <LoadingScreen message={message} />;
  }

  if (!snapshot.auth.logged_in) {
    return <Navigate replace to="/login" />;
  }

  return (
    <SidebarProvider>
      <div className="flex w-full min-h-screen bg-transparent">
        <AppSidebar />
        <SidebarInset className="min-w-0">
          <div className="border-b border-stone-200/80 bg-white/70 px-4 py-3 backdrop-blur dark:border-stone-800 dark:bg-stone-950/70 md:hidden">
            <SidebarTrigger />
          </div>
          <main className="mx-auto min-w-0 flex min-h-screen w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">
            <div className="w-full space-y-6">
              <Outlet />
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
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
