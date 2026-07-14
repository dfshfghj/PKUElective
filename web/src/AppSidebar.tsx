import {
  Bot,
  CalendarRange,
  Gauge,
  LogOut,
  Repeat2,
  Search,
  Settings,
  SidebarClose,
  SidebarOpen,
  Sparkles,
  TableProperties,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import { useAppModel } from "./app-model";
import { Button } from "./components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "./components/ui/sidebar";
import { cn } from "./lib/utils";

const navigation = [
  { to: "/", label: "概览", icon: Gauge },
  { to: "/preselect", label: "预选", icon: Sparkles },
  { to: "/plan", label: "选课计划", icon: TableProperties },
  { to: "/supplement", label: "补选退选", icon: Repeat2 },
  { to: "/results", label: "选课结果", icon: CalendarRange },
  { to: "/query", label: "课程查询", icon: Search },
  { to: "/automation", label: "自动化", icon: Bot },
  { to: "/settings", label: "设置", icon: Settings },
];

export function AppSidebar() {
  const { snapshot, pending, handleLogout } = useAppModel();
  const { setOpenMobile, state, toggleSidebar, isMobile } = useSidebar();
  const location = useLocation();
  const username = snapshot.auth.username ?? "未命名用户";
  const userInitial = username.slice(0, 1).toUpperCase();

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-stone-200/70 bg-white/85 backdrop-blur-xl dark:border-stone-800 dark:bg-stone-950/85"
    >
      <SidebarHeader className="gap-3 p-3">
        <div className="flex items-center gap-2 p-2 transition-all duration-200 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-[1.25rem] group-data-[collapsible=icon]:p-2 dark:border-stone-800 dark:from-stone-950 dark:via-stone-900 dark:to-stone-900 dark:shadow-black/10">
          <div className="min-w-0 flex-1 transition-all duration-200 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-md font-semibold text-stone-950 dark:text-stone-100">
              选课网
            </p>
          </div>
          <Button
            aria-label={state === "collapsed" ? "展开侧栏" : "收起侧栏"}
            className="hidden shrink-0 rounded-xl text-stone-500 hover:text-stone-950 md:inline-flex dark:text-stone-400 dark:hover:text-stone-100"
            onClick={toggleSidebar}
            size="icon-sm"
            variant="ghost"
          >
            {state === "collapsed" ? (
              <SidebarOpen className="size-4" />
            ) : (
              <SidebarClose className="size-4" />
            )}
          </Button>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarMenu className="gap-1">
          {navigation.map((item) => (
            <SidebarMenuItem key={item.to}>
              <SidebarMenuButton
                asChild
                className={cn(
                  "h-11 rounded-xl px-3 text-stone-600 transition-all duration-200 hover:bg-orange-50 hover:text-stone-950 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:rounded-2xl dark:text-stone-300 dark:hover:bg-stone-900 dark:hover:text-stone-50",
                  "data-[active=true]:bg-stone-950 data-[active=true]:text-white data-[active=true]:shadow-lg data-[active=true]:shadow-stone-950/10 dark:data-[active=true]:bg-stone-100 dark:data-[active=true]:text-stone-950",
                )}
                isActive={
                  item.to === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.to)
                }
                tooltip={item.label}
              >
                <NavLink
                  end={item.to === "/"}
                  onClick={() => setOpenMobile(false)}
                  to={item.to}
                >
                  <item.icon className="size-4" />
                  <span>{item.label}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-3 pt-2">
        <div className="flex items-center gap-2 rounded-2xl border border-stone-200/80 bg-stone-50/80 p-2 transition-all duration-200 group-data-[collapsible=icon]:justify-center dark:border-stone-800 dark:bg-stone-900/70">
          <div className="min-w-0 flex-1 transition-all duration-200 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
              {username}
            </p>
          </div>
          <Button
            aria-label="退出登录"
            disabled={pending !== null}
            onClick={() => {
              if (isMobile) {
                setOpenMobile(false);
              }
              void handleLogout();
            }}
            size="icon-sm"
            variant="outline"
            className="shrink-0 rounded-xl border-stone-200 bg-white/90 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
