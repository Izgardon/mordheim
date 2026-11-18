import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import DiceEntry from "@/components/ui/dice-entry";
import { IconButton } from "@/components/ui/icon-button";
import {
  explorationIncomeNote,
  paysShards,
} from "@/features/battles/components/postbattle/postbattle-rules";
import {
  getSelectedExplorationDiceValues,
  setLocalExplorationResource,
} from "@/features/battles/components/postbattle/postbattle-utils";
import type { ExplorationState } from "@/features/battles/hooks/useExploration";
import type { ExplorationChart } from "@/features/exploration/types/exploration-types";
import { placesFound } from "@/features/exploration/utils/places-found";
import type { WarbandResource } from "@/features/warbands/types/warband-types";
import { cn } from "@/lib/utils";

import ExploreDie from "./ExploreDie";
import ExplorePlaceCard from "./ExplorePlaceCard";

/**
 * Explore (design E): the dice (one per hero on his feet, one more for a win), rolled once or
 * typed in a box each, and kept with the draft; afterwards each die is still typed over or thrown
 * again on its own (`ExploreDie`), and the rest of the roll stays put; the total and the shards it
 * finds; which resource they go to; and each multiple's place with what the campaign's chart says
 * it does.
 */
export default function ExploreTab({
  explore,
  chart,
  resources,
  why,
  isMobile,
  onReadAndRoll,
}: {
  explore: ExplorationState;
  /** The campaign's chart (`campaigns/:id/exploration/`): its places and their rules text. */
  chart?: ExplorationChart;
  resources: WarbandResource[];
  /** "3 heroes on their feet, +1 for winning". */
  why: string;
  isMobile: boolean;
  /** Opens the campaign's locations searched for the place (none when they're switched off). */
  onReadAndRoll?: (place: string) => void;
}) {
  const { exploration, amount, rolled } = explore;
  if (!exploration) return null;
  const chosen = getSelectedExplorationDiceValues(exploration);
  const found = rolled ? placesFound(chart, chosen) : [];
  const hot = new Set(found.map((entry) => entry.face));
  const pays = paysShards(explore.rules);
  const note = explorationIncomeNote(explore.rules);
  const total = chosen.reduce((sum, value) => sum + value, 0);
  const take = (faces: number[]) =>
    explore.setExploration({ ...exploration, diceValues: faces, hasRolledAllDice: true });

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
          <div role="group" aria-label="Exploration dice" className="flex flex-wrap gap-2">
            {exploration.diceValues.map((value, index) => (
              <ExploreDie
                key={index}
                index={index}
                value={value as number}
                found={hot.has(value as number)}
                chosen={exploration.selectedDice[index]}
                isMobile={isMobile}
                onFace={(face) => explore.setDie(index, face)}
              />
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
            <DiceEntry
              dice={`${exploration.diceCount}D6`}
              onFaces={take}
              button={(roll) => (
                <Button disabled={exploration.diceCount <= 0} onClick={roll}>
                  Roll {exploration.diceCount}D6
                </Button>
              )}
            />
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
            {pays ? (
              <span className="font-display text-[22px] font-semibold text-accent-hi">
                {rolled ? `${amount} ${amount === 1 ? "shard" : "shards"}` : "Not rolled yet"}
              </span>
            ) : null}
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
        {pays ? null : (
          // this chart pays no wyrdstone: what the total gives is its own, in its own words
          <p className="m-0 whitespace-pre-line border-t border-line pt-3 text-sm text-text2">
            {note}
          </p>
        )}
      </article>
      {found.map((entry) => (
        <ExplorePlaceCard key={entry.face} found={entry} onReadAndRoll={onReadAndRoll} />
      ))}
    </div>
  );
}
