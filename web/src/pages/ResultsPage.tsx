import { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FileSpreadsheet, X } from "lucide-react";
import { Dialog } from "radix-ui";

import { EmptyState, LineBreakText, LoadingState, PageHeader, Surface } from "../components";
import { emptyPagination, useAppModel } from "../app-model";
import { useIsCompactViewport } from "../hooks/use-mobile";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DataTable, SortableHeader, tableCellMuted } from "@/components/data-table";
import { ServerPagination } from "@/components/server-pagination";
import { Badge } from "@/components/ui/badge";
import type { CourseResult, TimetableCell } from "../types";
import { refreshResults } from "../api";

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
  const { snapshot, pending, handlePaginateResults, loadPage } = useAppModel();
  const isMobile = useIsCompactViewport();
  const enteredRef = useRef(false);
  const [selectedTimetableCell, setSelectedTimetableCell] = useState<{
    text: string;
    section: string;
    weekday: string;
  } | null>(null);
  const results = snapshot.results;
  const timetable = results.timetable;
  const mergedTimetable = timetable ? mergeTimetableRows(timetable.rows) : [];
  const timetableHeaders = timetable?.headers.length ? timetable.headers : fallbackHeaders;
  const resultColumns = useMemo<ColumnDef<CourseResult>[]>(
    () => [
      resultColumn("course_id", "课程号", true),
      resultColumn("name", "课程名", true),
      resultColumn("category", "课程类别", true),
      resultColumn("credits", "学分", true),
      resultColumn("teacher", "教师", true),
      resultColumn("class_id", "班号", true),
      resultColumn("department", "开课单位", true),
      {
        accessorKey: "classroom_info",
        meta: { label: "教室信息" },
        cell: ({ row }) => <LineBreakText text={row.original.classroom_info || "—"} />,
        header: ({ column }) => (
          <SortableHeader label="教室信息" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} sorted={column.getIsSorted()} />
        ),
      },
      {
        accessorKey: "pnp_status",
        meta: { label: "P/NP", mobileHidden: true },
        cell: ({ row }) => tableCellMuted(row.original.pnp_status),
        header: ({ column }) => (
          <SortableHeader label="P/NP" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} sorted={column.getIsSorted()} />
        ),
      },
      {
        accessorKey: "result",
        meta: { label: "结果", mobileSlot: "summary" },
        cell: ({ row }) => (
          <Badge variant="outline">{row.original.result || "—"}</Badge>
        ),
        header: ({ column }) => (
          <SortableHeader label="结果" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")} sorted={column.getIsSorted()} />
        ),
      },
      resultColumn("ip_address", "IP", true),
      resultColumn("operation_time", "操作时间", false),
    ],
    [],
  );

  useEffect(() => {
    if (!enteredRef.current && snapshot.auth.logged_in) {
      enteredRef.current = true;
      void loadPage("results", "刷新选课结果", (current) => ({ ...current, results: { ...current.results, courses: [], summary: null, timetable: null, pagination: { ...emptyPagination } } }), refreshResults);
    }
  }, []);

  return (
    <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
      <PageHeader
        breadcrumb="选课结果"
        title="选课结果"
      />

      {results.notice || results.export_url ? (
        <div className="grid gap-2 text-xs leading-5 text-stone-500 sm:hidden dark:text-stone-400">
          {results.notice ? <p>{results.notice}</p> : null}
          {results.export_url ? (
            <a
              aria-label="导出 Excel"
              className="inline-flex w-fit items-center font-medium text-orange-700 dark:text-orange-300"
              href={results.export_url}
              rel="noreferrer"
              target="_blank"
            >
              <FileSpreadsheet className="size-4" />
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="gap-4 text-sm leading-6 text-stone-600 dark:text-stone-300 hidden sm:grid">
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

      <Surface className="mobile-compact-surface" title="选课结果列表" meta={`${results.courses.length} 门`}>
        {results.courses.length === 0 ? (
          pending !== null ? (
            <LoadingState />
          ) : (
            <EmptyState text="还没有拿到选课结果，先刷新一次看看。" />
          )
        ) : (
          <DataTable
            columns={resultColumns}
            data={results.courses}
            emptyText="还没有拿到选课结果，先刷新一次看看。"
            getRowId={(course) => `${course.course_id}-${course.class_id}-${course.operation_time}`}
            initialVisibility={{ category: false, department: false, pnp_status: false, ip_address: false }}
            mobileCardBadges={(course) => (
              <>
                <Badge variant="secondary">{course.category}</Badge>
                <Badge variant="outline">{course.credits} 学分</Badge>
              </>
            )}
            mobileCardDescription={(course) => [course.course_id, course.teacher].filter(Boolean).join(" · ")}
            mobileCardTitle={(course) => course.name}
          />
        )}
        <ServerPagination
          disabled={pending !== null}
          onNavigate={(url) => void handlePaginateResults(url)}
          pagination={results.pagination}
        />
      </Surface>

      <Surface className="mobile-compact-surface" title={timetable?.caption ?? "学期课程表"}>
        {!timetable || timetable.rows.length === 0 ? (
          pending !== null ? (
            <LoadingState />
          ) : (
            <EmptyState text="当前没有可展示的课表数据。" />
          )
        ) : (
          isMobile ? (
            <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-stone-900/8 bg-white dark:border-stone-800 dark:bg-stone-950">
              <table className="w-full table-fixed border-separate border-spacing-0 text-center text-[10px] text-stone-800 dark:text-stone-200">
                <thead className="text-stone-700 dark:text-stone-300">
                  <tr>
                    {timetableHeaders.map((header, index) => (
                      <th
                        key={header}
                        className={`border-b border-r border-stone-200/80 bg-stone-100 px-0.5 py-1.5 font-semibold last:border-r-0 dark:border-stone-800 dark:bg-stone-900 ${index === 0 ? "w-[8%]" : ""}`}
                      >
                        {compactHeaderLabel(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-stone-800 dark:text-stone-200">
                  {mergedTimetable.map((row) => (
                    <tr key={row.section} className="align-top">
                      <td
                        className="w-[8%] border-b border-r border-stone-200/80 bg-stone-50 px-0.5 py-1 font-medium dark:border-stone-800 dark:bg-stone-900"
                      >
                        {compactSectionLabel(row.section)}
                      </td>
                      {row.cells.map((cell, index) => {
                        if (cell.hidden) {
                          return null;
                        }

                        if (!cell.text.trim()) {
                          return (
                            <td
                              key={`${row.section}-${index}`}
                              className="h-16 border-b border-r border-stone-200/80 bg-white last:border-r-0 dark:border-stone-800 dark:bg-stone-950"
                            />
                          );
                        }

                        const palette = courseCellPalette(cell.background_color);
                        const compact = compactCourseParts(cell.text);

                        return (
                          <td
                            key={`${row.section}-${index}`}
                            rowSpan={cell.rowSpan}
                            className="relative border-b border-r border-stone-200/80 p-0 align-top last:border-r-0 dark:border-stone-800"
                          >
                            <button
                              aria-label={`查看${compact.courseName || "课程"}详情`}
                              className="absolute inset-0 flex h-full w-full rounded-md items-center justify-center gap-0.5 overflow-hidden px-0.5 py-1 text-stone-900 outline-none transition active:brightness-95 focus-visible:ring-2 focus-visible:ring-orange-500/40 dark:text-stone-100"
                              onClick={() =>
                                setSelectedTimetableCell({
                                  text: cell.text,
                                  section: row.section,
                                  weekday: timetableHeaders[index + 1] ?? `第 ${index + 1} 列`,
                                })
                              }
                              style={{
                                backgroundColor: palette.backgroundColor,
                                borderColor: palette.borderColor,
                              }}
                              type="button"
                            >
                              <span className="break-all text-[12px] font-medium [writing-mode:vertical-rl]">
                                {compact.courseName}
                              </span>
                              {compact.classroom ? (
                                <span className="break-all text-[10px] text-stone-600 [writing-mode:vertical-rl] dark:text-stone-300">
                                  {compact.classroom}
                                </span>
                              ) : null}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-stone-900/8 bg-white shadow-sm dark:border-stone-800 dark:bg-stone-950">
              <ScrollArea className="w-full min-w-0 max-w-full overflow-x-hidden">
                <table className="w-full table-fixed border-separate border-spacing-0 bg-white text-left text-sm dark:bg-stone-950">
                  <thead className="text-stone-700 dark:text-stone-300">
                    <tr>
                      {timetableHeaders.map((header) => (
                        <th key={header} className="break-words border-b border-r border-stone-200/80 bg-stone-100 px-2 py-3 text-center text-xs font-semibold last:border-r-0 dark:border-stone-800 dark:bg-stone-900">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-stone-800 dark:text-stone-200">
                    {mergedTimetable.map((row) => (
                      <tr key={row.section} className="align-top">
                        <td className="w-[9%] break-words border-b border-r border-stone-200/80 bg-stone-50 px-2 py-3 text-xs font-medium dark:border-stone-800 dark:bg-stone-900 text-center">
                          {row.section}
                        </td>
                        {row.cells.map((cell, index) => {
                          if (cell.hidden) return null;
                          if (!cell.text.trim()) {
                            return <td key={`${row.section}-${index}`} className="break-words border-b border-r border-stone-200/80 bg-white px-2 py-3 last:border-r-0 dark:border-stone-800 dark:bg-stone-950" />;
                          }
                          const palette = courseCellPalette(cell.background_color);
                          return (
                            <td key={`${row.section}-${index}`} rowSpan={cell.rowSpan} className="relative h-px break-words border-b border-r border-stone-200/80 p-0 align-top last:border-r-0 dark:border-stone-800">
                              <div className="flex h-full min-h-24 w-full min-w-0 items-center overflow-hidden rounded-md px-2 py-2 text-xs leading-5 text-stone-900 shadow-sm dark:text-stone-100" style={{ backgroundColor: palette.backgroundColor, borderColor: palette.borderColor }} title={cell.text}>
                                <div className="min-w-0 whitespace-pre-line break-words">{cell.text}</div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          )
        )}
      </Surface>

      <Dialog.Root open={selectedTimetableCell !== null} onOpenChange={(open) => !open && setSelectedTimetableCell(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-stone-950/30 backdrop-blur-sm" />
          <Dialog.Content className="safe-dialog fixed left-1/2 top-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-stone-200/80 bg-white p-4 text-stone-950 shadow-2xl outline-none dark:border-stone-800 dark:bg-stone-950 dark:text-stone-100">
            <div className="pr-8">
              <Dialog.Title className="text-base font-semibold">
                {selectedTimetableCell ? compactCourseParts(selectedTimetableCell.text).courseName : "课程详情"}
              </Dialog.Title>
              {selectedTimetableCell ? (
                <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                  {selectedTimetableCell.weekday} · {selectedTimetableCell.section}
                </p>
              ) : null}
            </div>
            <Dialog.Description className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-stone-100/80 p-3 text-sm leading-6 text-stone-700 dark:bg-stone-900 dark:text-stone-300">
              {selectedTimetableCell?.text ?? ""}
            </Dialog.Description>
            <Dialog.Close className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md text-stone-500 transition hover:bg-stone-100 hover:text-stone-950 dark:hover:bg-stone-900 dark:hover:text-stone-100" aria-label="关闭">
              <X className="size-4" />
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function resultColumn(
  key: keyof CourseResult,
  label: string,
  mobileHidden: boolean,
): ColumnDef<CourseResult> {
  return {
    accessorKey: key,
    meta: { label, mobileHidden },
    cell: ({ row }) => tableCellMuted(row.original[key]),
    header: ({ column }) => (
      <SortableHeader
        label={label}
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        sorted={column.getIsSorted()}
      />
    ),
  };
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

  if (normalized) {
    const mixTarget = isDark ? "black" : "white";
    return {
      backgroundColor: `color-mix(in srgb, ${normalized} 32%, ${mixTarget})`,
      borderColor: `color-mix(in srgb, ${normalized} 42%, ${mixTarget})`,
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

function compactCourseParts(text: string) {
  const normalized = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (normalized.length === 0) {
    return { courseName: "", classroom: "" };
  }

  const firstLine = normalized[0] ?? "";
  const inlineMatch = firstLine.match(/^(.*?)\s*\(([^()]+)\)/);
  if (inlineMatch) {
    const [, courseName, room] = inlineMatch;
    return {
      courseName: courseName.trim(),
      classroom: normalizeClassroom(room),
    };
  }

  const courseName = firstLine.replace(/\([^()]+\)/g, "").trim();
  const standaloneRoomLine = normalized.find((line) => /^\([^()]+\)$/.test(line));
  const room = standaloneRoomLine ? standaloneRoomLine.replace(/[()]/g, "").trim() : "";

  const labeledRoomLine = normalized.find((line) => /(?:上课)?教室[：:]/.test(line));
  const labeledRoom = labeledRoomLine?.replace(/^.*?(?:上课)?教室[：:]\s*/, "") ?? "";

  return {
    courseName,
    classroom: normalizeClassroom(room || labeledRoom),
  };
}

function normalizeClassroom(value: string) {
  const normalized = value.replace(/[()]/g, "").trim();
  return normalized.includes("暂无上课教室数据") ? "" : normalized;
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
