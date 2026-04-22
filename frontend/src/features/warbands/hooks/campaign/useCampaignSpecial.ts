import { useCallback, useEffect, useMemo, useState } from "react";
import { listSpecial } from "@/features/special/api/special-api";
import { useAppStore } from "@/stores/app-store";

type UseCampaignSpecialParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
  auto?: boolean;
};

export function useCampaignSpecial(params: UseCampaignSpecialParams) {
  const isEnabled = params.enabled ?? true;
  const isAuto = params.auto ?? true;
  const { specialsCache, setSpecialsCache } = useAppStore();
  const campaignKey = Number.isNaN(params.campaignId) ? "base" : `campaign:${params.campaignId}`;
  const cacheEntry = specialsCache[campaignKey];
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const availableSpecials = useMemo(() => cacheEntry?.data ?? [], [cacheEntry]);

  const loadSpecials = useCallback(async () => {
    if (!isEnabled || !params.hasCampaignId || Number.isNaN(params.campaignId)) {
      return [];
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await listSpecial({ campaignId: params.campaignId });
      setSpecialsCache(campaignKey, result);
      return result;
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to load special");
      } else {
        setError("Unable to load special");
      }
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [campaignKey, isEnabled, params.campaignId, params.hasCampaignId, setSpecialsCache]);

  useEffect(() => {
    if (!isEnabled || !isAuto || cacheEntry?.loaded) {
      return;
    }
    void loadSpecials();
  }, [cacheEntry?.loaded, isAuto, isEnabled, loadSpecials]);

  return {
    availableSpecials,
    specialsError: error,
    isSpecialsLoading: isLoading,
    loadSpecials,
  };
}
