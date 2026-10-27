import { useMemo, useState } from "react";

import { useCatalogueSearchParams } from "@/features/catalogue/hooks/useCatalogueSearchParams";

import { ITEM_SUBTYPE_OPTIONS } from "../utils/item-form-values";
import { isSold } from "../utils/item-listing";

import type { ItemRow, ItemTabId } from "../components/items-columns";
import type { Item } from "../types/item-types";

export const ALL_SUBTYPES = "all";
export const ALL_SINGLE_USE = "all";
export const SINGLE_USE_ONLY = "single";

export const ITEM_TYPE_BY_TAB: Record<ItemTabId, string> = {
  weapons: "Weapon",
  armour: "Armour",
  misc: "Miscellaneous",
  animals: "Animal",
};

const rowId = (itemId: number, availabilityId?: number | null) =>
  `item:${itemId}:availability:${availabilityId ?? "none"}`;

/** The text a Wargear search looks in: name, type, subtype, restrictions, fluff, properties. */
const matchesQuery = (item: Item, query: string) =>
  [
    item.name,
    item.type,
    item.subtype,
    ...(item.availabilities ?? []).flatMap((availability) =>
      (availability.restrictions ?? []).map((link) => link.restriction.restriction)
    ),
    item.description,
    item.properties?.map((property) => property.name).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(query);

/**
 * One row per availability, the rarer first; an item with none gets one row, and so does a beast
 * the shop doesn't sell: the prices its bestiary entry keeps for the shop (or the book's, as the
 * Giant Rat's warptoken price) aren't on offer, so its row shows none.
 */
function toRows(items: Item[]): ItemRow[] {
  return items.flatMap((item): ItemRow[] => {
    const availabilities = item.availabilities ?? [];
    if (availabilities.length === 0 || !isSold(item)) {
      return [{ ...item, _availability: null, _rowId: rowId(item.id) }];
    }
    return [...availabilities]
      .sort((a, b) => b.rarity - a.rarity)
      .map((availability) => ({
        ...item,
        _availability: availability,
        _rowId: rowId(item.id, availability.id),
      }));
  });
}

const isTab = (value: string): value is ItemTabId => value in ITEM_TYPE_BY_TAB;

/**
 * Wargear's tab, subtype and single-use filters, search and opened rows, and the rows they
 * leave. The filters live in the query string (`tab`, `subtype`, `single`, `q`, CAT-NEW-02),
 * so Back and shared links restore them; the opened rows don't. A new tab clears the subtype, the
 * single-use filter and the opened rows.
 */
export function useItemsFilters(items: Item[]) {
  const url = useCatalogueSearchParams();
  const tabParam = url.get("tab");
  const activeTab: ItemTabId = isTab(tabParam) ? tabParam : "weapons";
  const selectedSubtype = url.get("subtype", ALL_SUBTYPES);
  const selectedSingleUse = url.get("single") === "1" ? SINGLE_USE_ONLY : ALL_SINGLE_USE;
  const searchQuery = url.get("q");
  const [expandedRowIds, setExpandedRowIds] = useState<string[]>([]);

  const setActiveTab = (tab: ItemTabId) => {
    url.set({ tab: tab === "weapons" ? null : tab, subtype: null, single: null });
    setExpandedRowIds([]);
  };
  const setSelectedSubtype = (subtype: string) =>
    url.set({ subtype: subtype === ALL_SUBTYPES ? null : subtype });
  const setSelectedSingleUse = (value: string) =>
    url.set({ single: value === SINGLE_USE_ONLY ? "1" : null });
  const setSearchQuery = (query: string) => url.set({ q: query });

  const rows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const type = ITEM_TYPE_BY_TAB[activeTab];
    const bySubtype = selectedSubtype !== ALL_SUBTYPES && selectedSubtype.trim();
    const singleUseOnly = activeTab === "misc" && selectedSingleUse !== ALL_SINGLE_USE;
    // By name, as the other catalogue pages list theirs: the server sends the campaign's rows
    // (Custom, House rule) first. `filter` made a copy: the list is the shared query cache.
    return toRows(
      items
        .filter(
          (item) =>
            (!query || matchesQuery(item, query)) &&
            item.type === type &&
            (!bySubtype || (item.subtype ?? "").toLowerCase() === selectedSubtype.toLowerCase()) &&
            (!singleUseOnly || item.single_use)
        )
        .sort((a, b) => a.name.localeCompare(b.name))
    );
  }, [items, searchQuery, activeTab, selectedSubtype, selectedSingleUse]);

  /** The tab's subtypes: the usual ones and any the catalogue adds, sorted. */
  const subtypeOptions = useMemo(() => {
    const type = ITEM_TYPE_BY_TAB[activeTab];
    const extras = items
      .filter((item) => item.type === type)
      .map((item) => item.subtype)
      .filter(Boolean) as string[];
    const unique = new Set([...(ITEM_SUBTYPE_OPTIONS[type] ?? []), ...extras]);
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [items, activeTab]);

  return {
    activeTab,
    setActiveTab,
    selectedSubtype,
    setSelectedSubtype,
    selectedSingleUse,
    setSelectedSingleUse,
    searchQuery,
    setSearchQuery,
    rows,
    subtypeOptions,
    expanded: {
      ids: expandedRowIds,
      toggle: (id: string) =>
        setExpandedRowIds((prev) =>
          prev.includes(id) ? prev.filter((open) => open !== id) : [...prev, id]
        ),
    },
    /** A deleted item's rows close. */
    collapseItem: (itemId: number) =>
      setExpandedRowIds((prev) => prev.filter((id) => !id.startsWith(`item:${itemId}:`))),
  };
}

export type ItemsFilters = ReturnType<typeof useItemsFilters>;
