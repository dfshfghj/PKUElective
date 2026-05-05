import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useAppModel } from "../app-model";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Checkbox } from "../components/ui/checkbox";
import { Input } from "../components/ui/input";
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="absolute inset-0" />
      <div className="relative grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-[32px] border border-white/60 bg-stone-950 px-8 py-10 text-stone-50 shadow-[0_25px_100px_rgba(28,25,23,0.2)] dark:border-stone-800 dark:bg-stone-900">
        </section>

        <Card className="border-white/70 bg-white/92 dark:border-stone-800 dark:bg-stone-950/92">
          <CardHeader>
            <CardTitle>登录选课网</CardTitle>
          </CardHeader>
          <CardContent>
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
              <div className="grid gap-3 rounded-2xl border border-stone-200/70 p-4 dark:border-stone-800">
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
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    当前平台构建暂未接入安全凭据存储，因此不能保存密码。
                  </p>
                ) : null}
              </div>
              <Button className="w-full" disabled={pending !== null} size="lg" type="submit">
                {pending === "登录" ? "登录中…" : "进入控制台"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
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

function FeatureStat(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 dark:border-stone-800 dark:bg-white/3">
      <p className="text-xs uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">{props.label}</p>
      <p className="mt-2 text-xl font-semibold">{props.value}</p>
    </div>
  );
}
