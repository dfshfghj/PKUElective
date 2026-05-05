import { useSyncExternalStore } from "react";

export type ThemeMode = "light" | "dark";

const darkMediaQuery = "(prefers-color-scheme: dark)";

function canUseDom() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function getSystemTheme(): ThemeMode {
  if (!canUseDom()) {
    return "light";
  }

  return window.matchMedia(darkMediaQuery).matches ? "dark" : "light";
}

function applyTheme(mode: ThemeMode) {
  if (!canUseDom()) {
    return;
  }

  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.style.colorScheme = mode;
}

export function initializeTheme() {
  applyTheme(getSystemTheme());
}

function subscribe(onStoreChange: () => void) {
  if (!canUseDom()) {
    return () => {};
  }

  const mediaQuery = window.matchMedia(darkMediaQuery);
  const handleChange = () => {
    applyTheme(getSystemTheme());
    onStoreChange();
  };

  applyTheme(getSystemTheme());
  mediaQuery.addEventListener("change", handleChange);
  return () => {
    mediaQuery.removeEventListener("change", handleChange);
  };
}

function getSnapshot() {
  return getSystemTheme();
}

function getServerSnapshot(): ThemeMode {
  return "light";
}

export function useThemeMode() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
