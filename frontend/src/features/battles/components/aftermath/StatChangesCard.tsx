import { Switch } from "@/components/ui/switch";

import type { StatChangeRow } from "./aftermath-stats";

/**
 * The battle's stat changes (design E's Experience tab): each unit or group whose stats changed in
 * the fight, with a Keep tick; kept changes become permanent at Ready, the rest are dropped.
 */
export default function StatChangesCard({
  rows,
  onKeep,
}: {
  rows: StatChangeRow[];
  onKeep: (row: StatChangeRow, keep: boolean) => void;
}) {
  if (!rows.length) return null;
  return (
    <article className="flex flex-col gap-2 border border-border bg-surface p-[18px]">
      <div className="flex items-baseline justify-between gap-2.5">
        <h2 className="m-0 font-display text-[19px] font-semibold text-head">Stat changes</h2>
        <span className="text-xs text-muted-foreground">Kept ones stay after the battle</span>
      </div>
      <ul className="flex flex-col">
        {rows.map((row) => (
          <li
            key={row.key}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2"
          >
            <span className="flex min-w-0 flex-col">
              <span className="font-bold text-ink">{row.name}</span>
              <span className="font-mono text-xs text-text2">{row.changes.join(" · ")}</span>
            </span>
            <Switch checked={row.kept} onCheckedChange={(keep) => onKeep(row, keep)}>
              Keep
            </Switch>
          </li>
        ))}
      </ul>
    </article>
  );
}
