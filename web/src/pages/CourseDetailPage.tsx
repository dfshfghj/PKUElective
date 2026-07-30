import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { isTauri } from "@tauri-apps/api/core";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  closeCourseReviewWebview,
  fetchCourseDetail,
  findCourseReview,
  hideCourseReviewWebview,
  openCourseReviewWebview,
  resizeCourseReviewWebview,
  showCourseReviewWebview,
  type CourseReviewMatch,
  type WebviewBounds,
} from "../api";
import { EmptyState, PageHeader, SecondaryButton, Surface } from "../components";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import type { CourseDetail } from "../types";

export function CourseDetailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const detailUrl = searchParams.get("url");
  const courseName = searchParams.get("name") || "";
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"detail" | "review">("detail");
  const detailHtml = useMemo(() => (detail ? sanitizeCourseDetailHtml(detail.html) : ""), [detail]);

  useEffect(() => {
    if (!detailUrl) {
      setError("缺少课程详情链接，请从课程列表进入。");
      return;
    }

    let cancelled = false;
    setDetail(null);
    setError(null);
    void fetchCourseDetail(detailUrl)
      .then((result) => {
        if (!cancelled) setDetail(result);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "课程详情加载失败。");
      });

    return () => {
      cancelled = true;
    };
  }, [detailUrl]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 sm:gap-4">
      <PageHeader
        breadcrumb="课程详情"
        title={searchParams.get("name") || "课程详情"}
      />
      <div className="flex w-full shrink-0 items-center rounded-lg border border-stone-200 bg-white/80 p-1 sm:w-fit dark:border-stone-800 dark:bg-stone-900/80">
        <Button className="flex-1 sm:flex-none" onClick={() => setActiveTab("detail")} size="sm" variant={activeTab === "detail" ? "default" : "ghost"}>
          课程详情
        </Button>
        <Button className="flex-1 sm:flex-none" onClick={() => setActiveTab("review")} size="sm" variant={activeTab === "review" ? "default" : "ghost"}>
          课程测评
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <div className={activeTab === "detail" ? "h-full" : "hidden"}>
          <ScrollArea className="h-full w-full" viewportClassName="overscroll-contain">
            <div className="pb-2 sm:pr-3">
              <Surface>
                {error ? (
                  <EmptyState text={error} />
                ) : detail ? (
                  <div
                    className="course-detail-content overflow-hidden bg-transparent text-sm text-stone-800 dark:text-stone-200"
                    dangerouslySetInnerHTML={{ __html: detailHtml }}
                  />
                ) : (
                  <div className="py-16 text-center text-sm text-stone-500 dark:text-stone-400">正在加载课程详情…</div>
                )}
              </Surface>
            </div>
          </ScrollArea>
        </div>
        <div className={activeTab === "review" ? "h-full" : "hidden"}>
          <CourseReviewPanel active={activeTab === "review"} courseName={courseName} />
        </div>
      </div>
    </div>
  );
}

function CourseReviewPanel({ active, courseName }: { active: boolean; courseName: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);
  const openedCourseIdRef = useRef<number | null>(null);
  const [candidates, setCandidates] = useState<CourseReviewMatch[]>([]);
  const [exactMatch, setExactMatch] = useState(false);
  const [match, setMatch] = useState<CourseReviewMatch | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "browser" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    if (!courseName) {
      setStatus("missing");
      return;
    }
    setStatus("loading");
    void findCourseReview(courseName)
      .then((result) => {
        if (cancelled) return;
        setCandidates(result.matches);
        setExactMatch(result.exact);
        setMatch(result.matches[0] ?? null);
        setStatus(result.matches.length ? "ready" : "missing");
      })
      .catch(() => {
        if (!cancelled) setStatus(isTauri() ? "error" : "browser");
      });
    return () => {
      cancelled = true;
    };
  }, [courseName]);

  useEffect(() => {
    if (!match || !active || !containerRef.current || !isTauri()) {
      if (openedRef.current && !active) void hideCourseReviewWebview();
      return;
    }
    let cancelled = false;
    const container = containerRef.current;
    const updateBounds = () => {
      if (cancelled) return;
      void resizeCourseReviewWebview(boundsForElement(container));
    };
    const bounds = boundsForElement(container);
    if (openedRef.current && openedCourseIdRef.current === match.courseId) {
      void resizeCourseReviewWebview(bounds).then(showCourseReviewWebview).catch(() => {
        if (!cancelled) setStatus("error");
      });
    } else {
      void openCourseReviewWebview(match.courseId, bounds)
        .then(() => {
          openedRef.current = true;
          openedCourseIdRef.current = match.courseId;
          if (cancelled) {
            void hideCourseReviewWebview();
          }
        })
        .catch(() => {
          if (!cancelled) setStatus("error");
        });
    }
    const observer = new ResizeObserver(updateBounds);
    observer.observe(container);
    window.addEventListener("resize", updateBounds);

    return () => {
      cancelled = true;
      observer.disconnect();
      window.removeEventListener("resize", updateBounds);
    };
  }, [active, match]);

  useEffect(() => () => {
    openedRef.current = false;
    openedCourseIdRef.current = null;
    void closeCourseReviewWebview();
  }, []);

  return (
    <div className="flex h-full min-h-[320px] flex-col gap-3">
      {!exactMatch && candidates.length > 0 ? (
        <div className="flex h-11 shrink-0 items-center rounded-xl border gap-2">
          <span className="hidden shrink-0 text-xs sm:inline">相近课程</span>
          <Button aria-label="上一个相近课程" className="h-7 w-7 shrink-0" onClick={() => selectRelativeCandidate(-1)} size="icon" variant="ghost">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1 truncate text-center text-sm text-stone-800 dark:text-stone-200">
            {match?.courseName}
          </div>
          <span className="shrink-0 text-xs tabular-nums text-stone-500 dark:text-stone-400">
            {match ? candidates.findIndex((candidate) => candidate.courseId === match.courseId) + 1 : 0}/{candidates.length}
          </span>
          <Button aria-label="下一个相近课程" className="h-7 w-7 shrink-0" onClick={() => selectRelativeCandidate(1)} size="icon" variant="ghost">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
      <div
        className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900"
        ref={containerRef}
      >
        {status === "loading" ? <ReviewMessage>正在匹配并加载课程测评…</ReviewMessage> : null}
        {status === "missing" ? <ReviewMessage>暂未找到“{courseName}”的课程测评。</ReviewMessage> : null}
        {status === "browser" ? <ReviewMessage>课程测评仅在桌面应用中嵌入显示。</ReviewMessage> : null}
        {status === "error" ? <ReviewMessage>课程测评加载失败，请稍后重试。</ReviewMessage> : null}
      </div>
    </div>
  );

  function selectRelativeCandidate(offset: number) {
    if (!match || candidates.length === 0) return;
    const currentIndex = candidates.findIndex((candidate) => candidate.courseId === match.courseId);
    const nextIndex = (Math.max(currentIndex, 0) + offset + candidates.length) % candidates.length;
    setStatus("ready");
    setMatch(candidates[nextIndex]);
  }
}

function ReviewMessage({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full items-center justify-center px-6 text-center text-sm text-stone-500 dark:text-stone-400">{children}</div>;
}

function boundsForElement(element: HTMLElement): WebviewBounds {
  const rect = element.getBoundingClientRect();
  return { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
}

function sanitizeCourseDetailHtml(html: string) {
  const document = new DOMParser().parseFromString(html, "text/html");
  document
    .querySelectorAll("script, style, link, base, iframe, form, button, input, select, textarea")
    .forEach((node) => node.remove());

  document.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      const name = attribute.name.toLowerCase();
      if (name.startsWith("on") || name === "style" || name === "target") {
        element.removeAttribute(attribute.name);
      }
    });

    if (element instanceof HTMLAnchorElement) {
      element.removeAttribute("href");
    }

    if (element instanceof HTMLImageElement && element.getAttribute("src")) {
      element.src = new URL(element.getAttribute("src")!, "https://elective.pku.edu.cn/").toString();
    }
  });

  return document.body.innerHTML;
}
