import { useState } from "react";

import {
  createWarbandTrade,
  getWarbandHenchmenGroupDetail,
  getWarbandHeroDetail,
  getWarbandHiredSwordDetail,
  listWarbandHenchmenGroups,
  removeWarbandItem,
  updateWarbandHenchmenGroup,
  updateWarbandHero,
  updateWarbandHiredSword,
} from "../../api/warbands-api";
import { getItem } from "../../../items/api/items-api";
import {
  heroPayload,
  hiredSwordPayload,
  henchmenGroupPayload,
} from "../../utils/unit-item-actions";

import { useAppStore } from "@/stores/app-store";

import type { Item } from "../../../items/types/item-types";
import type { HenchmenGroup, WarbandHero, WarbandItemSummary } from "../../types/warband-types";

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
};

const targetConfig = {
  heroes: {
    fetch: getWarbandHeroDetail,
    update: updateWarbandHero,
    payload: heroPayload,
  },
  hiredswords: {
    fetch: getWarbandHiredSwordDetail,
    update: updateWarbandHiredSword,
    payload: hiredSwordPayload,
  },
  henchmen: {
    fetch: getWarbandHenchmenGroupDetail,
    update: updateWarbandHenchmenGroup,
    payload: henchmenGroupPayload,
  },
} as const;

export default function useStashActions({
  items,
  warbandId,
  onItemsChanged,
  onHeroUpdated,
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
    } else if (action === "Buy again") {
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
    sellPrice: number,
  ) => {
    await removeWarbandItem(warbandId, item.id, sellQty);
    await createWarbandTrade(warbandId, {
      action: "Sold",
      description: sellQty > 1 ? `${item.name} x ${sellQty}` : item.name,
      price: sellPrice,
    });
    onItemsChanged?.();
  };

  const handleMoveConfirm = async (
    item: WarbandItemSummary,
    moveQty: number,
    unitType: string,
    unitId: string,
  ) => {
    await removeWarbandItem(warbandId, item.id, moveQty);

    const config = targetConfig[unitType as keyof typeof targetConfig];
    if (config) {
      const targetId = Number(unitId);
      const target = await config.fetch(warbandId, targetId);
      const targetItems = target.items.map((i: { id: number; cost?: number | null }) => ({ id: i.id, cost: i.cost ?? null }));
      const addedItems = Array.from({ length: moveQty }, () => ({ id: item.id, cost: item.cost ?? null }));
      await (config.update as any)(
        warbandId,
        targetId,
        (config.payload as any)(target, [...targetItems, ...addedItems]),
      );

      if (unitType === "heroes") {
        const freshTarget = await getWarbandHeroDetail(warbandId, targetId);
        onHeroUpdated?.(freshTarget);
      }
    }

    onItemsChanged?.();
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
