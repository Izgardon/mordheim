import { useMemo } from "react";

import { outOfPlay } from "@/features/campaigns/api/settings-queries";
import type { Setting } from "@/features/campaigns/types/campaign-types";
import { matchesSearchQuery } from "@/lib/matches-search-query";

import {
  STORE_CATEGORIES,
  itemName,
  searchWords,
  storeCategory,
  type StoreCategory,
} from "../store/store-items";
import type { Item, ItemAvailability, ItemOffer } from "../types/item-types";

export const ALL_SETTINGS = "all";

/** A Wargear row: the item, the price row the warband sees, its offer, and why it can't usually. */
export type WargearRowData = {
  item: Item;
  availability: ItemAvailability | null;
  offer?: ItemOffer;
  warning: string;
};

type WargearFilters = {
  items: Item[];
  settings: Map<number, Setting>;
  /** The warband's offers (who-can/), or none without a warband. */
  offers: Map<number, ItemOffer> | null;
  warbandName: string | null;
  onlyMine: boolean;
  query: string;
  category: StoreCategory;
  setting: string;
  openId: string | null;
};

const settingKey = (item: Item) => (item.setting_id == null ? "own" : String(item.setting_id));

/**
 * Wargear's rows and filters: each item with the price row the warband sees (the server's), the
 * rows searched, kind and setting counts, and the summary line.
 */
export function useWargearRows(filters: WargearFilters) {
  const { items, settings, offers, onlyMine, query, category, setting, openId } = filters;
  const all = useMemo<WargearRowData[]>(
    () =>
      [...items]
        .sort((a, b) => itemName(a).localeCompare(itemName(b)))
        .map((item) => {
          const offer = offers ? offers.get(item.id) : undefined;
          const rows = item.availabilities ?? [];
          const availability =
            rows.find((row) => row.id === offer?.availability_id) ?? rows[0] ?? null;
          const warning = offers
            ? offer && !offer.can_buy
              ? offer.reason
              : ""
            : outOfPlay(item, settings);
          return { item, availability, offer, warning };
        }),
    [items, settings, offers]
  );
  const searched = all.filter(
    ({ item, warning }) =>
      (!offers || !onlyMine || !warning) &&
      (setting === ALL_SETTINGS || settingKey(item) === setting) &&
      matchesSearchQuery(query, ...searchWords(item))
  );
  const rows = all.filter(
    (row) =>
      String(row.item.id) === openId ||
      (searched.includes(row) && (category === "all" || storeCategory(row.item) === category))
  );
  const counts = STORE_CATEGORIES.map((entry) => ({
    ...entry,
    count:
      entry.id === "all"
        ? searched.length
        : searched.filter((row) => storeCategory(row.item) === entry.id).length,
  }));
  const settingOptions = [
    { id: ALL_SETTINGS, label: "All settings" },
    ...[...new Set(items.map(settingKey))]
      .map((key) => ({
        id: key,
        label: key === "own" ? "This campaign" : (settings.get(Number(key))?.name ?? "Unknown"),
        order: key === "own" ? 999 : (settings.get(Number(key))?.sort_order ?? 998),
      }))
      .sort((a, b) => a.order - b.order)
      .map(({ id: key, label }) => ({ id: key, label })),
  ];
  const restricted = rows.filter((row) => row.warning).length;
  const name = filters.warbandName;
  const summary = `${rows.length} ${rows.length === 1 ? "item" : "items"} shown${
    !name
      ? ""
      : onlyMine
        ? `, what ${name} can buy`
        : restricted
          ? `, ${restricted} not usually`
          : ""
  }`;
  return { rows, counts, settingOptions, summary };
}
