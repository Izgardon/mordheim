import { useState } from "react";

import { Button } from "@/components/ui/button";
import DiceEntry from "@/components/ui/dice-entry";
import type { CampaignLocation } from "@/features/campaigns/types/campaign-types";
import { cn } from "@/lib/utils";

import type { WarbandHero } from "../../types/warband-types";
import LocationVisit from "./LocationVisit";

const d6Results = (location: CampaignLocation) => [
  location.d6_1,
  location.d6_2,
  location.d6_3,
  location.d6_4,
  location.d6_5,
  location.d6_6,
];

const hasD6 = (location: CampaignLocation) => d6Results(location).some((entry) => entry?.trim());

/**
 * One location in the Locations panel: its name, area and text, a D6 roll when it has results
 * (rolled, or the die typed in), Send a hero (your warband), and Edit and Remove for those who
 * manage locations.
 */
export default function LocationCard({
  location,
  warbandId,
  heroes,
  canSend,
  sending,
  onToggleSend,
  onEdit,
  onRemove,
}: {
  location: CampaignLocation;
  warbandId: number;
  heroes: WarbandHero[];
  canSend: boolean;
  /** Send a hero is open on this card (one card at a time). */
  sending: boolean;
  onToggleSend: () => void;
  /** With `manage_locations` only. */
  onEdit?: () => void;
  onRemove?: () => void;
}) {
  const [rolled, setRolled] = useState<number | null>(null);

  return (
    <li
      className={cn(
        "flex flex-col gap-2.5 border bg-surface px-3.5 py-3",
        sending ? "border-accent-line" : "border-border"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-baseline gap-2">
            <span className="font-display text-[17px] font-semibold text-head">
              {location.name}
            </span>
            {location.area?.trim() ? (
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-accent-text">
                {location.area}
              </span>
            ) : null}
          </span>
          {location.content ? (
            <span className="line-clamp-3 text-[13px] text-text2">{location.content}</span>
          ) : null}
          {hasD6(location) ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="border border-border px-[7px] py-px text-[11px] font-bold text-muted-foreground">
                D6 roll
              </span>
              <DiceEntry
                dice="D6"
                size="sm"
                className="gap-1.5"
                total={rolled}
                onFaces={([face]) => setRolled(face)}
                onChange={([face]) => (face === null ? setRolled(null) : undefined)}
                button={(roll) => (
                  <button
                    type="button"
                    className="text-xs font-bold text-accent-text hover:underline"
                    onClick={roll}
                  >
                    {rolled ? "Roll again" : "Roll D6"}
                  </button>
                )}
              />
            </div>
          ) : null}
          {rolled ? (
            <p className="m-0 border-l-2 border-accent-line pl-2.5 text-[13px] text-ink">
              <span className="mr-1.5 font-mono font-bold text-accent-hi">{rolled}</span>
              {d6Results(location)[rolled - 1]?.trim() || "Nothing listed for this roll."}
            </p>
          ) : null}
          {onEdit || onRemove ? (
            <div className="flex gap-4 pt-0.5">
              {onEdit ? (
                <button
                  type="button"
                  className="text-xs font-bold text-accent-text hover:underline"
                  aria-label={`Edit ${location.name}`}
                  onClick={onEdit}
                >
                  Edit
                </button>
              ) : null}
              {onRemove ? (
                <button
                  type="button"
                  className="text-xs font-bold text-danger hover:underline"
                  aria-label={`Remove ${location.name}`}
                  onClick={onRemove}
                >
                  Remove
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {canSend ? (
          <Button size="sm" variant="secondary" aria-expanded={sending} onClick={onToggleSend}>
            Send a hero
          </Button>
        ) : null}
      </div>
      {sending ? (
        <LocationVisit
          location={location}
          warbandId={warbandId}
          heroes={heroes}
          onLogged={onToggleSend}
        />
      ) : null}
    </li>
  );
}
