import type { WarbandHero } from "../../../warbands/types/warband-types";

type WarbandHeroesTableProps = {
  heroes: WarbandHero[];
};

export default function WarbandHeroesTable({ heroes }: WarbandHeroesTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/70">
      <table className="min-w-full text-xs text-muted-foreground">
        <thead>
          <tr className="border-b border-border/40 bg-black text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
            <th className="px-3 text-left text-foreground">Name</th>
            <th className="px-3 text-left">Type</th>
            <th className="px-3 text-left">M</th>
            <th className="px-3 text-left">WS</th>
            <th className="px-3 text-left">BS</th>
            <th className="px-3 text-left">S</th>
            <th className="px-3 text-left">T</th>
            <th className="px-3 text-left">W</th>
            <th className="px-3 text-left">I</th>
            <th className="px-3 text-left">A</th>
            <th className="px-3 text-left">Ld</th>
            <th className="px-3 text-left">AS</th>
          </tr>
        </thead>
        <tbody>
          {heroes.map((hero) => (
            <tr key={hero.id} className="border-b border-border/40 last:border-b-0">
              <td className="px-3 py-2 text-sm font-semibold text-foreground">
                {hero.name || "Unnamed"}
              </td>
              <td className="px-3 py-2 text-xs uppercase tracking-[0.2em]">
                {hero.unit_type || "Hero"}
              </td>
              <td className="px-3 py-2">{hero.movement ?? 0}</td>
              <td className="px-3 py-2">{hero.weapon_skill ?? 0}</td>
              <td className="px-3 py-2">{hero.ballistic_skill ?? 0}</td>
              <td className="px-3 py-2">{hero.strength ?? 0}</td>
              <td className="px-3 py-2">{hero.toughness ?? 0}</td>
              <td className="px-3 py-2">{hero.wounds ?? 0}</td>
              <td className="px-3 py-2">{hero.initiative ?? 0}</td>
              <td className="px-3 py-2">{hero.attacks ?? 0}</td>
              <td className="px-3 py-2">{hero.leadership ?? 0}</td>
              <td className="px-3 py-2">{hero.armour_save || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
