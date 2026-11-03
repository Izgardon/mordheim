import { cn } from "@/lib/utils";

export const STAT_KEYS = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld", "Sv"] as const;
export type StatKey = (typeof STAT_KEYS)[number];

type StatStripProps = {
  /** The profile; a missing value shows as a dash. */
  values: Partial<Record<StatKey, string | number>>;
  /** Cells to pick out, such as M and Sv while mounted. */
  highlighted?: ReadonlyArray<StatKey>;
  /** A warning on a cell (a written value whose number has moved), marked and read out. */
  flags?: Partial<Record<StatKey, string>>;
  className?: string;
};

/** The ten-cell profile (M WS BS S T W I A Ld Sv) under a unit's name. */
export function StatStrip({ values, highlighted = [], flags = {}, className }: StatStripProps) {
  return (
    <dl className={cn("grid grid-cols-10 border-y border-line", className)}>
      {STAT_KEYS.map((key) => {
        const on = highlighted.includes(key);
        const flag = flags[key];
        const shown = values[key] ?? "–";
        return (
          <div
            key={key}
            data-highlighted={on || undefined}
            data-flagged={flag ? true : undefined}
            title={flag}
            className={cn(
              "relative flex min-w-0 flex-col items-center pb-[7px] pt-1.5",
              on && "bg-accent-soft"
            )}
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
                "m-0 max-w-full truncate font-mono font-bold",
                String(shown).length > 3 ? "text-[12px] leading-[22px]" : "text-[15px]",
                flag ? "text-danger" : on ? "text-accent-hi" : "text-ink"
              )}
            >
              {shown}
              {flag ? <span className="sr-only"> ({flag})</span> : null}
            </dd>
            {flag ? (
              <span aria-hidden="true" className="absolute right-0.5 top-1 h-1.5 w-1.5 bg-danger" />
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}
