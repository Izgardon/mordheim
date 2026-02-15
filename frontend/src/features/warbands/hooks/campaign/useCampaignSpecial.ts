import { listSpecial } from "@/features/special/api/special-api";
import { useCampaignData } from "./useCampaignData";

type UseCampaignSpecialParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
};

export function useCampaignSpecial(params: UseCampaignSpecialParams) {
  const { data, setData, error, isLoading, reload } = useCampaignData({
    ...params,
    fetchFn: listSpecial,
    label: "special",
  });

  return {
    availableSpecials: data,
    setAvailableSpecials: setData,
    specialsError: error,
    isSpecialsLoading: isLoading,
    loadSpecials: reload,
  };
}
