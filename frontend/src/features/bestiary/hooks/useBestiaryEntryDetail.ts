import { useCatalogueEntryDetail } from "@/features/catalogue/hooks/useCatalogueEntryDetail";

import { getBestiaryEntry } from "../api/bestiary-api";

/**
 * One beast with its skills, specials, spells and equipment, cached like the lists: the detail
 * panel and the edit form share one read, a write caches its answer, and `catalogue.changed`
 * marks it stale.
 */
export function useBestiaryEntryDetail(campaignId: number, entryId: number | null) {
  return useCatalogueEntryDetail("bestiary", campaignId, entryId, getBestiaryEntry);
}
