import { Input } from "@components/input";
import { Label } from "@components/label";
import type { HeroFormEntry } from "../../../types/warband-types";

type HeroStatsGridProps = {
  hero: HeroFormEntry;
  index: number;
  statFields: readonly string[];
  inputClassName: string;
  onUpdate: (index: number, updater: (hero: HeroFormEntry) => HeroFormEntry) => void;
};

export default function HeroStatsGrid({
  hero,
  index,
  statFields,
  inputClassName,
  onUpdate,
}: HeroStatsGridProps) {
  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-background/50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">Stats</p>
      <div className="grid grid-cols-3 gap-1 sm:grid-cols-5 lg:grid-cols-10">
        {statFields.map((stat) => (
          <div key={stat} className="space-y-1 text-center">
            <Label className="text-[9px] uppercase text-muted-foreground">{stat}</Label>
            <Input
              value={hero.stats[stat]}
              onChange={(event) =>
                onUpdate(index, (current) => ({
                  ...current,
                  stats: { ...current.stats, [stat]: event.target.value },
                }))
              }
              placeholder="-"
              className={`${inputClassName} h-7 px-1 text-xs text-center`}
            />
          </div>
        ))}
        <div className="space-y-1 text-center">
          <Label className="text-[9px] uppercase text-muted-foreground">AS</Label>
          <Input
            value={hero.armour_save}
            onChange={(event) =>
              onUpdate(index, (current) => ({
                ...current,
                armour_save: event.target.value,
              }))
            }
            placeholder="-"
            className={`${inputClassName} h-7 px-1 text-xs text-center`}
          />
        </div>
      </div>
    </div>
  );
}
