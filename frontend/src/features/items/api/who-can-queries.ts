import { useMemo } from "react";
import { useQuery, type QueryClient } from "@tanstack/react-query";

import { apiRequest } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

import type { HireAccess, ItemOffer, WarbandGroup, WhoCan } from "../types/item-types";

/** What a warband can buy changes with the catalogue, its type or the settings in play. */
const WHO_CAN_STALE_TIME_MS = 5 * 60_000;
/** The groups change only with a reseed. */
const GROUPS_STALE_TIME_MS = 30 * 60_000;

export function getWhoCan(warbandId: number) {
  return apiRequest<WhoCan>(`/warbands/${warbandId}/who-can/`);
}

export function listWarbandGroups() {
  return apiRequest<WarbandGroup[]>("/warband-groups/");
}

/**
 * What a warband can usually buy, hire and learn, as the server decides it (the items rebuild):
 * each item's price row with `can_buy` and the reason, each hireling's `can_hire`, and the special
 * skills its types may learn, as maps by id. Empty maps while it loads, or with no warband.
 */
export function useWhoCan(campaignId: number, warbandId: number | null | undefined) {
  const query = useQuery({
    queryKey: queryKeys.campaign.warbandWhoCan(campaignId, warbandId ?? 0),
    queryFn: () => getWhoCan(warbandId as number),
    staleTime: WHO_CAN_STALE_TIME_MS,
    enabled: Boolean(warbandId) && campaignId > 0,
  });
  const { data } = query;
  const maps = useMemo(
    () => ({
      items: new Map<number, ItemOffer>((data?.items ?? []).map((offer) => [offer.item_id, offer])),
      hiredSwords: new Map<number, HireAccess>(
        (data?.hired_swords ?? []).map((row) => [row.id, row])
      ),
      dramatisPersonae: new Map<number, HireAccess>(
        (data?.dramatis_personae ?? []).map((row) => [row.id, row])
      ),
      specialSkillIds: new Set<number>(data?.special_skill_ids ?? []),
    }),
    [data]
  );
  return { ...maps, isLoading: query.isLoading && Boolean(warbandId) };
}

/** Every warband's who-can read in a campaign goes stale: the catalogue or the settings changed. */
export function invalidateWhoCan(queryClient: QueryClient, campaignId: number) {
  return queryClient.invalidateQueries({
    predicate: (query) =>
      query.queryKey[0] === "campaign" &&
      query.queryKey[1] === campaignId &&
      query.queryKey[2] === "warband" &&
      query.queryKey[4] === "who-can",
  });
}

/** The races and sides a who-can list may name. */
export function useWarbandGroups({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: queryKeys.warbandGroups(),
    queryFn: listWarbandGroups,
    staleTime: GROUPS_STALE_TIME_MS,
    enabled,
  });
}
