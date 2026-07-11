import { useEffect, useRef } from "react";

import { EmptyState, LineBreakText, PageHeader, Surface } from "../components";
import { useAppModel } from "../app-model";
import { useIsMobile } from "../hooks/use-mobile";
import type { TimetableCell } from "../types";

const fallbackHeaders = ["节数", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"];
const compactWeekdayLabels: Record<string, string> = {
  星期一: "一",
  星期二: "二",
  星期三: "三",
  星期四: "四",
  星期五: "五",
  星期六: "六",
  星期日: "日",
};

export function ResultsPage() {
  const { snapshot, pending, handleRefreshResults } = useAppModel();
  const isMobile = useIsMobile();
  const hasTriggeredAutoRefresh = useRef(false);
  const results = snapshot.results;
  const timetable = results.timetable;
  const mergedTimetable = timetable ? mergeTimetableRows(timetable.rows) : [];

  useEffect(() => {
    if (hasTriggeredAutoRefresh.current) {
      return;
    }
    if (!snapshot.auth.logged_in || pending !== null) {
      return;
    }

    hasTriggeredAutoRefresh.current = true;
    void handleRefreshResults();
  }, [handleRefreshResults, pending, snapshot.auth.logged_in]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="选课结果"
        title="选课结果"
      />

      <Surface title="结果说明">
        <div className="grid gap-4 text-sm leading-6 text-stone-600 dark:text-stone-300">
          <div className="rounded-2xl bg-stone-100/80 p-4 dark:bg-stone-900/80">
            {results.notice ?? "这里会显示选课状态、操作时间，以及课表中的具体排课信息。"}
          </div>
          {results.export_url ? (
            <a
              className="inline-flex w-fit rounded-full bg-orange-100 px-4 py-2 text-sm font-medium text-orange-900 transition hover:bg-orange-200 dark:bg-orange-950/40 dark:text-orange-100 dark:hover:bg-orange-950/60"
              href={results.export_url}
              rel="noreferrer"
              target="_blank"
            >
              导出 Excel
            </a>
          ) : null}
        </div>
      </Surface>

      <Surface title="选课结果列表" meta={`${results.courses.length} 门`}>
        {results.courses.length === 0 ? (
          <EmptyState text="还没有拿到选课结果，先刷新一次看看。" />
        ) : (
          <div className="overflow-hidden rounded-3xl border border-stone-900/8 dark:border-stone-800">
            <div className="overflow-auto">
              <table className="min-w-full divide-y divide-stone-900/6 bg-white/80 text-left text-sm dark:divide-stone-800 dark:bg-stone-950/80">
                <thead className="bg-stone-100/90 text-stone-700 dark:bg-stone-900 dark:text-stone-300">
                  <tr>
                    {["课程号", "课程名", "课程类别", "学分", "教师", "班号", "开课单位", "教室信息", "P/NP", "结果", "IP", "操作时间"].map((label) => (
                      <th key={label} className="px-4 py-4 font-semibold">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="truncate divide-y divide-stone-900/6 text-stone-800 dark:divide-stone-800 dark:text-stone-200">
                  {results.courses.map((course) => (
                    <tr key={`${course.course_id}-${course.class_id}-${course.operation_time}`} className="hover:bg-orange-50/60 dark:hover:bg-stone-900">
                      <td className="px-4 py-4">{course.course_id}</td>
                      <td className="px-4 py-4">{course.name}</td>
                      <td className="px-4 py-4">{course.category}</td>
                      <td className="px-4 py-4">{course.credits}</td>
                      <td className="px-4 py-4">{course.teacher}</td>
                      <td className="px-4 py-4">{course.class_id}</td>
                      <td className="px-4 py-4">{course.department || "—"}</td>
                      <td className="min-w-80 px-4 py-4 text-xs leading-6">
                        <LineBreakText text={course.classroom_info} />
                      </td>
                      <td className="px-4 py-4">{course.pnp_status || "—"}</td>
                      <td className="px-4 py-4">
                        <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-900 dark:bg-orange-950/40 dark:text-orange-100">
                          {course.result || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-4">{course.ip_address || "—"}</td>
                      <td className="whitespace-nowrap px-4 py-4">{course.operation_time || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Surface>

      <Surface title={timetable?.caption ?? "学期课程表"}>
        {!timetable || timetable.rows.length === 0 ? (
          <EmptyState text="当前没有可展示的课表数据。" />
        ) : (
          <div className="overflow-hidden rounded-3xl border border-stone-900/8 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-950">
            <div className="overflow-auto">
              <table className="min-w-full border-separate border-spacing-0 bg-white text-left text-sm dark:bg-stone-950">
                <thead className="text-stone-700 dark:text-stone-300">
                  <tr>
                    {(timetable.headers.length > 0 ? timetable.headers : fallbackHeaders).map((header) => (
                      <th
                        key={header}
                        className="text-center border-b border-r border-stone-200/80 bg-stone-100 px-4 py-4 font-semibold last:border-r-0 dark:border-stone-800 dark:bg-stone-900"
                      >
                        {isMobile ? compactHeaderLabel(header) : header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-stone-800 dark:text-stone-200">
                  {mergedTimetable.map((row) => (
                    <tr key={row.section} className="align-top">
                      <td
                        className={`whitespace-nowrap border-b border-r border-stone-200/80 bg-stone-50 py-4 font-medium dark:border-stone-800 dark:bg-stone-900 ${
                          isMobile
                            ? "w-16 px-2 text-center"
                            : "w-28 px-4 text-left"
                        }`}
                      >
                        {isMobile ? compactSectionLabel(row.section) : row.section}
                      </td>
                      {row.cells.map((cell, index) => {
                        if (cell.hidden) {
                          return null;
                        }

                        if (!cell.text.trim()) {
                          return (
                            <td
                              key={`${row.section}-${index}`}
                              className="min-w-40 border-b border-r border-stone-200/80 bg-white px-4 py-4 text-xs leading-6 last:border-r-0 dark:border-stone-800 dark:bg-stone-950"
                            >
                              {" "}
                            </td>
                          );
                        }

                        const palette = courseCellPalette(cell.background_color);

                        return (
                          <td
                            key={`${row.section}-${index}`}
                            rowSpan={cell.rowSpan}
                            className="min-w-40 border-b border-r border-stone-200/80 align-top last:border-r-0 dark:border-stone-800"
                          >
                            <div
                              className="flex h-full min-h-24 rounded-md px-3 py-3 text-xs leading-6 text-stone-900 shadow-sm dark:text-stone-100"
                              style={{
                                backgroundColor: palette.backgroundColor,
                                borderColor: palette.borderColor,
                              }}
                              title={cell.text}
                            >
                              <div className="break-words">
                                <div className="whitespace-pre-line">
                                  {isMobile ? compactCourseText(cell.text) : cell.text}
                                </div>
                              </div>
                            </div>
                          </td>
                        );
                      })}
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

type MergedCell = TimetableCell & {
  rowSpan: number;
  hidden: boolean;
};

type MergedRow = {
  section: string;
  cells: MergedCell[];
};

function mergeTimetableRows(
  rows: Array<{ section: string; cells: TimetableCell[] }>,
): MergedRow[] {
  const merged = rows.map((row) => ({
    section: row.section,
    cells: row.cells.map((cell) => ({
      ...cell,
      rowSpan: 1,
      hidden: false,
    })),
  }));

  if (merged.length === 0) {
    return merged;
  }

  const columnCount = Math.max(...merged.map((row) => row.cells.length));

  for (let column = 0; column < columnCount; column += 1) {
    let start = 0;
    while (start < merged.length) {
      const baseCell = merged[start].cells[column];
      if (!baseCell || !baseCell.text.trim()) {
        start += 1;
        continue;
      }

      let end = start + 1;
      while (end < merged.length) {
        const nextCell = merged[end].cells[column];
        if (!nextCell || !sameCourseCell(baseCell, nextCell)) {
          break;
        }
        end += 1;
      }

      const span = end - start;
      if (span > 1) {
        baseCell.rowSpan = span;
        for (let index = start + 1; index < end; index += 1) {
          merged[index].cells[column].hidden = true;
        }
      }

      start = end;
    }
  }

  return merged;
}

function sameCourseCell(left: TimetableCell, right: TimetableCell) {
  return (
    left.text.trim() !== "" &&
    left.text === right.text &&
    (left.background_color ?? "") === (right.background_color ?? "")
  );
}

function courseCellPalette(backgroundColor: string | null) {
  const normalized = (backgroundColor ?? "").trim().toLowerCase();
  const isDark = document.documentElement.classList.contains("dark");

  const themedPalettes: Record<
    string,
    { backgroundColor: string; borderColor: string }
  > = {
    aquamarine: {
      backgroundColor: isDark ? "rgba(16, 185, 129, 0.22)" : "rgba(16, 185, 129, 0.16)",
      borderColor: isDark ? "rgba(94, 234, 212, 0.28)" : "rgba(16, 185, 129, 0.35)",
    },
    lightyellow: {
      backgroundColor: isDark ? "rgba(245, 158, 11, 0.2)" : "rgba(245, 158, 11, 0.16)",
      borderColor: isDark ? "rgba(251, 191, 36, 0.3)" : "rgba(245, 158, 11, 0.35)",
    },
    pink: {
      backgroundColor: isDark ? "rgba(236, 72, 153, 0.2)" : "rgba(236, 72, 153, 0.15)",
      borderColor: isDark ? "rgba(244, 114, 182, 0.3)" : "rgba(236, 72, 153, 0.35)",
    },
    lightblue: {
      backgroundColor: isDark ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.16)",
      borderColor: isDark ? "rgba(96, 165, 250, 0.3)" : "rgba(59, 130, 246, 0.35)",
    },
    khaki: {
      backgroundColor: isDark ? "rgba(217, 119, 6, 0.2)" : "rgba(217, 119, 6, 0.16)",
      borderColor: isDark ? "rgba(251, 146, 60, 0.3)" : "rgba(217, 119, 6, 0.35)",
    },
  };

  if (normalized && themedPalettes[normalized]) {
    return themedPalettes[normalized];
  }

  if (normalized) {
    return {
      backgroundColor: isDark ? "rgba(249, 115, 22, 0.18)" : "rgba(249, 115, 22, 0.12)",
      borderColor: isDark ? "rgba(251, 146, 60, 0.28)" : "rgba(249, 115, 22, 0.28)",
    };
  }

  return {
    backgroundColor: "rgba(255, 255, 255, 0)",
    borderColor: "rgba(0, 0, 0, 0)",
  };
}

function compactHeaderLabel(header: string) {
  return compactWeekdayLabels[header] ?? header;
}

function compactCourseText(text: string) {
  const normalized = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (normalized.length === 0) {
    return "";
  }

  const firstLine = normalized[0] ?? "";
  const inlineMatch = firstLine.match(/^(.*?)\s*\(([^()]+)\)/);
  if (inlineMatch) {
    const [, courseName, room] = inlineMatch;
    return `${courseName.trim()}\n${room.trim()}`;
  }

  const courseName = firstLine.replace(/\([^()]+\)/g, "").trim();
  const standaloneRoomLine = normalized.find((line) => /^\([^()]+\)$/.test(line));
  const room = standaloneRoomLine ? standaloneRoomLine.replace(/[()]/g, "").trim() : "";

  return room ? `${courseName}\n${room}` : courseName;
}

function compactSectionLabel(section: string) {
  const matched = section.match(/^第(.+)节$/);
  if (!matched) {
    return section;
  }

  const map: Record<string, string> = {
    一: "1",
    二: "2",
    三: "3",
    四: "4",
    五: "5",
    六: "6",
    七: "7",
    八: "8",
    九: "9",
    十: "10",
    十一: "11",
    十二: "12",
  };

  return map[matched[1]] ?? section;
}
