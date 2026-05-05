import { useEffect, useMemo, useRef, useState } from "react";

import { EmptyState, PageHeader, PrimaryButton, SecondaryButton, Surface } from "../components";
import { useAppModel } from "../app-model";

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
          <div className="overflow-hidden rounded-3xl border border-stone-900/8 dark:border-stone-800">
            <div className="overflow-auto">
              <table className="truncate min-w-full divide-y divide-stone-900/6 bg-white/80 text-left text-sm dark:divide-stone-800 dark:bg-stone-950/80">
                <thead className="bg-stone-100/90 text-stone-700 dark:bg-stone-900 dark:text-stone-300">
                  <tr>
                    {["课程号", "课程名", "课程类别", "学分", "教师", "班号", "开课单位", "上课/考试信息", "限数/已选", "意愿值", "预选"].map((label) => (
                      <th key={label} className="px-4 py-4 font-semibold">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-900/6 text-stone-800 dark:divide-stone-800 dark:text-stone-200">
                  {rows.map((course) => {
                    const draftValue = preferenceDrafts[course.key] ?? course.preference_value;
                    const parsedPreference =
                      draftValue.trim() === "" ? null : Number.parseInt(draftValue, 10);

                    return (
                      <tr key={course.key} className="hover:bg-orange-50/60 dark:hover:bg-stone-900">
                        <td className="px-4 py-4">{course.course_id}</td>
                        <td className="px-4 py-4">{course.name}</td>
                        <td className="px-4 py-4">{course.category}</td>
                        <td className="px-4 py-4">{course.credits}</td>
                        <td className="px-4 py-4">{course.teacher}</td>
                        <td className="px-4 py-4">{course.class_id}</td>
                        <td className="px-4 py-4">{course.department || "—"}</td>
                        <td className="px-4 py-4 text-xs leading-6">{course.schedule || "—"}</td>
                        <td className="px-4 py-4">{course.volume_cnt} / {course.elected_cnt}</td>
                        <td className="px-4 py-4">
                          <input
                            className="h-10 w-20 rounded-md border border-stone-200 bg-white px-3 text-center text-sm text-stone-950 shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-orange-500/20 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100"
                            inputMode="numeric"
                            onChange={(event) =>
                              setPreferenceDrafts((current) => ({
                                ...current,
                                [course.key]: event.target.value,
                              }))
                            }
                            value={draftValue}
                          />
                        </td>
                        <td className="px-4 py-4">
                          <SecondaryButton
                            disabled={
                              pending !== null ||
                              (draftValue.trim() !== "" && Number.isNaN(parsedPreference))
                            }
                            onClick={() =>
                              void handlePreselectCourse(course.select_url, parsedPreference)
                            }
                          >
                            预选
                          </SecondaryButton>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Surface>
    </div>
  );
}
