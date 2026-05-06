import { useState } from "react";
import type { CheckedState } from "@radix-ui/react-checkbox";

import {
  EmptyState,
  InputField,
  PageHeader,
  PrimaryButton,
  SecondaryButton,
  SelectField,
  Surface,
} from "../components";
import { useAppModel } from "../app-model";
import { Checkbox } from "@/components/ui/checkbox";

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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Course Query"
        title="课程查询"
      />

      <Surface title="查询条件" meta="后端查询">
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

      <Surface title="查询结果" meta={`${snapshot.query_courses.length} 门`}>
        {snapshot.query_courses.length === 0 ? (
          <EmptyState text="暂无更多结果。" />
        ) : (
          <div className="overflow-hidden rounded-3xl border border-stone-900/8 dark:border-stone-800">
            <div className="overflow-auto">
              <table className="truncate min-w-full divide-y divide-stone-900/6 bg-white/80 text-left text-sm dark:divide-stone-800 dark:bg-stone-950/80">
                <thead className="bg-stone-100/90 text-stone-700 dark:bg-stone-900 dark:text-stone-300">
                  <tr>
                    <th className="px-4 py-4 font-semibold">课程号</th>
                    <th className="px-4 py-4 font-semibold">课程名</th>
                    <th className="px-4 py-4 font-semibold">课程类别</th>
                    <th className="hidden px-4 py-4 font-semibold lg:table-cell">学分</th>
                    <th className="px-4 py-4 font-semibold">教师</th>
                    <th className="px-4 py-4 font-semibold">班号</th>
                    <th className="hidden px-4 py-4 font-semibold 2xl:table-cell">开课单位</th>
                    <th className="hidden px-4 py-4 font-semibold xl:table-cell">年级</th>
                    <th className="px-4 py-4 font-semibold">上课时间及教室</th>
                    <th className="px-4 py-4 font-semibold">限数/已选</th>
                    <th className="hidden px-4 py-4 font-semibold 2xl:table-cell">自选P/NP</th>
                    <th className="hidden px-4 py-4 font-semibold 2xl:table-cell">备注</th>
                    <th className="px-4 py-4 font-semibold">加入选课计划</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-900/6 text-stone-800 dark:divide-stone-800 dark:text-stone-200">
                  {snapshot.query_courses.map((course) => (
                    <tr key={`${course.course_id}-${course.class_id}`} className="hover:bg-orange-50/60 dark:hover:bg-stone-900">
                      <td className="px-4 py-4">{course.course_id}</td>
                      <td className="px-4 py-4">{course.name}</td>
                      <td className="px-4 py-4">{course.category}</td>
                      <td className="hidden px-4 py-4 lg:table-cell">{course.credits}</td>
                      <td className="px-4 py-4">{course.teacher}</td>
                      <td className="px-4 py-4">{course.class_id}</td>
                      <td className="hidden px-4 py-4 2xl:table-cell">{course.department || "—"}</td>
                      <td className="hidden px-4 py-4 xl:table-cell">{course.grade || "—"}</td>
                      <td className="min-w-72 px-4 py-4 text-xs leading-6 xl:min-w-96">{course.schedule || "—"}</td>
                      <td className="px-4 py-4">{course.volume_cnt} / {course.elected_cnt}</td>
                      <td className="hidden px-4 py-4 2xl:table-cell">{course.pnp_status || "—"}</td>
                      <td className="hidden max-w-80 px-4 py-4 text-xs leading-6 2xl:table-cell">{course.note || "—"}</td>
                      <td className="px-4 py-4">
                        <PrimaryButton
                          disabled={pending !== null || !course.add_to_plan_url}
                          onClick={() =>
                            course.add_to_plan_url &&
                            void handleAddCourseToPlan(course.add_to_plan_url)
                          }
                        >
                          加入选课计划
                        </PrimaryButton>
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
