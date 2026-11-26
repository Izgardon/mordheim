import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { dialogOpen, inSidewaysScroller, scrollPanes } from "@/lib/touch-gestures";

/** How far a finger pulls before the page starts to follow (William, 26 Nov 2026: the distance was never the trouble, the sideways swipes were). */
const ACTIVATION_DISTANCE = 48;
/** Past this sideways, before the pull starts, the touch is a swipe for the rest of its life. */
const SIDEWAYS_SLOP = 10;
export const PULL_TO_REFRESH_THRESHOLD = 72;
const MAX_DISTANCE = 120;
const RESISTANCE = 0.45;

type PullToRefreshOptions = {
  enabled: boolean;
  /** Resolves once the refresh is done (or never, if it falls back to a full reload). */
  onRefresh: () => Promise<void>;
};

/**
 * Pull down at the top of the scroll container to refresh. The touch listeners are native, and
 * touchmove is registered non-passive: React attaches touchmove as passive, so the old
 * onTouchMove's preventDefault() was ignored and iOS rubber-banding ran alongside the pull
 * (BUG-61).
 *
 * A drag that starts inside a pane of the page's own is left alone (William, 18 Nov 2026, from his
 * phone, on the battle screen: "here i scroll down the feed and it will refresh the page"). The
 * listeners sit on the scroll container, so every touch in the page reached them, and a screen
 * built from panes leaves that container at scrollTop 0 behind them: scrolling the feed down was a
 * pull, which cancelled the scroll and refreshed the page.
 *
 * It is also harder to set off by accident (William, 25 Nov 2026): it waits for 90 px, a pull must
 * be clearly downward (twice as far down as sideways when it starts), a sideways swipe is never a
 * pull, nor is a touch in a row that scrolls sideways or while a dialog or sheet is open.
 */
export function usePullToRefresh({ enabled, onRefresh }: PullToRefreshOptions) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const gesture = useRef({
    startX: 0,
    startY: null as number | null,
    started: false,
    distance: 0,
    refreshing: false,
  });
  const onRefreshRef = useRef(onRefresh);

  useLayoutEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  useEffect(() => {
    const element = scrollRef.current;
    if (!enabled || !element) {
      return;
    }

    const setDistance = (distance: number) => {
      gesture.current.distance = distance;
      setPullDistance(distance);
    };
    const resetPull = () => {
      gesture.current.startY = null;
      gesture.current.started = false;
      setIsPulling(false);
      setDistance(0);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (gesture.current.refreshing) return;
      const touch = event.touches[0];
      if (
        !touch ||
        element.scrollTop > 0 ||
        scrollPanes(event.target, element).length > 0 ||
        inSidewaysScroller(event.target, element) ||
        dialogOpen()
      ) {
        resetPull();
        return;
      }
      gesture.current.startX = touch.clientX ?? 0;
      gesture.current.startY = touch.clientY;
      gesture.current.started = false;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const { startX, startY, refreshing } = gesture.current;
      if (refreshing || startY === null) return;
      if (element.scrollTop > 0) {
        resetPull();
        return;
      }
      const touch = event.touches[0];
      const deltaY = (touch?.clientY ?? startY) - startY;
      const deltaX = Math.abs((touch?.clientX ?? startX) - startX);
      if (!gesture.current.started) {
        // sideways first is a swipe for the rest of the touch, and a pull starts clearly downward
        if (deltaX > Math.max(SIDEWAYS_SLOP, Math.abs(deltaY))) return resetPull();
        if (deltaY <= ACTIVATION_DISTANCE) return;
        if (deltaY < 2 * deltaX) return resetPull();
        gesture.current.started = true;
      }
      if (deltaY <= ACTIVATION_DISTANCE) {
        setIsPulling(false);
        setDistance(0);
        return;
      }
      event.preventDefault();
      setIsPulling(true);
      setDistance(Math.min((deltaY - ACTIVATION_DISTANCE) * RESISTANCE, MAX_DISTANCE));
    };

    const handleTouchEnd = () => {
      gesture.current.startY = null;
      gesture.current.started = false;
      setIsPulling(false);
      if (gesture.current.refreshing) return;
      if (gesture.current.distance < PULL_TO_REFRESH_THRESHOLD) {
        setDistance(0);
        return;
      }
      setDistance(PULL_TO_REFRESH_THRESHOLD);
      gesture.current.refreshing = true;
      setIsRefreshing(true);
      void onRefreshRef.current().then(() => {
        gesture.current.refreshing = false;
        setIsRefreshing(false);
        setDistance(0);
      });
    };

    const handleTouchCancel = () => {
      if (!gesture.current.refreshing) resetPull();
    };

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd);
    element.addEventListener("touchcancel", handleTouchCancel);
    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchcancel", handleTouchCancel);
    };
  }, [enabled]);

  const refreshLabel = isRefreshing
    ? "Refreshing..."
    : pullDistance >= PULL_TO_REFRESH_THRESHOLD
      ? "Release to refresh"
      : "Pull to refresh";

  return {
    scrollRef,
    pullDistance,
    isPulling,
    showRefreshPrompt: pullDistance > 0 || isRefreshing,
    refreshLabel,
  };
}
