import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api-client";
import { CATALOGUE_STALE_TIME_MS } from "@/lib/catalogue-queries";
import { queryKeys } from "@/lib/query-keys";

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
  const query = useQuery({
    queryKey: queryKeys.campaign.catalogueEntry(campaignId, kind, entryId ?? 0),
    queryFn: ({ signal }) => getHirelingProfile(kind, entryId as number, signal),
    enabled: entryId !== null && campaignId > 0,
    staleTime: CATALOGUE_STALE_TIME_MS,
  });
  const error =
    query.error && query.data === undefined
      ? (query.error instanceof Error && query.error.message) || "Failed to load"
      : "";
  return {
    entry: query.data ?? null,
    isLoading: query.isLoading,
    error,
    /** The server answered 404: it has no such entry (a version reverted, an entry deleted). */
    gone: query.error instanceof ApiError && query.error.status === 404,
  };
}
