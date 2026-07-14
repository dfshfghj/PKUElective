(() => {
  if (window.HEEDCourseReview) return;

  const STYLE_ELEMENT_ID = "heed-course-review-style";

  const api = {
    installStyle(css) {
      let style = document.getElementById(STYLE_ELEMENT_ID);
      if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ELEMENT_ID;
        (document.head || document.documentElement).appendChild(style);
      }
      style.textContent = String(css ?? "");
    },
    addRootClass(className) {
      const apply = () => document.documentElement.classList.add(className);
      if (document.documentElement) apply();
      else document.addEventListener("DOMContentLoaded", apply, { once: true });
    },
  };

  Object.defineProperty(window, "HEEDCourseReview", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: api,
  });

  window.dispatchEvent(new CustomEvent("heed-course-review-ready", { detail: api }));

  const injectStyle = () => {
    const root = document.head || document.documentElement;

    if (!root) {
      return false;
    }
    const style = document.createElement("style");
    style.id = "my-custom-style";

    style.textContent = `
    [data-bs-theme=dark] {
      --bs-body-bg: transparent;
      --bs-body-color: oklch(0.985 0 0);
      --bs-border-color: oklch(1 0 0 / 10%);
      --background: oklch(0.145 0 0);
      --foreground: oklch(0.985 0 0);
      --card: oklch(0.205 0 0);
      --card-foreground: oklch(0.985 0 0);
      --popover: oklch(0.205 0 0);
      --popover-foreground: oklch(0.985 0 0);
      --primary: oklch(0.922 0 0);
      --primary-foreground: oklch(0.205 0 0);
      --secondary: oklch(0.269 0 0);
      --secondary-foreground: oklch(0.985 0 0);
      --muted: oklch(0.269 0 0);
      --muted-foreground: oklch(0.708 0 0);
      --accent: oklch(0.269 0 0);
      --accent-foreground: oklch(0.985 0 0);
      --destructive: oklch(0.704 0.191 22.216);
      --border: oklch(1 0 0 / 10%);
    }

    [data-bs-theme=light] {
      --background: oklch(1 0 0);
      --foreground: oklch(0.145 0 0);
      --card: oklch(1 0 0);
      --card-foreground: oklch(0.145 0 0);
      --popover: oklch(1 0 0);
      --popover-foreground: oklch(0.145 0 0);
      --primary: oklch(0.205 0 0);
      --primary-foreground: oklch(0.985 0 0);
      --secondary: oklch(0.97 0 0);
      --secondary-foreground: oklch(0.205 0 0);
      --muted: oklch(0.97 0 0);
      --muted-foreground: oklch(0.556 0 0);
      --accent: oklch(0.97 0 0);
      --accent-foreground: oklch(0.205 0 0);
      --destructive: oklch(0.577 0.245 27.325);
      --border: oklch(0.922 0 0);
    }

    body {
      background: var(--background) !important;
    }

    #mobileTopSearchBar,
    nav.navbar,
    .d-none.d-md-block.col-xl-3.col-md-4 {
      display: none !important;
    }
    .col-xl-9.col-md-8.col-sm-12 {
      width: 100% !important;
    }

    #root > div.mt-3.container-fluid > div > div.col-xl-9.col-md-8.col-sm-12 > div > div.d-flex.justify-content-between.align-items-center > h4 > a {
      display: none !important;
    }

    span.course-dept-label {
      background: transparent !important;
      border: none !important;
    }

    .course-dept-dot {
      background: var(--primary) !important;
    }

    .course-stats-panel {
      --course-stats-soft-bg: var(--card) !important;
      --course-stats-muted-bg: var(--card) !important;
      --course-stats-border: var(--border) !important;
      --course-stats-row-border: var(--border) !important;
      --course-stat-warning: var(--destructive) !important;
      --course-term-count-bg: var(--card) !important;
      --course-term-count-border: var(--border) !important;
      --course-term-count-fg: var(--card-foreground) !important;
      --course-term-fall-bg: var(--card) !important;
      --course-term-fall-border: var(--border) !important;
      --course-term-fall-fg: var(--card-foreground) !important;
      --course-term-spring-bg: var(--card) !important;
      --course-term-spring-border: var(--border) !important;
      --course-term-spring-fg: var(--card-foreground) !important;
      --course-term-summer-bg: var(--card) !important;
      --course-term-summer-border: var(--border) !important;
      --course-term-summer-fg: var(--card-foreground) !important;
      --course-term-empty-bg: var(--card) !important;
      --course-term-empty-border: var(--border) !important;
      --course-term-empty-fg: var(--card-foreground) !important;
    }

    .btn-primary {
      --bs-btn-color: var(--primary-foreground) !important;
      --bs-btn-bg: var(--primary) !important;
      --bs-btn-border-color: transparent !important;
      --bs-btn-hover-color: var(--primary-foreground) !important;
      --bs-btn-hover-bg: var(--primary) !important;
      --bs-btn-hover-border-color: transparent !important;
      --bs-btn-focus-shadow-rgb: none !important;
      --bs-btn-active-color: var(--primary-foreground) !important;
      --bs-btn-active-bg: var(--primary) !important;
      --bs-btn-active-border-color: transparent !important;
      --bs-btn-active-shadow: none !important;
      --bs-btn-disabled-color: var(--primary-foreground) !important;
      --bs-btn-disabled-bg: var(--primary) !important;
      --bs-btn-disabled-border-color: transparent !important;
    }

    .btn-secondary {
      --bs-btn-color: var(--secondary-foreground) !important;
      --bs-btn-bg: var(--secondary) !important;
      --bs-btn-border-color: transparent !important;
      --bs-btn-hover-color: var(--secondary-foreground) !important;
      --bs-btn-hover-bg: var(--secondary) !important;
      --bs-btn-hover-border-color: transparent !important;
      --bs-btn-focus-shadow-rgb: none !important;
      --bs-btn-active-color: var(--secondary-foreground) !important;
      --bs-btn-active-bg: var(--secondary) !important;
      --bs-btn-active-border-color: transparent !important;
      --bs-btn-active-shadow: none !important;
      --bs-btn-disabled-color: var(--secondary-foreground) !important;
      --bs-btn-disabled-bg: var(--secondary) !important;
      --bs-btn-disabled-border-color: transparent !important;
    }

    .btn-primary, .btn-primary:not(.disabled):hover, .btn-primary:not(.disabled):active, .btn-primary:focus,
    .btn-secondary, .btn-secondary:not(.disabled):hover, .btn-secondary:not(.disabled):active, .btn-secondary:focus {
      border: none !important;
    }

    .btn-primary:hover, .btn-primary:active, .btn-primary:focus {
      background: var(--primary);
    }
    .btn-secondary:hover, .btn-secondary:active, .btn-secondary:focus {
      background: var(--secondary);
    }

    .btn:not(.disabled):hover {
      margin-top: 0px !important;
    }

    .bg-secondary,
    .badge.rounded-pill.bg-info {
      background:var(--secondary) !important;
      color: var(--secondary-foreground) !important;
    }

    .bg-primary {
      background: var(--primary) !important;
      color: var(--primary-foreground) !important;
    }

    .course-stats-title {
      color:var(--foreground) !important;
    }

    .card {
      --bs-card-bg: var(--card) !important;
      --bs-card-border-color: var(--border) !important;
    }

    .pagination {
      justify-content: center;
    }

    #root > div.mt-3.container-fluid > div > div.col-xl-9.col-md-8.col-sm-12 > div > div.d-flex.justify-content-between.align-items-center > h4 {
      display: none !important;
    }

    .placeholder-bg {
      background: linear-gradient(90deg,var(--secondary) 8%,color-mix(in lch, var(--secondary) 90%, var(--background) 10%) 18%,var(--secondary) 33%) 0 0/1000px 104px !important;
    }

    #root > div.mt-3.container-fluid > div > div.col-xl-9.col-md-8.col-sm-12 > div > div.mt-2.card.border-primary {
      border: none !important;
    }
    #root > div.mt-3.container-fluid > div > div.col-xl-9.col-md-8.col-sm-12 > div > div.mt-2.card.border-primary > div > div.px-2.py-1.text-primary.mb-0.card-title.h5,
    #root > div.mt-3.container-fluid > div > div.col-xl-9.col-md-8.col-sm-12 > div > div.mt-2.card.border-primary > div > div.px-2.py-1.text-primary.mb-1.card-title.h5{
      color: var(--foreground) !important;
    }
  `;

    document.documentElement.appendChild(style);
    return true;
  }
  if (injectStyle()) {
    return;
  }

  const observer = new MutationObserver(() => {
    if (injectStyle()) {
      observer.disconnect();
    }
  });

  observer.observe(document, {
    childList: true,
  });
})();
