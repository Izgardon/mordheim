import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * A new page starts at the top. The app shells scroll an inner element (marked
 * `data-scroll-root`), not the window, so resetting only the window did nothing (BUG-58).
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    document.querySelectorAll<HTMLElement>("[data-scroll-root]").forEach((element) => {
      element.scrollTop = 0;
    });
  }, [pathname]);

  return null;
}
