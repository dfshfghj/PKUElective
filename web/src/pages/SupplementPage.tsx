import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { RefreshCw } from "lucide-react";

import { EmptyState, LineBreakText, PageHeader, PrimaryButton, SecondaryButton, Surface } from "../components";
import { useAppModel } from "../app-model";
import { DataTable, SortableHeader, tableCellMuted } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { CourseDetailLink } from "@/components/course-detail-link";
import type { SupplementAvailableCourse, SupplementSelectedCourse } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type AvailableRow = SupplementAvailableCourse & { key: string; remaining: number };
type SelectedRow = SupplementSelectedCourse & { key: string; remaining: number };

export function SupplementPage() {
  const {
    pending,
    snapshot,
    handleRefreshSupplement,
    handleRefreshSupplementCaptcha,
    handleRefreshSupplementLimit,
    handleSupplementCancelCourse,
    handleSupplementSelectCourse,
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
        meta: { label: "补选", mobileSlot: "footer" },
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <SecondaryButton
            disabled={pending !== null || !row.original.select_url}
            onClick={() =>
              row.original.select_url && void (
                row.original.action_label === "刷新"
                  ? handleRefreshSupplementLimit(row.original.select_url)
                  : handleSupplementSelectCourse(row.original.select_url, captchaCode)
              )
            }
          >
            {row.original.action_label || "补选"}
          </SecondaryButton>
        ),
        header: () => <span className="px-2">补选</span>,
      },
    ],
    [captchaCode, handleRefreshSupplementLimit, handleSupplementSelectCourse, pending],
  );
  const selectedColumns = useMemo<ColumnDef<SelectedRow>[]>(
    () => [
      ...baseColumns<SelectedRow>(),
      availabilityColumn<SelectedRow>(),
      {
        accessorKey: "status",
        meta: { label: "选课状态", mobileHidden: true },
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
        meta: { label: "退选", mobileSlot: "footer" },
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <SecondaryButton
            disabled={pending !== null || !row.original.cancel_url}
            onClick={() => {
              if (!row.original.cancel_url) return;
              const confirmed = window.confirm(`确认退选 ${row.original.name} ${row.original.class_id} 班？`);
              if (confirmed) {
                void handleSupplementCancelCourse(row.original.cancel_url, captchaCode);
              }
            }}
          >
            退选
          </SecondaryButton>
        ),
        header: () => <span className="px-2">退选</span>,
      },
    ],
    [captchaCode, handleSupplementCancelCourse, pending],
  );

  useEffect(() => {
    setCaptchaCode("");
  }, [snapshot.supplement_captcha_image_b64]);

  useEffect(() => {
    if (hasAutoLoadedRef.current || !snapshot.auth.logged_in || snapshot.elective_data_preloading || pending !== null) {
      return;
    }
    if (
      snapshot.supplement.notices.length > 0
      || snapshot.supplement.available_courses.length > 0
      || snapshot.supplement.selected_courses.length > 0
      || snapshot.supplement.selected_credits !== null
    ) {
      hasAutoLoadedRef.current = true;
      return;
    }
    hasAutoLoadedRef.current = true;
    void handleRefreshSupplement();
  }, [handleRefreshSupplement, pending, snapshot.auth.logged_in, snapshot.elective_data_preloading, snapshot.supplement]);

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        breadcrumb="补选退选"
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
      ) : null}

      <Surface title="选课计划中本学期可选列表">
        {availableRows.length === 0 ? (
          <EmptyState text="还没有补选课程数据，先刷新一次。" />
        ) : (
          <div>
            <div className="flex gap-4">
              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-wrap">
                  <Input
                    className="h-7 w-full px-3 text-sm outline-none sm:w-40"
                    disabled={pending !== null}
                    maxLength={5}
                    onChange={(event) => setCaptchaCode(event.target.value)}
                    placeholder="输入验证码"
                    type="text"
                    value={captchaCode}
                  />
                  <div className="flex gap-4">
                    <Button
                      disabled={pending !== null}
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        void handleRefreshSupplementCaptcha();
                        setCaptchaCode("");
                      }}
                    >
                      <RefreshCw className="size-4" />
                      <span>刷新</span>
                    </Button>
                  </div>
                </div>
              </div>
              <div>
                {snapshot.supplement_captcha_image_b64 ? (
                  <img
                    alt="补选退选验证码"
                    className="block object-contain"
                    src={`data:image/png;base64,${snapshot.supplement_captcha_image_b64}`}
                  />
                ) : (
                  <div className="flex items-center justify-center text-sm text-stone-500 dark:text-stone-400">
                    暂无验证码
                  </div>
                )}
                {snapshot.captcha_model_error ? (
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    模型不可用，仍可手动输入验证码：{snapshot.captcha_model_error}
                  </p>
                ) : snapshot.supplement_captcha_recognized ? (
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    OCR：<span className="font-semibold tracking-wider">{snapshot.supplement_captcha_recognized}</span>
                  </p>
                ) : snapshot.supplement_captcha_recognition_error ? (
                  <p className="text-sm text-stone-500 dark:text-stone-400"></p>
                ) : null}
              </div>
            </div>
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
            mobileCardTitle={(course) => course.name}
            mobileCardDescription={(course) =>
              [course.course_id, course.class_id, course.teacher].filter(Boolean).join(" · ")
            }
            mobileCardBadges={(course) => (
              <>
                <Badge variant="secondary">{course.category}</Badge>
                <Badge variant="outline">{course.credits} 学分</Badge>
                <Badge
                  className={
                    course.remaining > 0
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                      : "border-stone-200 bg-stone-100 text-stone-700 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
                  }
                  variant="outline"
                >
                  {course.volume_cnt} / {course.elected_cnt}
                </Badge>
              </>
            )}
          />
          </div>
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
            mobileCardTitle={(course) => course.name}
            mobileCardDescription={(course) =>
              [course.course_id, course.class_id, course.teacher].filter(Boolean).join(" · ")
            }
            mobileCardBadges={(course) => (
              <>
                <Badge variant="secondary">{course.category}</Badge>
                <Badge variant="outline">{course.credits} 学分</Badge>
                <Badge variant="outline">{course.status || "已选上"}</Badge>
                <Badge variant="outline">
                  {course.volume_cnt} / {course.elected_cnt}
                </Badge>
              </>
            )}
          />
        )}
      </Surface>
    </div>
  );
}

function baseColumns<T extends AvailableRow | SelectedRow>(): ColumnDef<T>[] {
  return [
    sortableTextColumn("course_id", "课程号", undefined, { mobileHidden: true }),
    sortableTextColumn("name", "课程名", (_value, row) => <CourseDetailLink detailUrl={row.detail_url} name={row.name} />, { mobileHidden: true }),
    sortableTextColumn("category", "课程类别", undefined, { mobileHidden: true }),
    sortableTextColumn("credits", "学分", undefined, { mobileHidden: true }),
    sortableTextColumn("weekly_hours", "周学时", undefined, { mobileHidden: true }),
    sortableTextColumn("teacher", "教师", undefined, { mobileHidden: true }),
    sortableTextColumn("class_id", "班号", undefined, { mobileHidden: true }),
    sortableTextColumn("department", "开课单位", (value) => tableCellMuted(value), { mobileHidden: true }),
    sortableTextColumn("grade", "年级", undefined, { mobileHidden: true }),
    {
      accessorKey: "schedule",
      meta: { label: "上课/考试信息" },
      cell: ({ row }) => <LineBreakText text={row.original.schedule} />,
      header: ({ column }) => (
        <SortableHeader
          label="上课/考试信息"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          sorted={column.getIsSorted()}
        />
      ),
    },
    sortableTextColumn("pnp_status", "自选P/NP", (value) => tableCellMuted(value), { mobileHidden: true }),
  ];
}

function sortableTextColumn<T extends AvailableRow | SelectedRow>(
  key: keyof T & string,
  label: string,
  render?: (value: string, row: T) => ReactNode,
  meta?: { mobileHidden?: boolean; mobileSlot?: "content" | "footer" },
): ColumnDef<T> {
  return {
    accessorKey: key,
    meta: { label, ...meta },
    cell: ({ row }) => render?.(String(row.original[key] ?? ""), row.original) ?? String(row.original[key] ?? ""),
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
    meta: { label: "限数/已选", mobileHidden: true },
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
