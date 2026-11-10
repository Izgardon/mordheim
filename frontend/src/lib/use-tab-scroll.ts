import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/** The element the page scrolls in: the app shell's `data-scroll-root`, else the document. */
function scrollAreaOf(node: HTMLElement): HTMLElement {
  return (
    node.closest<HTMLElement>("[data-scroll-root]") ??
    (document.scrollingElement as HTMLElement | null) ??
    document.documentElement
  );
}

/** The sticky box holding the bar inside its scroll area (the Aftermath's header on a phone). */
function stickyBox(bar: HTMLElement, area: HTMLElement) {
  for (let node: HTMLElement | null = bar; node && node !== area; node = node.parentElement) {
    if (getComputedStyle(node).position === "sticky") return node;
  }
  return null;
}

/**
 * Where the scroll area goes once the tab changes (`top`), the page column the bar is in and the
 * height it needs for that (a shorter tab would pull the page up to make it fit).
 */
export type TabLanding = {
  area: HTMLElement;
  column: HTMLElement | null;
  top: number;
  height: number;
};

/**
 * Where a tab change from `bar` leaves the page (William, 8 Nov 2026: "it should only put the tab
 * line to the top of the screen"): the bar at the top of the scroll area, just under the app's top
 * bar, so the tab's content starts right under it; for a sticky bar, its content right under the
 * stuck box. A bar picked from at or above that point stays where it is (`always` off), so the
 * page never jumps down to it; `always` (Next and Back) lands it there wherever it is.
 */
export function tabLanding(bar: HTMLElement, always: boolean): TabLanding {
  const area = scrollAreaOf(bar);
  const inDocument = area === document.scrollingElement || area === document.documentElement;
  const areaTop = inDocument ? 0 : area.getBoundingClientRect().top;
  const sticky = stickyBox(bar, area);
  const content = sticky ? (sticky.nextElementSibling as HTMLElement | null) : bar;
  const offset = content ? content.getBoundingClientRect().top - areaTop : 0;
  const under = sticky && content ? sticky.getBoundingClientRect().bottom - areaTop : 0;
  const wanted = Math.max(0, area.scrollTop + offset - under);
  const top = always || (!sticky && wanted > area.scrollTop) ? wanted : area.scrollTop;
  const column =
    (Array.from(area.children).find((child) => child.contains(bar)) as HTMLElement | undefined) ??
    null;
  const columnTop = column ? area.scrollTop + column.getBoundingClientRect().top - areaTop : 0;
  return { area, column, top, height: top + area.clientHeight - columnTop };
}

/**
 * A page's tabs: put `barRef` on the tab bar and call `pick` as a tab is picked from it (`reveal`
 * from Next or Back). After the change the bar sits at the top of the screen with the new tab's
 * content under it (`tabLanding`), never at the page's top: when the new tab is too short for
 * that, the page column keeps the height it needs until the page goes.
 */
export function useTabScroll<T extends HTMLElement = HTMLDivElement>() {
  const barRef = useRef<T>(null);
  const [landing, setLanding] = useState<TabLanding | null>(null);
  const stretched = useRef(new Set<HTMLElement>());

  useLayoutEffect(() => {
    if (!landing) return;
    const { area, column, top, height } = landing;
    if (column && column.offsetHeight < height) {
      column.style.minHeight = `${Math.ceil(height)}px`;
      stretched.current.add(column);
    }
    area.scrollTop = top;
  }, [landing]);

  useEffect(() => {
    const columns = stretched.current;
    return () => {
      columns.forEach((column) => column.style.removeProperty("min-height"));
      columns.clear();
    };
  }, []);

  const land = useCallback((always: boolean) => {
    if (barRef.current) setLanding(tabLanding(barRef.current, always));
  }, []);
  const pick = useCallback(() => land(false), [land]);
  const reveal = useCallback(() => land(true), [land]);
  return { barRef, pick, reveal };
}
