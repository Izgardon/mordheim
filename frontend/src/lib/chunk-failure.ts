import { useEffect, useState } from "react";

/** Why a page's code didn't download: a deploy replaced it, or there is no signal. */
export type ChunkFailureCause = "checking" | "offline" | "updated";

const REACH_TIMEOUT_MS = 5_000;

/**
 * Whether the app's own site answers. A page's code that failed to download while it does was
 * replaced by a deploy; while it doesn't, the phone has no (or too weak a) connection, which
 * `navigator.onLine` alone misses.
 */
export async function canReachApp() {
  if (!navigator.onLine) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REACH_TIMEOUT_MS);
  try {
    await fetch(`/?reach=${Date.now()}`, {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    return true; // any answer: the site is there
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** The cause of a failed chunk load (`failed` true), checked once; null when it isn't one. */
export function useChunkFailureCause(failed: boolean): ChunkFailureCause | null {
  const [cause, setCause] = useState<ChunkFailureCause>(() =>
    navigator.onLine ? "checking" : "offline"
  );
  useEffect(() => {
    if (!failed || cause !== "checking") return;
    let live = true;
    void canReachApp().then((reached) => {
      if (live) setCause(reached ? "updated" : "offline");
    });
    return () => {
      live = false;
    };
  }, [failed, cause]);
  return failed ? cause : null;
}
