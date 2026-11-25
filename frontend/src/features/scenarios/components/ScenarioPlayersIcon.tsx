import { GiCrossedSwords, GiThreeFriends } from "react-icons/gi";

import { cn } from "@/lib/utils";

import type { ScenarioPlayers } from "../types";

const LABELS: Record<ScenarioPlayers, string> = {
  "1v1": "1v1",
  multiplayer: "Multiplayer",
  either: "1v1 or multiplayer",
};
const ICONS = {
  "1v1": [GiCrossedSwords],
  multiplayer: [GiThreeFriends],
  either: [GiCrossedSwords, GiThreeFriends],
} as const;

/**
 * Who a scenario is for, to be seen at a glance (William, 25 Nov 2026: "I just want the icon for easy
 * visibility"): crossed swords for two warbands, three figures for three or more, both for either.
 */
export default function ScenarioPlayersIcon({
  players,
  className,
}: {
  players: ScenarioPlayers;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={LABELS[players]}
      title={LABELS[players]}
      className="inline-flex shrink-0 gap-0.5"
    >
      {ICONS[players].map((Icon, index) => (
        <Icon
          key={index}
          aria-hidden="true"
          focusable="false"
          className={cn("h-4 w-4 shrink-0 text-accent-text", className)}
        />
      ))}
    </span>
  );
}

export const playersLabel = (players: ScenarioPlayers) => LABELS[players];

/** A filter's 1v1 or Multiplayer takes in the scenarios for either. */
export const playersMatch = (players: ScenarioPlayers, filter: ScenarioPlayers | "all") =>
  filter === "all" || players === filter || players === "either";
