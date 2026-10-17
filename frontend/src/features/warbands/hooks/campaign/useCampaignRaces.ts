import { useCallback } from "react";

import { useCatalogue, useCatalogueCache } from "@/lib/catalogue-queries";
import type { Race } from "@/features/races/types/race-types";

type UseCampaignRacesParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
};

export function useCampaignRaces({
  campaignId,
  hasCampaignId,
  enabled = true,
}: UseCampaignRacesParams) {
  const { data, error, isLoading } = useCatalogue("races", campaignId, {
    enabled: hasCampaignId && enabled,
  });
  const catalogueCache = useCatalogueCache();

  const handleRaceCreated = useCallback(
    (race: Race) => {
      catalogueCache.upsert("races", campaignId, race);
    },
    [campaignId, catalogueCache]
  );

  return {
    availableRaces: data,
    racesError: error,
    isRacesLoading: isLoading,
    handleRaceCreated,
  };
}
