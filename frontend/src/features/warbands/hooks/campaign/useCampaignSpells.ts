import { listSpells } from "@/features/spells/api/spells-api";
import { useCampaignData } from "./useCampaignData";

type UseCampaignSpellsParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
};

export function useCampaignSpells(params: UseCampaignSpellsParams) {
  const { data, setData, error, isLoading, reload } = useCampaignData({
    ...params,
    fetchFn: listSpells,
    label: "spells",
  });

  return {
    availableSpells: data,
    setAvailableSpells: setData,
    spellsError: error,
    isSpellsLoading: isLoading,
    loadSpells: reload,
  };
}
