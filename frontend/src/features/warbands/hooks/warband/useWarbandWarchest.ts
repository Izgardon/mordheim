import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listWarbandItems } from "@/features/warbands/api/warbands-api";
import { queryKeys } from "@/lib/query-keys";

import type { WarbandItemSummary } from "@/features/warbands/types/warband-types";

const NO_ITEMS: WarbandItemSummary[] = [];
const LOAD_ERROR = "Unable to load warchest items.";

/**
 * The stash, fetched each time it opens (and on `loadWarchestItems`), cached under the warband
 * so item moves elsewhere on the page merge into it.
 */
export function useWarbandWarchest(campaignId: number, warbandId?: number | null) {
  const [isWarchestOpen, setIsWarchestOpen] = useState(false);
  const stash = useQuery({
    queryKey: queryKeys.campaign.warbandStash(campaignId, warbandId ?? 0),
    queryFn: () => listWarbandItems(warbandId ?? 0),
    enabled: isWarchestOpen && Boolean(warbandId),
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const { refetch } = stash;

  const loadWarchestItems = useCallback(async () => {
    if (!warbandId) {
      return;
    }
    await refetch();
  }, [refetch, warbandId]);

  const error = stash.error;
  const warchestError =
    !stash.isFetching && error
      ? error instanceof Error
        ? error.message || LOAD_ERROR
        : LOAD_ERROR
      : "";

  const toggleWarchest = () => setIsWarchestOpen((prev) => !prev);
  const closeWarchest = () => setIsWarchestOpen(false);

  return {
    isWarchestOpen,
    setIsWarchestOpen,
    warchestItems: stash.data ?? NO_ITEMS,
    isWarchestLoading: stash.isFetching,
    warchestError,
    loadWarchestItems,
    toggleWarchest,
    closeWarchest,
  };
}
