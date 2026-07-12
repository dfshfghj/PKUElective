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
  saved_username: string | null;
  saved_channel: "bzx" | "bfx" | null;
  remember_password: boolean;
  auto_login: boolean;
  auth_restoring: boolean;
  secure_store_available: boolean;
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
  captcha_image_b64: string | null;
};

export type Course = {
  name: string;
  class_id: string;
  teacher: string;
  select_url: string;
  volume_cnt: number;
  elected_cnt: number;
};

export type SupplementPage = {
  notices: string[];
  available_courses: SupplementAvailableCourse[];
  selected_courses: SupplementSelectedCourse[];
  selected_credits: string | null;
};

export type SupplementAvailableCourse = {
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
  action_label: string;
  select_url: string | null;
  detail_url: string | null;
};

export type SupplementSelectedCourse = {
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
  status: string;
  cancel_url: string | null;
  detail_url: string | null;
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
  detail_url: string | null;
};

export type PreselectedCourse = Omit<PreselectCourse, "select_url"> & {
  cancel_url: string;
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
  detail_url: string | null;
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
  detail_url: string | null;
};

export type CourseDetail = {
  html: string;
};

export type CourseResult = {
  course_id: string;
  name: string;
  category: string;
  credits: string;
  weekly_hours: string;
  teacher: string;
  class_id: string;
  department: string;
  classroom_info: string;
  pnp_status: string;
  result: string;
  ip_address: string;
  operation_time: string;
};

export type TimetableCell = {
  text: string;
  background_color: string | null;
};

export type TimetableRow = {
  section: string;
  cells: TimetableCell[];
};

export type Timetable = {
  caption: string | null;
  headers: string[];
  rows: TimetableRow[];
};

export type ElectiveResults = {
  summary: string | null;
  notice: string | null;
  export_url: string | null;
  courses: CourseResult[];
  timetable: Timetable | null;
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
  automation_running: boolean;
  bots: BotView[];
  courses: Course[];
  preselect_courses: PreselectCourse[];
  preselected_courses: PreselectedCourse[];
  plan_courses: PlanCourse[];
  query_courses: QueryCourse[];
  supplement: SupplementPage;
  supplement_captcha_image_b64: string | null;
  supplement_captcha_verified: boolean;
  results: ElectiveResults;
  wishlist: WishlistItem[];
};

export type ConfigPatch = Partial<AppConfig>;

export type MessageEvent = {
  kind: string;
  text: string;
};
