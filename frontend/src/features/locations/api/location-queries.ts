import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { CAMPAIGN_LIST_STALE_TIME_MS } from "@/features/campaigns/api/campaign-queries";
import { isCampaignId } from "@/features/campaigns/hooks/useCampaignQuery";
import { markLedgerStale, setHeroTradingAction } from "@/features/warbands/api/warband-cache";
import { queryKeys } from "@/lib/query-keys";

import type {
  CampaignLocation,
  LocationGroup,
  LocationGroupPayload,
  LocationPayload,
} from "../types";
import {
  createLocation,
  createLocationGroup,
  deleteLocation,
  deleteLocationGroup,
  listLocationGroups,
  updateLocation,
  updateLocationGroup,
  visitLocation,
} from "./locations-api";

/** The campaign's location groups, read only while Locations are switched on. */
export function useLocationGroups(campaignId: number, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.campaign.locations(campaignId),
    queryFn: () => listLocationGroups(campaignId),
    staleTime: CAMPAIGN_LIST_STALE_TIME_MS,
    enabled: enabled && isCampaignId(campaignId),
  });
}

/** A location put in its group's place in the tree (moved there, or added last). */
function placeLocation(groups: LocationGroup[], saved: CampaignLocation): LocationGroup[] {
  return groups.map((group) => {
    const others = group.locations.filter((entry) => entry.id !== saved.id);
    if (group.id !== saved.group_id) return { ...group, locations: others };
    const held = group.locations.some((entry) => entry.id === saved.id);
    const locations = held
      ? group.locations.map((entry) => (entry.id === saved.id ? saved : entry))
      : [...others, saved];
    return { ...group, locations };
  });
}

/** The groups' and locations' writes (`manage_locations`), each answer written into the tree. */
export function useLocationWrites(campaignId: number) {
  const queryClient = useQueryClient();
  const key = queryKeys.campaign.locations(campaignId);
  const write = (update: (groups: LocationGroup[]) => LocationGroup[]) =>
    queryClient.setQueryData<LocationGroup[]>(key, (groups?: LocationGroup[]) =>
      update(groups ?? [])
    );
  return {
    createGroup: useMutation({
      mutationFn: (payload: LocationGroupPayload) => createLocationGroup(campaignId, payload),
      onSuccess: (group) => write((groups) => [...groups, group]),
    }),
    updateGroup: useMutation({
      mutationFn: ({ id, ...payload }: LocationGroupPayload & { id: number }) =>
        updateLocationGroup(campaignId, id, payload),
      onSuccess: (group) => write((groups) => groups.map((g) => (g.id === group.id ? group : g))),
    }),
    removeGroup: useMutation({
      mutationFn: (id: number) => deleteLocationGroup(campaignId, id),
      onSuccess: (_answer, id) => write((groups) => groups.filter((g) => g.id !== id)),
    }),
    saveLocation: useMutation({
      mutationFn: ({ id, ...payload }: LocationPayload & { id?: number }) =>
        id ? updateLocation(campaignId, id, payload) : createLocation(campaignId, payload),
      onSuccess: (saved) => write((groups) => placeLocation(groups, saved)),
    }),
    removeLocation: useMutation({
      mutationFn: (id: number) => deleteLocation(campaignId, id),
      onSuccess: (_answer, id) =>
        write((groups) =>
          groups.map((g) => ({ ...g, locations: g.locations.filter((l) => l.id !== id) }))
        ),
    }),
  };
}

/** A visit: the heroes' trading actions as the server left them go into the warband's sheet, the
 * log reads again, and the line and any warnings show. */
export function useLocationVisit(warbandId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ locationId, heroIds }: { locationId: number; heroIds: number[] }) =>
      visitLocation(warbandId, locationId, heroIds),
    onSuccess: (answer) => {
      for (const hero of answer.heroes) {
        setHeroTradingAction(queryClient, warbandId, hero.id, hero.trading_action);
      }
      markLedgerStale(queryClient, warbandId);
      toast.success(answer.message);
      for (const warning of answer.warnings) toast.warning(warning.message);
    },
  });
}
