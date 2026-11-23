import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { unitName } from "@/features/warbands/components/roster/unit-view";
import type { WarbandHero } from "@/features/warbands/types/warband-types";
import { getErrorMessage } from "@/lib/get-error-message";
import { cn } from "@/lib/utils";

import { useLocationVisit } from "../api/location-queries";
import { firstPick, outsideRange } from "../hero-picks";
import type { CampaignLocation } from "../types";

/**
 * Visit: pick the heroes who go (the first whose trading action is unspent, at first) and send
 * them. A pick outside the location's range warns and still goes; so does a hero whose trading
 * action is spent where the location takes it.
 */
export default function LocationVisit({
  location,
  warbandId,
  heroes,
}: {
  location: CampaignLocation;
  warbandId: number;
  heroes: WarbandHero[];
}) {
  const visit = useLocationVisit(warbandId);
  const [picked, setPicked] = useState<number[]>(() => firstPick(heroes));
  const [error, setError] = useState("");
  const toggle = (id: number) =>
    setPicked((now) => (now.includes(id) ? now.filter((entry) => entry !== id) : [...now, id]));
  const outside = outsideRange(location, picked.length, heroes.length);
  const send = () => {
    setError("");
    visit.mutate(
      {
        locationId: location.id,
        heroIds: heroes.filter((h) => picked.includes(h.id)).map((h) => h.id),
      },
      {
        // the next pick is the first hero whose trading action is still unspent
        onSuccess: (answer) => {
          const now = new Map(answer.heroes.map((hero) => [hero.id, hero.trading_action]));
          setPicked(
            firstPick(
              heroes.map((hero) => ({
                ...hero,
                trading_action: now.get(hero.id) ?? hero.trading_action,
              }))
            )
          );
        },
        onError: (failure) => setError(getErrorMessage(failure, "Couldn't send the heroes.")),
      }
    );
  };

  if (!heroes.length) return null;
  return (
    <section
      aria-label={`Visit ${location.name}`}
      className="flex flex-col gap-2 border-t border-line pt-3"
    >
      <div role="group" aria-label="Heroes who go" className="flex flex-wrap gap-1.5">
        {heroes.map((hero) => {
          const spent = location.takes_trading_action && hero.trading_action === false;
          return (
            // a spent trading action reads at a glance, struck through and faded, not as a word
            // (William, 23 Nov 2026); it can still go, and the server warns
            <Chip
              key={hero.id}
              pressed={picked.includes(hero.id)}
              onClick={() => toggle(hero.id)}
              title={spent ? "Trading action spent" : undefined}
              aria-description={spent ? "Trading action spent" : undefined}
              className={cn(spent && "border-dashed opacity-55 line-through")}
            >
              {unitName(hero)}
            </Chip>
          );
        })}
      </div>
      {outside ? (
        <p className="m-0 text-xs font-semibold text-danger">{`${location.name} is for ${location.heroes_text.toLowerCase()}.`}</p>
      ) : null}
      {error ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <Button
        size="sm"
        className="self-start"
        disabled={!picked.length || visit.isPending}
        onClick={send}
      >
        {visit.isPending ? "Sending…" : "Visit"}
      </Button>
    </section>
  );
}
