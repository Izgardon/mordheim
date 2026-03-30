import { CardBackground } from "@/components/ui/card-background";
import OverflowTagList from "./OverflowTagList";
import type { HiredSwordProfileSummary } from "../types/bestiary-types";

const STAT_HEADERS = [
  { key: "movement", label: "M" },
  { key: "weapon_skill", label: "WS" },
  { key: "ballistic_skill", label: "BS" },
  { key: "strength", label: "S" },
  { key: "toughness", label: "T" },
  { key: "wounds", label: "W" },
  { key: "initiative", label: "I" },
  { key: "attacks", label: "A" },
  { key: "leadership", label: "Ld" },
] as const;

function formatCost(
  cost: number | null,
  expression: string
): string {
  if (expression) return expression;
  if (cost !== null) return `${cost} gc`;
  return "-";
}

type Props = {
  profile: HiredSwordProfileSummary;
  onClick?: (profile: HiredSwordProfileSummary) => void;
};

export default function HiredSwordProfileCard({ profile, onClick }: Props) {
  const entry = profile.bestiary_entry;

  return (
    <div
      className="cursor-pointer transition hover:brightness-110 min-h-[244px]"
      onClick={() => onClick?.(profile)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick?.(profile);
      }}
    >
      <CardBackground className="h-full space-y-2 bg-[rgba(12,9,6,0.92)] p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-foreground">
              {entry.name}
            </h3>
            <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
              Hired Sword
              {entry.large ? " \u2022 Large" : ""}
              {entry.caster !== "No" ? ` \u2022 ${entry.caster}` : ""}
            </p>
          </div>
        </div>

        <div className="flex gap-3 text-xs text-muted-foreground">
          <span>
            Hire:{" "}
            <span className="font-semibold text-foreground">
              {formatCost(profile.hire_cost, profile.hire_cost_expression)}
            </span>
          </span>
          <span>
            Upkeep:{" "}
            <span className="font-semibold text-foreground">
              {formatCost(profile.upkeep_cost, profile.upkeep_cost_expression)}
            </span>
          </span>
        </div>

        {profile.restrictions.length > 0 ? (
          <OverflowTagList
            tags={profile.restrictions.map((r) => ({
              key: `${r.restriction.id}-${r.additional_note}`,
              label:
                r.restriction.restriction +
                (r.additional_note ? ` (${r.additional_note})` : ""),
            }))}
            tagClassName="rounded bg-background/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
          />
        ) : null}

        {profile.available_skill_types.length > 0 ? (
          <OverflowTagList
            tags={profile.available_skill_types.map((type) => ({
              key: type,
              label: type,
            }))}
            tagClassName="rounded bg-background/60 px-1.5 py-0.5 text-[10px] text-foreground"
          />
        ) : null}

        {entry.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {entry.description}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded border border-border/60 bg-background/60">
          <table className="min-w-full text-[10px] text-muted-foreground">
            <thead className="bg-background/80 uppercase tracking-[0.2em]">
              <tr>
                {STAT_HEADERS.map((h) => (
                  <th key={h.key} className="px-2 py-1 text-center font-semibold">
                    {h.label}
                  </th>
                ))}
                <th className="px-2 py-1 text-center font-semibold">AS</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border/60">
                {STAT_HEADERS.map((h) => (
                  <td
                    key={h.key}
                    className="px-2 py-1 text-center text-xs font-semibold text-foreground"
                  >
                    {entry[h.key]}
                  </td>
                ))}
                <td className="px-2 py-1 text-center text-xs font-semibold text-foreground">
                  {entry.armour_save != null ? `${entry.armour_save}+` : "-"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardBackground>
    </div>
  );
}
