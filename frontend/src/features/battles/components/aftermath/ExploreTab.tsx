import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import {
  getSelectedExplorationDiceValues,
  setLocalExplorationResource,
} from "@/features/battles/components/postbattle/postbattle-utils";
import { explorationMultiples } from "@/features/battles/data/exploration-multiples";
import type { ExplorationState } from "@/features/battles/hooks/useExploration";
import type { WarbandResource } from "@/features/warbands/types/warband-types";
import { rollDice } from "@/lib/dice";
import { cn } from "@/lib/utils";

/**
 * Explore (design E): the dice (one per hero on his feet, one more for a win), rolled once and
 * kept with the draft; the total and the shards it finds; which resource they go to; and each
 * multiple's place, whose rules "Read and roll" opens in the campaign's locations.
 */
export default function ExploreTab({
  explore,
  resources,
  why,
  isMobile,
  onReadAndRoll,
}: {
  explore: ExplorationState;
  resources: WarbandResource[];
  /** "3 heroes on their feet, +1 for winning". */
  why: string;
  isMobile: boolean;
  /** Opens the campaign's locations searched for the place (none when they're switched off). */
  onReadAndRoll?: (place: string) => void;
}) {
  const { exploration, amount } = explore;
  if (!exploration) return null;
  const rolled =
    exploration.diceValues.length > 0 && exploration.diceValues.every((v) => v !== null);
  const chosen = getSelectedExplorationDiceValues(exploration);
  const multiples = rolled ? explorationMultiples(chosen) : [];
  const hot = new Set(multiples.map((entry) => entry.face));
  const total = chosen.reduce((sum, value) => sum + value, 0);
  const roll = () =>
    explore.setExploration({
      ...exploration,
      diceValues: rollDice(exploration.diceCount),
      hasRolledAllDice: true,
    });

  return (
    <div className="flex flex-col gap-3">
      <article className="flex flex-col gap-3.5 border border-border bg-surface p-[18px]">
        <div className="flex items-baseline justify-between gap-2.5">
          {isMobile ? null : (
            <h2 className="m-0 font-display text-[19px] font-semibold text-head">Exploration</h2>
          )}
          <span className="text-xs text-muted-foreground">{why}</span>
        </div>
        {rolled ? (
          <div className="flex flex-wrap gap-2">
            {exploration.diceValues.map((value, index) => (
              <span
                key={index}
                className={cn(
                  "box-border flex items-center justify-center font-mono font-bold",
                  isMobile ? "h-[52px] w-[52px] text-[22px]" : "h-14 w-14 text-2xl",
                  hot.has(value as number) && exploration.selectedDice[index]
                    ? "border-2 border-primary text-accent-hi"
                    : "border border-strong text-head",
                  !exploration.selectedDice[index] && "opacity-40"
                )}
              >
                {value}
              </span>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <IconButton
                aria-label="One die fewer"
                className="h-9 w-9"
                disabled={exploration.diceCount <= 0}
                onClick={() => explore.commitDiceCount(exploration.diceCount - 1)}
              >
                <Minus aria-hidden="true" />
              </IconButton>
              <span className="min-w-[64px] text-center font-mono text-sm text-text2">
                {exploration.diceCount} {exploration.diceCount === 1 ? "die" : "dice"}
              </span>
              <IconButton
                aria-label="One die more"
                className="h-9 w-9"
                disabled={exploration.diceCount >= explore.limits.max}
                onClick={() => explore.commitDiceCount(exploration.diceCount + 1)}
              >
                <Plus aria-hidden="true" />
              </IconButton>
            </div>
            <Button disabled={exploration.diceCount <= 0} onClick={roll}>
              Roll {exploration.diceCount}D6
            </Button>
          </div>
        )}
        <div
          className={cn(
            "flex gap-x-6 gap-y-3 border-t border-line pt-3",
            isMobile ? "flex-col" : "flex-wrap items-center"
          )}
        >
          <div className="flex items-baseline justify-between gap-6">
            <span className="text-text2">Total {rolled ? total : "–"}</span>
            <span className="font-display text-[22px] font-semibold text-accent-hi">
              {rolled ? `${amount} ${amount === 1 ? "shard" : "shards"}` : "Not rolled yet"}
            </span>
          </div>
          <label
            className={cn(
              "flex gap-2 text-[13px] font-semibold text-muted-foreground",
              isMobile ? "flex-col gap-1 text-xs font-bold" : "ml-auto items-center"
            )}
          >
            {isMobile ? "Add them to" : "Add to"}
            <select
              value={exploration.resourceId ?? ""}
              onChange={(event) =>
                explore.setExploration(
                  setLocalExplorationResource(
                    exploration,
                    event.target.value ? Number(event.target.value) : null
                  )
                )
              }
              className={cn(
                "border border-strong bg-page px-2.5 text-ink",
                isMobile ? "min-h-11 text-[15px]" : "min-h-10 text-sm"
              )}
            >
              {resources.length === 0 ? <option value="">No resources yet</option> : null}
              {resources.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>
      {multiples.map((multiple) => (
        <article
          key={multiple.face}
          className="flex items-center justify-between gap-3 border border-accent-line bg-panel px-[18px] py-4"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-accent-text">
              {multiple.kicker}
            </span>
            <span className="font-display text-[19px] font-semibold text-head">
              {multiple.place}
            </span>
          </div>
          {onReadAndRoll ? (
            <Button
              variant="secondary"
              className="border-accent-line text-accent-hi"
              onClick={() => onReadAndRoll(multiple.place)}
            >
              Read and roll
            </Button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
