import { Gauge, LogOut, Search, Settings2, Sparkles, TableProperties } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useAppModel } from "./app-model";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent } from "./components/ui/card";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
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
  { to: "/query", label: "课程查询", icon: Search },
  { to: "/settings", label: "设置", icon: Settings2 },
];

export function AppSidebar() {
  const { snapshot, pending, handleLogout } = useAppModel();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar>
      <SidebarHeader>
        <h1 className="mt-2 text-2xl font-semibold">选课网</h1>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu>
          {navigation.map((item) => (
            <SidebarMenuItem key={item.to}>
              <div>
                <NavLink
                  className={({ isActive }) =>
                    cn(
                      "w-full flex items-center gap-3 rounded-lg px-3 py-2 my-1 text-sm font-medium transition",
                      isActive
                        ? "bg-stone-950 text-white dark:bg-stone-100 dark:text-stone-950"
                        : "text-stone-600 dark:text-stone-300 dark:hover:bg-stone-900 dark:hover:text-stone-50",
                    )
                  }
                  end={item.to === "/"}
                  onClick={() => setOpenMobile(false)}
                  to={item.to}
                >
                  <item.icon className="size-4" />
                  <span>{item.label}</span>
                </NavLink>
              </div>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <div className="flex items-center">
          <span className="text-sm flex-1">{snapshot.auth.username}</span>
          <Button
            disabled={pending !== null}
            onClick={() => void handleLogout()}
            variant="outline"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
