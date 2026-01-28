import type { WarbandHero } from "../../../../types/warband-types";

type HeroStatsTableProps = {
  hero: WarbandHero;
};

const STAT_FIELDS = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld", "AS"] as const;

type StatKey = (typeof STAT_FIELDS)[number];

const formatValue = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
};

export default function HeroStatsTable({ hero }: HeroStatsTableProps) {
  const statValueMap: Record<StatKey, number | string | null | undefined> = {
    M: hero.movement,
    WS: hero.weapon_skill,
    BS: hero.ballistic_skill,
    S: hero.strength,
    T: hero.toughness,
    W: hero.wounds,
    I: hero.initiative,
    A: hero.attacks,
    Ld: hero.leadership,
    AS: hero.armour_save,
  };

  return (
    <div className="warband-hero-stats-wrapper">
      <table className="warband-hero-stats-table">
        <thead>
          <tr>
            {STAT_FIELDS.map((stat) => (
              <th key={stat}>{stat}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {STAT_FIELDS.map((stat) => (
              <td key={stat}>{formatValue(statValueMap[stat])}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
