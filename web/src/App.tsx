import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { AppProvider, useAppModel } from "./app-model";
import { AppSidebar } from "./AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import { CoursesPage } from "./pages/CoursesPage";
import { CourseQueryPage } from "./pages/CourseQueryPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { SettingsPage } from "./pages/SettingsPage";
import { WishlistPage } from "./pages/WishlistPage";
import { useThemeMode } from "./theme";

export function App() {
  const themeMode = useThemeMode();

  return (
    <AppProvider>
      <AppRoutes />
      <Toaster closeButton richColors position="top-right" theme={themeMode} />
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
        <Route element={<CourseQueryPage />} path="/query" />
        <Route element={<SettingsPage />} path="/settings" />
      </Route>
      <Route
        element={<Navigate replace to={snapshot.auth.logged_in ? "/" : "/login"} />}
        path="*"
      />
    </Routes>
  );
}

function GuestRoute() {
  const { snapshot, loading } = useAppModel();

  if (loading) {
    return <LoadingScreen />;
  }

  if (snapshot.auth.logged_in) {
    return <Navigate replace to="/" />;
  }

  return <Outlet />;
}

function ProtectedLayout() {
  const { snapshot, loading } = useAppModel();

  if (loading) {
    return <LoadingScreen />;
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

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent px-4">
      <div className="rounded-2xl border border-stone-200 bg-white px-5 py-4 text-sm text-stone-500 shadow-sm dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
        正在连接后端…
      </div>
    </div>
  );
}
