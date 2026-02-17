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

import { useAppStore } from "@/stores/app-store";

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

export default function useStashActions({
  items,
  warbandId,
  onItemsChanged,
  onHeroUpdated,
}: UseStashActionsOptions) {
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialogState>(null);
  const [henchmenGroups, setHenchmenGroups] = useState<HenchmenGroup[]>([]);
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

    const targetId = Number(unitId);
    const addedIds = Array.from({ length: moveQty }, () => item.id);

    if (unitType === "heroes") {
      const target = await getWarbandHeroDetail(warbandId, targetId);
      const targetItemIds = target.items.map((i) => i.id);
      await updateWarbandHero(warbandId, targetId, {
        name: target.name,
        unit_type: target.unit_type,
        race: target.race_id ?? null,
        price: target.price,
        xp: target.xp,
        item_ids: [...targetItemIds, ...addedIds],
      });
      const freshTarget = await getWarbandHeroDetail(warbandId, targetId);
      onHeroUpdated?.(freshTarget);
    } else if (unitType === "hiredswords") {
      const target = await getWarbandHiredSwordDetail(warbandId, targetId);
      const targetItemIds = target.items.map((i) => i.id);
      await updateWarbandHiredSword(warbandId, targetId, {
        name: target.name,
        unit_type: target.unit_type,
        race: target.race_id ?? null,
        price: target.price,
        upkeep_price: target.upkeep_price ?? 0,
        xp: target.xp,
        item_ids: [...targetItemIds, ...addedIds],
      });
    } else if (unitType === "henchmen") {
      const target = await getWarbandHenchmenGroupDetail(warbandId, targetId);
      const targetItemIds = target.items.map((i) => i.id);
      await updateWarbandHenchmenGroup(warbandId, targetId, {
        item_ids: [...targetItemIds, ...addedIds],
      } as any);
    }

    onItemsChanged?.();
  };

  return {
    openMenu,
    setOpenMenu,
    itemDialog,
    setItemDialog,
    henchmenGroups,
    entries,
    warband,
    handleMenuToggle,
    handleMenuAction,
    handleSellConfirm,
    handleMoveConfirm,
  };
}
