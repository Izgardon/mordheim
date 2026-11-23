import { useEffect, useState } from "react";

import { filterGroups } from "../location-filter";
import type { LocationGroup } from "../types";

/** A set of ids with one toggled. */
const toggled = (ids: ReadonlySet<number>, id: number) => {
  const next = new Set(ids);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

/**
 * The tree's search and which rows are open. A search opens every group and location it leaves,
 * so a link naming a location (`?place=`, Explore's Read) lands on it open; each still closes.
 */
export function useLocationTree(groups: LocationGroup[], initialSearch?: string, enabled = true) {
  const [search, setSearch] = useState(initialSearch ?? "");
  const [openGroups, setOpenGroups] = useState<ReadonlySet<number>>(() => new Set());
  const [openPlaces, setOpenPlaces] = useState<ReadonlySet<number>>(() => new Set());
  useEffect(() => {
    if (enabled && initialSearch) setSearch(initialSearch);
  }, [enabled, initialSearch]);
  const shown = filterGroups(groups, search);
  const found = search.trim()
    ? shown
        .map((group) => `${group.id}:${group.locations.map((place) => place.id).join(",")}`)
        .join(";")
    : "";
  useEffect(() => {
    if (!found) return;
    const pairs = found.split(";").map((entry) => entry.split(":"));
    setOpenGroups(new Set(pairs.map(([group]) => Number(group))));
    setOpenPlaces(
      new Set(pairs.flatMap(([, places]) => (places ? places.split(",").map(Number) : [])))
    );
  }, [found]);
  return {
    search,
    setSearch,
    shown,
    groupOpen: (id: number) => openGroups.has(id),
    toggleGroup: (id: number) => setOpenGroups((ids) => toggled(ids, id)),
    placeOpen: (id: number) => openPlaces.has(id),
    togglePlace: (id: number) => setOpenPlaces((ids) => toggled(ids, id)),
  };
}
