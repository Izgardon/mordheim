import { useMemo } from "react";

import { priceLabel, rarityLabel } from "@/features/items/utils/item-prices";
import { useCatalogue } from "@/lib/catalogue-queries";

import { useTemplateWhoCan } from "../api/editor-queries";
import { chartRow } from "./list-draft";

/**
 * The Lists section's items: the campaign's Wargear, each item's chart ("Melee · chart: 35 gc, Rare
 * 7") at the price row its template's types are offered, and why they can't usually buy it
 * ("Not usually available to Night Watch."), as the server's who-can says.
 */
export function useItemCharts(campaignId: number, templateId: number) {
  const items = useCatalogue("items", campaignId);
  const whoCan = useTemplateWhoCan(campaignId, templateId, true);
  return useMemo(() => {
    const offers = new Map((whoCan.data?.items ?? []).map((offer) => [offer.item_id, offer]));
    const byId = new Map(items.data.map((item) => [item.id, item]));
    const chartOf = (itemId: number) => {
      const item = byId.get(itemId);
      if (!item) return "";
      const row = chartRow(item, offers.get(itemId));
      const chart = row ? `chart: ${priceLabel(row)}, ${rarityLabel(row.rarity)}` : "";
      return [item.subtype || item.type, chart].filter(Boolean).join(" · ");
    };
    const reasonOf = (itemId: number) => {
      const offer = offers.get(itemId);
      return offer && !offer.can_buy ? offer.reason : "";
    };
    return { items: items.data, isLoading: items.isLoading, byId, offers, chartOf, reasonOf };
  }, [items.data, items.isLoading, whoCan.data]);
}

export type ItemCharts = ReturnType<typeof useItemCharts>;
