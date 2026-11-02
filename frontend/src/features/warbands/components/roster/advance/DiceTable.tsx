import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DiceTableRow = { key: string; roll: string; result: ReactNode; aside?: ReactNode };

/**
 * A dice table with the row the roll landed on picked out: the advance table, a lore's spells.
 */
export default function DiceTable({
  label,
  rows,
  current,
}: {
  /** "Hero advance table": the table's name for a screen reader. */
  label: string;
  rows: DiceTableRow[];
  /** The key of the row the roll landed on. */
  current?: string;
}) {
  return (
    <table aria-label={label} className="w-full border-collapse text-[13px]">
      <tbody>
        {rows.map((row) => {
          const on = row.key === current;
          return (
            <tr
              key={row.key}
              aria-current={on ? "true" : undefined}
              className={cn(
                "border-b border-line last:border-b-0",
                on && "bg-accent-soft text-accent-hi"
              )}
            >
              <td
                className={cn(
                  "w-14 py-1.5 pl-2 font-mono font-bold",
                  on ? "text-accent-hi" : "text-muted-foreground"
                )}
              >
                {row.roll}
              </td>
              <td className={cn("py-1.5 pr-2", on ? "font-bold" : "text-ink")}>{row.result}</td>
              {row.aside !== undefined ? (
                <td className="py-1.5 pr-2 text-right font-mono text-xs text-muted-foreground">
                  {row.aside}
                </td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
