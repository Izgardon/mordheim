import { useEffect, useMemo, useState } from "react";

import { ITEM_SUBTYPE_OPTIONS } from "../utils/item-form-values";

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

/** One row per availability, the rarer first; an item with none gets one row. */
function toRows(items: Item[]): ItemRow[] {
  return items.flatMap((item): ItemRow[] => {
    const availabilities = item.availabilities ?? [];
    if (availabilities.length === 0) {
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

/**
 * Wargear's tab, subtype and single-use filters, search and opened rows, and the rows they
 * leave. A new tab clears the subtype, the single-use filter and the opened rows.
 */
export function useItemsFilters(items: Item[]) {
  const [activeTab, setActiveTab] = useState<ItemTabId>("weapons");
  const [selectedSubtype, setSelectedSubtype] = useState(ALL_SUBTYPES);
  const [selectedSingleUse, setSelectedSingleUse] = useState(ALL_SINGLE_USE);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRowIds, setExpandedRowIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedSubtype(ALL_SUBTYPES);
    setSelectedSingleUse(ALL_SINGLE_USE);
    setExpandedRowIds([]);
  }, [activeTab]);

  const rows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const type = ITEM_TYPE_BY_TAB[activeTab];
    const bySubtype = selectedSubtype !== ALL_SUBTYPES && selectedSubtype.trim();
    const singleUseOnly = activeTab === "misc" && selectedSingleUse !== ALL_SINGLE_USE;
    return toRows(
      items.filter(
        (item) =>
          (!query || matchesQuery(item, query)) &&
          item.type === type &&
          (!bySubtype || (item.subtype ?? "").toLowerCase() === selectedSubtype.toLowerCase()) &&
          (!singleUseOnly || item.single_use)
      )
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
