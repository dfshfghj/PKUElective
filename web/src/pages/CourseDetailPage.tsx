import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { fetchCourseDetail } from "../api";
import { EmptyState, PageHeader, SecondaryButton, Surface } from "../components";
import type { CourseDetail } from "../types";

export function CourseDetailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const detailUrl = searchParams.get("url");
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    <div className="space-y-6">
      <PageHeader
        breadcrumb="课程详情"
        title={searchParams.get("name") || "课程详情"}
        actions={<SecondaryButton onClick={() => navigate("/preselect")}>返回预选</SecondaryButton>}
      />
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
  );
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
