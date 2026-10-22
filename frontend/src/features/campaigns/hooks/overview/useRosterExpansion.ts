import { useState } from "react";
import { useQueries } from "@tanstack/react-query";

// api
import { rosterStatsQuery } from "../../api/campaign-queries";

// other
import { getErrorMessage } from "@/lib/get-error-message";

// types
import type { CampaignPlayer, RosterUnit } from "../../types/campaign-types";
import type { RosterStatsRow, WarbandRosterStats } from "@/features/warbands/api/warbands-core";

/** A `roster-stats/` row as the roster's units table shows it, keyed by kind. */
const toRosterUnit =
  (prefix: string, category: RosterUnit["category"]) =>
  ({ id, ...stats }: RosterStatsRow): RosterUnit => ({ id: `${prefix}-${id}`, category, ...stats });

/** The three kinds' stat lines in one list, heroes first (stable, so `select` memoises it). */
export function toRosterUnits(stats: WarbandRosterStats): RosterUnit[] {
  return [
    ...stats.heroes.map(toRosterUnit("hero", "Heroes")),
    ...stats.henchmen_groups.map(toRosterUnit("henchmen", "Henchmen")),
    ...stats.hirelings.map(toRosterUnit("hireling", "Hired Swords")),
  ];
}

type Expanded = { playerId: number; warbandId: number | null };

/**
 * Which roster rows are open, and each open warband's units: one cached `roster-stats/` read per
 * warband (PERF-42), kept when the row folds, so unfolding it again sends nothing.
 */
export function useRosterExpansion(campaignId: number) {
  const [expanded, setExpanded] = useState<Expanded[]>([]);
  const warbandIds = expanded.flatMap((entry) => (entry.warbandId ? [entry.warbandId] : []));
  const results = useQueries({
    queries: warbandIds.map((warbandId) => ({
      ...rosterStatsQuery(campaignId, warbandId),
      select: toRosterUnits,
    })),
  });

  const heroSnapshots: Record<number, RosterUnit[]> = {};
  const snapshotLoading: Record<number, boolean> = {};
  const snapshotErrors: Record<number, string> = {};
  warbandIds.forEach((warbandId, index) => {
    const result = results[index];
    if (result.data) {
      heroSnapshots[warbandId] = result.data;
    }
    snapshotLoading[warbandId] = result.isPending && result.isFetching;
    snapshotErrors[warbandId] = result.error
      ? getErrorMessage(result.error, "Unable to load warband roster")
      : "";
  });

  const togglePlayer = (player: CampaignPlayer) => {
    setExpanded((prev) =>
      prev.some((entry) => entry.playerId === player.id)
        ? prev.filter((entry) => entry.playerId !== player.id)
        : [...prev, { playerId: player.id, warbandId: player.warband?.id ?? null }]
    );
  };

  return {
    expandedPlayers: expanded.map((entry) => entry.playerId),
    heroSnapshots,
    snapshotLoading,
    snapshotErrors,
    togglePlayer,
  };
}
