import { cn } from "@/lib/utils";

/** The printed track: forty boxes. A custom plot's ladder, or the player, may run past it. */
const BOOK_TRACK = 40;

const list = (numbers: number[]) =>
  numbers.length < 2
    ? numbers.join("")
    : `${numbers.slice(0, -1).join(", ")} and ${numbers[numbers.length - 1]}`;

/**
 * The campaign point track (apps/plots): a box per point, filled up to the warband's total, with
 * the rungs of its plot's ladder drawn heavy and numbered. The ladder comes from the warband's own
 * plot, so a custom plot's rungs are its own; the book's seven are 5, 10, 15, 20, 25, 35 and 40,
 * with no 30, and 40 wins the campaign. Shared: the warband page's plot section and anywhere else
 * a total is read against a ladder (William, 20 Nov 2026: "make this table a shareable component").
 */
export function PlotTrack({ total, rungs }: { total: number; rungs: number[] }) {
  const length = Math.max(BOOK_TRACK, total, ...rungs);
  const marks = new Set(rungs);
  const label = rungs.length
    ? `${total} of ${length} campaign points; achievements at ${list(rungs)}`
    : `${total} of ${length} campaign points`;

  return (
    <div role="img" aria-label={label} className="flex flex-wrap gap-[2px]">
      {Array.from({ length }, (_, index) => index + 1).map((point) => {
        const mark = marks.has(point);
        return (
          <span
            key={point}
            aria-hidden="true"
            className={cn(
              "flex h-6 w-5 items-center justify-center font-mono text-[9px] font-bold leading-none",
              mark
                ? "border-2 border-accent-line text-head"
                : "border border-line text-transparent",
              point <= total ? "bg-accent-soft" : "bg-transparent"
            )}
          >
            {mark ? point : ""}
          </span>
        );
      })}
    </div>
  );
}
