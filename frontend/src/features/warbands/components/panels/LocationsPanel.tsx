import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip, ChipLabel } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { SidePanel } from "@/components/ui/side-panel";
import { listCampaignLocations } from "@/features/campaigns/api/campaigns-api";
import type { CampaignLocation } from "@/features/campaigns/types/campaign-types";
import { getErrorMessage } from "@/lib/get-error-message";

import { useLedgerEntry } from "../../api/economy-queries";
import { markLedgerStale } from "../../api/warband-cache";
import { createWarbandLog } from "../../api/warbands-api";
import { ADJUSTMENT } from "../../hooks/warband/useTreasuryEntryForm";
import type { WarbandHero } from "../../types/warband-types";
import { unitName } from "../roster/unit-view";

type LocationsPanelProps = {
  campaignId: number;
  warbandId: number;
  heroes: WarbandHero[];
  canEdit: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const hasD6 = (location: CampaignLocation) =>
  [location.d6_1, location.d6_2, location.d6_3, location.d6_4, location.d6_5, location.d6_6].some(
    (entry) => entry?.trim()
  );

/**
 * The campaign's locations (design E): search, a D6 flag, and Send a hero, which logs what he
 * brought back by hand: gold as a ledger adjustment, an item or an injury in the warband log.
 * The locations have no area or type yet, so there is no area filter.
 */
export default function LocationsPanel(props: LocationsPanelProps) {
  const { campaignId, warbandId } = props;
  const queryClient = useQueryClient();
  const ledgerEntry = useLedgerEntry(warbandId);
  const locations = useQuery({
    queryKey: ["campaign", campaignId, "locations"],
    queryFn: () => listCampaignLocations(campaignId),
    enabled: props.open,
  });
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState<{ locationId: number; heroId: number | null } | null>(
    null
  );
  const [gold, setGold] = useState("");
  const [item, setItem] = useState("");
  const [injury, setInjury] = useState("");
  const query = search.trim().toLowerCase();
  const shown = (locations.data ?? []).filter((location) =>
    `${location.name} ${location.content}`.toLowerCase().includes(query)
  );

  const log = async (location: CampaignLocation, hero: WarbandHero) => {
    const who = unitName(hero);
    try {
      const amount = Number(gold) || 0;
      if (amount) {
        await ledgerEntry.mutateAsync({
          action: ADJUSTMENT,
          description: `${location.name}: found by ${who}`,
          price: amount,
        });
      }
      if (item.trim() || injury.trim()) {
        await createWarbandLog(warbandId, {
          feature: "location",
          entry_type: "visit",
          payload: { location: location.name, hero: who, item: item.trim(), injury: injury.trim() },
        });
        markLedgerStale(queryClient, warbandId);
      }
      toast.success(`${who}'s visit to ${location.name} is logged.`);
      setSending(null);
      setGold("");
      setItem("");
      setInjury("");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <SidePanel
      open={props.open}
      onOpenChange={props.onOpenChange}
      kicker="Campaign"
      title="Locations"
    >
      <Input
        type="search"
        aria-label="Search locations"
        placeholder="Search locations"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {locations.isPending ? (
        <p className="text-sm text-muted-foreground">Finding the locations…</p>
      ) : null}
      {locations.data && !shown.length ? (
        <p className="text-sm text-text2">No location matches.</p>
      ) : null}
      <ul className="m-0 flex list-none flex-col border-t border-line p-0">
        {shown.map((location) => {
          const open = sending?.locationId === location.id;
          const hero = props.heroes.find((entry) => entry.id === sending?.heroId);
          return (
            <li key={location.id} className="flex flex-col gap-2.5 border-b border-line py-3">
              <div className="flex items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="font-bold text-ink">{location.name}</span>
                  {location.content ? (
                    <span className="line-clamp-3 text-[13px] text-text2">{location.content}</span>
                  ) : null}
                  {hasD6(location) ? (
                    <div className="flex gap-1.5">
                      <ChipLabel>D6 roll</ChipLabel>
                    </div>
                  ) : null}
                </div>
                {props.canEdit ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    aria-expanded={open}
                    onClick={() =>
                      setSending(open ? null : { locationId: location.id, heroId: null })
                    }
                  >
                    Send a hero
                  </Button>
                ) : null}
              </div>
              {open ? (
                <div className="flex flex-col gap-2.5 border border-line bg-raised p-3">
                  <div role="group" aria-label="Hero" className="flex flex-wrap gap-1.5">
                    {props.heroes.map((entry) => (
                      <Chip
                        key={entry.id}
                        pressed={entry.id === sending?.heroId}
                        onClick={() => setSending({ locationId: location.id, heroId: entry.id })}
                      >
                        {unitName(entry)}
                      </Chip>
                    ))}
                  </div>
                  {hero ? (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
                          Gold
                          <Input
                            inputSize="sm"
                            inputMode="numeric"
                            placeholder="0"
                            value={gold}
                            onChange={(event) => setGold(event.target.value)}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
                          Item found
                          <Input
                            inputSize="sm"
                            placeholder="None"
                            value={item}
                            onChange={(event) => setItem(event.target.value)}
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
                          Injury
                          <Input
                            inputSize="sm"
                            placeholder="None"
                            value={injury}
                            onChange={(event) => setInjury(event.target.value)}
                          />
                        </label>
                      </div>
                      <Button
                        size="sm"
                        className="self-start"
                        onClick={() => void log(location, hero)}
                      >
                        Log {unitName(hero)}&apos;s visit
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </SidePanel>
  );
}
