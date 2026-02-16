import { listItems } from "@/features/items/api/items-api";
import { useCampaignData } from "./useCampaignData";

type UseCampaignItemsParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
  auto?: boolean;
};

export function useCampaignItems(params: UseCampaignItemsParams) {
  const { data, setData, error, isLoading, reload } = useCampaignData({
    ...params,
    fetchFn: listItems,
    label: "items",
  });

  return {
    availableItems: data,
    setAvailableItems: setData,
    itemsError: error,
    isItemsLoading: isLoading,
    loadItems: reload,
  };
}
