import { EmptyState, PageHeader, Surface } from "../components";
import { useAppModel } from "../app-model";
import { HIDE_AUTOMATION } from "../build-flags";

export function DashboardPage() {
  const { snapshot } = useAppModel();
  const schedule = snapshot.elective_schedule;

  return (
    <div className="space-y-6">
      <PageHeader breadcrumb="概览" title="概览" />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Surface title="当前会话">
          <div className="rounded-2xl bg-stone-100 p-5 dark:bg-stone-900">
            <p className="text-sm text-stone-500 dark:text-stone-400">当前账号</p>
            <p className="mt-2 text-2xl font-semibold text-stone-950 dark:text-stone-100">
              {snapshot.auth.username ?? "未登录"}
            </p>
          </div>
        </Surface>

        <Surface title="数据概览">
          <dl className="grid gap-3 rounded-3xl bg-stone-100/80 p-5 text-sm text-stone-700 dark:bg-stone-900/80 dark:text-stone-300">
            {!HIDE_AUTOMATION && <Stat label="Bot 数量" value={snapshot.bots.length} />}
            <Stat label="课程快照" value={snapshot.courses.length} />
            <Stat label="Wishlist" value={snapshot.wishlist.length} />
            <Stat label="选课结果" value={snapshot.results.courses.length} />
          </dl>
        </Surface>
      </div>

      <Surface title="选课时间表" meta="帮助 · 总体流程">
        {schedule.length === 0 && snapshot.elective_data_preloading ? (
          <div className="py-10 text-center text-sm text-stone-500 dark:text-stone-400">正在加载选课时间表…</div>
        ) : schedule.length === 0 ? (
          <EmptyState text="当前没有可显示的选课时间表。" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="border-b border-stone-200 text-stone-500 dark:border-stone-800 dark:text-stone-400">
                <tr>
                  <th className="px-4 py-3 font-medium">选课阶段</th>
                  <th className="px-4 py-3 font-medium">开始时间</th>
                  <th className="px-4 py-3 font-medium">结束时间</th>
                  <th className="px-4 py-3 font-medium">备注</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
                {schedule.map((row, index) => (
                  <tr className="hover:bg-orange-50/60 dark:hover:bg-stone-900" key={`${row.stage}-${index}`}>
                    <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100">{row.stage}</td>
                    <td className="px-4 py-3 text-stone-600 dark:text-stone-300">{row.start_time || "—"}</td>
                    <td className="px-4 py-3 text-stone-600 dark:text-stone-300">{row.end_time || "—"}</td>
                    <td className="px-4 py-3 text-stone-500 dark:text-stone-400">{row.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>

      <Surface title="选课结果列表" meta={`${snapshot.results.courses.length} 门`}>
        {snapshot.results.courses.length === 0 ? (
          <EmptyState text="当前还没有选课结果。" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-stone-200 text-stone-500 dark:border-stone-800 dark:text-stone-400">
                <tr>
                  <th className="px-4 py-3 font-medium">课程名</th>
                  <th className="px-4 py-3 font-medium">教师</th>
                  <th className="px-4 py-3 font-medium">P/NP</th>
                  <th className="px-4 py-3 font-medium">结果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800/80">
                {snapshot.results.courses.map((course) => (
                  <tr className="hover:bg-orange-50/60 dark:hover:bg-stone-900" key={`${course.course_id}-${course.class_id}`}>
                    <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100">{course.name}</td>
                    <td className="px-4 py-3 text-stone-600 dark:text-stone-300">{course.teacher || "—"}</td>
                    <td className="px-4 py-3 text-stone-600 dark:text-stone-300">{course.pnp_status || "—"}</td>
                    <td className="px-4 py-3 font-medium text-stone-900 dark:text-stone-100">{course.result || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Surface>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt>{label}</dt>
      <dd className="font-semibold text-stone-950 dark:text-stone-100">{value}</dd>
    </div>
  );
}
