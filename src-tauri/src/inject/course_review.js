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
    body {
      background: oklch(1 0 0) !important;
    }

    [data-bs-theme=dark] body {
      background: oklch(0.145 0 0) !important;
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

    [data-bs-theme=dark] .card {
     --bs-card-bg: oklch(0.205 0 0);
    --bs-card-border-color: oklch(1 0 0 / 10%);
    }

    [data-bs-theme=light] .card {
     --bs-card-bg: oklch(1 0 0);
    --bs-card-border-color: oklch(0.922 0 0);
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
