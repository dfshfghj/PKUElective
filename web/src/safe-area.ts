interface AndroidSafeAreaBridge {
  getInsets(): string;
}

const MOBILE_BREAKPOINT = 768;

declare global {
  interface Window {
    __TAURI_ANDROID_SAFE_AREA__?: AndroidSafeAreaBridge;
    __applyAndroidSafeAreaInsets?: (
      top: number,
      right: number,
      bottom: number,
      left: number,
    ) => void;
  }
}

function applyAndroidSafeAreaInsets(
  top: number,
  right: number,
  bottom: number,
  left: number,
) {
  const rootStyle = document.documentElement.style;
  rootStyle.setProperty("--safe-area-top", `${top}px`);
  rootStyle.setProperty("--safe-area-right", `${right}px`);
  rootStyle.setProperty("--safe-area-bottom", `${bottom}px`);
  rootStyle.setProperty("--safe-area-left", `${left}px`);
}

export function initializeSafeArea() {
  const bridge = window.__TAURI_ANDROID_SAFE_AREA__;
  const root = document.documentElement;
  const compactViewport = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
  const mobilePlatform = Boolean(bridge);

  root.classList.toggle("mobile-platform", mobilePlatform);
  const updateMobileLayout = () => {
    root.classList.toggle("mobile-layout", mobilePlatform || compactViewport.matches);
  };
  compactViewport.addEventListener("change", updateMobileLayout);
  updateMobileLayout();

  if (!bridge) return;

  window.__applyAndroidSafeAreaInsets = applyAndroidSafeAreaInsets;

  const insets = bridge.getInsets().split(",").map(Number);
  if (insets.length === 4 && insets.every(Number.isFinite)) {
    applyAndroidSafeAreaInsets(insets[0], insets[1], insets[2], insets[3]);
  }
}

export function isMobilePlatform() {
  return document.documentElement.classList.contains("mobile-platform");
}
