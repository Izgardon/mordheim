import { useCallback, useEffect, useMemo, useState } from "react";
import { listSpells } from "@/features/spells/api/spells-api";
import { useAppStore } from "@/stores/app-store";

type UseCampaignSpellsParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
  auto?: boolean;
};

export function useCampaignSpells(params: UseCampaignSpellsParams) {
  const isEnabled = params.enabled ?? true;
  const isAuto = params.auto ?? true;
  const { spellsCache, setSpellsCache } = useAppStore();
  const campaignKey = Number.isNaN(params.campaignId) ? "base" : `campaign:${params.campaignId}`;
  const cacheEntry = spellsCache[campaignKey];
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const availableSpells = useMemo(() => cacheEntry?.data ?? [], [cacheEntry]);

  const loadSpells = useCallback(async () => {
    if (!isEnabled || !params.hasCampaignId || Number.isNaN(params.campaignId)) {
      return [];
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await listSpells({ campaignId: params.campaignId });
      setSpellsCache(campaignKey, result);
      return result;
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to load spells");
      } else {
        setError("Unable to load spells");
      }
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [campaignKey, isEnabled, params.campaignId, params.hasCampaignId, setSpellsCache]);

  useEffect(() => {
    if (!isEnabled || !isAuto || cacheEntry?.loaded) {
      return;
    }
    void loadSpells();
  }, [cacheEntry?.loaded, isAuto, isEnabled, loadSpells]);

  return {
    availableSpells,
    spellsError: error,
    isSpellsLoading: isLoading,
    loadSpells,
  };
}
