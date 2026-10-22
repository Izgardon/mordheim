import { useMemo } from "react";

import { useCatalogue } from "@/lib/catalogue-queries";
import { matchesSearchQuery } from "@/lib/matches-search-query";

import type { ItemProperty } from "../types/item-types";

/** As the server filters by type: the property's own type, any case, or none at all. */
const appliesToType = (property: ItemProperty, type: string) =>
  !property.type?.trim() || property.type.trim().toLowerCase() === type.trim().toLowerCase();

/**
 * The item forms' property suggestions (CAT-PERF-08): the campaign's cached `item-properties`
 * list, read once and shared with the Wargear page, filtered to the form's type and the search as
 * you type, so a keystroke sends no request and no late answer can replace newer results.
 */
export function useItemPropertySearch(
  campaignId: number,
  type: string,
  search: string,
  { enabled = true }: { enabled?: boolean } = {}
) {
  const { data } = useCatalogue("item-properties", campaignId, {
    enabled: enabled && Boolean(type),
  });
  const forType = useMemo(
    () => (type ? data.filter((property) => appliesToType(property, type)) : []),
    [data, type]
  );
  const matches = useMemo(
    () => forType.filter((property) => matchesSearchQuery(search, property.name)),
    [forType, search]
  );
  return { forType, matches };
}
