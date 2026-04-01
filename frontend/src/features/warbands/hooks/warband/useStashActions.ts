import { useState } from "react";

import {
  listWarbandHenchmenGroups,
  sellWarbandItem,
  transferWarbandItem,
} from "../../api/warbands-api";
import { getItem } from "../../../items/api/items-api";
import { useAppStore } from "@/stores/app-store";

import type { Item } from "../../../items/types/item-types";
import type {
  HenchmenGroup,
  WarbandHero,
  WarbandItemMutationResponse,
  WarbandItemSummary,
} from "../../types/warband-types";

export type StashEntry = {
  id: string;
  itemId: number;
  label: string;
  item: WarbandItemSummary;
};

export type OpenMenu = {
  entryId: string;
  entry: StashEntry;
  rect: DOMRect;
};

export type ItemDialogState = {
  action: "sell" | "move";
  item: WarbandItemSummary;
  count: number;
} | null;

type UseStashActionsOptions = {
  items: WarbandItemSummary[];
  warbandId: number;
  onItemsChanged?: () => void;
  onHeroUpdated?: (hero: WarbandHero) => void;
  onMutationComplete?: (
    result: WarbandItemMutationResponse & { targetUnitType?: string }
  ) => void;
};

export default function useStashActions({
  items,
  warbandId,
  onItemsChanged,
  onHeroUpdated,
  onMutationComplete,
}: UseStashActionsOptions) {
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialogState>(null);
  const [henchmenGroups, setHenchmenGroups] = useState<HenchmenGroup[]>([]);
  const [acquireItem, setAcquireItem] = useState<Item | null>(null);
  const { warband } = useAppStore();

  const entries: StashEntry[] = items.map((item) => ({
    id: `stash-item-${item.id}`,
    itemId: item.id,
    label: item.quantity && item.quantity > 1 ? `${item.name} x ${item.quantity}` : item.name,
    item,
  }));

  const handleMenuToggle = (entry: StashEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    if (openMenu?.entryId === entry.id) {
      setOpenMenu(null);
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setOpenMenu({ entryId: entry.id, entry, rect });
    }
  };

  const handleMenuAction = (action: string, entry: StashEntry) => {
    setOpenMenu(null);
    if (action === "Sell" || action === "Move") {
      if (action === "Move" && warband) {
        listWarbandHenchmenGroups(warband.id)
          .then(setHenchmenGroups)
          .catch(() => {});
      }
      setItemDialog({
        action: action === "Sell" ? "sell" : "move",
        item: entry.item,
        count: entry.item.quantity ?? 1,
      });
      return;
    }

    if (action === "Buy again") {
      void (async () => {
        try {
          const fullItem = await getItem(entry.item.id);
          setAcquireItem(fullItem);
        } catch (err) {
          console.error("Failed to load item details", err);
        }
      })();
    }
  };

  const handleSellConfirm = async (
    item: WarbandItemSummary,
    sellQty: number,
    sellPrice: number
  ) => {
    const result = await sellWarbandItem(warbandId, {
      source_type: "stash",
      source_id: null,
      item_id: item.id,
      quantity: sellQty,
      price: sellPrice,
    });
    onItemsChanged?.();
    onMutationComplete?.(result);
  };

  const handleMoveConfirm = async (
    item: WarbandItemSummary,
    moveQty: number,
    unitType: string,
    unitId: string
  ) => {
    const result = await transferWarbandItem(warbandId, {
      source_type: "stash",
      source_id: null,
      target_type:
        unitType === "heroes" ? "hero" : unitType === "hiredswords" ? "hired_sword" : "henchmen_group",
      target_id: Number(unitId),
      item_id: item.id,
      quantity: moveQty,
    });

    if (unitType === "heroes" && result.target && !("quantity" in result.target)) {
      onHeroUpdated?.(result.target as WarbandHero);
    }

    onItemsChanged?.();
    onMutationComplete?.({ ...result, targetUnitType: unitType });
  };

  return {
    openMenu,
    setOpenMenu,
    itemDialog,
    setItemDialog,
    acquireItem,
    setAcquireItem,
    henchmenGroups,
    entries,
    warband,
    handleMenuToggle,
    handleMenuAction,
    handleSellConfirm,
    handleMoveConfirm,
  };
}
