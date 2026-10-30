import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import indexHtml from "../../index.html?raw";
import themeInitScript from "../../public/theme-init.js?raw";
import { THEME_STORAGE_KEY, currentTheme, readStoredTheme, setTheme, useTheme } from "./theme";

const runThemeInit = () => new Function(themeInitScript)();

function blockStorage() {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("SecurityError");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("SecurityError");
  });
}

describe("theme", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is dark by default, with nothing stored", () => {
    expect(readStoredTheme()).toBe("dark");
    expect(currentTheme()).toBe("dark");
    expect(renderHook(() => useTheme()).result.current.theme).toBe("dark");
  });

  it("toggles between dark and light on <html>", () => {
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    expect(result.current.theme).toBe("light");

    act(() => result.current.toggleTheme());
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(result.current.theme).toBe("dark");
  });

  it("keeps the choice for this device", () => {
    setTheme("light");

    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
    expect(readStoredTheme()).toBe("light");
  });

  it("still switches when storage is blocked, and reads blocked storage as dark", () => {
    blockStorage();

    expect(() => setTheme("light")).not.toThrow();
    expect(currentTheme()).toBe("light");
    expect(readStoredTheme()).toBe("dark");
  });
});

describe("theme-init.js (before the first paint)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("puts the stored light choice on <html>, under the key the app writes", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");

    runThemeInit();

    expect(document.documentElement).toHaveAttribute("data-theme", "light");
  });

  it("falls back to dark for nothing stored, a stray value or blocked storage", () => {
    runThemeInit();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    runThemeInit();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");

    blockStorage();
    expect(runThemeInit).not.toThrow();
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  });

  it("is loaded in <head>, as a plain blocking script, before the app's module", () => {
    const head = indexHtml.slice(0, indexHtml.indexOf("</head>"));
    const initTag = '<script src="/theme-init.js"></script>';

    expect(head).toContain(initTag);
    expect(indexHtml.indexOf(initTag)).toBeLessThan(indexHtml.indexOf('type="module"'));
  });
});
