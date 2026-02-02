import { useCallback, useEffect, useState } from "react";

import { listOthers } from "../../others/api/others-api";

import type { Other } from "../../others/types/other-types";

type UseCampaignOthersParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
};

export function useCampaignOthers({
  campaignId,
  hasCampaignId,
  enabled = true,
}: UseCampaignOthersParams) {
  const [availableOthers, setAvailableOthers] = useState<Other[]>([]);
  const [othersError, setOthersError] = useState("");
  const [isOthersLoading, setIsOthersLoading] = useState(false);

  const loadOthers = useCallback(async () => {
    if (!enabled || !hasCampaignId || Number.isNaN(campaignId)) {
      return;
    }
    setIsOthersLoading(true);
    setOthersError("");

    try {
      const data = await listOthers({ campaignId });
      setAvailableOthers(data);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setOthersError(errorResponse.message || "Unable to load others");
      } else {
        setOthersError("Unable to load others");
      }
    } finally {
      setIsOthersLoading(false);
    }
  }, [campaignId, enabled, hasCampaignId]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    loadOthers();
  }, [enabled, loadOthers]);

  return {
    availableOthers,
    setAvailableOthers,
    othersError,
    isOthersLoading,
    loadOthers,
  };
}
