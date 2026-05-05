import { useEffect, useRef } from "react";

import {
  EmptyState,
  PageHeader,
  SecondaryButton,
  Surface,
} from "../components";
import { useAppModel } from "../app-model";

export function WishlistPage() {
  const { snapshot, pending, handleRefreshPlan, handleRemovePlanCourse } = useAppModel();
  const planRows = snapshot.plan_courses;
  const hasTriggeredAutoRefresh = useRef(false);

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

      <Surface title="维护选课计划" meta="真实后端数据">
        <div className="grid gap-4 text-sm leading-6 text-stone-600 dark:text-stone-300">
          <div className="rounded-2xl bg-orange-50/80 p-4 text-orange-900 dark:bg-orange-950/30 dark:text-orange-100">
            课程加入选课计划后，并不表示已经完成选择；后续仍需要进入“预选”或补选流程继续操作。
          </div>
          <div className="rounded-2xl bg-stone-100/80 p-4 dark:bg-stone-900/80">
            添加课程请前往“课程查询”页；这里主要负责查看和删除当前选课计划中的课程。
          </div>
        </div>
      </Surface>

      <Surface title="选课计划列表" meta={`${planRows.length} 项`}>
        {planRows.length === 0 ? (
          <EmptyState text="选课计划还是空的，先去课程查询页加入几门课试试。" />
        ) : (
          <div className="overflow-hidden rounded-3xl border border-stone-900/8 dark:border-stone-800">
            <div className="overflow-auto">
              <table className="truncate min-w-full divide-y divide-stone-900/6 bg-white/80 text-left text-sm dark:divide-stone-800 dark:bg-stone-950/80">
                <thead className="bg-stone-100/90 text-stone-700 dark:bg-stone-900 dark:text-stone-300">
                  <tr>
                    {["课程号", "课程名称", "课程班号", "课程类别", "学分", "总学时", "上课时间", "自选P/NP", "选课标志", "删除"].map((label) => (
                      <th key={label} className="px-4 py-4 font-semibold">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-900/6 text-stone-800 dark:divide-stone-800 dark:text-stone-200">
                  {planRows.map((item) => (
                    <tr key={`${item.course_id}-${item.class_id}`} className="hover:bg-orange-50/60 dark:hover:bg-stone-900">
                      <td className="px-4 py-4">{item.course_id}</td>
                      <td className="px-4 py-4">{item.name}</td>
                      <td className="px-4 py-4">{item.class_id}</td>
                      <td className="px-4 py-4">{item.category}</td>
                      <td className="px-4 py-4">{item.credits}</td>
                      <td className="px-4 py-4">{item.total_hours}</td>
                      <td className="px-4 py-4 text-xs leading-6">{item.schedule || "—"}</td>
                      <td className="px-4 py-4">{item.pnp_status || "—"}</td>
                      <td className="px-4 py-4">{item.selection_mark || "—"}</td>
                      <td className="px-4 py-4">
                        <SecondaryButton
                          disabled={pending !== null || !item.delete_url}
                          onClick={() => item.delete_url && void handleRemovePlanCourse(item.delete_url)}
                        >
                          点击删除
                        </SecondaryButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Surface>
    </div>
  );
}
