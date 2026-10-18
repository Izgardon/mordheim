import { useEffect, useState } from "react";

/** "9:42" for what is left of a deadline (whole seconds, rounded up, so 0:00 means it's over). */
export function formatCountdown(remainingMs: number) {
  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * The milliseconds left before `deadline` (an ISO date), ticking every second; null without one.
 * A new deadline (a trade extended by activity) restarts it.
 */
export function useCountdown(deadline: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) {
      return;
    }
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  return deadline ? Math.max(0, new Date(deadline).getTime() - now) : null;
}
