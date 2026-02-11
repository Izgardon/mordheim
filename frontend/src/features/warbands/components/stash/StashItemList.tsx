import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

import ItemSellDialog from "../dialogs/items/ItemSellDialog";
import ItemMoveDialog from "../dialogs/items/ItemMoveDialog";

import type { WarbandHero, WarbandItemSummary } from "../../types/warband-types";

import cardDetailed from "@/assets/containers/basic_bar.webp";
import { ExitIcon } from "@components/exit-icon";
import { useAppStore } from "@/stores/app-store";
import {
  createWarbandTrade,
  getWarbandHeroDetail,
  removeWarbandItem,
  updateWarbandHero,
} from "../../api/warbands-api";

type StashEntry = {
  id: string;
  itemId: number;
  label: string;
  item: WarbandItemSummary;
};

type OpenMenu = {
  entryId: string;
  entry: StashEntry;
  rect: DOMRect;
};

type ItemDialogState = {
  action: "sell" | "move";
  item: WarbandItemSummary;
  count: number;
} | null;

type StashItemListProps = {
  items: WarbandItemSummary[];
  warbandId: number;
  onClose?: () => void;
  onItemsChanged?: () => void;
  onHeroUpdated?: (updatedHero: WarbandHero) => void;
};

export default function StashItemList({
  items,
  warbandId,
  onClose,
  onItemsChanged,
  onHeroUpdated,
}: StashItemListProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialogState>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { warband } = useAppStore();
  const heroes = warband?.heroes ?? [];

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

  const entries: StashEntry[] = items.map((item) => ({
    id: `stash-item-${item.id}`,
    itemId: item.id,
    label: item.quantity && item.quantity > 1 ? `${item.name} x ${item.quantity}` : item.name,
    item,
  }));

  if (entries.length === 0) {
    return null;
  }

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
      setItemDialog({
        action: action === "Sell" ? "sell" : "move",
        item: entry.item,
        count: entry.item.quantity ?? 1,
      });
    }
  };

  const handleSellConfirm = async (item: WarbandItemSummary, sellQty: number, sellPrice: number) => {
    await removeWarbandItem(warbandId, item.id, sellQty);
    await createWarbandTrade(warbandId, {
      action: "Sold",
      description: sellQty > 1 ? `${item.name} x ${sellQty}` : item.name,
      price: sellPrice,
    });
    onItemsChanged?.();
  };

  const handleMoveConfirm = async (item: WarbandItemSummary, moveQty: number, unitId: string) => {
    await removeWarbandItem(warbandId, item.id, moveQty);

    const targetHeroId = Number(unitId);
    const targetHero = await getWarbandHeroDetail(warbandId, targetHeroId);
    const targetItemIds = targetHero.items.map((i) => i.id);
    const addedIds = Array.from({ length: moveQty }, () => item.id);
    await updateWarbandHero(warbandId, targetHeroId, {
      name: targetHero.name,
      unit_type: targetHero.unit_type,
      race: targetHero.race_id ?? null,
      price: targetHero.price,
      xp: targetHero.xp,
      item_ids: [...targetItemIds, ...addedIds],
    });

    const freshTarget = await getWarbandHeroDetail(warbandId, targetHeroId);
    onHeroUpdated?.(freshTarget);
    onItemsChanged?.();
  };

  return (
    <>
      <div
        className="relative space-y-2 p-3"
        style={{
          backgroundImage: `url(${cardDetailed})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }}
      >
        <button
          type="button"
          className="icon-button absolute right-1 top-2 transition-[filter] hover:brightness-125"
          onClick={onClose}
          aria-label="Close warband stash"
        >
          <ExitIcon className="h-5 w-5" />
        </button>
        <p className="text-[0.55rem] uppercase tracking-[0.35em] text-muted-foreground">
          Warband Stash
        </p>
        <div className="min-h-[10rem] max-h-[12rem] overflow-y-auto pr-1">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 transition-colors duration-150 hover:border-white/40"
              >
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {entry.label}
                </span>
                <button
                  type="button"
                  className="flex h-5 w-4 flex-shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-foreground/50 transition-colors duration-150 hover:text-foreground"
                  onClick={(e) => handleMenuToggle(entry, e)}
                >
                  <svg width="3" height="13" viewBox="0 0 3 13" fill="currentColor">
                    <circle cx="1.5" cy="1.5" r="1.5" />
                    <circle cx="1.5" cy="6.5" r="1.5" />
                    <circle cx="1.5" cy="11.5" r="1.5" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
      {openMenu &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] min-w-[100px] rounded border border-white/20 bg-neutral-900 py-1 shadow-lg"
            style={{
              top: openMenu.rect.bottom + 4,
              left: openMenu.rect.right - 100,
            }}
          >
            {["Sell", "Move", "Buy again"].map((action) => (
              <button
                key={action}
                type="button"
                className="block w-full cursor-pointer border-none bg-transparent px-3 py-1.5 text-left text-xs text-foreground transition-colors duration-150 hover:bg-white/10 hover:text-accent"
                onClick={() => handleMenuAction(action, openMenu.entry)}
              >
                {action}
              </button>
            ))}
          </div>,
          document.body
        )}
      {itemDialog?.action === "sell" && (
        <ItemSellDialog
          open
          onOpenChange={(open) => { if (!open) setItemDialog(null); }}
          itemName={itemDialog.item.name}
          itemCost={itemDialog.item.cost}
          maxQuantity={itemDialog.count}
          onConfirm={({ quantity, price }) =>
            handleSellConfirm(itemDialog.item, quantity, price)
          }
        />
      )}
      {itemDialog?.action === "move" && (
        <ItemMoveDialog
          open
          onOpenChange={(open) => { if (!open) setItemDialog(null); }}
          itemName={itemDialog.item.name}
          maxQuantity={itemDialog.count}
          unitTypes={["heroes"]}
          units={heroes}
          defaultUnitType="heroes"
          disableUnitTypeSelect
          description="Choose a hero to move this item to"
          onConfirm={({ quantity, unitId }) =>
            handleMoveConfirm(itemDialog.item, quantity, unitId)
          }
        />
      )}
    </>
  );
}
