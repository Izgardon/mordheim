import { useMediaQuery } from "@/lib/use-media-query";
import type { RosterUnit } from "../../hooks/useCampaignOverview";

const CATEGORY_ORDER: RosterUnit["category"][] = ["Heroes", "Henchmen", "Hired Swords"];

const STATS = [
  { key: "movement" as const, label: "M" },
  { key: "weapon_skill" as const, label: "WS" },
  { key: "ballistic_skill" as const, label: "BS" },
  { key: "strength" as const, label: "S" },
  { key: "toughness" as const, label: "T" },
  { key: "wounds" as const, label: "W" },
  { key: "initiative" as const, label: "I" },
  { key: "attacks" as const, label: "A" },
  { key: "leadership" as const, label: "Ld" },
  { key: "armour_save" as const, label: "AS" },
];

function statValue(unit: RosterUnit, key: (typeof STATS)[number]["key"]): string | number {
  if (key === "armour_save") return unit.armour_save || "-";
  return (unit[key] as number | undefined) ?? 0;
}

function groupByCategory(units: RosterUnit[]) {
  const map: Partial<Record<RosterUnit["category"], RosterUnit[]>> = {};
  for (const unit of units) {
    if (!map[unit.category]) map[unit.category] = [];
    map[unit.category]!.push(unit);
  }
  return CATEGORY_ORDER.filter((cat) => map[cat]?.length).map((cat) => ({
    category: cat,
    units: map[cat]!,
  }));
}

type UnitsTableProps = {
  units: RosterUnit[];
};

export default function UnitsTable({ units }: UnitsTableProps) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const groups = groupByCategory(units);

  if (isMobile) {
    return (
      <div className="space-y-4">
        {groups.map(({ category, units: group }) => (
          <div key={category} className="space-y-1.5">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
              {category}
            </p>
            <div className="overflow-hidden rounded-lg border border-border/40">
              {group.map((unit, i) => (
                <div key={unit.id} className={i > 0 ? "border-t border-border/40" : undefined}>
                  <div className="flex items-center justify-between bg-black/40 px-3 py-2">
                    <span className="text-sm font-semibold text-foreground">
                      {unit.name || "Unnamed"}
                    </span>
                    <span className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                      {unit.unit_type || ""}
                    </span>
                  </div>
                  <div className="grid grid-cols-10 bg-background/20 px-2 py-2 text-center">
                    {STATS.map(({ key, label }) => (
                      <div key={key} className="flex flex-col items-center gap-0.5">
                        <span className="text-[0.55rem] uppercase tracking-wider text-muted-foreground">
                          {label}
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          {statValue(unit, key)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map(({ category, units: group }) => (
        <div key={category} className="space-y-1.5">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
            {category}
          </p>
          <div className="overflow-x-auto rounded-xl border border-border/60 bg-card/70">
            <table className="min-w-full text-xs text-muted-foreground">
              <thead>
                <tr className="border-b border-border/40 bg-black text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                  <th className="px-3 py-1.5 text-left text-foreground">Name</th>
                  <th className="px-3 py-1.5 text-left">Type</th>
                  {STATS.map(({ key, label }) => (
                    <th key={key} className="px-3 py-1.5 text-left">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.map((unit) => (
                  <tr key={unit.id} className="border-b border-border/40 last:border-b-0">
                    <td className="px-3 py-2 text-sm font-semibold text-foreground">
                      {unit.name || "Unnamed"}
                    </td>
                    <td className="px-3 py-2 uppercase tracking-[0.15em]">
                      {unit.unit_type || "—"}
                    </td>
                    {STATS.map(({ key }) => (
                      <td key={key} className="px-3 py-2">
                        {statValue(unit, key)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
