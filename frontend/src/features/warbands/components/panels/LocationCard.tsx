import { useState } from "react";

import { Button } from "@/components/ui/button";
import RollControl from "@/components/ui/roll-control";
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
 * The Locations page's D6 table (William, 7 Nov 2026: "yes if it is a d6 location"): each result
 * and what it gives, as the panel's result line reads them after a roll. Read only.
 */
function LocationResults({ location }: { location: CampaignLocation }) {
  return (
    <table
      aria-label={`${location.name}: D6 results`}
      className="mt-1 w-full border-collapse text-[13px]"
    >
      <thead>
        <tr>
          <th scope="col" className="w-10 px-2 py-1 text-left text-[11px] font-bold text-faint">
            D6
          </th>
          <th scope="col" className="sr-only">
            Result
          </th>
        </tr>
      </thead>
      <tbody>
        {d6Results(location).map((result, index) => (
          <tr key={index} className="border-t border-line align-baseline">
            <th scope="row" className="px-2 py-1 text-left font-mono font-bold text-accent-hi">
              {index + 1}
            </th>
            <td className={cn("py-1 pr-2", result?.trim() ? "text-ink" : "text-faint")}>
              {result?.trim() || "Nothing listed"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * One location: its name, area and text, a D6 when it has results (the panel's: the shared roll
 * control's box above Roll D6, rolled here or typed in, then locked as Rolled, with the location's
 * result for it), Send a hero (your warband), and Edit and Remove for those who manage locations.
 * On the Locations page it shows its whole text and, for a D6 location, its results; no roll.
 */
export default function LocationCard({
  location,
  warbandId,
  heroes,
  canSend,
  onPage,
  sending,
  onToggleSend,
  onEdit,
  onRemove,
}: {
  location: CampaignLocation;
  warbandId: number;
  heroes: WarbandHero[];
  canSend: boolean;
  onPage: boolean;
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
            <span
              className={cn(
                "text-[13px] text-text2",
                onPage ? "whitespace-pre-line" : "line-clamp-3"
              )}
            >
              {location.content}
            </span>
          ) : null}
          {onPage && hasD6(location) ? <LocationResults location={location} /> : null}
          {!onPage && hasD6(location) ? (
            <RollControl
              dice="D6"
              lockedLabel="Rolled"
              entry="above"
              size="sm"
              quiet
              faces={rolled === null ? null : [rolled]}
              onResult={([face]) => setRolled(face)}
              className="pt-0.5"
            />
          ) : null}
          {!onPage && rolled ? (
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
