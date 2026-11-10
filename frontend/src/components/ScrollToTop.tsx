import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Back to the page's top. The app shells scroll an inner element (marked `data-scroll-root`), not
 * the window, so resetting only the window did nothing (BUG-58).
 */
export function scrollPageToTop() {
  window.scrollTo(0, 0);
  document.querySelectorAll<HTMLElement>("[data-scroll-root]").forEach((element) => {
    element.scrollTop = 0;
  });
}

/**
 * A new page starts at the top; a change of the query string alone (a tab, a filter) keeps the
 * scroll where it is.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    scrollPageToTop();
  }, [pathname]);

  return null;
}
