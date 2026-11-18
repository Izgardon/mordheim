import { useEffect, useRef, useState } from "react";

/** How long a just-changed mark stays on a model (William, 12 Nov 2026: "transient"). */
export const STATUS_MARK_MS = 1500;

/**
 * The models whose status has just changed, by unit key: the battle cards mark them briefly
 * (William, 12 Nov 2026: a "brief highlight on the model, and the card's section highlighted too").
 *
 * A key holds one mark and one timer, so a status cycled three times quickly restarts that one
 * mark instead of leaving three behind, and every timer is cleared when the screen goes. The first
 * read is the baseline: arriving at the battle marks nobody.
 */
export function useRecentStatus(
  statuses: readonly (readonly [key: string, status: string])[],
  lifetime = STATUS_MARK_MS
): ReadonlySet<string> {
  const signature = statuses.map(([key, status]) => `${key}=${status}`).join("|");
  const latest = useRef(statuses);
  latest.current = statuses;
  const seen = useRef<Map<string, string> | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [recent, setRecent] = useState<ReadonlySet<string>>(() => new Set());

  useEffect(() => {
    const before = seen.current;
    const now = new Map(latest.current);
    seen.current = now;
    if (!before) return;
    const changed = [...now]
      .filter(([key, status]) => before.has(key) && before.get(key) !== status)
      .map(([key]) => key);
    if (!changed.length) return;
    setRecent((current) => new Set([...current, ...changed]));
    for (const key of changed) {
      const running = timers.current.get(key);
      if (running) clearTimeout(running);
      timers.current.set(
        key,
        setTimeout(() => {
          timers.current.delete(key);
          setRecent((current) => {
            if (!current.has(key)) return current;
            const next = new Set(current);
            next.delete(key);
            return next;
          });
        }, lifetime)
      );
    }
  }, [signature, lifetime]);

  useEffect(() => {
    const running = timers.current;
    return () => {
      running.forEach(clearTimeout);
      running.clear();
    };
  }, []);

  return recent;
}
