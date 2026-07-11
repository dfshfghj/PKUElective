import {
  PageHeader,
  SecondaryButton,
  Surface,
} from "../components";
import { useAppModel } from "../app-model";

export function DashboardPage() {
  const {
    snapshot,
    pending,
    loading,
    handleRefresh,
    syncSnapshot,
  } = useAppModel();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb="概览"
        title="概览"
        description=""
        actions={
          <>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Surface title="当前会话">
          <div className="grid gap-4">
            <div className="rounded-2xl bg-stone-100 p-5 dark:bg-stone-900">
              <p className="text-sm text-stone-500 dark:text-stone-400">当前账号</p>
              <p className="mt-2 text-2xl font-semibold text-stone-950 dark:text-stone-100">
                {snapshot.auth.username ?? "未登录"}
              </p>
            </div>
          </div>
        </Surface>

        <Surface title="快速控制">
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-1">
              <SecondaryButton
                disabled={!snapshot.auth.logged_in || pending !== null}
                onClick={() => void handleRefresh()}
              >
                同步课程数据
              </SecondaryButton>
            </div>
            <dl className="grid gap-3 rounded-3xl bg-stone-100/80 p-5 text-sm text-stone-700 dark:bg-stone-900/80 dark:text-stone-300">
              <div className="flex items-center justify-between gap-4">
                <dt>Bot 数量</dt>
                <dd className="font-semibold text-stone-950 dark:text-stone-100">{snapshot.bots.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>课程快照</dt>
                <dd className="font-semibold text-stone-950 dark:text-stone-100">{snapshot.courses.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>Wishlist</dt>
                <dd className="font-semibold text-stone-950 dark:text-stone-100">{snapshot.wishlist.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>已出结果课程</dt>
                <dd className="font-semibold text-stone-950 dark:text-stone-100">{snapshot.results.courses.length}</dd>
              </div>
            </dl>
          </div>
        </Surface>
      </div>

    </div>
  );
}
