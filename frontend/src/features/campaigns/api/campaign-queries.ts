import { useQuery, type QueryClient, type QueryKey } from "@tanstack/react-query";

// api
import {
  getBattleRecord,
  listCampaignActiveBattles,
  listCampaignBattleHistory,
  listCampaignChronicle,
  listCampaignEncampments,
  listCampaignLocations,
  listCampaignMembers,
  listCampaignPlayerNames,
  listCampaignPlayers,
} from "./campaigns-api";

// other
import { isCampaignId } from "../hooks/useCampaignQuery";
import { queryKeys } from "@/lib/query-keys";

// types
import type { CampaignChronicleFilter } from "../types/campaign-types";

/**
 * The campaign's shared lists as TanStack queries, under `["campaign", id, ...]` (IMP-66), so a
 * revisit within the stale time sends nothing, pull-to-refresh and the reconnect catch-up reach
 * them, and a write updates the one list it changed (`setQueryData`, `updateCachedList`).
 */
export const CAMPAIGN_LIST_STALE_TIME_MS = 30_000;

type Toggle = { enabled?: boolean };

const listOptions = (campaignId: number, enabled = true) => ({
  staleTime: CAMPAIGN_LIST_STALE_TIME_MS,
  enabled: enabled && isCampaignId(campaignId),
});

export function useCampaignPlayers(campaignId: number, { enabled = true }: Toggle = {}) {
  return useQuery({
    queryKey: queryKeys.campaign.players(campaignId),
    queryFn: () => listCampaignPlayers(campaignId),
    ...listOptions(campaignId, enabled),
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

/** One ended battle's record, read when its row opens on the Battles page. */
export function useBattleRecord(campaignId: number, battleId: number) {
  return useQuery({
    queryKey: queryKeys.campaign.battleRecord(campaignId, battleId),
    queryFn: () => getBattleRecord(campaignId, battleId),
    ...listOptions(campaignId),
  });
}

/** The chronicle, one list per filter: kills, deaths, level-ups, purchases, trades, bounties. */
export function useCampaignChronicle(campaignId: number, kind: CampaignChronicleFilter | "all") {
  return useQuery({
    queryKey: queryKeys.campaign.chronicle(campaignId, kind),
    queryFn: () => listCampaignChronicle(campaignId, kind),
    ...listOptions(campaignId),
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

/** The locations, read only while they are switched on (the panel, settings, Search everything). */
export function useCampaignLocations(campaignId: number, { enabled = true }: Toggle = {}) {
  return useQuery({
    queryKey: queryKeys.campaign.locations(campaignId),
    queryFn: () => listCampaignLocations(campaignId),
    ...listOptions(campaignId, enabled),
  });
}

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
