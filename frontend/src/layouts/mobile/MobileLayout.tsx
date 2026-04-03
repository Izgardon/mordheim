import { useCallback, useRef, useState } from "react";
import type { ReactNode, TouchEvent } from "react";

import siteBackground from "@/assets/background/site_background.webp";
import { cn } from "@/lib/utils";
import { reloadMobileLayout } from "./mobile-refresh";

const PULL_TO_REFRESH_ACTIVATION_DISTANCE = 48;
const PULL_TO_REFRESH_THRESHOLD = 72;
const MAX_PULL_TO_REFRESH_DISTANCE = 120;
const PULL_TO_REFRESH_RESISTANCE = 0.45;

type MobileLayoutProps = {
  topBar?: ReactNode;
  topBarOffset?: string;
  bottomNav?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export default function MobileLayout({
  topBar,
  topBarOffset,
  bottomNav,
  children,
  className,
  contentClassName,
}: MobileLayoutProps) {
  const contentRef = useRef<HTMLDivElement | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const hasTopBar = Boolean(topBar);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const contentPaddingBottom = bottomNav
    ? "calc(env(safe-area-inset-bottom, 0px) + 6.5rem)"
    : "env(safe-area-inset-bottom, 0px)";
  const contentPaddingTop = hasTopBar
    ? undefined
    : topBarOffset ?? "calc(env(safe-area-inset-top, 0px) + 4.75rem)";
  const showRefreshPrompt = pullDistance > 0 || isRefreshing;
  const refreshLabel = isRefreshing
    ? "Refreshing..."
    : pullDistance >= PULL_TO_REFRESH_THRESHOLD
      ? "Release to refresh"
      : "Pull to refresh";

  const resetPullState = useCallback(() => {
    touchStartYRef.current = null;
    setIsPulling(false);
    setPullDistance(0);
  }, []);

  const handleTouchStart = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (isRefreshing) {
      return;
    }

    const contentElement = contentRef.current;
    if (!contentElement || contentElement.scrollTop > 0) {
      touchStartYRef.current = null;
      setIsPulling(false);
      setPullDistance(0);
      return;
    }

    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  }, [isRefreshing]);

  const handleTouchMove = useCallback((event: TouchEvent<HTMLDivElement>) => {
    if (isRefreshing) {
      return;
    }

    const contentElement = contentRef.current;
    const startY = touchStartYRef.current;
    if (!contentElement || startY === null) {
      return;
    }

    if (contentElement.scrollTop > 0) {
      resetPullState();
      return;
    }

    const currentY = event.touches[0]?.clientY ?? startY;
    const deltaY = currentY - startY;
    if (deltaY <= 0) {
      setIsPulling(false);
      setPullDistance(0);
      return;
    }

    if (deltaY <= PULL_TO_REFRESH_ACTIVATION_DISTANCE) {
      setIsPulling(false);
      setPullDistance(0);
      return;
    }

    event.preventDefault();
    setIsPulling(true);
    setPullDistance(
      Math.min(
        (deltaY - PULL_TO_REFRESH_ACTIVATION_DISTANCE) * PULL_TO_REFRESH_RESISTANCE,
        MAX_PULL_TO_REFRESH_DISTANCE
      )
    );
  }, [isRefreshing, resetPullState]);

  const handleTouchEnd = useCallback(() => {
    touchStartYRef.current = null;
    setIsPulling(false);

    if (isRefreshing) {
      return;
    }

    if (pullDistance >= PULL_TO_REFRESH_THRESHOLD) {
      setPullDistance(PULL_TO_REFRESH_THRESHOLD);
      setIsRefreshing(true);
      reloadMobileLayout();
      return;
    }

    setPullDistance(0);
  }, [isRefreshing, pullDistance]);

  const handleTouchCancel = useCallback(() => {
    if (isRefreshing) {
      return;
    }

    resetPullState();
  }, [isRefreshing, resetPullState]);

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
        ref={contentRef}
        data-testid="mobile-layout-scroll"
        className={cn(
          "scrollbar-hidden flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-0 pb-4",
          hasTopBar ? "pt-0" : "pt-3",
          contentClassName
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        style={{
          paddingBottom: contentPaddingBottom,
          ...(contentPaddingTop ? { paddingTop: contentPaddingTop } : {}),
        }}
      >
        {showRefreshPrompt ? (
          <div className="pointer-events-none flex justify-center px-4 pt-2" role="status" aria-live="polite">
            <div className="rounded-full border border-[#6d573e] bg-[#17110b]/95 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-[#e4d5bb] shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
              {refreshLabel}
            </div>
          </div>
        ) : null}
        <div
          className={cn("px-1.5", isPulling ? "" : "transition-transform duration-200 ease-out")}
          style={{ transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined }}
        >
          {children}
        </div>
      </div>
      {bottomNav}
    </main>
  );
}
