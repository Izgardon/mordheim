import { useCallback } from "react";
import { listSpells } from "@/features/spells/api/spells-api";
import { useAppStore } from "@/stores/app-store";
import { useCampaignData } from "./useCampaignData";

type UseCampaignSpellsParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
  auto?: boolean;
};

export function useCampaignSpells(params: UseCampaignSpellsParams) {
  const { setSpellsCache } = useAppStore();
  const campaignKey = Number.isNaN(params.campaignId) ? "base" : `campaign:${params.campaignId}`;
  const { data, setData, error, isLoading, reload } = useCampaignData({
    ...params,
    fetchFn: listSpells,
    label: "spells",
  });

  const loadSpells = useCallback(async () => {
    const result = await reload();
    setSpellsCache(campaignKey, result);
  }, [reload, setSpellsCache, campaignKey]);

  return {
    availableSpells: data,
    setAvailableSpells: setData,
    spellsError: error,
    isSpellsLoading: isLoading,
    loadSpells,
  };
}
