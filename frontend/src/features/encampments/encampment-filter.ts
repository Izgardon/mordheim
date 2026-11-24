import { matchesSearchQuery } from "@/lib/matches-search-query";

import type { CampaignEncampment, EncampmentGroup } from "./types";

/**
 * The groups a search leaves: a group whose name or words match keeps all its encampments, else it
 * keeps the encampments whose name, gaining, words or holder match, and is left out when none does.
 */
export function filterGroups(groups: EncampmentGroup[], query: string): EncampmentGroup[] {
  if (!query.trim()) return groups;
  return groups.flatMap((group) => {
    if (matchesSearchQuery(query, group.name, group.description)) return [group];
    const encampments = group.encampments.filter((camp) =>
      matchesSearchQuery(query, camp.name, camp.gained_by, camp.text, camp.holder?.name ?? "")
    );
    return encampments.length ? [{ ...group, encampments }] : [];
  });
}

/** "3 encampments", the line under a group's name. */
export const encampmentCount = (group: EncampmentGroup) =>
  `${group.encampments.length} ${group.encampments.length === 1 ? "encampment" : "encampments"}`;

/** The line under an encampment's name: who holds it (and whose warband), nobody, or razed. */
export const holdingLine = (camp: CampaignEncampment) =>
  camp.razed
    ? "Razed"
    : camp.holder
      ? `Held by ${camp.holder.name} (${camp.holder.player})`
      : "Nobody's";
