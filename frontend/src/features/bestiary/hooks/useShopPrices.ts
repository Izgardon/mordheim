import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listRestrictions } from "@/features/items/api/items-api";
import { CATALOGUE_STALE_TIME_MS } from "@/lib/catalogue-queries";
import { queryKeys } from "@/lib/query-keys";

import type { Restriction } from "@/features/items/types/item-types";
import type { BestiaryItem } from "../types/bestiary-types";
import type { ShopPriceRow, ShopRestrictionRow } from "../utils/beast-shop";

type PriceField = "cost" | "rarity" | "variableCost";

const NO_RESTRICTIONS: Restriction[] = [];
let nextKey = 1;

const blankRow = (): ShopPriceRow => ({
  key: nextKey++,
  cost: "",
  rarity: "",
  variableCost: "",
  restrictions: [],
});

const restrictionRow = (restriction: Restriction, note = ""): ShopRestrictionRow => ({
  key: nextKey++,
  restriction,
  note,
});

/** The item's prices as rows; none when it has none. */
const rowsOf = (item: BestiaryItem | null | undefined): ShopPriceRow[] =>
  (item?.availabilities ?? []).map((price) => ({
    key: nextKey++,
    cost: String(price.cost),
    rarity: String(price.rarity),
    variableCost: price.variable_cost ?? "",
    restrictions: (price.restrictions ?? []).map((link) =>
      restrictionRow(link.restriction, link.additional_note ?? "")
    ),
  }));

/**
 * The prices the shop sells a beast's item at (its availabilities): each price, rarity and
 * variable cost, with restrictions and their notes picked from the campaign's restrictions (read
 * once, only while the shop section shows).
 */
export function useShopPrices({ campaignId, enabled }: { campaignId: number; enabled: boolean }) {
  const [rows, setRows] = useState<ShopPriceRow[]>([]);
  const { data } = useQuery({
    queryKey: queryKeys.campaign.restrictions(campaignId),
    queryFn: () => listRestrictions({ campaignId }),
    staleTime: CATALOGUE_STALE_TIME_MS,
    enabled: enabled && campaignId > 0,
  });

  const updateRow = (key: number, update: (row: ShopPriceRow) => ShopPriceRow) =>
    setRows((prev) => prev.map((row) => (row.key === key ? update(row) : row)));
  const updateRestrictions = (
    key: number,
    update: (links: ShopRestrictionRow[]) => ShopRestrictionRow[]
  ) => updateRow(key, (row) => ({ ...row, restrictions: update(row.restrictions) }));

  const load = useCallback((item: BestiaryItem | null | undefined) => setRows(rowsOf(item)), []);
  const ensureOne = useCallback(
    () => setRows((prev) => (prev.length > 0 ? prev : [blankRow()])),
    []
  );

  return {
    available: data ?? NO_RESTRICTIONS,
    rows,
    load,
    /** A blank price when there is none yet (ticking "Available in the shop"). */
    ensureOne,
    add: () => setRows((prev) => [...prev, blankRow()]),
    remove: (key: number) => setRows((prev) => prev.filter((row) => row.key !== key)),
    set: (key: number, field: PriceField, value: string) =>
      updateRow(key, (row) => ({ ...row, [field]: value })),
    addRestriction: (key: number, restriction: Restriction) =>
      updateRestrictions(key, (links) => [...links, restrictionRow(restriction)]),
    removeRestriction: (key: number, linkKey: number) =>
      updateRestrictions(key, (links) => links.filter((link) => link.key !== linkKey)),
    setNote: (key: number, linkKey: number, note: string) =>
      updateRestrictions(key, (links) =>
        links.map((link) => (link.key === linkKey ? { ...link, note } : link))
      ),
  };
}

export type ShopPrices = ReturnType<typeof useShopPrices>;
