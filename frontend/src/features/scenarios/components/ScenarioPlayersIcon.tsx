import { GiCrossedSwords, GiThreeFriends } from "react-icons/gi";

import { cn } from "@/lib/utils";

import type { ScenarioPlayers } from "../types";

const LABELS: Record<ScenarioPlayers, string> = { "1v1": "1v1", multiplayer: "Multiplayer" };

/** Who a scenario is for: crossed swords for two warbands, three figures for three or more. */
export default function ScenarioPlayersIcon({
  players,
  className,
}: {
  players: ScenarioPlayers;
  className?: string;
}) {
  const Icon = players === "multiplayer" ? GiThreeFriends : GiCrossedSwords;
  return (
    <span role="img" aria-label={LABELS[players]} title={LABELS[players]} className="inline-flex">
      <Icon
        aria-hidden="true"
        focusable="false"
        className={cn("h-4 w-4 shrink-0 text-accent-text", className)}
      />
    </span>
  );
}

export const playersLabel = (players: ScenarioPlayers) => LABELS[players];
