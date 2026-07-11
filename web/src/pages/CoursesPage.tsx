import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { EmptyState, LineBreakText, PageHeader, PrimaryButton, SecondaryButton, Surface } from "../components";
import { useAppModel } from "../app-model";
import { DataTable, SortableHeader, tableCellMuted } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import type { PreselectCourse, PreselectedCourse } from "@/types";

export function CoursesPage() {
  const { pending, snapshot, handleCancelPreselectCourse, handlePreselectCourse, handleRefreshPreselect } = useAppModel();
  const [preferenceDrafts, setPreferenceDrafts] = useState<Record<string, string>>({});
  const hasAutoLoadedRef = useRef(false);
  const rows = useMemo(
    () =>
      snapshot.preselect_courses.map((course) => ({
        ...course,
        remaining: Math.max(course.volume_cnt - course.elected_cnt, 0),
        key: `${course.course_id}-${course.class_id}`,
      })),
    [snapshot.preselect_courses],
  );
  const selectedRows = useMemo(
    () => snapshot.preselected_courses.map((course, index) => ({ ...course, key: `${course.course_id}-${course.class_id}-${index}` })),
    [snapshot.preselected_courses],
  );
  const columns = useMemo<ColumnDef<PreselectCourse & { remaining: number; key: string }>[]>(
    () => [
      {
        accessorKey: "course_id",
        meta: { label: "课程号", mobileHidden: true },
        header: ({ column }) => (
          <SortableHeader
            label="课程号"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        accessorKey: "name",
        meta: { label: "课程名", mobileHidden: true },
        header: ({ column }) => (
          <SortableHeader
            label="课程名"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        accessorKey: "category",
        meta: { label: "课程类别", mobileHidden: true },
        header: ({ column }) => (
          <SortableHeader
            label="课程类别"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        accessorKey: "credits",
        meta: { label: "学分", mobileHidden: true },
        header: ({ column }) => (
          <SortableHeader
            label="学分"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        accessorKey: "teacher",
        meta: { label: "教师", mobileHidden: true },
        header: ({ column }) => (
          <SortableHeader
            label="教师"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        accessorKey: "class_id",
        meta: { label: "班号", mobileHidden: true },
        header: ({ column }) => (
          <SortableHeader
            label="班号"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        accessorKey: "department",
        meta: { label: "开课单位" },
        cell: ({ row }) => tableCellMuted(row.original.department),
        header: ({ column }) => (
          <SortableHeader
            label="开课单位"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
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
      {
        id: "availability",
        accessorFn: (row) => row.remaining,
        meta: { label: "限数/已选" },
        cell: ({ row }) => (
          <div className="space-y-1">
            <div>
              {row.original.volume_cnt} / {row.original.elected_cnt}
            </div>
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
        id: "preference_value",
        accessorFn: (row) => preferenceDrafts[row.key] ?? row.preference_value,
        meta: { label: "意愿值" },
        enableHiding: false,
        cell: ({ row }) => {
          const draftValue = preferenceDrafts[row.original.key] ?? row.original.preference_value;

          if (draftValue === "推荐") {
            return <Badge variant="secondary">推荐</Badge>;
          }

          return (
            <input
              className="h-10 w-20 rounded-md border border-stone-200 bg-white px-3 text-center text-sm text-stone-950 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-orange-500/20 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100"
              inputMode="numeric"
              onChange={(event) =>
                setPreferenceDrafts((current) => ({
                  ...current,
                  [row.original.key]: event.target.value,
                }))
              }
              value={draftValue}
            />
          );
        },
        header: ({ column }) => (
          <SortableHeader
            label="意愿值"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        id: "actions",
        meta: { label: "预选", mobileSlot: "footer" },
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          const draftValue = preferenceDrafts[row.original.key] ?? row.original.preference_value;
          const isRecommended = draftValue === "推荐";
          const parsedPreference =
            isRecommended || draftValue.trim() === "" ? null : Number.parseInt(draftValue, 10);

          return (
            <SecondaryButton
              disabled={pending !== null || (!isRecommended && draftValue.trim() !== "" && Number.isNaN(parsedPreference))}
              onClick={() => void handlePreselectCourse(row.original.select_url, parsedPreference)}
            >
              预选
            </SecondaryButton>
          );
        },
        header: () => <span className="px-2">预选</span>,
      },
    ],
    [handlePreselectCourse, pending, preferenceDrafts],
  );

  const selectedColumns = useMemo<ColumnDef<PreselectedCourse & { key: string }>[]>(
    () => [
      { accessorKey: "course_id", meta: { label: "课程号", mobileHidden: true }, header: () => "课程号" },
      { accessorKey: "name", meta: { label: "课程名" }, header: () => "课程名" },
      { accessorKey: "teacher", meta: { label: "教师", mobileHidden: true }, header: () => "教师" },
      { accessorKey: "class_id", meta: { label: "班号", mobileHidden: true }, header: () => "班号" },
      { accessorKey: "schedule", meta: { label: "上课/考试信息" }, cell: ({ row }) => <LineBreakText text={row.original.schedule} />, header: () => "上课/考试信息" },
      {
        id: "actions", meta: { label: "取消", mobileSlot: "footer" }, enableHiding: false, enableSorting: false,
        cell: ({ row }) => <SecondaryButton disabled={pending !== null} onClick={() => {
          if (window.confirm(`确认取消预选 ${row.original.name} ${row.original.class_id} 班？`)) void handleCancelPreselectCourse(row.original.cancel_url);
        }}>取消预选</SecondaryButton>,
        header: () => <span className="px-2">取消</span>,
      },
    ],
    [handleCancelPreselectCourse, pending],
  );

  useEffect(() => {
    if (hasAutoLoadedRef.current || !snapshot.auth.logged_in || pending !== null) {
      return;
    }
    hasAutoLoadedRef.current = true;
    void handleRefreshPreselect();
  }, [handleRefreshPreselect, pending, snapshot.auth.logged_in]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Elective Work"
        title="预选"
        actions={
          <>
            <div className="rounded-full bg-white/70 px-4 py-2 text-sm text-stone-600 shadow-sm dark:bg-stone-900 dark:text-stone-300">
              {rows.length} 门课程
            </div>
          </>
        }
      />

      <Surface title="选课计划中本学期可选列表">
        {rows.length === 0 ? (
          <EmptyState text="还没有预选课程数据，先刷新一次。" />
        ) : (
          <DataTable
            columns={columns}
            data={rows}
            getRowId={(course) => course.key}
            initialVisibility={{
              department: false,
            }}
            mobileCardTitle={(course) => course.name}
            mobileCardDescription={(course) =>
              `${course.course_id} · 班号 ${course.class_id} · ${course.teacher || "教师待定"}`
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
                  剩余 {course.remaining}
                </Badge>
              </>
            )}
          />
        )}
      </Surface>

      <Surface title="已选列表" meta={selectedRows.length ? `${selectedRows.length} 门课程` : undefined}>
        {selectedRows.length === 0 ? (
          <EmptyState text="当前没有预选课程。" />
        ) : (
          <DataTable
            columns={selectedColumns}
            data={selectedRows}
            getRowId={(course) => course.key}
            initialVisibility={{ teacher: false, class_id: false }}
            mobileCardTitle={(course) => course.name}
            mobileCardDescription={(course) => `${course.course_id} · 班号 ${course.class_id} · ${course.teacher || "教师待定"}`}
            mobileCardBadges={(course) => <><Badge variant="secondary">{course.category}</Badge><Badge variant="outline">{course.credits} 学分</Badge></>}
          />
        )}
      </Surface>
    </div>
  );
}
