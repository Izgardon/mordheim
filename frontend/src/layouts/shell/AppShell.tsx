import { Fragment, useCallback, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { refreshMobileQueries, reloadMobileLayout } from "../mobile/mobile-refresh";
import { usePullToRefresh } from "../mobile/use-pull-to-refresh";

type AppShellProps = {
  variant: "mobile" | "desktop";
  children: ReactNode;
  /** Desktop: the nav rail. */
  rail?: ReactNode;
  /** Mobile: the bar above the page. */
  topBar?: ReactNode;
  /** Mobile: the bar below the page (the bottom nav, or the battle tools). */
  bottomNav?: ReactNode;
  /** Mobile: pull-to-refresh refreshes this campaign's data (all data when omitted). */
  campaignId?: number;
};

/**
 * The campaign shell for both breakpoints (design E): the rail beside the page on the web; the top
 * bar, the page and the bottom nav stacked on a phone. Only the chrome changes with `variant`: the
 * page sits at the same position in the tree either way, so crossing 960 px restyles the frame
 * instead of unmounting the page and its unsaved state (BUG-23).
 */
export default function AppShell({
  variant,
  children,
  rail,
  topBar,
  bottomNav,
  campaignId,
}: AppShellProps) {
  const isMobile = variant === "mobile";
  const queryClient = useQueryClient();
  // Bumped after a pull-to-refresh to remount the page, so screens whose data is not in the
  // query cache yet reload it.
  const [contentGeneration, setContentGeneration] = useState(0);

  const refreshContent = useCallback(async () => {
    try {
      await refreshMobileQueries(queryClient, campaignId);
    } catch {
      reloadMobileLayout();
      return new Promise<void>(() => undefined); // the page is reloading
    }
    // Remount only once the queries have settled: unmounting their observers mid-fetch would
    // cancel and repeat those requests.
    setContentGeneration((generation) => generation + 1);
  }, [campaignId, queryClient]);

  const pull = usePullToRefresh({ enabled: isMobile, onRefresh: refreshContent });

  return (
    <main
      className={isMobile ? "fixed inset-0 flex flex-col overflow-hidden bg-page" : "desktop-shell"}
    >
      {isMobile ? null : <aside className="desktop-shell__rail">{rail}</aside>}
      {isMobile && topBar ? <div className="shrink-0">{topBar}</div> : null}
      <div className={isMobile ? "flex min-h-0 flex-1 flex-col" : "desktop-shell__main"}>
        <div
          ref={pull.scrollRef}
          data-scroll-root=""
          data-testid="shell-scroll"
          className={
            isMobile
              ? "scrollbar-hidden min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain pb-4"
              : "desktop-shell__content"
          }
        >
          {isMobile && pull.showRefreshPrompt ? (
            <div
              className="pointer-events-none flex justify-center px-4 pt-2"
              role="status"
              aria-live="polite"
            >
              <div className="border border-accent-line bg-panel px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-accent-hi">
                {pull.refreshLabel}
              </div>
            </div>
          ) : null}
          <div
            className={
              isMobile
                ? cn("px-3", pull.isPulling ? "" : "transition-transform duration-200 ease-out")
                : "desktop-shell__content-inner"
            }
            style={
              isMobile && pull.pullDistance > 0
                ? { transform: `translateY(${pull.pullDistance}px)` }
                : undefined
            }
          >
            <Fragment key={contentGeneration}>{children}</Fragment>
          </div>
        </div>
      </div>
      {isMobile && bottomNav ? (
        <div className="shrink-0 pb-[env(safe-area-inset-bottom,0px)]">{bottomNav}</div>
      ) : null}
    </main>
  );
}
