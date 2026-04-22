import { useCallback, useEffect, useMemo, useState } from "react";

import { listRaces } from "@/features/races/api/races-api";
import type { Race } from "@/features/races/types/race-types";
import { useAppStore } from "@/stores/app-store";

type UseCampaignRacesParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
  auto?: boolean;
};

export function useCampaignRaces(params: UseCampaignRacesParams) {
  const isEnabled = params.enabled ?? true;
  const isAuto = params.auto ?? true;
  const { racesCache, setRacesCache, upsertRaceCache } = useAppStore();
  const campaignKey = Number.isNaN(params.campaignId) ? "base" : `campaign:${params.campaignId}`;
  const cacheEntry = racesCache[campaignKey];
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const availableRaces = useMemo(() => cacheEntry?.data ?? [], [cacheEntry]);

  const loadRaces = useCallback(async (): Promise<Race[]> => {
    if (!isEnabled || !params.hasCampaignId || Number.isNaN(params.campaignId)) {
      return [];
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await listRaces({ campaignId: params.campaignId });
      setRacesCache(campaignKey, result);
      return result;
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to load races");
      } else {
        setError("Unable to load races");
      }
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [campaignKey, isEnabled, params.campaignId, params.hasCampaignId, setRacesCache]);

  useEffect(() => {
    if (!isEnabled || !isAuto || cacheEntry?.loaded) {
      return;
    }
    void loadRaces();
  }, [cacheEntry?.loaded, isAuto, isEnabled, loadRaces]);

  const handleRaceCreated = useCallback((race: Race) => {
    upsertRaceCache(campaignKey, race);
  }, [campaignKey, upsertRaceCache]);

  return {
    availableRaces,
    setAvailableRaces: (races: Race[]) => setRacesCache(campaignKey, races),
    racesError: error,
    isRacesLoading: isLoading,
    loadRaces,
    handleRaceCreated,
  };
}
