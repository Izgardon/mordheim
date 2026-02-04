import { useCallback, useEffect, useState } from "react";

import { listFeatures } from "../../features/api/features-api";

import type { Feature } from "../../features/types/feature-types";

type UseCampaignFeaturesParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
};

export function useCampaignFeatures({
  campaignId,
  hasCampaignId,
  enabled = true,
}: UseCampaignFeaturesParams) {
  const [availableFeatures, setAvailableFeatures] = useState<Feature[]>([]);
  const [featuresError, setFeaturesError] = useState("");
  const [isFeaturesLoading, setIsFeaturesLoading] = useState(false);

  const loadFeatures = useCallback(async () => {
    if (!enabled || !hasCampaignId || Number.isNaN(campaignId)) {
      return;
    }
    setIsFeaturesLoading(true);
    setFeaturesError("");

    try {
      const data = await listFeatures({ campaignId });
      setAvailableFeatures(data);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setFeaturesError(errorResponse.message || "Unable to load features");
      } else {
        setFeaturesError("Unable to load features");
      }
    } finally {
      setIsFeaturesLoading(false);
    }
  }, [campaignId, enabled, hasCampaignId]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    loadFeatures();
  }, [enabled, loadFeatures]);

  return {
    availableFeatures,
    setAvailableFeatures,
    featuresError,
    isFeaturesLoading,
    loadFeatures,
  };
}

