import { useQuery } from "@tanstack/react-query";

import { ApiError } from "@/lib/api-client";
import { CATALOGUE_STALE_TIME_MS } from "@/lib/catalogue-queries";
import { queryKeys, type CatalogueKind } from "@/lib/query-keys";

/**
 * One catalogue entry with its links (a beast's, a hired sword's), cached like the lists: the
 * detail panel and the edit form share one read, a write caches its answer, and
 * `catalogue.changed` marks it stale. `fetch` reads it (`GET <kind>/:id/`).
 */
export function useCatalogueEntryDetail<T>(
  kind: CatalogueKind,
  campaignId: number,
  entryId: number | null,
  fetch: (entryId: number, signal: AbortSignal) => Promise<T>
) {
  const query = useQuery({
    queryKey: queryKeys.campaign.catalogueEntry(campaignId, kind, entryId ?? 0),
    queryFn: ({ signal }) => fetch(entryId as number, signal),
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
