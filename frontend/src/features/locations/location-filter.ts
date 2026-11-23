import { matchesSearchQuery } from "@/lib/matches-search-query";

import type { LocationGroup } from "./types";

/**
 * The groups a search leaves: a group whose name or words match keeps all its locations, else it
 * keeps the locations whose name or rules match, and is left out when none does.
 */
export function filterGroups(groups: LocationGroup[], query: string): LocationGroup[] {
  if (!query.trim()) return groups;
  return groups.flatMap((group) => {
    if (matchesSearchQuery(query, group.name, group.description, group.restrictions))
      return [group];
    const locations = group.locations.filter((place) =>
      matchesSearchQuery(query, place.name, place.rules)
    );
    return locations.length ? [{ ...group, locations }] : [];
  });
}

/** "3 locations", the line under a group's name. */
export const locationCount = (group: LocationGroup) =>
  `${group.locations.length} ${group.locations.length === 1 ? "location" : "locations"}`;

/** "1 hero · Trading action", the line under a location's name. */
export const locationSub = (place: { heroes_text: string; takes_trading_action: boolean }) =>
  place.takes_trading_action ? `${place.heroes_text} · Trading action` : place.heroes_text;
