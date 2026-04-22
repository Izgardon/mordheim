import { useCallback, useEffect, useMemo, useState } from "react";
import { listItems } from "@/features/items/api/items-api";
import type { Item } from "@/features/items/types/item-types";
import { useAppStore } from "@/stores/app-store";

type UseCampaignItemsParams = {
  campaignId: number;
  hasCampaignId: boolean;
  enabled?: boolean;
  auto?: boolean;
};

export function useCampaignItems(params: UseCampaignItemsParams) {
  const isEnabled = params.enabled ?? true;
  const isAuto = params.auto ?? true;
  const { itemsCache, setItemsCache } = useAppStore();
  const campaignKey = Number.isNaN(params.campaignId) ? "base" : `campaign:${params.campaignId}`;
  const cacheEntry = itemsCache[campaignKey];
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const availableItems = useMemo(() => cacheEntry?.data ?? [], [cacheEntry]);

  const loadItems = useCallback(async (): Promise<Item[]> => {
    if (!isEnabled || !params.hasCampaignId || Number.isNaN(params.campaignId)) {
      return [];
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await listItems({ campaignId: params.campaignId });
      setItemsCache(campaignKey, result);
      return result;
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setError(errorResponse.message || "Unable to load items");
      } else {
        setError("Unable to load items");
      }
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [campaignKey, isEnabled, params.campaignId, params.hasCampaignId, setItemsCache]);

  useEffect(() => {
    if (!isEnabled || !isAuto || cacheEntry?.loaded) {
      return;
    }
    void loadItems();
  }, [cacheEntry?.loaded, isAuto, isEnabled, loadItems]);

  return {
    availableItems,
    itemsError: error,
    isItemsLoading: isLoading,
    loadItems,
  };
}
