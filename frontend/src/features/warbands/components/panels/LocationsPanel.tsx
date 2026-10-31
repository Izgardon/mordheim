import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { SidePanel } from "@/components/ui/side-panel";
import { useCampaignLocations } from "@/features/campaigns/api/campaign-queries";
import type { CampaignLocation } from "@/features/campaigns/types/campaign-types";
import { cn } from "@/lib/utils";

import type { WarbandHero } from "../../types/warband-types";
import { rollDie } from "@/lib/dice";
import LocationVisit from "./LocationVisit";

type LocationsPanelProps = {
  campaignId: number;
  /** Your warband: Send a hero logs to it. Without one (or `canEdit`), the panel only reads. */
  warbandId: number;
  heroes: WarbandHero[];
  canEdit: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens searched for this (Explore's "Read and roll" names the location it found). */
  initialSearch?: string;
};

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
 * The campaign's locations (design E): search, area chips built from the areas in use, an area
 * tag and flags on each, a D6 roll for those with results, and Send a hero.
 */
export default function LocationsPanel(props: LocationsPanelProps) {
  const { campaignId } = props;
  const locations = useCampaignLocations(campaignId, { enabled: props.open });
  const [search, setSearch] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [sending, setSending] = useState<number | null>(null);
  const [rolls, setRolls] = useState<Record<number, number>>({});
  const { open, initialSearch } = props;
  useEffect(() => {
    if (open && initialSearch) setSearch(initialSearch);
  }, [open, initialSearch]);

  const all = locations.data ?? [];
  const areas = [...new Set(all.map((location) => location.area?.trim()).filter(Boolean))].sort();
  const query = search.trim().toLowerCase();
  const shown = all.filter(
    (location) =>
      (area === null || location.area?.trim() === area) &&
      `${location.name} ${location.area ?? ""} ${location.content}`.toLowerCase().includes(query)
  );

  return (
    <SidePanel open={open} onOpenChange={props.onOpenChange} kicker="Campaign" title="Locations">
      <Input
        type="search"
        aria-label="Search locations"
        placeholder="Search locations"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {areas.length ? (
        <div role="group" aria-label="Area" className="flex flex-wrap gap-1.5">
          <Chip pressed={area === null} onClick={() => setArea(null)}>
            All
          </Chip>
          {areas.map((name) => (
            <Chip key={name} pressed={area === name} onClick={() => setArea(name)}>
              {name}
            </Chip>
          ))}
        </div>
      ) : null}
      {locations.isPending ? (
        <p className="text-sm text-muted-foreground">Finding the locations…</p>
      ) : null}
      {locations.data && !shown.length ? (
        <p className="text-sm text-text2">No location matches.</p>
      ) : null}
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {shown.map((location) => {
          const isSending = sending === location.id;
          const rolled = rolls[location.id];
          return (
            <li
              key={location.id}
              className={cn(
                "flex flex-col gap-2.5 border bg-surface px-3.5 py-3",
                isSending ? "border-accent-line" : "border-border"
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
                      <button
                        type="button"
                        className="text-xs font-bold text-accent-text hover:underline"
                        onClick={() => setRolls((all) => ({ ...all, [location.id]: rollDie(6) }))}
                      >
                        {rolled ? "Roll again" : "Roll D6"}
                      </button>
                    </div>
                  ) : null}
                  {rolled ? (
                    <p className="m-0 border-l-2 border-accent-line pl-2.5 text-[13px] text-ink">
                      <span className="mr-1.5 font-mono font-bold text-accent-hi">{rolled}</span>
                      {d6Results(location)[rolled - 1]?.trim() || "Nothing listed for this roll."}
                    </p>
                  ) : null}
                </div>
                {props.canEdit ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-expanded={isSending}
                    onClick={() => setSending(isSending ? null : location.id)}
                  >
                    Send a hero
                  </Button>
                ) : null}
              </div>
              {isSending ? (
                <LocationVisit
                  location={location}
                  warbandId={props.warbandId}
                  heroes={props.heroes}
                  onLogged={() => setSending(null)}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </SidePanel>
  );
}
