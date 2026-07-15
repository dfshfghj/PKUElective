import { useCallback, useEffect, useState } from "react";
import { Copy, Download, ExternalLink, RefreshCw, Trash2 } from "lucide-react";

import { clearAppLog, exportAppLog, getAppInfo, type AppInfo } from "../api";
import { EmptyState, PageHeader, Surface } from "../components";
import { useAppModel } from "../app-model";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { ConfirmDialog } from "../components/confirm-dialog";
import { useUpdater } from "../update-context";

export function AppSettingsPage() {
  const { snapshot } = useAppModel();
  const updater = useUpdater();
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"export" | "clear" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const refreshInfo = useCallback(async () => {
    setError(null);
    try {
      setInfo(await getAppInfo());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "应用信息读取失败。");
    }
  }, []);

  useEffect(() => {
    void refreshInfo();
  }, [refreshInfo]);

  return (
    <div className="space-y-6">
      <PageHeader breadcrumb="设置" title="设置" description="查看应用信息并管理本地诊断日志。" />

      {error ? <EmptyState text={error} /> : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Surface title="关于 HEED">
          <dl className="divide-y divide-stone-100 text-sm dark:divide-stone-800">
            <InfoRow label="版本号" value={info ? `v${info.version} · ${info.buildChannel}` : "正在读取…"} />
            <InfoRow label="运行平台" value={info ? `${info.platform} · ${info.architecture}` : "正在读取…"} />
            <div className="flex items-center justify-between gap-6 py-4">
              <dt className="shrink-0 text-stone-500 dark:text-stone-400">项目地址</dt>
              <dd className="min-w-0 text-right">
                <a
                  className="inline-flex items-center gap-1 break-all font-medium text-orange-700 underline underline-offset-4 dark:text-orange-300"
                  href={info?.projectUrl ?? "https://github.com/dfshfghj/PKUElective"}
                  rel="noreferrer"
                  target="_blank"
                >
                  dfshfghj/PKUElective <ExternalLink className="size-3.5 shrink-0" />
                </a>
              </dd>
            </div>
          </dl>
        </Surface>

        <Surface title="运行状态">
          <dl className="divide-y divide-stone-100 text-sm dark:divide-stone-800">
            <InfoRow label="当前账号" value={snapshot.auth.username ?? "未登录"} />
            <InfoRow label="自动登录" value={snapshot.auth.auto_login ? "已启用" : "未启用"} />
            <div className="flex items-center justify-between gap-6 py-4">
              <dt className="text-stone-500 dark:text-stone-400">安全凭据存储</dt>
              <dd><Badge variant={snapshot.auth.secure_store_available ? "secondary" : "outline"}>{snapshot.auth.secure_store_available ? "可用" : "不可用"}</Badge></dd>
            </div>
            <InfoRow label="后台数据预加载" value={snapshot.elective_data_preloading ? "进行中" : "已空闲"} />
          </dl>
        </Surface>
      </div>

      <Surface title="应用更新" meta={updater.availableVersion ? `v${updater.availableVersion}` : undefined}>
        <div className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-stone-900 dark:text-stone-100">
                {updater.message ?? "Release 构建会在启动后自动检查更新。"}
              </p>
              {updater.notes ? <p className="mt-1 whitespace-pre-wrap text-sm text-stone-500 dark:text-stone-400">{updater.notes}</p> : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button disabled={updater.phase === "checking" || updater.phase === "downloading"} onClick={() => void updater.checkForUpdates()} variant="outline">
                <RefreshCw className={`size-4 ${updater.phase === "checking" ? "animate-spin" : ""}`} />
                检查更新
              </Button>
              {updater.phase === "available" ? (
                <Button onClick={() => void updater.installUpdate()}>
                  <Download className="size-4" /> 安装并重启
                </Button>
              ) : null}
            </div>
          </div>
          {updater.phase === "downloading" ? (
            <div className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800">
                <div
                  className="h-full rounded-full bg-orange-500 transition-[width]"
                  style={{ width: updater.totalBytes ? `${Math.min(100, updater.downloadedBytes / updater.totalBytes * 100)}%` : "12%" }}
                />
              </div>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                已下载 {formatBytes(updater.downloadedBytes)}{updater.totalBytes ? ` / ${formatBytes(updater.totalBytes)}` : ""}
              </p>
            </div>
          ) : null}
        </div>
      </Surface>

      <Surface title="诊断日志" meta={info ? formatBytes(info.logSizeBytes) : undefined}>
        <div className="space-y-5">
          <div className="rounded-xl bg-stone-100/80 p-4 dark:bg-stone-900/80">
            <p className="text-xs font-medium uppercase tracking-wider text-stone-500 dark:text-stone-400">保存位置</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all text-sm text-stone-700 dark:text-stone-300">{info?.logPath ?? "正在读取…"}</code>
              <Button aria-label="复制日志路径" disabled={!info} onClick={() => info && void navigator.clipboard.writeText(info.logPath)} size="icon-sm" variant="ghost">
                <Copy className="size-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button disabled={busy !== null || !info} onClick={() => void handleExport()}>
              <Download className="size-4" /> {busy === "export" ? "正在导出…" : "导出到下载目录"}
            </Button>
            <Button disabled={busy !== null || !info} onClick={() => setClearDialogOpen(true)} variant="destructive">
              <Trash2 className="size-4" /> {busy === "clear" ? "正在清除…" : "清除日志"}
            </Button>
            <Button disabled={busy !== null} onClick={() => void refreshInfo()} variant="outline">
              <RefreshCw className="size-4" /> 刷新信息
            </Button>
          </div>
          {message ? <p className="text-sm text-stone-600 dark:text-stone-300">{message}</p> : null}
        </div>
      </Surface>

      <ConfirmDialog
        confirmLabel="清除日志"
        description="当前应用日志会被永久清除，此操作无法撤销。后续产生的新日志仍会继续记录。"
        onConfirm={() => void handleClear()}
        onOpenChange={setClearDialogOpen}
        open={clearDialogOpen}
        pending={busy === "clear"}
        title="确认清除日志？"
      />
    </div>
  );

  async function handleExport() {
    setBusy("export");
    setMessage(null);
    try {
      const path = await exportAppLog();
      setMessage(`日志已导出到：${path}`);
      await refreshInfo();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "日志导出失败。");
    } finally {
      setBusy(null);
    }
  }

  async function handleClear() {
    setBusy("clear");
    setMessage(null);
    try {
      await clearAppLog();
      setMessage("日志已清除，后续运行日志仍会继续记录。");
      await refreshInfo();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "日志清除失败。");
    } finally {
      setBusy(null);
    }
  }
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <dt className="shrink-0 text-stone-500 dark:text-stone-400">{label}</dt>
      <dd className="min-w-0 break-all text-right font-medium text-stone-900 dark:text-stone-100">{value}</dd>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
