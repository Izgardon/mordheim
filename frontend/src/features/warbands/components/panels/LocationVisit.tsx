import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import type { CampaignLocation } from "@/features/campaigns/types/campaign-types";
import { getErrorMessage } from "@/lib/get-error-message";

import { useLedgerEntry } from "../../api/economy-queries";
import { markLedgerStale } from "../../api/warband-cache";
import { createWarbandLog } from "../../api/warbands-api";
import { ADJUSTMENT } from "../../hooks/warband/useTreasuryEntryForm";
import type { WarbandHero } from "../../types/warband-types";
import { unitName } from "../roster/unit-view";

/**
 * Send a hero to a location: pick him, then log what he brought back by hand: gold as a ledger
 * adjustment, an item or an injury in the warband log.
 */
export default function LocationVisit({
  location,
  warbandId,
  heroes,
  onLogged,
}: {
  location: CampaignLocation;
  warbandId: number;
  heroes: WarbandHero[];
  onLogged: () => void;
}) {
  const queryClient = useQueryClient();
  const ledgerEntry = useLedgerEntry(warbandId);
  const [heroId, setHeroId] = useState<number | null>(null);
  const [gold, setGold] = useState("");
  const [item, setItem] = useState("");
  const [injury, setInjury] = useState("");
  const hero = heroes.find((entry) => entry.id === heroId);

  const log = async (who: string) => {
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
      onLogged();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const field = (label: string, value: string, set: (next: string) => void, numeric = false) => (
    <label className="flex flex-col gap-1 text-xs font-bold text-muted-foreground">
      {label}
      <Input
        inputSize="sm"
        inputMode={numeric ? "numeric" : undefined}
        placeholder={numeric ? "0" : "None"}
        value={value}
        onChange={(event) => set(event.target.value)}
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-2.5 border-t border-line pt-2.5">
      <div role="group" aria-label="Hero" className="flex flex-wrap gap-1.5">
        {heroes.map((entry) => (
          <Chip key={entry.id} pressed={entry.id === heroId} onClick={() => setHeroId(entry.id)}>
            {unitName(entry)}
          </Chip>
        ))}
      </div>
      {hero ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {field("Gold", gold, setGold, true)}
            {field("Item found", item, setItem)}
            {field("Injury", injury, setInjury)}
          </div>
          <Button size="sm" className="self-end" onClick={() => void log(unitName(hero))}>
            Log {unitName(hero)}&apos;s visit
          </Button>
        </>
      ) : null}
    </div>
  );
}
