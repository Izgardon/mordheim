import { useEffect, useRef } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

const WINDOW = 8;

/**
 * The full-width XP track (William: "a full width bar with animation on the bar when adding
 * experience"): a block for each advance of the unit's table (the current one, two after it and up
 * to eight in all), sized by its XP, each ending in a box that is ticked once the block is complete. Added XP grows the fill, and a block it completes
 * ticks its box; with reduced motion both just change. Half points fill half a point.
 */
export default function XpTrack({
  xp,
  thresholds,
  className,
}: {
  xp: number;
  /** The kind's table: the XP each advance comes at. */
  thresholds: readonly number[];
  className?: string;
}) {
  const before = useRef(xp);
  const previous = before.current;
  useEffect(() => {
    before.current = xp;
  }, [xp]);

  const next = thresholds.findIndex((to) => xp < to);
  const end = next === -1 ? thresholds.length : Math.min(thresholds.length, next + 3);
  const start = Math.max(0, end - WINDOW);

  return (
    <div aria-hidden="true" className={cn("flex w-full items-center gap-0.5", className)}>
      {thresholds.slice(start, end).map((to, offset) => {
        const index = start + offset;
        const from = index ? thresholds[index - 1] : 0;
        const share = Math.min(1, Math.max(0, (xp - from) / (to - from)));
        const done = xp >= to;
        return (
          <div
            key={to}
            className="flex min-w-0 items-center gap-0.5"
            style={{ flexGrow: to - from }}
          >
            <div className="h-2 min-w-0 flex-1 bg-line">
              <div
                className="h-2 bg-primary transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${share * 100}%` }}
              />
            </div>
            <span
              className={cn(
                "flex h-3.5 w-3.5 shrink-0 items-center justify-center border",
                done ? "border-primary bg-primary text-primary-foreground" : "border-strong"
              )}
            >
              {done ? (
                <Check
                  key={previous < to ? `new-${xp}` : "kept"}
                  className={cn("h-3 w-3", previous < to && "xp-tick")}
                  strokeWidth={3}
                />
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
