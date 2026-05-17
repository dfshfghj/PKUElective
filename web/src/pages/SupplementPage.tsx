import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";

import { EmptyState, PageHeader, PrimaryButton, SecondaryButton, Surface } from "../components";
import { useAppModel } from "../app-model";
import { DataTable, SortableHeader, tableCellMuted, tableCellWrap } from "@/components/data-table";
import type { SupplementAvailableCourse, SupplementSelectedCourse } from "@/types";

type AvailableRow = SupplementAvailableCourse & { key: string; remaining: number };
type SelectedRow = SupplementSelectedCourse & { key: string; remaining: number };

export function SupplementPage() {
  const {
    pending,
    snapshot,
    handleRefreshSupplement,
    handleRefreshSupplementCaptcha,
    handleSupplementCancelCourse,
    handleSupplementSelectCourse,
    handleVerifySupplementCaptcha,
  } = useAppModel();
  const hasAutoLoadedRef = useRef(false);
  const [captchaCode, setCaptchaCode] = useState("");
  const availableRows = useMemo<AvailableRow[]>(
    () =>
      snapshot.supplement.available_courses.map((course, index) => ({
        ...course,
        key: `${course.course_id}-${course.class_id}-${index}`,
        remaining: Math.max(course.volume_cnt - course.elected_cnt, 0),
      })),
    [snapshot.supplement.available_courses],
  );
  const selectedRows = useMemo<SelectedRow[]>(
    () =>
      snapshot.supplement.selected_courses.map((course, index) => ({
        ...course,
        key: `${course.course_id}-${course.class_id}-${index}`,
        remaining: Math.max(course.volume_cnt - course.elected_cnt, 0),
      })),
    [snapshot.supplement.selected_courses],
  );
  const availableColumns = useMemo<ColumnDef<AvailableRow>[]>(
    () => [
      ...baseColumns<AvailableRow>(),
      availabilityColumn<AvailableRow>(),
      {
        id: "actions",
        meta: { label: "补选" },
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <SecondaryButton
            disabled={pending !== null || !row.original.select_url}
            onClick={() =>
              row.original.select_url && void handleSupplementSelectCourse(row.original.select_url)
            }
          >
            {row.original.action_label || "补选"}
          </SecondaryButton>
        ),
        header: () => <span className="px-2">补选</span>,
      },
    ],
    [handleSupplementSelectCourse, pending],
  );
  const selectedColumns = useMemo<ColumnDef<SelectedRow>[]>(
    () => [
      ...baseColumns<SelectedRow>(),
      availabilityColumn<SelectedRow>(),
      {
        accessorKey: "status",
        meta: { label: "选课状态" },
        cell: ({ row }) => tableCellMuted(row.original.status),
        header: ({ column }) => (
          <SortableHeader
            label="选课状态"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        id: "actions",
        meta: { label: "退选" },
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <SecondaryButton
            disabled={pending !== null || !row.original.cancel_url}
            onClick={() => {
              if (!row.original.cancel_url) return;
              const confirmed = window.confirm(`确认退选 ${row.original.name} ${row.original.class_id} 班？`);
              if (confirmed) {
                void handleSupplementCancelCourse(row.original.cancel_url);
              }
            }}
          >
            退选
          </SecondaryButton>
        ),
        header: () => <span className="px-2">退选</span>,
      },
    ],
    [handleSupplementCancelCourse, pending],
  );

  useEffect(() => {
    if (hasAutoLoadedRef.current || !snapshot.auth.logged_in || pending !== null) {
      return;
    }
    hasAutoLoadedRef.current = true;
    void handleRefreshSupplement();
  }, [handleRefreshSupplement, pending, snapshot.auth.logged_in]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Supplement"
        title="补选退选"
        actions={
          <>
            <div className="rounded-full bg-white/70 px-4 py-2 text-sm text-stone-600 shadow-sm dark:bg-stone-900 dark:text-stone-300">
              可补选 {availableRows.length} 门 · 已选上 {selectedRows.length} 门
            </div>
            <PrimaryButton
              disabled={pending !== null}
              onClick={() => void handleRefreshSupplement()}
            >
              <span className="inline-flex items-center gap-2">
                <RefreshCw className="size-4" />
                刷新
              </span>
            </PrimaryButton>
          </>
        }
      />

      {snapshot.supplement.notices.length > 0 ? (
        <Surface title="页面通知">
          <div className="grid gap-3 text-sm leading-6 text-stone-600 dark:text-stone-300">
            {snapshot.supplement.notices.slice(0, 3).map((notice, index) => (
              <div
                className="rounded-xl border border-orange-200/70 bg-orange-50/70 px-4 py-3 dark:border-stone-800 dark:bg-stone-900/80"
                key={`${notice}-${index}`}
              >
                {notice}
              </div>
            ))}
          </div>
        </Surface>
      ) : null}

      <Surface
        title="验证码"
        meta={snapshot.supplement_captcha_verified ? "已验证" : "补选/退选前需要先验证"}
      >
        <div className="grid gap-4 lg:grid-cols-[12rem_1fr]">
          <div className="overflow-hidden rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-950">
            {snapshot.supplement_captcha_image_b64 ? (
              <img
                alt="补选退选验证码"
                className="block h-24 w-full object-contain"
                src={`data:image/png;base64,${snapshot.supplement_captcha_image_b64}`}
              />
            ) : (
              <div className="flex h-24 items-center justify-center text-sm text-stone-500 dark:text-stone-400">
                暂无验证码
              </div>
            )}
          </div>
          <div className="space-y-3">
            <p className="text-sm text-stone-600 dark:text-stone-300">
              {snapshot.supplement_captcha_verified
                ? "当前验证码已通过，接下来可以继续补选或退选。"
                : "验证码不区分大小写，验证通过后再进行补选或退选。"}
            </p>
            <div className="flex flex-wrap gap-3">
              <input
                className="h-10 w-40 rounded-lg border border-stone-200 bg-white px-3 text-sm outline-none ring-0 transition focus:border-emerald-400 dark:border-stone-700 dark:bg-stone-950"
                disabled={pending !== null}
                maxLength={5}
                onChange={(event) => setCaptchaCode(event.target.value)}
                placeholder="输入验证码"
                type="text"
                value={captchaCode}
              />
              <PrimaryButton
                disabled={pending !== null || captchaCode.trim().length === 0}
                onClick={() => {
                  void handleVerifySupplementCaptcha(captchaCode.trim());
                  setCaptchaCode("");
                }}
              >
                验证
              </PrimaryButton>
              <SecondaryButton
                disabled={pending !== null}
                onClick={() => {
                  void handleRefreshSupplementCaptcha();
                  setCaptchaCode("");
                }}
              >
                刷新验证码
              </SecondaryButton>
            </div>
          </div>
        </div>
      </Surface>

      <Surface title="选课计划中本学期可选列表">
        {availableRows.length === 0 ? (
          <EmptyState text="还没有补选课程数据，先刷新一次。" />
        ) : (
          <DataTable
            columns={availableColumns}
            data={availableRows}
            getRowId={(course) => course.key}
            initialVisibility={{
              category: false,
              weekly_hours: false,
              department: false,
              grade: false,
              pnp_status: false,
            }}
          />
        )}
      </Surface>

      <Surface
        title="已选上列表"
        meta={snapshot.supplement.selected_credits ? `总学分 ${snapshot.supplement.selected_credits}` : undefined}
      >
        {selectedRows.length === 0 ? (
          <EmptyState text="当前没有已选上课程数据。" />
        ) : (
          <DataTable
            columns={selectedColumns}
            data={selectedRows}
            getRowId={(course) => course.key}
            initialVisibility={{
              category: false,
              weekly_hours: false,
              department: false,
              grade: false,
              pnp_status: false,
            }}
          />
        )}
      </Surface>
    </div>
  );
}

function baseColumns<T extends AvailableRow | SelectedRow>(): ColumnDef<T>[] {
  return [
    sortableTextColumn("course_id", "课程号"),
    sortableTextColumn("name", "课程名"),
    sortableTextColumn("category", "课程类别"),
    sortableTextColumn("credits", "学分"),
    sortableTextColumn("weekly_hours", "周学时"),
    sortableTextColumn("teacher", "教师"),
    sortableTextColumn("class_id", "班号"),
    sortableTextColumn("department", "开课单位", (value) => tableCellMuted(value)),
    sortableTextColumn("grade", "年级"),
    {
      accessorKey: "schedule",
      meta: { label: "上课/考试信息" },
      cell: ({ row }) => <div className={tableCellWrap("min-w-72")}>{tableCellMuted(row.original.schedule)}</div>,
      header: ({ column }) => (
        <SortableHeader
          label="上课/考试信息"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          sorted={column.getIsSorted()}
        />
      ),
    },
    sortableTextColumn("pnp_status", "自选P/NP", (value) => tableCellMuted(value)),
  ];
}

function sortableTextColumn<T extends AvailableRow | SelectedRow>(
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

function availabilityColumn<T extends AvailableRow | SelectedRow>(): ColumnDef<T> {
  return {
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
  };
}
