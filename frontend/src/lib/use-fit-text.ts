import { useLayoutEffect, useRef, type DependencyList } from "react";

/** The smallest a shrunk line goes: below this a value stops being readable. */
const SMALLEST = 11;

/**
 * Keeps a one-line element on one line by shrinking its font (William, 22 Nov 2026: "I would
 * rather the text shrank ... data should try and stay on one line"): at `largest` px when it
 * fits, else scaled down to its width. Give the element `whitespace-nowrap` and `overflow-hidden`,
 * and size any smaller text inside it in `em`, so all of it shrinks together. `deps` are what can
 * change the text.
 */
export function useFitText<T extends HTMLElement>(largest: number, deps: DependencyList) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fit = () => {
      element.style.fontSize = `${largest}px`;
      const room = element.clientWidth;
      const natural = element.scrollWidth;
      if (room > 0 && natural > room) {
        const size = Math.max(SMALLEST, Math.floor((largest * room * 10) / natural) / 10);
        element.style.fontSize = `${size}px`;
      }
    };
    fit();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(fit);
    observer?.observe(element.parentElement ?? element);
    return () => observer?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` are the caller's text
  }, [largest, ...deps]);
  return ref;
}
