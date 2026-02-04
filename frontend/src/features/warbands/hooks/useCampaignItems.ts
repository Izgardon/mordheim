import { useCallback, useEffect, useState } from "react";

import { listItems } from "../../items/api/items-api";

import type { Item } from "../../items/types/item-types";

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
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [itemsError, setItemsError] = useState("");
  const [isItemsLoading, setIsItemsLoading] = useState(false);

  const loadItems = useCallback(async () => {
    if (!enabled || !hasCampaignId || Number.isNaN(campaignId)) {
      return;
    }
    setIsItemsLoading(true);
    setItemsError("");

    try {
      const data = await listItems({ campaignId });
      setAvailableItems(data);
    } catch (errorResponse) {
      if (errorResponse instanceof Error) {
        setItemsError(errorResponse.message || "Unable to load items");
      } else {
        setItemsError("Unable to load items");
      }
    } finally {
      setIsItemsLoading(false);
    }
  }, [campaignId, enabled, hasCampaignId]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    loadItems();
  }, [enabled, loadItems]);

  return {
    availableItems,
    setAvailableItems,
    itemsError,
    isItemsLoading,
    loadItems,
  };
}

