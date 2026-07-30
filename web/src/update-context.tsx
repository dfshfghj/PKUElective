import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { toast } from "sonner";

import { getAppInfo } from "./api";

type UpdatePhase = "idle" | "checking" | "available" | "downloading" | "up-to-date" | "disabled" | "error";

type UpdateState = {
  phase: UpdatePhase;
  currentVersion: string | null;
  availableVersion: string | null;
  notes: string | null;
  downloadedBytes: number;
  totalBytes: number | null;
  message: string | null;
};

type UpdateContextValue = UpdateState & {
  checkForUpdates: () => Promise<void>;
  installUpdate: () => Promise<void>;
};

const initialState: UpdateState = {
  phase: "idle",
  currentVersion: null,
  availableVersion: null,
  notes: null,
  downloadedBytes: 0,
  totalBytes: null,
  message: null,
};

const UpdateContext = createContext<UpdateContextValue | null>(null);

export function UpdateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const updateRef = useRef<Update | null>(null);
  const installRef = useRef<() => Promise<void>>(async () => undefined);

  const installUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;

    setState((current) => ({
      ...current,
      phase: "downloading",
      downloadedBytes: 0,
      totalBytes: null,
      message: "正在下载更新…",
    }));

    try {
      let downloadedBytes = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          setState((current) => ({
            ...current,
            totalBytes: event.data.contentLength ?? null,
          }));
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          setState((current) => ({ ...current, downloadedBytes }));
        } else {
          setState((current) => ({ ...current, message: "更新安装完成，正在重启…" }));
        }
      });
      await relaunch();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "更新下载或安装失败。";
      setState((current) => ({ ...current, phase: "error", message }));
      toast.error("自动更新失败", { description: message });
    }
  }, []);

  installRef.current = installUpdate;

  const checkForUpdates = useCallback(async () => {
    if (!isTauri()) {
      setState((current) => ({ ...current, phase: "disabled", message: "浏览器模式不支持自动更新。" }));
      return;
    }

    setState((current) => ({ ...current, phase: "checking", message: "正在检查更新…" }));
    try {
      const info = await getAppInfo();
      if (info.platform === "android" || info.platform === "ios") {
        setState((current) => ({
          ...current,
          phase: "disabled",
          currentVersion: info.version,
          message: "移动端不支持应用内自动更新。",
        }));
        return;
      }
      if (info.buildChannel !== "Release") {
        setState((current) => ({
          ...current,
          phase: "disabled",
          currentVersion: info.version,
          message: "Dev 构建不进入自动更新渠道。",
        }));
        return;
      }

      const update = await check({ timeout: 20_000 });
      if (!update) {
        setState((current) => ({
          ...current,
          phase: "up-to-date",
          currentVersion: info.version,
          availableVersion: null,
          message: "当前已是最新版本。",
        }));
        return;
      }

      if (updateRef.current) await updateRef.current.close();
      updateRef.current = update;
      setState({
        phase: "available",
        currentVersion: update.currentVersion,
        availableVersion: update.version,
        notes: update.body ?? null,
        downloadedBytes: 0,
        totalBytes: null,
        message: `发现新版本 v${update.version}`,
      });
      toast.info(`发现 HEED v${update.version}`, {
        action: { label: "安装更新", onClick: () => void installRef.current() },
        description: update.body || "新版本已经可以下载。",
        duration: 30_000,
      });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "检查更新失败。";
      setState((current) => ({ ...current, phase: "error", message }));
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void checkForUpdates(), 3_000);
    return () => {
      window.clearTimeout(timer);
      if (updateRef.current) void updateRef.current.close();
    };
  }, [checkForUpdates]);

  return (
    <UpdateContext.Provider value={{ ...state, checkForUpdates, installUpdate }}>
      {children}
    </UpdateContext.Provider>
  );
}

export function useUpdater() {
  const context = useContext(UpdateContext);
  if (!context) throw new Error("useUpdater must be used within UpdateProvider");
  return context;
}
