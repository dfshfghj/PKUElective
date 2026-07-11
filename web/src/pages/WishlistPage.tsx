import { useEffect, useMemo, useRef } from "react";
import type { ColumnDef } from "@tanstack/react-table";

import {
  EmptyState,
  LineBreakText,
  PageHeader,
  SecondaryButton,
  Surface,
} from "../components";
import { useAppModel } from "../app-model";
import { DataTable, SortableHeader, tableCellMuted, tableCellWrap } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import type { PlanCourse } from "@/types";

export function WishlistPage() {
  const { snapshot, pending, handleRefreshPlan, handleRemovePlanCourse } = useAppModel();
  const planRows = snapshot.plan_courses;
  const hasTriggeredAutoRefresh = useRef(false);
  const columns = useMemo<ColumnDef<PlanCourse>[]>(
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
        meta: { label: "课程名称", mobileHidden: true },
        header: ({ column }) => (
          <SortableHeader
            label="课程名称"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        accessorKey: "class_id",
        meta: { label: "课程班号", mobileHidden: true },
        header: ({ column }) => (
          <SortableHeader
            label="课程班号"
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
        accessorKey: "total_hours",
        meta: { label: "总学时", mobileHidden: true },
        header: ({ column }) => (
          <SortableHeader
            label="总学时"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        accessorKey: "weekly_hours",
        meta: { label: "周学时" },
        header: ({ column }) => (
          <SortableHeader
            label="周学时"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        accessorKey: "grade",
        meta: { label: "年级" },
        cell: ({ row }) => tableCellMuted(row.original.grade),
        header: ({ column }) => (
          <SortableHeader
            label="年级"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        accessorKey: "schedule",
        meta: { label: "上课时间" },
        cell: ({ row }) => <div className={tableCellWrap("min-w-72")}><LineBreakText text={row.original.schedule} /></div>,
        header: ({ column }) => (
          <SortableHeader
            label="上课时间"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        accessorKey: "pnp_status",
        meta: { label: "自选P/NP" },
        cell: ({ row }) => tableCellMuted(row.original.pnp_status),
        header: ({ column }) => (
          <SortableHeader
            label="自选P/NP"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        accessorKey: "selection_mark",
        meta: { label: "选课标志" },
        cell: ({ row }) => tableCellMuted(row.original.selection_mark),
        header: ({ column }) => (
          <SortableHeader
            label="选课标志"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        id: "actions",
        meta: { label: "删除", mobileSlot: "footer" },
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <SecondaryButton
            disabled={pending !== null || !row.original.delete_url}
            onClick={() =>
              row.original.delete_url && void handleRemovePlanCourse(row.original.delete_url)
            }
          >
            点击删除
          </SecondaryButton>
        ),
        header: () => <span className="px-2">删除</span>,
      },
    ],
    [handleRemovePlanCourse, pending],
  );

  useEffect(() => {
    if (hasTriggeredAutoRefresh.current) {
      return;
    }
    if (!snapshot.auth.logged_in || pending !== null) {
      return;
    }

    hasTriggeredAutoRefresh.current = true;
    void handleRefreshPlan();
  }, [handleRefreshPlan, pending, snapshot.auth.logged_in]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Elective Plan"
        title="选课计划"
      />

      <Surface title="维护选课计划">
        <div className="grid gap-4 text-sm leading-6 text-stone-600 dark:text-stone-300">
          <div className="rounded-2xl bg-orange-50/80 p-4 text-orange-900 dark:bg-orange-950/30 dark:text-orange-100">
            课程加入选课计划后，并不表示已经完成选择；后续仍需要进入“预选”或补选流程继续操作。
          </div>
          <div className="rounded-2xl bg-stone-100/80 p-4 dark:bg-stone-900/80">
            添加课程请前往“课程查询”页；这里主要负责查看和删除当前选课计划中的课程。
          </div>
        </div>
      </Surface>

      <Surface title="选课计划列表">
        {planRows.length === 0 ? (
          <EmptyState text="选课计划还是空的，先去课程查询页加入几门课试试。" />
        ) : (
          <DataTable
            columns={columns}
            data={planRows}
            getRowId={(item) => `${item.course_id}-${item.class_id}`}
            initialVisibility={{
              weekly_hours: false,
              grade: false,
              pnp_status: false,
              selection_mark: false,
            }}
            mobileCardTitle={(course) => course.name}
            mobileCardDescription={(course) => `${course.course_id} · 班号 ${course.class_id}`}
            mobileCardBadges={(course) => (
              <>
                <Badge variant="secondary">{course.category}</Badge>
                <Badge variant="outline">{course.credits} 学分</Badge>
                <Badge variant="outline">{course.total_hours} 总学时</Badge>
              </>
            )}
          />
        )}
      </Surface>
    </div>
  );
}
