import { useEffect, useRef, useState } from "react";

import { getItem } from "../../items/api/items-api";
import { useActingWarband } from "../components/warband/shown-warband-context";
import { sellUnitItem, moveUnitItem, type UnitType } from "../utils/unit-item-actions";

import type { Item } from "../../items/types/item-types";
import type { WarbandItemMutationResponse, WarbandUnitDetail } from "../types/warband-types";

export type BlockEntry = {
  id: string;
  visibleId: number;
  label: string;
  type: string;
  [key: string]: unknown;
};

export type OpenMenu = {
  entryId: string;
  entry: BlockEntry;
  rect: DOMRect;
};

export type ItemDialogState = {
  action: "sell" | "move";
  item: Item;
  count: number;
} | null;

type UseUnitItemMenuOptions<U extends WarbandUnitDetail> = {
  warbandId: number;
  unit: U;
  unitType: UnitType;
  canEdit: boolean;
  onSourceUpdated?: (unit: U) => void;
  onMutationComplete?: (result: WarbandItemMutationResponse & { targetUnitType?: string }) => void;
};

export default function useUnitItemMenu<U extends WarbandUnitDetail>({
  warbandId,
  unit,
  unitType,
  canEdit,
  onSourceUpdated,
  onMutationComplete,
}: UseUnitItemMenuOptions<U>) {
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialogState>(null);
  const [buyAgainItem, setBuyAgainItem] = useState<Item | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  // Move targets are the units of the warband on screen, from its sheet (BUG-107).
  const warband = useActingWarband();

  useEffect(() => {
    if (!openMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openMenu]);

  useEffect(() => {
    if (!canEdit && openMenu) {
      setOpenMenu(null);
    }
  }, [canEdit, openMenu]);

  const handleMenuToggle = (entry: BlockEntry, e: React.MouseEvent) => {
    if (!canEdit) return;
    e.stopPropagation();
    if (openMenu?.entryId === entry.id) {
      setOpenMenu(null);
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setOpenMenu({ entryId: entry.id, entry, rect });
    }
  };

  const handleMenuAction = (action: string, entry: BlockEntry) => {
    setOpenMenu(null);
    const item = (unit.items ?? []).find((i) => i.id === entry.visibleId);
    if (!item) return;

    if (action === "Sell" || action === "Move") {
      const count = (unit.items ?? []).filter((i) => i.id === entry.visibleId).length;
      setItemDialog({ action: action === "Sell" ? "sell" : "move", item, count });
      return;
    }

    if (action === "Buy again") {
      void (async () => {
        try {
          const fullItem = await getItem(item.id);
          setBuyAgainItem(fullItem);
        } catch (err) {
          console.error("Failed to load item details", err);
        }
      })();
    }
  };

  const handleSellItem = async (item: Item, sellQty: number, sellPrice: number) => {
    const result = await sellUnitItem({
      warbandId,
      unit,
      item,
      sellQty,
      sellPrice,
      unitType,
    });
    if (result.source && !("quantity" in result.source)) {
      onSourceUpdated?.(result.source as U);
    }
    onMutationComplete?.(result);
  };

  const handleMoveItem = async (
    item: Item,
    moveQty: number,
    targetUnitType: string,
    targetUnitId: string
  ) => {
    const result = await moveUnitItem({
      warbandId,
      unit,
      item,
      moveQty,
      targetUnitType,
      targetUnitId,
      unitType,
    });
    if (result.source && !("quantity" in result.source)) {
      onSourceUpdated?.(result.source as U);
    }
    onMutationComplete?.({ ...result, targetUnitType });
  };

  return {
    openMenu,
    setOpenMenu,
    itemDialog,
    setItemDialog,
    buyAgainItem,
    setBuyAgainItem,
    menuRef,
    warband,
    unitType,
    unitId: unit.id,
    warbandId,
    handleMenuToggle,
    handleMenuAction,
    handleSellItem,
    handleMoveItem,
  };
}
