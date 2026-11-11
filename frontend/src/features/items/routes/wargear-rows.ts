import { useMemo } from "react";

import type { Setting } from "@/features/campaigns/types/campaign-types";
import {
  ALL_SETTINGS,
  inPlayOnly,
  settingFilterKey,
  settingFilterOptions,
  settingShortName,
} from "@/features/reference/in-play";
import { matchesSearchQuery } from "@/lib/matches-search-query";

import {
  STORE_CATEGORIES,
  itemName,
  searchWords,
  storeCategory,
  type StoreCategory,
} from "../store/store-items";
import type { Item, ItemAvailability, ItemOffer } from "../types/item-types";

/** A Wargear row: the item, the price row the warband sees, its offer, and why it can't usually. */
export type WargearRowData = {
  item: Item;
  availability: ItemAvailability | null;
  offer?: ItemOffer;
  warning: string;
  /** Its setting as the column and the card name it ("Mordheim", "Sartosa"), empty for none. */
  settingName: string;
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

/**
 * Wargear's rows and filters: the items in play in the campaign (`inPlayOnly`), each with the price
 * row the warband sees (the server's), the rows searched, kind and setting counts (Mordheim's
 * grades as one), and the summary line.
 */
export function useWargearRows(filters: WargearFilters) {
  const { items, settings, offers, onlyMine, query, category, setting, openId } = filters;
  const all = useMemo<WargearRowData[]>(
    () =>
      inPlayOnly(items)
        .sort((a, b) => itemName(a).localeCompare(itemName(b)))
        .map((item) => {
          const offer = offers ? offers.get(item.id) : undefined;
          const rows = item.availabilities ?? [];
          const availability =
            rows.find((row) => row.id === offer?.availability_id) ?? rows[0] ?? null;
          const warning = offer && !offer.can_buy ? offer.reason : "";
          const settingName = settingShortName(item.setting_id, settings);
          return { item, availability, offer, warning, settingName };
        }),
    [items, offers, settings]
  );
  const searched = all.filter(
    ({ item, warning }) =>
      (!offers || !onlyMine || !warning) &&
      (setting === ALL_SETTINGS || settingFilterKey(item.setting_id, settings) === setting) &&
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
  const settingOptions = settingFilterOptions(
    all.map(({ item }) => item.setting_id),
    settings
  );
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
