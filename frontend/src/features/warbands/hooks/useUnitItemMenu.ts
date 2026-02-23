import { useState, useRef, useEffect } from "react";

import { listWarbandHenchmenGroups } from "../api/warbands-api";
import { getItem } from "../../items/api/items-api";
import { useAppStore } from "@/stores/app-store";
import { sellUnitItem, moveUnitItem } from "../utils/unit-item-actions";

import type { Item } from "../../items/types/item-types";
import type { HenchmenGroup, WarbandHero, WarbandHiredSword } from "../types/warband-types";

// ── Shared types ───────────────────────────────────────────────────────

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

// ── Hook types ─────────────────────────────────────────────────────────

type UnitWithItems = { id: number; items: Item[] };

type UseUnitItemMenuOptions<U extends UnitWithItems, P> = {
  warbandId: number;
  unit: U;
  unitType: "heroes" | "hiredswords" | "henchmen";
  canEdit: boolean;
  updateSource: (warbandId: number, unitId: number, payload: P) => Promise<U>;
  buildSourcePayload: (unit: U, itemIds: number[]) => P;
  fetchSource: (warbandId: number, unitId: number) => Promise<U>;
  onSourceUpdated?: (unit: U) => void;
  onMoveComplete?: (result: {
    source: U;
    target?: WarbandHero | WarbandHiredSword | HenchmenGroup;
    targetUnitType: string;
  }) => void;
};

// ── Hook ───────────────────────────────────────────────────────────────

export default function useUnitItemMenu<U extends UnitWithItems, P>({
  warbandId,
  unit,
  unitType,
  canEdit,
  updateSource,
  buildSourcePayload,
  fetchSource,
  onSourceUpdated,
  onMoveComplete,
}: UseUnitItemMenuOptions<U, P>) {
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialogState>(null);
  const [buyAgainItem, setBuyAgainItem] = useState<Item | null>(null);
  const [henchmenGroups, setHenchmenGroups] = useState<HenchmenGroup[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const { warband } = useAppStore();

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
      if (action === "Move" && warband) {
        listWarbandHenchmenGroups(warband.id)
          .then(setHenchmenGroups)
          .catch(() => {});
      }
      setItemDialog({ action: action === "Sell" ? "sell" : "move", item, count });
    } else if (action === "Buy again") {
      void (async () => {
        if (item.rarity !== undefined && item.rarity !== null) {
          setBuyAgainItem(item);
          return;
        }
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
    const updated = await sellUnitItem({
      warbandId,
      unit,
      item,
      sellQty,
      sellPrice,
      updateUnit: updateSource,
      buildPayload: buildSourcePayload,
    });
    onSourceUpdated?.(updated);
  };

  const handleMoveItem = async (item: Item, moveQty: number, targetUnitType: string, targetUnitId: string) => {
    const result = await moveUnitItem({
      warbandId,
      unit,
      item,
      moveQty,
      targetUnitType,
      targetUnitId,
      updateSource,
      buildSourcePayload,
      fetchSource,
    });
    onSourceUpdated?.(result.source);
    onMoveComplete?.({
      source: result.source,
      target: result.target,
      targetUnitType,
    });
  };

  return {
    openMenu,
    setOpenMenu,
    itemDialog,
    setItemDialog,
    buyAgainItem,
    setBuyAgainItem,
    henchmenGroups,
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
