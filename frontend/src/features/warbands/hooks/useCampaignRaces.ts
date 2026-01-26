import { useCallback, useEffect, useState } from "react";

import { listRaces } from "../../races/api/races-api";

import type { Race } from "../../races/types/race-types";

type UseCampaignRacesParams = {
  campaignId: number;
  hasCampaignId: boolean;
};

export function useCampaignRaces({ campaignId, hasCampaignId }: UseCampaignRacesParams) {
  const [availableRaces, setAvailableRaces] = useState<Race[]>([]);
  const [racesError, setRacesError] = useState("");
  const [isRacesLoading, setIsRacesLoading] = useState(false);

  const loadRaces = useCallback(async () => {
    if (!hasCampaignId || Number.isNaN(campaignId)) {
      return;
    }
    setIsRacesLoading(true);
    setRacesError("");

    try {
      const data = await listRaces({ campaignId });
      setAvailableRaces(data);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setRacesError(errorResponse.message || "Unable to load races");
      } else {
        setRacesError("Unable to load races");
      }
    } finally {
      setIsRacesLoading(false);
    }
  }, [campaignId, hasCampaignId]);

  const handleRaceCreated = useCallback((race: Race) => {
    setAvailableRaces((prev) =>
      prev.some((existing) => existing.id === race.id) ? prev : [race, ...prev]
    );
  }, []);

  useEffect(() => {
    loadRaces();
  }, [loadRaces]);

  return {
    availableRaces,
    setAvailableRaces,
    racesError,
    isRacesLoading,
    loadRaces,
    handleRaceCreated,
  };
}
