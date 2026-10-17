import { Fragment, useCallback, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import siteBackground from "@/assets/background/site_background.webp";
import { cn } from "@/lib/utils";
import { refreshMobileQueries, reloadMobileLayout } from "./mobile-refresh";
import { usePullToRefresh } from "./use-pull-to-refresh";

type MobileLayoutProps = {
  /** Pull-to-refresh refreshes this campaign's data (all data when omitted). */
  campaignId?: number;
  topBar?: ReactNode;
  topBarOffset?: string;
  bottomNav?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export default function MobileLayout({
  campaignId,
  topBar,
  topBarOffset,
  bottomNav,
  children,
  className,
  contentClassName,
}: MobileLayoutProps) {
  const queryClient = useQueryClient();
  const hasTopBar = Boolean(topBar);
  // Bumped after a refresh to remount the page, so screens whose data is not in the query cache
  // yet (overview tabs, the warband sheet, battle state) reload it as they did after a full reload.
  const [contentGeneration, setContentGeneration] = useState(0);
  const contentPaddingBottom = bottomNav
    ? "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)"
    : "env(safe-area-inset-bottom, 0px)";
  const contentPaddingTop = hasTopBar
    ? undefined
    : (topBarOffset ?? "calc(env(safe-area-inset-top, 0px) + 4.75rem)");

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

  const { scrollRef, pullDistance, isPulling, showRefreshPrompt, refreshLabel } = usePullToRefresh({
    enabled: true,
    onRefresh: refreshContent,
  });

  return (
    <main
      className={cn("fixed inset-0 flex flex-col overflow-hidden bg-transparent", className)}
      style={{
        backgroundImage: `radial-gradient(420px 320px at 0% 0%, rgba(57, 255, 77, 0.18), transparent 60%),
          radial-gradient(520px 380px at 100% 0%, rgba(57, 255, 77, 0.14), transparent 62%),
          radial-gradient(520px 380px at 0% 100%, rgba(57, 255, 77, 0.12), transparent 62%),
          radial-gradient(520px 380px at 100% 100%, rgba(57, 255, 77, 0.16), transparent 62%),
          url(${siteBackground})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundAttachment: "scroll",
      }}
    >
      {topBar ? <div className="shrink-0">{topBar}</div> : null}
      <div
        ref={scrollRef}
        data-testid="mobile-layout-scroll"
        className={cn(
          "scrollbar-hidden flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-0 pb-4",
          hasTopBar ? "pt-0" : "pt-3",
          contentClassName
        )}
        style={{
          paddingBottom: contentPaddingBottom,
          ...(contentPaddingTop ? { paddingTop: contentPaddingTop } : {}),
        }}
      >
        {showRefreshPrompt ? (
          <div
            className="pointer-events-none flex justify-center px-4 pt-2"
            role="status"
            aria-live="polite"
          >
            <div className="rounded-full border border-[#6d573e] bg-[#17110b]/95 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#e4d5bb] shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
              {refreshLabel}
            </div>
          </div>
        ) : null}
        <div
          className={cn("px-1.5", isPulling ? "" : "transition-transform duration-200 ease-out")}
          style={{ transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined }}
        >
          <Fragment key={contentGeneration}>{children}</Fragment>
        </div>
      </div>
      {bottomNav}
    </main>
  );
}
