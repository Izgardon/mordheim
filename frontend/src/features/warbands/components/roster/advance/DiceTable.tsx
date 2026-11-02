import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type DiceTableRow = { key: string; roll: string; result: ReactNode; aside?: ReactNode };

/**
 * A dice table with the row the roll landed on picked out: the advance table, a lore's spells.
 * With `onPick`, a row can be clicked to take its result, as if the die had shown it.
 */
export default function DiceTable({
  label,
  rows,
  current,
  onPick,
}: {
  /** "Hero advance table": the table's name for a screen reader. */
  label: string;
  rows: DiceTableRow[];
  /** The key of the row the roll landed on. */
  current?: string;
  onPick?: (key: string) => void;
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
              onClick={onPick ? () => onPick(row.key) : undefined}
              className={cn(
                "border-b border-line last:border-b-0",
                on && "bg-accent-soft text-accent-hi",
                onPick && !on && "cursor-pointer hover:bg-raised"
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
              <td className={cn("py-1.5 pr-2", on ? "font-bold" : "text-ink")}>
                {onPick ? (
                  <button
                    type="button"
                    aria-pressed={on}
                    className="w-full cursor-pointer bg-transparent p-0 text-left text-inherit focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                    onClick={(event) => {
                      event.stopPropagation();
                      onPick(row.key);
                    }}
                  >
                    {row.result}
                  </button>
                ) : (
                  row.result
                )}
              </td>
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
