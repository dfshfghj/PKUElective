import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import type { CheckedState } from "@radix-ui/react-checkbox";

import {
  EmptyState,
  InputField,
  LineBreakText,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  Surface,
} from "../components";
import { useAppModel } from "../app-model";
import { DataTable, SortableHeader, tableCellMuted, tableCellWrap } from "@/components/data-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { CourseDetailLink } from "@/components/course-detail-link";
import type { QueryCourse } from "@/types";

const categoryOptions = [
  { label: "专业课", value: "speciality" },
  { label: "培养方案", value: "education_plan_bk" },
  { label: "政治课", value: "politics" },
  { label: "英语课", value: "english" },
  { label: "体育课", value: "gym" },
  { label: "通识课", value: "tsk_choice" },
  { label: "公选课", value: "pub_choice" },
  { label: "计算机基础课", value: "liberal_computer" },
  { label: "劳动教育课", value: "ldjyk" },
  { label: "思政选择性必修课", value: "szxzxbx" },
];

const departmentOptions = [
  { label: "全部", value: "ALL" },
  { label: "物理学院", value: "00004" },
  { label: "化学与分子工程学院", value: "00010" },
  { label: "生命科学学院", value: "00011" },
  { label: "地球与空间科学学院", value: "00012" },
  { label: "心理与认知科学学院", value: "00016" },
  { label: "新闻与传播学院", value: "00018" },
  { label: "哲学系", value: "00023" },
  { label: "国际关系学院", value: "00024" },
  { label: "经济学院", value: "00025" },
  { label: "光华管理学院", value: "00028" },
  { label: "法学院", value: "00029" },
  { label: "信息管理系", value: "00030" },
  { label: "社会学系", value: "00031" },
  { label: "英语语言文学系", value: "00038" },
  { label: "外国语学院", value: "00039" },
  { label: "体育教研部", value: "00041" },
  { label: "艺术学院", value: "00043" },
  { label: "信息科学技术学院", value: "00048" },
  { label: "教育学院", value: "00067" },
  { label: "工学院", value: "00086" },
  { label: "城市与环境学院", value: "00126" },
  { label: "环境科学与工程学院", value: "00127" },
  { label: "中国社会科学调查中心", value: "00187" },
  { label: "建筑与景观设计学院", value: "00195" },
  { label: "汇丰商学院", value: "00201" },
  { label: "现代农学院", value: "00211" },
  { label: "材料科学与工程学院", value: "00232" },
  { label: "教务部", value: "00612" },
  { label: "创新创业学院", value: "00671" },
  { label: "国际合作部", value: "610" },
];

const courseDayOptions = [
  { label: "不限", value: "" },
  { label: "星期一", value: "1" },
  { label: "星期二", value: "2" },
  { label: "星期三", value: "3" },
  { label: "星期四", value: "4" },
  { label: "星期五", value: "5" },
  { label: "星期六", value: "6" },
  { label: "星期日", value: "7" },
];

const courseTimeOptions = [
  { label: "不限", value: "" },
  { label: "第01节", value: "01" },
  { label: "第02节", value: "02" },
  { label: "第03节", value: "03" },
  { label: "第04节", value: "04" },
  { label: "第05节", value: "05" },
  { label: "第06节", value: "06" },
  { label: "第07节", value: "07" },
  { label: "第08节", value: "08" },
  { label: "第09节", value: "09" },
  { label: "第10节", value: "10" },
  { label: "第11节", value: "11" },
  { label: "第12节", value: "12" },
];

const lockedEmptyDepartmentCategories = new Set([
  "politics",
  "english",
  "gym",
  "liberal_computer",
  "ldjyk",
  "szxzxbx",
]);

function departmentStateForCategory(category: string) {
  if (category === "education_plan_bk") {
    return {
      options: departmentOptions.filter((option) => option.value === "00004"),
      value: "00004",
      disabled: true,
    };
  }

  if (lockedEmptyDepartmentCategories.has(category)) {
    return {
      options: [{ label: "无需选择", value: "" }],
      value: "",
      disabled: true,
    };
  }

  return {
    options: departmentOptions,
    value: undefined,
    disabled: false,
  };
}

function checkedStateToBoolean(checked: CheckedState) {
  return checked === true;
}

export function CourseQueryPage() {
  const { snapshot, pending, handleSearchQuery, handleAddCourseToPlan } = useAppModel();
  const [filters, setFilters] = useState({
    courseSettingType: "speciality",
    courseId: "",
    courseName: "",
    deptId: "ALL",
    courseDay: "",
    courseTime: "",
    queryDateFlag: false,
  });
  const departmentState = departmentStateForCategory(filters.courseSettingType);
  const columns = useMemo<ColumnDef<QueryCourse>[]>(
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
        cell: ({ row }) => <CourseDetailLink detailUrl={row.original.detail_url} name={row.original.name} />,
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
        meta: { label: "上课时间及教室", mobileHidden: true },
        cell: ({ row }) => <div className={tableCellWrap("min-w-72 xl:min-w-96")}><LineBreakText text={row.original.schedule} /></div>,
        header: ({ column }) => (
          <SortableHeader
            label="上课时间及教室"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        id: "availability",
        accessorFn: (row) => row.volume_cnt - row.elected_cnt,
        meta: { label: "限数/已选", mobileHidden: true },
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
        accessorKey: "note",
        meta: { label: "备注" },
        cell: ({ row }) => <div className={tableCellWrap("max-w-80")}>{tableCellMuted(row.original.note)}</div>,
        header: ({ column }) => (
          <SortableHeader
            label="备注"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            sorted={column.getIsSorted()}
          />
        ),
      },
      {
        id: "actions",
        meta: { label: "加入选课计划", mobileSlot: "footer" },
        enableHiding: false,
        enableSorting: false,
        cell: ({ row }) => (
          <PrimaryButton
            disabled={pending !== null || !row.original.add_to_plan_url}
            onClick={() =>
              row.original.add_to_plan_url &&
              void handleAddCourseToPlan(row.original.add_to_plan_url)
            }
          >
            加入选课计划
          </PrimaryButton>
        ),
        header: () => <span className="px-2">加入选课计划</span>,
      },
    ],
    [handleAddCourseToPlan, pending],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="课程查询"
        title="课程查询"
      />

      <Surface title="查询条件">
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSearchQuery({
              course_setting_type: filters.courseSettingType,
              course_id: filters.courseId || null,
              course_name: filters.courseName || null,
              dept_id: filters.deptId || "ALL",
              course_day: filters.courseDay || null,
              course_time: filters.courseTime || null,
              query_date_flag: filters.queryDateFlag,
            });
          }}
        >
          <div className="grid gap-4 xl:grid-cols-4">
            <SelectField
              label="课程分类"
              onChange={(value) =>
                setFilters((current) => {
                  const nextDepartmentState = departmentStateForCategory(value);
                  return {
                    ...current,
                    courseSettingType: value,
                    deptId: nextDepartmentState.value ?? current.deptId,
                  };
                })
              }
              options={categoryOptions}
              value={filters.courseSettingType}
            />
            <InputField
              label="课程号"
              onChange={(value) => setFilters((current) => ({ ...current, courseId: value }))}
              placeholder="至少填一项"
              value={filters.courseId}
            />
            <InputField
              label="课程名"
              onChange={(value) => setFilters((current) => ({ ...current, courseName: value }))}
              placeholder="至少填一项"
              value={filters.courseName}
            />
            <SelectField
              label="开课单位"
              disabled={departmentState.disabled}
              onChange={(value) => setFilters((current) => ({ ...current, deptId: value }))}
              options={departmentState.options}
              value={filters.deptId}
            />
          </div>
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr_auto]">
            <SelectField
              label="上课星期"
              onChange={(value) => setFilters((current) => ({ ...current, courseDay: value }))}
              options={courseDayOptions}
              value={filters.courseDay}
            />
            <SelectField
              label="上课节次"
              onChange={(value) => setFilters((current) => ({ ...current, courseTime: value }))}
              options={courseTimeOptions}
              value={filters.courseTime}
            />
            <label className="flex items-center gap-3 pb-2 mt-auto text-sm text-stone-600 dark:text-stone-300">
              <Checkbox
                className="size-4"
                checked={filters.queryDateFlag}
                onCheckedChange={(checked) =>
                  setFilters((current) => ({
                    ...current,
                    queryDateFlag: checkedStateToBoolean(checked),
                  }))
                }
              />
              <span>时间反查</span>
            </label>
          </div>
          <div className="flex flex-wrap gap-3">
            <PrimaryButton disabled={pending !== null} type="submit">
              查询
            </PrimaryButton>
            <SecondaryButton
              disabled={pending !== null}
              onClick={() =>
                setFilters({
                  courseSettingType: "speciality",
                  courseId: "",
                  courseName: "",
                  deptId: "ALL",
                  courseDay: "",
                  courseTime: "",
                  queryDateFlag: false,
                })
              }
              type="button"
            >
              清空条件
            </SecondaryButton>
          </div>
        </form>
      </Surface>

      <Surface title="查询结果">
        {snapshot.query_courses.length === 0 ? (
          <EmptyState text="暂无更多结果。" />
        ) : (
          <DataTable
            columns={columns}
            data={snapshot.query_courses}
            getRowId={(course) => `${course.course_id}-${course.class_id}`}
            initialVisibility={{
              department: false,
              grade: false,
              pnp_status: false,
              note: false,
            }}
            mobileCardTitle={(course) => course.name}
            mobileCardDescription={(course) =>
              `${course.course_id} · 班号 ${course.class_id} · ${course.teacher || "教师待定"}`
            }
            mobileCardBadges={(course) => (
              <>
                <Badge variant="secondary">{course.category}</Badge>
                <Badge variant="outline">{course.credits} 学分</Badge>
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
