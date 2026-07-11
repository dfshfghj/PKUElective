import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Bot, Pause, Play, Plus, RefreshCw, Trash2 } from "lucide-react";

import { EmptyState, InputField, PageHeader, PrimaryButton, Surface, formatTimestamp } from "../components";
import { useAppModel } from "../app-model";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, SortableHeader, tableCellMuted } from "@/components/data-table";

type AutomationCourseRow = ReturnType<typeof useAppModel>["courseRows"][number];

export function SettingsPage() {
  const {
    courseRows,
    pending,
    snapshot,
    handleAddBot,
    handleAddWishlistDirect,
    handleConfigNumberSubmit,
    handleConfigToggle,
    handleRefreshBotCaptcha,
    handleRefreshAutomationCourses,
    handleRemoveWishlist,
    handleVerifyBotCaptcha,
  } = useAppModel();
  const [captchaInputs, setCaptchaInputs] = useState<Record<string, string>>({});

  const wantedCount = snapshot.wishlist.length;
  const selectableWantedCount = courseRows.filter((course) => course.wanted && course.selectable).length;
  const automationReady = snapshot.bots.some((bot) => bot.status === "idle");

  const columns = useMemo<ColumnDef<AutomationCourseRow>[]>(
    () => [
      sortableTextColumn("name", "课程名"),
      sortableTextColumn("class_id", "班号"),
      sortableTextColumn("teacher", "教师", (value) => tableCellMuted(value)),
      {
        id: "availability",
        accessorFn: (row) => row.remaining,
        meta: { label: "限数/已选" },
        cell: ({ row }) => (
          <div className="whitespace-nowrap">
            {row.original.volume_cnt} / {row.original.elected_cnt}
          </div>
        ),
        header: ({ column }) => (
          <SortableHeader
            label="限数/已选"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        id: "target",
        accessorFn: (row) => (row.wanted ? 1 : 0),
        meta: { label: "待抢" },
        cell: ({ row }) => (
          <Badge
            className={
              row.original.wanted
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                : "border-stone-200 bg-stone-50 text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
            }
          >
            {row.original.wanted ? "已加入" : "未加入"}
          </Badge>
        ),
        header: ({ column }) => (
          <SortableHeader
            label="待抢"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        id: "actions",
        meta: { label: "操作" },
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) =>
          row.original.wanted ? (
            <Button
              className="gap-2"
              disabled={pending !== null}
              onClick={() => void handleRemoveWishlist(row.original.name, row.original.class_id)}
              size="sm"
              type="button"
              variant="outline"
            >
              <Trash2 className="size-4" />
              移出
            </Button>
          ) : (
            <Button
              className="gap-2"
              disabled={pending !== null}
              onClick={() => void handleAddWishlistDirect(row.original.name, row.original.class_id)}
              size="sm"
              type="button"
            >
              <Plus className="size-4" />
              待抢
            </Button>
          ),
        header: () => <span className="px-2">操作</span>,
      },
    ],
    [handleAddWishlistDirect, handleRemoveWishlist, pending],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Automation"
        title="自动化"
        actions={
          <>
            <StatusPill
              label={snapshot.config.auto_refresh ? "自动刷新开启" : "自动刷新暂停"}
              tone={snapshot.config.auto_refresh ? "green" : "stone"}
            />
            <PrimaryButton
              disabled={pending !== null}
              onClick={() => void handleConfigToggle("auto_refresh")}
            >
              <span className="inline-flex items-center gap-2">
                {snapshot.config.auto_refresh ? (
                  <Pause className="size-4" />
                ) : (
                  <Play className="size-4" />
                )}
                {snapshot.config.auto_refresh ? "暂停" : "开始"}
              </span>
            </PrimaryButton>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Bot" value={`${snapshot.bots.length}`} detail={automationReady ? "有空闲 Bot" : "需要空闲 Bot"} />
        <Metric label="待抢" value={`${wantedCount}`} detail={`${selectableWantedCount} 门当前有余量`} />
        <Metric
          label="扫描结果"
          value={`${courseRows.length}`}
          detail={snapshot.automation_running ? "后台运行中" : "后台未运行"}
        />
        <Metric label="间隔" value={`${snapshot.config.interval_ms} ms`} detail="每轮刷新间隔" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Surface
          title="可抢课程"
          meta={courseRows.length > 0 ? `${courseRows.length} 门` : undefined}
        >
          <div className="mb-4 flex flex-wrap gap-3">
            <Button
              className="gap-2"
              disabled={pending !== null}
              onClick={() => void handleRefreshAutomationCourses()}
              type="button"
              variant="outline"
            >
              <RefreshCw className="size-4" />
              刷新扫描
            </Button>
            <Button
              className="gap-2"
              disabled={pending !== null}
              onClick={() => void handleAddBot()}
              type="button"
              variant="outline"
            >
              <Bot className="size-4" />
              添加 Bot
            </Button>
          </div>

          {courseRows.length === 0 ? (
            <EmptyState text="还没有可抢课程数据。先添加 Bot 或刷新一次扫描。" />
          ) : (
            <DataTable
              columns={columns}
              data={courseRows}
              getRowId={(course) => `${course.name}-${course.class_id}`}
            />
          )}
        </Surface>

        <div className="space-y-6">
          <Surface title="待抢列表" meta={`${snapshot.wishlist.length} 门`}>
            {snapshot.wishlist.length === 0 ? (
              <EmptyState text="从可抢课程里加入目标，自动化会只尝试这些课程。" />
            ) : (
              <div className="grid gap-3">
                {snapshot.wishlist.map((item) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-xl border border-stone-200/80 bg-white/70 px-3 py-3 dark:border-stone-800 dark:bg-stone-950/70"
                    key={`${item.name}-${item.class_id}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                        {item.name}
                      </p>
                      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                        {item.class_id} 班{item.busy ? " · 提交中" : ""}
                      </p>
                    </div>
                    <Button
                      aria-label="移出待抢列表"
                      disabled={pending !== null || item.busy}
                      onClick={() => void handleRemoveWishlist(item.name, item.class_id)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Surface>

          <Surface title="Bot 状态" meta={`${snapshot.bots.length} 个`}>
            {snapshot.bots.length === 0 ? (
              <EmptyState text="自动抢课需要至少一个 Bot。添加 Bot 会使用当前登录凭据建立独立会话。" />
            ) : (
              <div className="grid gap-3">
                {snapshot.bots.map((bot) => (
                  <div
                    key={bot.id}
                    className="rounded-xl border border-stone-200/80 bg-white/70 px-3 py-3 dark:border-stone-800 dark:bg-stone-950/70"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-sm text-stone-950 dark:text-stone-100">{bot.id}</strong>
                      <StatusPill label={bot.status} tone={bot.status === "idle" ? "green" : "stone"} />
                    </div>
                    <p className="mt-2 text-xs text-stone-500 dark:text-stone-400">
                      最近刷新：
                      {bot.last_loop_unix_ms ? formatTimestamp(bot.last_loop_unix_ms) : "暂无"}
                    </p>
                    {bot.last_error ? (
                      <p className="mt-2 text-xs leading-5 text-rose-600 dark:text-rose-300">
                        {bot.last_error}
                      </p>
                    ) : null}
                    {bot.status === "waiting_captcha" ? (
                      <div className="mt-3 space-y-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900 dark:bg-amber-950/40">
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          这个 Bot 还在等验证码，验证通过后才会参与自动化。
                        </p>
                        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-950">
                          {bot.captcha_image_b64 ? (
                            <img
                              alt={`${bot.id} 验证码`}
                              className="block h-24 w-full object-contain"
                              src={`data:image/png;base64,${bot.captcha_image_b64}`}
                            />
                          ) : (
                            <div className="flex h-24 items-center justify-center text-xs text-stone-500 dark:text-stone-400">
                              暂无验证码
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <input
                            className="h-9 w-32 rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-emerald-400 dark:border-stone-700 dark:bg-stone-950"
                            disabled={pending !== null}
                            maxLength={5}
                            onChange={(event) =>
                              setCaptchaInputs((current) => ({
                                ...current,
                                [bot.id]: event.target.value,
                              }))
                            }
                            placeholder="输入验证码"
                            type="text"
                            value={captchaInputs[bot.id] ?? ""}
                          />
                          <Button
                            disabled={pending !== null || !(captchaInputs[bot.id] ?? "").trim()}
                            onClick={() => {
                              const code = (captchaInputs[bot.id] ?? "").trim();
                              if (!code) return;
                              void handleVerifyBotCaptcha(bot.id, code);
                              setCaptchaInputs((current) => ({ ...current, [bot.id]: "" }));
                            }}
                            size="sm"
                            type="button"
                          >
                            验证
                          </Button>
                          <Button
                            disabled={pending !== null}
                            onClick={() => void handleRefreshBotCaptcha(bot.id)}
                            size="sm"
                            type="button"
                            variant="outline"
                          >
                            刷新验证码
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Surface>
        </div>
      </div>

      <Surface title="运行参数">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="grid gap-3 sm:grid-cols-2">
            <ToggleTile
              title="验证码"
              active={snapshot.config.auto_captcha}
              onClick={() => void handleConfigToggle("auto_captcha")}
            />
            <ToggleTile
              title="通知"
              active={snapshot.config.notifications}
              onClick={() => void handleConfigToggle("notifications")}
            />
          </div>

          <form className="grid content-center gap-4 sm:grid-cols-[1fr_1fr_auto]" onSubmit={handleConfigNumberSubmit}>
            <InputField
              label="刷新间隔 ms"
              name="interval_ms"
              type="number"
              defaultValue={snapshot.config.interval_ms}
            />
            <InputField
              label="超时 ms"
              name="timeout_ms"
              type="number"
              defaultValue={snapshot.config.timeout_ms}
            />
            <div className="mt-auto">
              <PrimaryButton disabled={pending !== null} type="submit">
                保存
              </PrimaryButton>
            </div>
          </form>
        </div>
      </Surface>
    </div>
  );
}

function Metric(props: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-stone-200/80 bg-white/75 p-4 dark:border-stone-800 dark:bg-stone-950/75">
      <p className="text-xs font-semibold uppercase text-stone-500 dark:text-stone-400">
        {props.label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-stone-950 dark:text-stone-100">
        {props.value}
      </p>
      <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">{props.detail}</p>
    </div>
  );
}

function ToggleTile(props: { title: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={[
        "rounded-xl border p-4 text-left transition hover:-translate-y-0.5",
        props.active
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
          : "border-stone-200 bg-stone-50 text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300",
      ].join(" ")}
      onClick={props.onClick}
      type="button"
    >
      <p className="text-sm font-medium">{props.title}</p>
      <p className="mt-2 text-xl font-semibold">{props.active ? "ON" : "OFF"}</p>
    </button>
  );
}

function StatusPill(props: { label: string; tone: "green" | "stone" }) {
  return (
    <span
      className={
        props.tone === "green"
          ? "inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
          : "inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300"
      }
    >
      {props.label}
    </span>
  );
}

function sortableTextColumn<T extends AutomationCourseRow>(
  key: keyof T & string,
  label: string,
  render?: (value: string) => ReactNode,
): ColumnDef<T> {
  return {
    accessorKey: key,
    meta: { label },
    cell: ({ row }) => render?.(String(row.original[key] ?? "")) ?? String(row.original[key] ?? ""),
    header: ({ column }) => (
      <SortableHeader
        label={label}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        sorted={column.getIsSorted()}
      />
    ),
  };
}
