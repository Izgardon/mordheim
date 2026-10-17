import { useCallback, useMemo, useState } from "react";

import { listWarbandItems } from "../../../../api/warbands-items";
import { getHenchmenItemMultiplier } from "../../../henchmen/utils/henchmen-cost";

import type { HenchmenGroupFormEntry, WarbandItemSummary } from "../../../../types/warband-types";

/**
 * The stash, fetched once when editing starts and shared by every add-henchman dialog, so two
 * new members can't both claim the last copy of an item.
 */
export function useHenchmenStash(warbandId: number, groupForms: HenchmenGroupFormEntry[]) {
  const [stashItems, setStashItems] = useState<WarbandItemSummary[]>([]);

  const refreshStashItems = useCallback(() => {
    if (!warbandId) return;
    listWarbandItems(warbandId)
      .then(setStashItems)
      .catch(() => setStashItems([]));
  }, [warbandId]);

  // Remaining stash quantities after the claims of every group's new members.
  const stashQtyById = useMemo(() => {
    const map: Record<number, number> = {};
    for (const item of stashItems) {
      map[item.id] = (map[item.id] ?? 0) + (item.quantity ?? 1);
    }
    for (const group of groupForms) {
      if (!group.id) continue;
      const savedCount = group.henchmen.filter((h) => h.id !== 0).length;
      const itemCounts: Record<number, number> = {};
      for (const item of group.items) {
        itemCounts[item.id] = (itemCounts[item.id] ?? 0) + 1;
      }
      for (const h of group.henchmen) {
        if (!h.itemChoices) continue;
        for (const choice of h.itemChoices) {
          if (choice.action !== "stash") continue;
          const count = itemCounts[choice.itemId];
          if (count !== undefined) {
            const multiplier = getHenchmenItemMultiplier(count, savedCount);
            map[choice.itemId] = (map[choice.itemId] ?? 0) - multiplier;
          }
        }
      }
    }
    return map;
  }, [stashItems, groupForms]);

  return {
    cardProps: { stashQtyById },
    onStartEditing: () => {
      setStashItems([]);
      refreshStashItems();
    },
  };
}
