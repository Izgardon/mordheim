import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/** How long the fill takes to move (Tailwind's duration-500), and the pause on a full bar. */
const FILL_MS = 500;
const HOLD_MS = 250;

export type XpBlock = {
  /** The table's index of the advance the block ends at (past the table: its length). */
  index: number;
  from: number;
  to: number;
  /** How full it is, 0 to 1 (half points fill half a step). */
  share: number;
  /** Where each XP point inside the block falls, 0 to 1 from its start. */
  points: number[];
};

/**
 * The block the bar shows (William: "just show that level range"): from the last advance reached to
 * the next, so 7 XP on 2, 4, 6, 8 and 11 is 6 → 8. Past the table it is the last block, full.
 */
export function xpBlock(xp: number, thresholds: readonly number[]): XpBlock {
  const next = thresholds.findIndex((to) => xp < to);
  const index = next === -1 ? thresholds.length : next;
  const end = Math.min(index, thresholds.length - 1);
  const to = thresholds[end] ?? 0;
  const from = end > 0 ? thresholds[end - 1] : 0;
  const span = to - from;
  const share = next === -1 || span <= 0 ? 1 : Math.min(1, Math.max(0, (xp - from) / span));
  const points = span > 1 ? Array.from({ length: span - 1 }, (_, step) => (step + 1) / span) : [];
  return { index, from, to, share, points };
}

type Shown = XpBlock & {
  /** The box at its end: ticked, and whether the tick pops in. */
  ticked: boolean;
  pop: boolean;
  /** Jump without moving (the empty bar of the next block). */
  instant: boolean;
};

const shownOf = (block: XpBlock, thresholds: readonly number[]): Shown => ({
  ...block,
  ticked: block.index >= thresholds.length,
  pop: false,
  instant: false,
});

const reducedMotion = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The XP bar: the current block only, a faint line at each XP point inside it, and the advance's
 * box at its end. Added XP grows the fill; one that reaches the next advance fills the bar and ticks
 * its box, then the bar starts again on the next block. With reduced motion it just changes.
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
  const table = thresholds.join(",");
  const [shown, setShown] = useState(() => shownOf(xpBlock(xp, thresholds), thresholds));
  const before = useRef(xp);

  useEffect(() => {
    const steps = table ? table.split(",").map(Number) : [];
    const previous = before.current;
    before.current = xp;
    const target = shownOf(xpBlock(xp, steps), steps);
    const was = xpBlock(previous, steps);
    if (target.index <= was.index || reducedMotion()) {
      setShown(target);
      return;
    }
    setShown({ ...was, share: 1, ticked: true, pop: true, instant: false });
    const timers = [
      window.setTimeout(
        () => setShown({ ...target, share: 0, ticked: false, instant: true }),
        FILL_MS + HOLD_MS
      ),
      window.setTimeout(() => setShown(target), FILL_MS + HOLD_MS + 30),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [xp, table]);

  return (
    <div aria-hidden="true" className={cn("flex w-full items-center gap-1", className)}>
      <div className="relative h-2 min-w-0 flex-1 bg-line">
        <div
          data-xp-fill
          className={cn(
            "h-2 bg-primary",
            !shown.instant &&
              "transition-[width] duration-500 ease-out motion-reduce:transition-none"
          )}
          style={{ width: `${shown.share * 100}%` }}
        />
        {shown.points.map((at) => (
          <span
            key={at}
            data-xp-point
            className="absolute inset-y-0 w-px bg-page opacity-50"
            style={{ left: `${at * 100}%` }}
          />
        ))}
      </div>
      <span
        className={cn(
          "flex h-3.5 w-3.5 shrink-0 items-center justify-center border",
          shown.ticked ? "border-primary bg-primary text-primary-foreground" : "border-strong"
        )}
      >
        {shown.ticked ? (
          <Check
            key={shown.pop ? `new-${shown.index}` : "kept"}
            className={cn("h-3 w-3", shown.pop && "xp-tick")}
            strokeWidth={3}
          />
        ) : null}
      </span>
    </div>
  );
}
