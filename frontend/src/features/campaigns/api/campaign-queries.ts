import { useQuery, type QueryClient, type QueryKey } from "@tanstack/react-query";

// api
import {
  listCampaignActiveBattles,
  listCampaignBattleHistory,
  listCampaignBulletinEntries,
  listCampaignEncampments,
  listCampaignMembers,
  listCampaignPivotalMoments,
  listCampaignPlayerNames,
  listCampaignPlayers,
  listCampaignTopKillers,
  listCampaignTradeRequests,
} from "./campaigns-api";
import { listRestrictions } from "@/features/items/api/items-api";
import { getWarbandRosterStats } from "@/features/warbands/api/warbands-core";

// other
import { isCampaignId } from "../hooks/useCampaignQuery";
import { queryKeys } from "@/lib/query-keys";

// types
import type { Restriction } from "@/features/items/types/item-types";

/**
 * The campaign's shared lists as TanStack queries, under `["campaign", id, ...]` (IMP-66), so a
 * revisit within the stale time sends nothing, pull-to-refresh and the reconnect catch-up reach
 * them, and a write updates the one list it changed (`setQueryData`, `updateCachedList`).
 */
export const CAMPAIGN_LIST_STALE_TIME_MS = 30_000;
/** Restrictions change only with the catalogue. */
const RESTRICTIONS_STALE_TIME_MS = 5 * 60_000;

type Toggle = { enabled?: boolean };

const listOptions = (campaignId: number, enabled = true) => ({
  staleTime: CAMPAIGN_LIST_STALE_TIME_MS,
  enabled: enabled && isCampaignId(campaignId),
});

export function useCampaignPlayers(campaignId: number) {
  return useQuery({
    queryKey: queryKeys.campaign.players(campaignId),
    queryFn: () => listCampaignPlayers(campaignId),
    ...listOptions(campaignId),
  });
}

/** Ids and names only, for name pickers (PERF-41). */
export function useCampaignPlayerNames(campaignId: number, { enabled = true }: Toggle = {}) {
  return useQuery({
    queryKey: queryKeys.campaign.playerNames(campaignId),
    queryFn: () => listCampaignPlayerNames(campaignId),
    ...listOptions(campaignId, enabled),
  });
}

export function useCampaignBattleHistory(campaignId: number) {
  return useQuery({
    queryKey: queryKeys.campaign.battleHistory(campaignId),
    queryFn: () => listCampaignBattleHistory(campaignId),
    ...listOptions(campaignId),
  });
}

export function useCampaignPivotalMoments(campaignId: number) {
  return useQuery({
    queryKey: queryKeys.campaign.pivotalMoments(campaignId),
    queryFn: () => listCampaignPivotalMoments(campaignId),
    ...listOptions(campaignId),
  });
}

export function useCompletedTrades(campaignId: number) {
  return useQuery({
    queryKey: queryKeys.campaign.completedTrades(campaignId),
    queryFn: () => listCampaignTradeRequests(campaignId, "completed"),
    ...listOptions(campaignId),
  });
}

export function useCampaignTopKillers(campaignId: number, { enabled = true }: Toggle = {}) {
  return useQuery({
    queryKey: queryKeys.campaign.topKillers(campaignId),
    queryFn: async () => (await listCampaignTopKillers(campaignId)).top_killers,
    ...listOptions(campaignId, enabled),
  });
}

export function useCampaignBulletin(campaignId: number, { enabled = true }: Toggle = {}) {
  return useQuery({
    queryKey: queryKeys.campaign.bulletin(campaignId),
    queryFn: () => listCampaignBulletinEntries(campaignId),
    ...listOptions(campaignId, enabled),
  });
}

/** Members with emails, roles and grants: `capabilities.view_members` (owners and admins). */
export function useCampaignMembers(campaignId: number, { enabled = true }: Toggle = {}) {
  return useQuery({
    queryKey: queryKeys.campaign.members(campaignId),
    queryFn: () => listCampaignMembers(campaignId),
    ...listOptions(campaignId, enabled),
  });
}

/**
 * Open battles with the tools a battle manager may use on each: `capabilities.manage_battles`.
 * Settings → Active Battles reads it, and so can the stuck-battles banner (CAMP-NEW-05).
 */
export function useCampaignActiveBattles(campaignId: number, { enabled = true }: Toggle = {}) {
  return useQuery({
    queryKey: queryKeys.campaign.activeBattles(campaignId),
    queryFn: () => listCampaignActiveBattles(campaignId),
    ...listOptions(campaignId, enabled),
  });
}

/** The encampments, read only while the page is switched on. */
export function useCampaignEncampments(campaignId: number, { enabled = true }: Toggle = {}) {
  return useQuery({
    queryKey: queryKeys.campaign.encampments(campaignId),
    queryFn: () => listCampaignEncampments(campaignId),
    ...listOptions(campaignId, enabled),
  });
}

const NO_RESTRICTIONS: Restriction[] = [];

/** The setting restrictions a campaign can apply to item availability (catalogue data). */
export function useSettingRestrictions() {
  const { data } = useQuery({
    queryKey: queryKeys.restrictions("Setting"),
    queryFn: () => listRestrictions({ type: "Setting" }),
    staleTime: RESTRICTIONS_STALE_TIME_MS,
  });
  return data ?? NO_RESTRICTIONS;
}

/** One warband's on-roster stat lines, as a roster row expands it (one request, PERF-42). */
export const rosterStatsQuery = (campaignId: number, warbandId: number) => ({
  queryKey: queryKeys.campaign.warbandRosterStats(campaignId, warbandId),
  queryFn: () => getWarbandRosterStats(warbandId),
  staleTime: CAMPAIGN_LIST_STALE_TIME_MS,
});

/**
 * Applies `update` to a cached list, if it is cached: how a write puts its answer in the list it
 * changed (and how a realtime event can, later) without reading the list again.
 */
export function updateCachedList<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  update: (entries: T[]) => T[]
) {
  queryClient.setQueryData<T[]>(queryKey, (entries: T[] | undefined) =>
    entries ? update(entries) : entries
  );
}
