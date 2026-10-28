import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { STAT_FIELDS, type StatKey } from "@/features/catalogue/utils/statblock";

/** A profile the stat table shows: the nine characteristics and the armour save. */
type StatProfile = Record<StatKey, number> & { armour_save: number | null };

/** A linked skill, rule, spell or item: a small chip whose text opens in a tooltip. */
export const DETAIL_CHIP_CLASS =
  "cursor-help rounded bg-background/60 px-2 py-0.5 text-xs text-foreground underline decoration-dotted underline-offset-2";

/** The panel's top line: the entry's name and what it is, and Back (with any other actions). */
export function DetailHeader({
  name,
  kind,
  entry,
  onClose,
  badge,
  actions,
}: {
  name: string;
  /** "Attack", "Hired sword · Ogre": the first words of the line under the name. */
  kind: string;
  entry: { large: boolean; caster: string };
  onClose: () => void;
  /** Beside the name: its Custom or House rule badge. */
  badge?: ReactNode;
  /** Before Back: Edit. */
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center">
          <h2 className="font-display text-lg text-foreground">{name}</h2>
          {badge}
        </div>
        <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
          {kind}
          {entry.large ? " • Large" : ""}
          {entry.caster !== "No" ? ` • ${entry.caster}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <Button variant="secondary" size="sm" onClick={onClose}>
          Back
        </Button>
      </div>
    </div>
  );
}

/** The entry's profile, M to Ld, and its armour save. */
export function EntryStatTable({ entry }: { entry: StatProfile }) {
  return (
    <div className="overflow-x-auto rounded border border-border/60 bg-background/60">
      <table className="min-w-full text-xs text-muted-foreground">
        <thead className="bg-background/80 uppercase tracking-[0.2em]">
          <tr>
            {STAT_FIELDS.map((field) => (
              <th key={field.key} className="px-3 py-1.5 text-center font-semibold">
                {field.label}
              </th>
            ))}
            <th className="px-3 py-1.5 text-center font-semibold">AS</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-border/60">
            {STAT_FIELDS.map((field) => (
              <td
                key={field.key}
                className="px-3 py-1.5 text-center text-sm font-semibold text-foreground"
              >
                {entry[field.key]}
              </td>
            ))}
            <td className="px-3 py-1.5 text-center text-sm font-semibold text-foreground">
              {entry.armour_save != null ? `${entry.armour_save}+` : "-"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/** A titled row of chips (Skills & Special Rules, Spells, Equipment). */
export function DetailSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-1">
      <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}
