import { useEffect, useLayoutEffect, useRef, useState } from "react";

const ACTIVATION_DISTANCE = 48;
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
 */
export function usePullToRefresh({ enabled, onRefresh }: PullToRefreshOptions) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const gesture = useRef({ startY: null as number | null, distance: 0, refreshing: false });
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
      setIsPulling(false);
      setDistance(0);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (gesture.current.refreshing) return;
      if (element.scrollTop > 0) {
        resetPull();
        return;
      }
      gesture.current.startY = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const { startY, refreshing } = gesture.current;
      if (refreshing || startY === null) return;
      if (element.scrollTop > 0) {
        resetPull();
        return;
      }
      const deltaY = (event.touches[0]?.clientY ?? startY) - startY;
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
