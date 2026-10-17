import { useCatalogue } from "@/lib/catalogue-queries";

type UseCampaignItemsParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
};

export function useCampaignItems({
  campaignId,
  hasCampaignId,
  enabled = true,
}: UseCampaignItemsParams) {
  const { data, error, isLoading } = useCatalogue("items", campaignId, {
    enabled: hasCampaignId && enabled,
  });

  return {
    availableItems: data,
    itemsError: error,
    isItemsLoading: isLoading,
  };
}
