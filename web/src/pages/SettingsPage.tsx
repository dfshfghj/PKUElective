import { EmptyState, InputField, PageHeader, PrimaryButton, Surface, formatTimestamp } from "../components";
import { useAppModel } from "../app-model";

export function SettingsPage() {
  const { snapshot, pending, handleConfigToggle, handleConfigNumberSubmit } = useAppModel();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="配置与自动化状态"
        description=""
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Surface title="运行配置" meta="即时写回后端">
          <div className="grid gap-3 sm:grid-cols-3">
            <ToggleTile
              title="Auto Runner"
              active={snapshot.config.auto_refresh}
              onClick={() => void handleConfigToggle("auto_refresh")}
            />
            <ToggleTile
              title="Auto Captcha"
              active={snapshot.config.auto_captcha}
              onClick={() => void handleConfigToggle("auto_captcha")}
            />
            <ToggleTile
              title="Notifications"
              active={snapshot.config.notifications}
              onClick={() => void handleConfigToggle("notifications")}
            />
          </div>

          <form className="mt-5 grid gap-4" onSubmit={handleConfigNumberSubmit}>
            <InputField
              label="Interval ms"
              name="interval_ms"
              type="number"
              defaultValue={snapshot.config.interval_ms}
            />
            <InputField
              label="Timeout ms"
              name="timeout_ms"
              type="number"
              defaultValue={snapshot.config.timeout_ms}
            />
            <div className="pt-1">
              <PrimaryButton disabled={pending !== null} type="submit">
                保存配置
              </PrimaryButton>
            </div>
          </form>
        </Surface>

        <Surface title="自动化 Bot 状态" meta={`${snapshot.bots.length} 个 Bot`}>
          {snapshot.bots.length === 0 ? (
            <EmptyState text="当前还没有自动化 Bot。手动查询和刷新已经不需要 Bot，后续自动化补退选会使用这里的运行器。" />
          ) : (
            <div className="grid gap-3">
              {snapshot.bots.map((bot) => (
                <article
                  key={bot.id}
                  className="rounded-3xl border border-stone-900/8 bg-white/70 p-4 dark:border-stone-800 dark:bg-stone-900/70"
                >
                  <div className="flex items-center justify-between gap-4">
                    <strong className="text-stone-950 dark:text-stone-100">{bot.id}</strong>
                    <span className="rounded-full bg-stone-900/8 px-3 py-1 text-xs font-semibold capitalize text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                      {bot.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-stone-500 dark:text-stone-400">
                    最近刷新：
                    {bot.last_loop_unix_ms ? formatTimestamp(bot.last_loop_unix_ms) : "暂无"}
                  </p>
                  <p className="mt-2 text-sm text-stone-700 dark:text-stone-300">{bot.last_error ?? "无错误信息"}</p>
                </article>
              ))}
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}

function ToggleTile(props: { title: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className={[
        "rounded-2xl border p-5 text-left transition hover:-translate-y-0.5",
        props.active
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
          : "border-stone-200 bg-stone-50 text-stone-700 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300",
      ].join(" ")}
      onClick={props.onClick}
      type="button"
    >
      <p className="text-sm font-medium">{props.title}</p>
      <p className="mt-2 text-xl font-semibold">{props.active ? "ON" : "OFF"}</p>
    </button>
  );
}
