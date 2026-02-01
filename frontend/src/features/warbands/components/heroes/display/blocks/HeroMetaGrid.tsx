import type { WarbandHero } from "../../../../types/warband-types";

type HeroMetaGridProps = {
  hero: WarbandHero;
};

const formatCost = (value?: number | null) =>
  value === null || value === undefined ? "-" : `${value}gc`;

const formatXp = (value?: number | null) =>
  value === null || value === undefined ? "-" : `${value}xp`;

export default function HeroMetaGrid({ hero }: HeroMetaGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="border border-primary/20 bg-background/60 px-2.5 py-2">
        <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Type</p>
        <p className="text-sm font-semibold">{hero.unit_type || "-"}</p>
      </div>
      <div className="border border-primary/20 bg-background/60 px-2.5 py-2">
        <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Total cost</p>
        <p className="text-sm font-semibold">{formatCost(hero.price)}</p>
      </div>
      <div className="border border-primary/20 bg-background/60 px-2.5 py-2">
        <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">Exp total</p>
        <p className="text-sm font-semibold">{formatXp(hero.xp)}</p>
      </div>
    </div>
  );
}
