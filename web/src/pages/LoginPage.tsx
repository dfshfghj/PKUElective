import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAppModel } from "../app-model";
import pkuViewImage from "../assets/pku_view.jpg";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
import { WindowControls } from "../components/window-controls";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const DEFAULT_CHANNEL_VALUE = "__default__";

export function LoginPage() {
  const { snapshot, loginForm, pending, setLoginForm, handleLogin } = useAppModel();

  if (snapshot.auth.logged_in) {
    return <Navigate replace to="/" />;
  }

  return (
    <div className="full-screen-safe relative flex min-h-dvh items-center justify-center overflow-hidden bg-stone-100 px-4 py-10 dark:bg-stone-950">
      <div data-tauri-drag-region className="absolute inset-0" />
      <div
        className="absolute inset-x-0 top-0 z-20 hidden h-12 items-center justify-end md:flex"
        data-tauri-drag-region
      >
        <WindowControls className="m-0 flex h-full" />
      </div>
      <Card className="relative grid w-full max-w-6xl border-white/70 bg-white/92 p-0 shadow-[0_30px_120px_rgba(28,25,23,0.14)] backdrop-blur dark:border-white/10 dark:bg-stone-950/92 lg:grid-cols-[1fr_1.05fr]">
        <div className="flex flex-col justify-center px-5 py-7 sm:px-8 sm:py-10 lg:px-10">
          <CardHeader className="px-0">
            <CardTitle className="text-2xl font-semibold tracking-tight">登录选课网</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <form className="space-y-4" onSubmit={handleLogin}>
              <Field label="学号">
                <Input
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, username: event.target.value }))
                  }
                  value={loginForm.username}
                />
              </Field>
              <Field label="密码">
                <Input
                  onChange={(event) =>
                    setLoginForm((current) => ({ ...current, password: event.target.value }))
                  }
                  type="password"
                  value={loginForm.password}
                />
              </Field>
              <Field label="身份渠道">
                <Select
                  onValueChange={(value) =>
                    setLoginForm((current) => ({
                      ...current,
                      channel: (value === DEFAULT_CHANNEL_VALUE ? "" : value) as "" | "bzx" | "bfx",
                    }))
                  }
                  value={loginForm.channel || DEFAULT_CHANNEL_VALUE}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="默认" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={DEFAULT_CHANNEL_VALUE}>默认</SelectItem>
                    <SelectItem value="bzx">主修 bzx</SelectItem>
                    <SelectItem value="bfx">辅双 bfx</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <label className="flex items-center gap-3 text-sm text-stone-700 dark:text-stone-300">
                  <Checkbox
                    checked={loginForm.rememberPassword}
                    disabled={!snapshot.auth.secure_store_available}
                    onCheckedChange={(checked) =>
                      setLoginForm((current) => ({
                        ...current,
                        rememberPassword: checked === true,
                        autoLogin: checked === true ? current.autoLogin : false,
                      }))
                    }
                  />
                  <span>记住密码</span>
                </label>
                <label className="flex items-center gap-3 text-sm text-stone-700 dark:text-stone-300">
                  <Checkbox
                    checked={loginForm.autoLogin}
                    disabled={!snapshot.auth.secure_store_available}
                    onCheckedChange={(checked) =>
                      setLoginForm((current) => ({
                        ...current,
                        rememberPassword: checked === true ? true : current.rememberPassword,
                        autoLogin: checked === true,
                      }))
                    }
                  />
                  <span>启动时自动登录</span>
                </label>
                {!snapshot.auth.secure_store_available ? (
                  <p className="text-xs leading-5 text-stone-500 dark:text-stone-400">
                    当前平台构建暂未接入安全凭据存储，因此不能保存密码。
                  </p>
                ) : null}
              </div>
              <Button className="w-full" disabled={pending !== null} size="lg" type="submit">
                {pending === "登录" ? "登录中…" : "进入控制台"}
              </Button>
            </form>
          </CardContent>
        </div>

        <div className="relative hidden min-h-full overflow-hidden border-l border-stone-200/80 bg-stone-950 lg:block dark:border-white/10">
          <img
            alt="北京大学校园景观"
            className="h-full w-full object-cover object-center transition-[filter,transform] duration-500 dark:invert dark:hue-rotate-180 dark:contrast-110 dark:brightness-90"
            src={pkuViewImage}
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-stone-950/25 via-transparent to-white/12 dark:from-stone-950/50 dark:to-stone-50/8" />
        </div>
      </Card>
    </div>
  );
}

function Field(props: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-500 dark:text-stone-400">
        {props.label}
      </span>
      {props.children}
    </label>
  );
}
