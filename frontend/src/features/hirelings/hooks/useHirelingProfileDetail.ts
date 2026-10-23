import { useCatalogueEntryDetail } from "@/features/catalogue/hooks/useCatalogueEntryDetail";

import { getHirelingProfile } from "../api/hireling-catalogue-api";

import type { HirelingCatalogueKind } from "../hireling-catalogue-kinds";

/**
 * One hired sword or dramatis persona with what it knows and carries, cached like the lists: the
 * detail panel and the edit form share one read, a write caches its answer, and
 * `catalogue.changed` marks it stale.
 */
export function useHirelingProfileDetail(
  kind: HirelingCatalogueKind,
  campaignId: number,
  entryId: number | null
) {
  return useCatalogueEntryDetail(kind, campaignId, entryId, (id, signal) =>
    getHirelingProfile(kind, id, signal)
  );
}
