import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const PULL_TRIGGER = 64;
const PULL_MAX = 96;
const PULL_RESISTANCE = 0.5;
const REFRESH_HOLD = 44;

type PullToRefreshOptions = {
  enabled: boolean;
  busy?: boolean;
  onRefresh: () => Promise<unknown> | undefined;
  viewportId?: string;
};

export function usePullToRefresh({
  enabled,
  busy = false,
  onRefresh,
  viewportId = "app-main-scroll-viewport",
}: PullToRefreshOptions) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const refreshingRef = useRef(false);
  const pullRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const viewport = document.getElementById(viewportId);
    if (!viewport) return;

    let startY = 0;
    let tracking = false;

    const resetPull = () => {
      tracking = false;
      pullRef.current = 0;
      setPull(0);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (refreshingRef.current || viewport.scrollTop > 0) return;
      startY = event.touches[0].clientY;
      tracking = true;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!tracking) return;
      if (viewport.scrollTop > 0) {
        resetPull();
        return;
      }
      const delta = event.touches[0].clientY - startY;
      if (delta <= 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      if (event.cancelable) event.preventDefault();
      const next = Math.min(PULL_MAX, delta * PULL_RESISTANCE);
      pullRef.current = next;
      setPull(next);
    };

    const handleTouchEnd = () => {
      if (!tracking) return;
      const shouldRefresh = pullRef.current >= PULL_TRIGGER;
      resetPull();
      if (!shouldRefresh || refreshingRef.current || busyRef.current) return;
      refreshingRef.current = true;
      setRefreshing(true);
      void Promise.resolve(onRefreshRef.current()).finally(() => {
        refreshingRef.current = false;
        setRefreshing(false);
      });
    };

    viewport.addEventListener("touchstart", handleTouchStart, { passive: true });
    viewport.addEventListener("touchmove", handleTouchMove, { passive: false });
    viewport.addEventListener("touchend", handleTouchEnd);
    viewport.addEventListener("touchcancel", resetPull);

    return () => {
      viewport.removeEventListener("touchstart", handleTouchStart);
      viewport.removeEventListener("touchmove", handleTouchMove);
      viewport.removeEventListener("touchend", handleTouchEnd);
      viewport.removeEventListener("touchcancel", resetPull);
    };
  }, [enabled, viewportId]);

  return { pull, refreshing, triggered: pull >= PULL_TRIGGER };
}

export function PullToRefreshIndicator(props: {
  pull: number;
  refreshing: boolean;
}) {
  const { pull, refreshing } = props;
  const offset = refreshing ? REFRESH_HOLD : pull;
  const progress = Math.min(1, pull / PULL_TRIGGER);
  const visible = refreshing || pull > 0;

  return (
    <div
      aria-hidden={!visible}
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center"
      style={{
        opacity: visible ? 1 : 0,
        transform: `translateY(${offset}px)`,
        transition:
          pull === 0 ? "transform 200ms ease-out, opacity 200ms ease-out" : undefined,
      }}
    >
      <div className="flex size-8 items-center justify-center rounded-full border border-stone-200 bg-white shadow-sm dark:border-stone-700 dark:bg-stone-900">
        <RefreshCw
          className={refreshing ? "size-4 animate-spin text-stone-500 dark:text-stone-400" : "size-4 text-stone-500 dark:text-stone-400"}
          style={
            refreshing
              ? undefined
              : { opacity: 0.35 + progress * 0.65, transform: `rotate(${progress * 270}deg)` }
          }
        />
      </div>
      <span className="sr-only">{refreshing ? "正在刷新" : "下拉刷新"}</span>
    </div>
  );
}
