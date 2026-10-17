import { useCatalogue } from "@/lib/catalogue-queries";

type UseCampaignSpecialParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
};

export function useCampaignSpecial({
  campaignId,
  hasCampaignId,
  enabled = true,
}: UseCampaignSpecialParams) {
  const { data, error, isLoading } = useCatalogue("specials", campaignId, {
    enabled: hasCampaignId && enabled,
  });

  return {
    availableSpecials: data,
    specialsError: error,
    isSpecialsLoading: isLoading,
  };
}
