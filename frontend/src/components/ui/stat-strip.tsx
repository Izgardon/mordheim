import { cn } from "@/lib/utils";

export const STAT_KEYS = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld", "Sv"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

type StatStripProps = {
  /** The profile; a missing value shows as a dash. */
  values: Partial<Record<StatKey, string | number>>;
  /** Cells to pick out, such as M and Sv while mounted. */
  highlighted?: ReadonlyArray<StatKey>;
  className?: string;
};

/** The ten-cell profile (M WS BS S T W I A Ld Sv) under a unit's name. */
export function StatStrip({ values, highlighted = [], className }: StatStripProps) {
  return (
    <dl className={cn("grid grid-cols-10 border-y border-line", className)}>
      {STAT_KEYS.map((key) => {
        const on = highlighted.includes(key);
        return (
          <div
            key={key}
            data-highlighted={on || undefined}
            className={cn("flex flex-col items-center pb-[7px] pt-1.5", on && "bg-accent-soft")}
          >
            <dt
              className={cn(
                "text-[10px] font-bold tracking-[0.06em]",
                on ? "text-accent-text" : "text-faint"
              )}
            >
              {key}
            </dt>
            <dd
              className={cn(
                "m-0 font-mono text-[15px] font-bold",
                on ? "text-accent-hi" : "text-ink"
              )}
            >
              {values[key] ?? "–"}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
