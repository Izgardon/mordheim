import { useEffect, useRef, useState, type MouseEvent } from "react";
import { toast } from "sonner";

import { getItem } from "../../items/api/items-api";
import { getErrorMessage } from "@/lib/get-error-message";
import { useActingWarband } from "../components/warband/shown-warband-context";
import { useItemMove, useItemSale, type ItemMutationResult } from "../api/economy-queries";
import { costsSummary } from "../utils/stash-costs";

import type { Item } from "../../items/types/item-types";
import type {
  WarbandItemSalePayload,
  WarbandItemSummary,
  WarbandUnitDetail,
} from "../types/warband-types";

export type UnitType = "heroes" | "hiredswords" | "henchmen";

/** Whose item the menu acts on: the stash's rows, or one unit's items. */
export type ItemActionSource<U extends WarbandUnitDetail = WarbandUnitDetail> =
  | { kind: "stash"; items: WarbandItemSummary[] }
  | { kind: UnitType; unit: U };

/** A row with a kebab: its key, and the id of the item it shows. */
export type MenuEntry = { id: string; visibleId: number };

export type OpenMenu = { entryId: string; entry: MenuEntry; rect: DOMRect };

/** The item a row shows: its cost, suggested sale price and (stash) copies by cost. */
type MenuItem = Pick<
  WarbandItemSummary,
  "id" | "name" | "cost" | "costs" | "suggested_sale_price" | "sale_price_basis"
>;

export type ItemDialogState = { action: "sell" | "move"; item: MenuItem; count: number } | null;

type ApiUnitType = WarbandItemSalePayload["source_type"];

const API_TYPES: Record<string, ApiUnitType> = {
  heroes: "hero",
  hiredswords: "hired_sword",
  henchmen: "henchmen_group",
  stash: "stash",
};

/** The stash's rows as the list shows them ("Sword x 3", "1 at 12 gc, 2 at 9 gc"). */
export const stashEntries = (items: WarbandItemSummary[]) =>
  items.map((item) => ({
    id: `stash-item-${item.id}`,
    visibleId: item.id,
    label: item.quantity && item.quantity > 1 ? `${item.name} x ${item.quantity}` : item.name,
    costs: costsSummary(item.costs),
  }));

/** The item a row shows and how many copies the source holds. */
function menuItemOf(source: ItemActionSource, entry: MenuEntry) {
  if (source.kind === "stash") {
    const item = source.items.find((entry_) => entry_.id === entry.visibleId);
    return item ? { item, count: item.quantity ?? 1 } : null;
  }
  const items = source.unit.items ?? [];
  const item = items.find((entry_) => entry_.id === entry.visibleId);
  return item ? { item, count: items.filter((i) => i.id === entry.visibleId).length } : null;
}

type UseItemActionMenuOptions<U extends WarbandUnitDetail> = {
  source: ItemActionSource<U>;
  warbandId: number;
  canEdit: boolean;
  /** A unit source as the sale or move answered it. */
  onSourceUpdated?: (unit: U) => void;
  /** Every answer, for the caller to put in the cache (`itemMutationUpdate`). */
  onMutationComplete?: (result: ItemMutationResult) => void;
};

/**
 * An item's kebab menu, for the stash and every unit kind alike (ECON-CQ-06): Sell and Move open
 * their dialogs and send through `useItemSale` / `useItemMove`; Buy again loads the item for the
 * acquire dialog (PR C: at the campaign's current price). Move targets are the units of the
 * warband on screen (BUG-107).
 */
export default function useItemActionMenu<U extends WarbandUnitDetail>({
  source,
  warbandId,
  canEdit,
  onSourceUpdated,
  onMutationComplete,
}: UseItemActionMenuOptions<U>) {
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialogState>(null);
  const [buyAgainItem, setBuyAgainItem] = useState<Item | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const warband = useActingWarband();
  const { mutateAsync: sell } = useItemSale(warbandId);
  const { mutateAsync: move } = useItemMove(warbandId);
  const sourceRef: Pick<WarbandItemSalePayload, "source_type" | "source_id"> =
    source.kind === "stash"
      ? { source_type: "stash", source_id: null }
      : { source_type: API_TYPES[source.kind], source_id: source.unit.id };

  useEffect(() => {
    if (!openMenu) return;
    const handleClickOutside = (e: globalThis.MouseEvent) => {
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

  const handleMenuToggle = (entry: MenuEntry, e: MouseEvent) => {
    if (!canEdit) return;
    e.stopPropagation();
    if (openMenu?.entryId === entry.id) {
      setOpenMenu(null);
    } else {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setOpenMenu({ entryId: entry.id, entry, rect });
    }
  };

  const handleMenuAction = (action: string, entry: MenuEntry) => {
    setOpenMenu(null);
    const target = menuItemOf(source, entry);
    if (!target) return;
    if (action === "Sell" || action === "Move") {
      setItemDialog({ action: action === "Sell" ? "sell" : "move", ...target });
      return;
    }
    if (action === "Buy again") {
      void getItem(target.item.id)
        .then(setBuyAgainItem)
        .catch((err: unknown) => {
          toast.error(`Couldn't load ${target.item.name}.`, { description: getErrorMessage(err) });
        });
    }
  };

  /** The source unit as the answer has it, then the answer for the cache. */
  const complete = (result: ItemMutationResult) => {
    if (source.kind !== "stash" && result.source && !("quantity" in result.source)) {
      onSourceUpdated?.(result.source as U);
    }
    onMutationComplete?.(result);
  };

  /** `cost`: only stash copies of that cost (BUG-117); left out, the copies that leave first. */
  const handleSell = async (
    item: MenuItem,
    sale: { quantity: number; price: number; cost?: number | null }
  ) => {
    complete(await sell({ ...sourceRef, item_id: item.id, ...sale }));
  };

  const handleMove = async (
    item: MenuItem,
    {
      unitType,
      unitId,
      ...copies
    }: { quantity: number; unitType: string; unitId: string; cost?: number | null }
  ) => {
    const result = await move({
      ...sourceRef,
      target_type: API_TYPES[unitType] ?? "henchmen_group",
      target_id: unitType === "stash" ? null : Number(unitId),
      item_id: item.id,
      ...copies,
    });
    complete({ ...result, targetUnitType: unitType });
  };

  return {
    openMenu,
    menuRef,
    itemDialog,
    setItemDialog,
    buyAgainItem,
    setBuyAgainItem,
    warband,
    handleMenuToggle,
    handleMenuAction,
    handleSell,
    handleMove,
  };
}

export type ItemActionMenu = ReturnType<typeof useItemActionMenu>;
