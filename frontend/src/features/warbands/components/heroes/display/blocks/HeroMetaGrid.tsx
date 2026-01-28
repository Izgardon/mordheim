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
    <div className="warband-hero-meta-grid">
      <div className="warband-hero-meta-block">
        <p className="warband-hero-meta-label">Type</p>
        <p className="warband-hero-meta-value">{hero.unit_type || "-"}</p>
      </div>
      <div className="warband-hero-meta-block">
        <p className="warband-hero-meta-label">Total cost</p>
        <p className="warband-hero-meta-value">{formatCost(hero.price)}</p>
      </div>
      <div className="warband-hero-meta-block">
        <p className="warband-hero-meta-label">Exp total</p>
        <p className="warband-hero-meta-value">{formatXp(hero.xp)}</p>
      </div>
    </div>
  );
}
