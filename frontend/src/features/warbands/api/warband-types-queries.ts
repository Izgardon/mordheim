import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type { WarbandTypeRow } from "../types/warband-types";

/** The book's types change with a reseed, a campaign's own when a player adds one (this tab). */
const WARBAND_TYPES_STALE_TIME_MS = 5 * 60_000;

export function listWarbandTypes(campaignId: number) {
  return apiRequest<WarbandTypeRow[]>(`/campaigns/${campaignId}/warband-types/`);
}

export function addWarbandType(campaignId: number, payload: { name: string; link_url?: string }) {
  return apiRequest<WarbandTypeRow>(`/campaigns/${campaignId}/warband-types/`, {
    method: "POST",
    body: payload,
  });
}

/** The warband types the campaign may pick, each saying whether it is in play there. */
export function useWarbandTypes(
  campaignId: number,
  { enabled = true }: { enabled?: boolean } = {}
) {
  return useQuery({
    queryKey: queryKeys.campaign.warbandTypes(campaignId),
    queryFn: () => listWarbandTypes(campaignId),
    staleTime: WARBAND_TYPES_STALE_TIME_MS,
    enabled: enabled && campaignId > 0,
  });
}

/** Adds a type of the campaign's own, which every player there can pick, to the cached list. */
export function useAddWarbandType(campaignId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; link_url?: string }) =>
      addWarbandType(campaignId, payload),
    onSuccess: (added) => {
      queryClient.setQueryData<WarbandTypeRow[]>(
        queryKeys.campaign.warbandTypes(campaignId),
        (rows: WarbandTypeRow[] | undefined) => (rows ? [...rows, added] : rows)
      );
    },
  });
}
