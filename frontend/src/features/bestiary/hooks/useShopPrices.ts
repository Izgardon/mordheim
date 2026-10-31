import { useCallback, useState } from "react";

import { blankPriceRow, priceRowsOf, type PriceRowDraft } from "@/features/items/utils/price-rows";

import type { BestiaryItem } from "../types/bestiary-types";

/**
 * The prices the shop sells a beast's item at (its price rows, the items rebuild): each one's
 * cost, dice, rarity, label, note and who may buy it, edited with the item form's price rows.
 */
export function useShopPrices() {
  const [rows, setRows] = useState<PriceRowDraft[]>([]);
  const load = useCallback(
    (item: BestiaryItem | null | undefined) => setRows(priceRowsOf(item?.availabilities)),
    []
  );
  const ensureOne = useCallback(
    () => setRows((prev) => (prev.length > 0 ? prev : [blankPriceRow()])),
    []
  );
  return {
    rows,
    setRows,
    load,
    /** A blank price when there is none yet (ticking "Available in the shop"). */
    ensureOne,
  };
}

export type ShopPrices = ReturnType<typeof useShopPrices>;
