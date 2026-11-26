import { useLayoutEffect, useRef, type DependencyList } from "react";

/** The smallest a shrunk line goes: below this a value stops being readable. */
const SMALLEST = 11;

/** Marks each one-line value inside the row that shares the row's size. */
export const FIT_VALUE = "data-fit-value";

/**
 * Keeps a row of one-line values on one line each, all at one size (William, 22 Nov 2026: "I
 * would rather the text shrank ... data should try and stay on one line"; 26 Nov 2026: Rating's
 * and Units' values the size of Cost's): at `largest` px while every value fits, else the size
 * the tightest fits at. Give each value `whitespace-nowrap`, `overflow-hidden` and the
 * `FIT_VALUE` attribute, and size any smaller text inside it in `em`, so all of it shrinks
 * together. `deps` are what can change the text.
 */
export function useFitRow<T extends HTMLElement>(largest: number, deps: DependencyList) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const row = ref.current;
    if (!row) return;
    const fit = () => {
      const values = Array.from(row.querySelectorAll<HTMLElement>(`[${FIT_VALUE}]`));
      values.forEach((value) => (value.style.fontSize = `${largest}px`));
      const size = values.reduce((smallest, value) => {
        const room = value.clientWidth;
        const natural = value.scrollWidth;
        if (room <= 0 || natural <= room) return smallest;
        return Math.min(smallest, Math.floor((largest * room * 10) / natural) / 10);
      }, largest);
      const shown = Math.max(SMALLEST, size);
      values.forEach((value) => (value.style.fontSize = `${shown}px`));
    };
    fit();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(row);
    return () => observer?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` are the caller's text
  }, [largest, ...deps]);
  return ref;
}
