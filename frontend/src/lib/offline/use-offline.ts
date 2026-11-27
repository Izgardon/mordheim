import { useSyncExternalStore } from "react";
import { onlineManager } from "@tanstack/react-query";

function subscribe(onChange: () => void) {
  const stopManager = onlineManager.subscribe(onChange);
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    stopManager();
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/**
 * Whether the phone is offline: the browser says so, or TanStack's online manager does (it has
 * paused the reads and writes until the connection returns).
 */
export function isOffline() {
  return !navigator.onLine || !onlineManager.isOnline();
}

/** `isOffline`, re-rendering when it changes. */
export function useOffline() {
  return useSyncExternalStore(subscribe, isOffline);
}
