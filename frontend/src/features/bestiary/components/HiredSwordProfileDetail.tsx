import { useEffect, useState } from "react";

import { CardBackground } from "@/components/ui/card-background";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { getHiredSwordProfile } from "../api/bestiary-api";

import type { HiredSwordProfile } from "../types/bestiary-types";

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

function formatCost(cost: number | null, expression: string): string {
  if (expression) return expression;
  if (cost !== null) return `${cost} gc`;
  return "-";
}

type Props = {
  profileId: number;
  onClose: () => void;
};

export default function HiredSwordProfileDetail({ profileId, onClose }: Props) {
  const [profile, setProfile] = useState<HiredSwordProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError("");

    getHiredSwordProfile(profileId)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  if (isLoading) {
    return (
      <CardBackground className="p-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </CardBackground>
    );
  }

  if (error || !profile) {
    return (
      <CardBackground className="space-y-3 p-6">
        <p className="text-sm text-red-600">{error || "Entry not found"}</p>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Back
        </Button>
      </CardBackground>
    );
  }

  const entry = profile.bestiary_entry;

  return (
    <CardBackground className="space-y-4 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg text-foreground">{entry.name}</h2>
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
            Hired Sword
            {entry.large ? " \u2022 Large" : ""}
            {entry.caster !== "No" ? ` \u2022 ${entry.caster}` : ""}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Back
        </Button>
      </div>

      <div className="flex gap-4 text-sm text-muted-foreground">
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
        <div className="flex flex-wrap gap-1.5">
          {profile.restrictions.map((r) => (
            <span
              key={`${r.restriction.id}-${r.additional_note}`}
              className="rounded bg-background/60 px-2 py-0.5 text-xs text-muted-foreground"
            >
              {r.restriction.restriction}
              {r.additional_note ? ` (${r.additional_note})` : ""}
            </span>
          ))}
        </div>
      ) : null}

      {profile.available_skill_types.length > 0 ? (
        <section className="space-y-1">
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
            Available Skill Types
          </p>
          <div className="flex flex-wrap gap-1.5">
            {profile.available_skill_types.map((type) => (
              <span
                key={type}
                className="rounded bg-background/60 px-2 py-0.5 text-xs text-foreground"
              >
                {type}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {entry.description ? (
        <p className="text-sm text-muted-foreground">{entry.description}</p>
      ) : null}

      <div className="overflow-x-auto rounded border border-border/60 bg-background/60">
        <table className="min-w-full text-xs text-muted-foreground">
          <thead className="bg-background/80 uppercase tracking-[0.2em]">
            <tr>
              {STAT_HEADERS.map((h) => (
                <th
                  key={h.key}
                  className="px-3 py-1.5 text-center font-semibold"
                >
                  {h.label}
                </th>
              ))}
              <th className="px-3 py-1.5 text-center font-semibold">AS</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border/60">
              {STAT_HEADERS.map((h) => (
                <td
                  key={h.key}
                  className="px-3 py-1.5 text-center text-sm font-semibold text-foreground"
                >
                  {entry[h.key]}
                </td>
              ))}
              <td className="px-3 py-1.5 text-center text-sm font-semibold text-foreground">
                {entry.armour_save != null ? `${entry.armour_save}+` : "-"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {entry.skills.length > 0 || entry.specials.length > 0 ? (
        <section className="space-y-1">
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
            Skills &amp; Special Rules
          </p>
          <div className="flex flex-wrap gap-2">
            {entry.skills.map((skill) => (
              <Tooltip
                key={`skill-${skill.id}`}
                trigger={
                  <span className="cursor-help rounded bg-background/60 px-2 py-0.5 text-xs text-foreground underline decoration-dotted underline-offset-2">
                    {skill.name}
                  </span>
                }
                content={
                  skill.description?.trim() || "No description available."
                }
              />
            ))}
            {entry.specials.map((special) => (
              <Tooltip
                key={`special-${special.id}`}
                trigger={
                  <span className="cursor-help rounded bg-background/60 px-2 py-0.5 text-xs text-foreground underline decoration-dotted underline-offset-2">
                    {special.name}
                  </span>
                }
                content={
                  special.description?.trim() || "No description available."
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {entry.spells.length > 0 ? (
        <section className="space-y-1">
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
            Spells
          </p>
          <div className="flex flex-wrap gap-2">
            {entry.spells.map((spell) => (
              <Tooltip
                key={spell.id}
                trigger={
                  <span className="cursor-help rounded bg-background/60 px-2 py-0.5 text-xs text-foreground underline decoration-dotted underline-offset-2">
                    {spell.name}
                  </span>
                }
                content={
                  spell.description?.trim() || "No description available."
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {entry.equipment.length > 0 ? (
        <section className="space-y-1">
          <p className="text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground">
            Equipment
          </p>
          <div className="flex flex-wrap gap-2">
            {entry.equipment.map((equip) => (
              <Tooltip
                key={equip.item.id}
                trigger={
                  <span className="cursor-help rounded bg-background/60 px-2 py-0.5 text-xs text-foreground underline decoration-dotted underline-offset-2">
                    {equip.item.name}
                    {equip.quantity > 1 ? ` x${equip.quantity}` : ""}
                  </span>
                }
                content={
                  equip.item.description?.trim() || "No description available."
                }
              />
            ))}
          </div>
        </section>
      ) : null}
    </CardBackground>
  );
}
