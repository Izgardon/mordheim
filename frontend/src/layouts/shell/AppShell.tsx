import { Fragment, useCallback, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import siteBackground from "@/assets/background/site_background.webp";
import { cn } from "@/lib/utils";
import { refreshMobileQueries, reloadMobileLayout } from "../mobile/mobile-refresh";
import { usePullToRefresh } from "../mobile/use-pull-to-refresh";

type AppShellProps = {
  variant: "mobile" | "desktop";
  children: ReactNode;
  /** Desktop: the side rail. */
  navbar?: ReactNode;
  /** Desktop: the top bar. */
  desktopTopBar?: ReactNode;
  /** Mobile: pull-to-refresh refreshes this campaign's data (all data when omitted). */
  campaignId?: number;
  mobileTopBar?: ReactNode;
  topBarOffset?: string;
  bottomNav?: ReactNode;
  contentClassName?: string;
};

const backgroundBase = {
  backgroundSize: "cover",
  backgroundPosition: "center",
  backgroundRepeat: "no-repeat",
  backgroundAttachment: "scroll",
} satisfies CSSProperties;

const mobileBackground: CSSProperties = {
  ...backgroundBase,
  backgroundImage: `radial-gradient(420px 320px at 0% 0%, rgba(57, 255, 77, 0.18), transparent 60%),
    radial-gradient(520px 380px at 100% 0%, rgba(57, 255, 77, 0.14), transparent 62%),
    radial-gradient(520px 380px at 0% 100%, rgba(57, 255, 77, 0.12), transparent 62%),
    radial-gradient(520px 380px at 100% 100%, rgba(57, 255, 77, 0.16), transparent 62%),
    url(${siteBackground})`,
};

const desktopBackground: CSSProperties = {
  ...backgroundBase,
  backgroundImage: `radial-gradient(560px 400px at 4% 8%, rgba(92, 255, 118, 0.18), transparent 62%),
    radial-gradient(640px 460px at 96% 10%, rgba(76, 255, 132, 0.14), transparent 64%),
    radial-gradient(620px 440px at 10% 82%, rgba(70, 255, 124, 0.11), transparent 66%),
    radial-gradient(700px 500px at 92% 84%, rgba(72, 255, 128, 0.13), transparent 68%),
    radial-gradient(480px 320px at 50% 38%, rgba(124, 255, 156, 0.06), transparent 70%),
    radial-gradient(360px 220px at 34% 58%, rgba(92, 255, 118, 0.05), transparent 72%),
    linear-gradient(rgba(28, 24, 18, 0.08), rgba(16, 13, 10, 0.16)),
    url(${siteBackground})`,
};

/**
 * The campaign shell for both breakpoints. Only the chrome changes with `variant`: the page sits
 * at the same position in the tree either way, so crossing 960 px (tablet rotation, window
 * resize) restyles the frame instead of unmounting the page and its unsaved state (BUG-23).
 * Every slot keeps its index, with `null` standing in for chrome the variant doesn't have.
 */
export default function AppShell({
  variant,
  children,
  navbar,
  desktopTopBar,
  campaignId,
  mobileTopBar,
  topBarOffset,
  bottomNav,
  contentClassName,
}: AppShellProps) {
  const isMobile = variant === "mobile";
  const queryClient = useQueryClient();
  // Bumped after a pull-to-refresh to remount the page, so screens whose data is not in the
  // query cache yet (overview tabs, the warband sheet, battle state) reload it.
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

  const hasMobileTopBar = Boolean(mobileTopBar);
  const mobileScrollStyle: CSSProperties = {
    paddingBottom: bottomNav
      ? "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)"
      : "env(safe-area-inset-bottom, 0px)",
    ...(hasMobileTopBar
      ? {}
      : { paddingTop: topBarOffset ?? "calc(env(safe-area-inset-top, 0px) + 4.75rem)" }),
  };

  return (
    <main
      className={
        isMobile ? "fixed inset-0 flex flex-col overflow-hidden bg-transparent" : "desktop-shell"
      }
      style={isMobile ? mobileBackground : desktopBackground}
    >
      {isMobile ? null : <aside className="desktop-shell__rail">{navbar}</aside>}
      {isMobile ? (
        hasMobileTopBar ? (
          <div className="shrink-0">{mobileTopBar}</div>
        ) : null
      ) : (
        <div className="desktop-shell__topbar">{desktopTopBar}</div>
      )}
      <div className={isMobile ? "flex min-h-0 flex-1 flex-col" : "desktop-shell__main"}>
        <div
          ref={pull.scrollRef}
          data-testid="shell-scroll"
          className={
            isMobile
              ? cn(
                  "scrollbar-hidden flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-0 pb-4",
                  hasMobileTopBar ? "pt-0" : "pt-3",
                  contentClassName
                )
              : "desktop-shell__content"
          }
          style={isMobile ? mobileScrollStyle : undefined}
        >
          {isMobile && pull.showRefreshPrompt ? (
            <div
              className="pointer-events-none flex justify-center px-4 pt-2"
              role="status"
              aria-live="polite"
            >
              <div className="rounded-full border border-[#6d573e] bg-[#17110b]/95 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#e4d5bb] shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
                {pull.refreshLabel}
              </div>
            </div>
          ) : null}
          <div
            className={
              isMobile
                ? cn("px-1.5", pull.isPulling ? "" : "transition-transform duration-200 ease-out")
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
      {isMobile ? bottomNav : null}
    </main>
  );
}
