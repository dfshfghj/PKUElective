export type BotStatus =
  | "init"
  | "authenticating"
  | "waiting_captcha"
  | "idle"
  | "looping"
  | "selecting"
  | "recovering"
  | "dead";

export type AuthStateView = {
  logged_in: boolean;
  username: string | null;
};

export type AppConfig = {
  auto_refresh: boolean;
  auto_captcha: boolean;
  notifications: boolean;
  interval_ms: number;
  timeout_ms: number;
};

export type BotView = {
  id: string;
  status: BotStatus;
  last_error: string | null;
  last_loop_unix_ms: number | null;
};

export type Course = {
  name: string;
  class_id: string;
  teacher: string;
  select_url: string;
  volume_cnt: number;
  elected_cnt: number;
};

export type PreselectCourse = {
  course_id: string;
  name: string;
  category: string;
  credits: string;
  weekly_hours: string;
  teacher: string;
  class_id: string;
  department: string;
  grade: string;
  schedule: string;
  pnp_status: string;
  volume_cnt: number;
  elected_cnt: number;
  preference_value: string;
  select_url: string;
};

export type PlanCourse = {
  course_id: string;
  name: string;
  class_id: string;
  category: string;
  grade: string;
  credits: string;
  weekly_hours: string;
  total_hours: string;
  schedule: string;
  pnp_status: string;
  selection_mark: string;
  delete_url: string | null;
};

export type QueryCourse = {
  course_id: string;
  name: string;
  category: string;
  credits: string;
  teacher: string;
  class_id: string;
  department: string;
  major: string;
  grade: string;
  schedule: string;
  volume_cnt: number;
  elected_cnt: number;
  pnp_status: string;
  note: string;
  add_to_plan_url: string | null;
};

export type CourseQueryFilters = {
  course_setting_type?: string | null;
  course_id?: string | null;
  course_name?: string | null;
  dept_id?: string | null;
  course_day?: string | null;
  course_time?: string | null;
  query_date_flag: boolean;
};

export type WishlistItem = {
  name: string;
  class_id: string;
  busy: boolean;
};

export type SnapshotView = {
  auth: AuthStateView;
  config: AppConfig;
  bots: BotView[];
  courses: Course[];
  preselect_courses: PreselectCourse[];
  plan_courses: PlanCourse[];
  query_courses: QueryCourse[];
  wishlist: WishlistItem[];
};

export type ConfigPatch = Partial<AppConfig>;

export type MessageEvent = {
  kind: string;
  text: string;
};
