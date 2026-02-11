import { useCallback } from "react";

import { listRaces } from "../../races/api/races-api";
import type { Race } from "../../races/types/race-types";
import { useCampaignData } from "./useCampaignData";

type UseCampaignRacesParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
};

export function useCampaignRaces(params: UseCampaignRacesParams) {
  const { data, setData, error, isLoading, reload } = useCampaignData({
    ...params,
    fetchFn: listRaces,
    label: "races",
  });

  const handleRaceCreated = useCallback((race: Race) => {
    setData((prev) =>
      prev.some((existing) => existing.id === race.id) ? prev : [race, ...prev]
    );
  }, [setData]);

  return {
    availableRaces: data,
    setAvailableRaces: setData,
    racesError: error,
    isRacesLoading: isLoading,
    loadRaces: reload,
    handleRaceCreated,
  };
}
