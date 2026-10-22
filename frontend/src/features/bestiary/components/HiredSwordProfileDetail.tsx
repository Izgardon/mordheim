import { useEffect, useState } from "react";

import { CardBackground } from "@/components/ui/card-background";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import DetailCardContent from "@/features/warbands/components/shared/unit_details/DetailCardContent";
import type { DetailEntry } from "@/features/warbands/components/shared/unit_details/detail-types";
import { getHiredSwordProfile } from "../api/bestiary-api";
import {
  DETAIL_CHIP_CLASS,
  DetailHeader,
  DetailSection,
  EntryStatTable,
} from "./detail/entry-detail-parts";

import type { HiredSwordProfile } from "../types/bestiary-types";

function formatCost(cost: number | null, expression: string): string {
  if (expression) return expression;
  if (cost !== null) return `${cost} gc`;
  return "-";
}

function renderDetailTooltip(key: string, triggerLabel: string, entry: DetailEntry) {
  return (
    <Tooltip
      key={key}
      trigger={<span className={DETAIL_CHIP_CLASS}>{triggerLabel}</span>}
      content={
        <CardBackground className="surface-panel-strong max-h-[40vh] overflow-y-auto p-5 text-foreground shadow-xl">
          <DetailCardContent entry={entry} />
        </CardBackground>
      }
      contentClassName="fixed z-[60] max-h-[40vh] overflow-visible bg-transparent p-0 shadow-none"
      minWidth={320}
      maxWidth={320}
      maxHeight="40vh"
    />
  );
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
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
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
      <CardBackground className="surface-panel-strong p-6">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </CardBackground>
    );
  }

  if (error || !profile) {
    return (
      <CardBackground className="surface-panel-strong space-y-3 p-6">
        <p className="text-sm text-red-600">{error || "Entry not found"}</p>
        <Button variant="secondary" size="sm" onClick={onClose}>
          Back
        </Button>
      </CardBackground>
    );
  }

  const entry = profile.bestiary_entry;

  return (
    <CardBackground className="surface-panel-strong space-y-4 p-4 sm:p-6">
      <DetailHeader name={entry.name} kind="Hired Sword" entry={entry} onClose={onClose} />

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

      <EntryStatTable entry={entry} />

      {entry.skills.length > 0 || entry.specials.length > 0 ? (
        <DetailSection title="Skills & Special Rules">
          {entry.skills.map((skill) =>
            renderDetailTooltip(`skill-${skill.id}`, skill.name, {
              id: skill.id,
              type: "skill",
              name: skill.name,
            })
          )}
          {entry.specials.map((special) =>
            renderDetailTooltip(`special-${special.id}`, special.name, {
              id: special.id,
              type: "special",
              name: special.name,
            })
          )}
        </DetailSection>
      ) : null}

      {entry.spells.length > 0 ? (
        <DetailSection title="Spells">
          {entry.spells.map((spell) =>
            renderDetailTooltip(`spell-${spell.id}`, spell.name, {
              id: spell.id,
              type: "spell",
              name: spell.name,
            })
          )}
        </DetailSection>
      ) : null}

      {entry.equipment.length > 0 ? (
        <DetailSection title="Equipment">
          {entry.equipment.map((equip) =>
            renderDetailTooltip(
              `item-${equip.item.id}`,
              `${equip.item.name}${equip.quantity > 1 ? ` x${equip.quantity}` : ""}`,
              {
                id: equip.item.id,
                type: "item",
                name: equip.item.name,
              }
            )
          )}
        </DetailSection>
      ) : null}
    </CardBackground>
  );
}
