import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/get-error-message";

import {
  addWarbandBestiaryFavourite,
  listWarbandBestiaryFavourites,
  removeWarbandBestiaryFavourite,
} from "../api/bestiary-api";

import type { BestiaryEntrySummary } from "../types/bestiary-types";

/**
 * Your warband's favourite bestiary entries, read on each visit, and a star that changes at
 * once and goes back, saying why, when its write fails (CAT-UX-04).
 */
export function useBestiaryFavourites(warbandId: number | undefined) {
  const [favouriteIds, setFavouriteIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!warbandId) return;
    listWarbandBestiaryFavourites(warbandId)
      .then((favs) => setFavouriteIds(new Set(favs.map((f) => f.id))))
      .catch(() => setFavouriteIds(new Set()));
  }, [warbandId]);

  const toggle = useCallback(
    async (entry: BestiaryEntrySummary) => {
      if (!warbandId) return;
      const isFav = favouriteIds.has(entry.id);
      const setStar = (filled: boolean) =>
        setFavouriteIds((prev) => {
          const next = new Set(prev);
          if (filled) next.add(entry.id);
          else next.delete(entry.id);
          return next;
        });
      setStar(!isFav);
      try {
        await (isFav
          ? removeWarbandBestiaryFavourite(warbandId, entry.id)
          : addWarbandBestiaryFavourite(warbandId, entry.id));
      } catch (error) {
        setStar(isFav);
        const action = isFav ? `remove ${entry.name} from` : `add ${entry.name} to`;
        toast.error(`Couldn't ${action} favourites.`, { description: getErrorMessage(error) });
      }
    },
    [warbandId, favouriteIds]
  );

  return { favouriteIds, toggle };
}

export type BestiaryFavourites = ReturnType<typeof useBestiaryFavourites>;
