import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import { EmptyState, PageHeader, PrimaryButton, SecondaryButton, Surface } from "../components";
import { useAppModel } from "../app-model";
import { DataTable, SortableHeader, tableCellMuted, tableCellWrap } from "@/components/data-table";
import type { PreselectCourse } from "@/types";

export function CoursesPage() {
  const { pending, snapshot, handlePreselectCourse, handleRefreshPreselect } = useAppModel();
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
  const columns = useMemo<ColumnDef<PreselectCourse & { remaining: number; key: string }>[]>(
    () => [
      {
        accessorKey: "course_id",
        meta: { label: "课程号" },
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
        meta: { label: "课程名" },
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
        meta: { label: "课程类别" },
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
        meta: { label: "学分" },
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
        meta: { label: "教师" },
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
        meta: { label: "班号" },
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
        cell: ({ row }) => <div className={tableCellWrap("min-w-72")}>{tableCellMuted(row.original.schedule)}</div>,
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
        meta: { label: "预选" },
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => {
          const draftValue = preferenceDrafts[row.original.key] ?? row.original.preference_value;
          const parsedPreference =
            draftValue.trim() === "" ? null : Number.parseInt(draftValue, 10);

          return (
            <SecondaryButton
              disabled={pending !== null || (draftValue.trim() !== "" && Number.isNaN(parsedPreference))}
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

      <Surface title="预选提示">
        <div className="grid gap-3 text-sm leading-6 text-stone-600 dark:text-stone-300">
        </div>
      </Surface>

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
          />
        )}
      </Surface>
    </div>
  );
}
