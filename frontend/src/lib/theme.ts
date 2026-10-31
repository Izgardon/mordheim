import { useCallback, useSyncExternalStore } from "react";

/**
 * Light or dark, per device. `public/theme-init.js` puts the stored choice on <html> as
 * `data-theme` before the first paint (it duplicates the key, the default and the bar colours
 * below: keep them in step); after that this module owns the attribute, the browser bar's
 * `theme-color` and the stored value.
 */
export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "mordheim_theme";
export const DEFAULT_THEME: Theme = "dark";
/** The browser bar's colour for each theme: design E's --color-page (index.html, theme-init.js). */
export const THEME_BAR_COLORS: Record<Theme, string> = { dark: "#0f0c09", light: "#e8dfd0" };

const listeners = new Set<() => void>();

/** The stored choice, or dark when there is none or storage can't be read (private mode). */
export function readStoredTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY) === "light" ? "light" : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** The theme the page shows now: what <html> says. */
export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : DEFAULT_THEME;
}

/** Shows `theme` and keeps it for this device; storage failing only loses the memory of it. */
export function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_BAR_COLORS[theme]);
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode or full storage: the choice holds until the page reloads.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The current theme and a toggle, re-rendering when either changes it. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => DEFAULT_THEME);
  const toggleTheme = useCallback(
    () => setTheme(currentTheme() === "light" ? "dark" : "light"),
    []
  );
  return { theme, setTheme, toggleTheme };
}
