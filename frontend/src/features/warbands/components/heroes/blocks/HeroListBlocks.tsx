import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

import DetailPopup, { type DetailEntry, type PopupPosition } from "../overlays/DetailPopup";
import ItemSellDialog from "../../dialogs/items/ItemSellDialog";
import ItemMoveDialog from "../../dialogs/items/ItemMoveDialog";

import type { WarbandHero } from "../../../types/warband-types";
import type { Item } from "../../../../items/types/item-types";
import { isPendingByName } from "../utils/pending-entries";

import cardDetailed from "@/assets/containers/basic_bar.webp";
import {
  addWarbandItem,
  createWarbandTrade,
  getWarbandHeroDetail,
  updateWarbandHero,
} from "../../../api/warbands-api";
import { useAppStore } from "@/stores/app-store";

type BlockEntry = {
  id: string;
  visibleId: number;
  label: string;
  type: "item" | "skill" | "spell" | "feature";
  pending?: boolean;
};

type NormalizedBlock = {
  id: string;
  title: string;
  entries: BlockEntry[];
};

type OpenPopup = {
  entry: DetailEntry;
  anchorRect: DOMRect;
  key: string;
  position?: PopupPosition;
};

type HeroListBlocksProps = {
  hero: WarbandHero;
  warbandId: number;
  variant?: "summary" | "detailed";
  onHeroUpdated?: (updatedHero: WarbandHero) => void;
  onPendingEntryClick?: (heroId: number, tab: "skills" | "spells" | "feature") => void;
};

type OpenMenu = {
  entryId: string;
  entry: BlockEntry;
  rect: DOMRect;
};

type ItemDialogState = {
  action: "sell" | "move";
  item: Item;
  count: number;
} | null;

export default function HeroListBlocks({ hero, warbandId, variant = "summary", onHeroUpdated, onPendingEntryClick }: HeroListBlocksProps) {
  const isDetailed = variant === "detailed";
  const [openPopups, setOpenPopups] = useState<OpenPopup[]>([]);
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialogState>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { warband } = useAppStore();
  const moveTargets = (warband?.heroes ?? []).filter((candidate) => candidate.id !== hero.id);

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

  const itemBlock: BlockEntry[] = Object.values(
    (hero.items ?? []).reduce<Record<number, { item: typeof hero.items[number]; count: number }>>((acc, item) => {
      if (acc[item.id]) {
        acc[item.id].count += 1;
      } else {
        acc[item.id] = { item, count: 1 };
      }
      return acc;
    }, {})
  ).map(({ item, count }) => ({
    id: `item-${item.id}`,
    visibleId: item.id,
    label: count >= 2 ? `${item.name} x ${count}` : item.name,
    type: "item",
  }));

  const skillBlock: BlockEntry[] = (hero.skills ?? []).map((skill, index) => ({
    id: `skill-${skill.id}-${index}`,
    visibleId: skill.id,
    label: skill.name,
    type: "skill",
    pending: isPendingByName("skill", skill.name),
  }));

  const spellBlock: BlockEntry[] = (hero.spells ?? []).map((spell, index) => ({
    id: `spell-${spell.id}-${index}`,
    visibleId: spell.id,
    label: spell.name,
    type: "spell",
    pending: isPendingByName("spell", spell.name),
  }));

  const featureBlock: BlockEntry[] = (hero.features ?? []).map((entry, index) => ({
    id: `feature-${entry.id}-${index}`,
    visibleId: entry.id,
    label: entry.name,
    type: "feature",
    pending: isPendingByName("feature", entry.name),
  }));

  const blocks: NormalizedBlock[] = [
    { id: "items", title: "Items", entries: itemBlock },
    { id: "skills", title: "Skills", entries: skillBlock },
    { id: "spells", title: "Spells", entries: spellBlock },
    { id: "feature", title: "Features", entries: featureBlock },
  ].filter((block) => block.entries.length > 0);

  if (blocks.length === 0) {
    return null;
  }

  const handleEntryClick = (entry: BlockEntry, event: React.MouseEvent) => {
    if (entry.pending && onPendingEntryClick && (entry.type === "skill" || entry.type === "spell" || entry.type === "feature")) {
      onPendingEntryClick(hero.id, entry.type === "skill" ? "skills" : entry.type === "spell" ? "spells" : "feature");
      return;
    }

    const entryKey = entry.id;
    const existingIndex = openPopups.findIndex((p) => p.key === entryKey);

    if (existingIndex !== -1) {
      setOpenPopups((prev) => prev.filter((p) => p.key !== entryKey));
    } else {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      setOpenPopups((prev) => [
        ...prev,
        {
          entry: {
            id: entry.visibleId,
            type: entry.type,
            name: entry.label,
          },
          anchorRect: rect,
          key: entryKey,
        },
      ]);
    }
  };

  const handleClose = (key: string) => {
    setOpenPopups((prev) => prev.filter((popup) => popup.key !== key));
  };

  const handlePositionCalculated = (key: string, position: PopupPosition) => {
    setOpenPopups((prev) =>
      prev.map((popup) =>
        popup.key === key ? { ...popup, position } : popup
      )
    );
  };

  const getExistingPositions = (currentIndex: number): PopupPosition[] => {
    return openPopups
      .slice(0, currentIndex)
      .filter((p) => p.position)
      .map((p) => p.position!);
  };

  const handleMenuToggle = (entry: BlockEntry, e: React.MouseEvent) => {
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
    if (action === "Sell" || action === "Move") {
      const item = (hero.items ?? []).find((i) => i.id === entry.visibleId);
      if (item) {
        const count = (hero.items ?? []).filter((i) => i.id === entry.visibleId).length;
        setItemDialog({ action: action === "Sell" ? "sell" : "move", item, count });
      }
    }
  };

  const handleSellItem = async (item: Item, sellQty: number, sellPrice: number) => {
    const currentItemIds = hero.items.map((i) => i.id);
    const newItemIds = [...currentItemIds];

    let removed = 0;
    for (let i = newItemIds.length - 1; i >= 0 && removed < sellQty; i--) {
      if (newItemIds[i] === item.id) {
        newItemIds.splice(i, 1);
        removed++;
      }
    }

    if (removed === 0) {
      throw new Error("Item not found on this hero.");
    }

    const updatedHero = await updateWarbandHero(warbandId, hero.id, {
      name: hero.name,
      unit_type: hero.unit_type,
      race: hero.race_id ?? null,
      price: hero.price,
      xp: hero.xp,
      item_ids: newItemIds,
    });

    await createWarbandTrade(warbandId, {
      action: "Sold",
      description: sellQty > 1 ? `${item.name} x${sellQty}` : item.name,
      price: sellPrice,
    });

    onHeroUpdated?.(updatedHero);
  };

  const handleMoveItem = async (item: Item, moveQty: number, unitType: string, unitId: string) => {
    const sourceItemIds = hero.items.map((i) => i.id);
    const newSourceItemIds = [...sourceItemIds];

    let removed = 0;
    for (let i = newSourceItemIds.length - 1; i >= 0 && removed < moveQty; i--) {
      if (newSourceItemIds[i] === item.id) {
        newSourceItemIds.splice(i, 1);
        removed++;
      }
    }

    if (removed === 0) {
      throw new Error("Item not found on this hero.");
    }

    await updateWarbandHero(warbandId, hero.id, {
      name: hero.name,
      unit_type: hero.unit_type,
      race: hero.race_id ?? null,
      price: hero.price,
      xp: hero.xp,
      item_ids: newSourceItemIds,
    });

    if (unitType === "stash") {
      for (let i = 0; i < moveQty; i++) {
        await addWarbandItem(warbandId, item.id);
      }
    } else {
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
    }

    const freshSource = await getWarbandHeroDetail(warbandId, hero.id);
    onHeroUpdated?.(freshSource);

    if (unitType !== "stash") {
      const freshTarget = await getWarbandHeroDetail(warbandId, Number(unitId));
      onHeroUpdated?.(freshTarget);
    }
  };

  return (
    <>
      <div className={isDetailed ? "grid grid-cols-4 gap-4" : "grid gap-3"}>
        {blocks.map((block) => (
          <div
            key={block.id}
            className="relative p-2.5"
            style={{
              backgroundImage: `url(${cardDetailed})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
            }}
          >
            <div className={isDetailed ? "overflow-y-auto pr-1" : "max-h-[5.5rem] overflow-y-auto pr-1"}>
              <div className={isDetailed ? "grid grid-cols-1 gap-y-1 text-sm" : "grid grid-cols-2 gap-x-3 gap-y-1 text-sm"}>
                {block.entries.map((entry) => (
                  <div
                    key={entry.id}
                    className={
                      entry.pending
                        ? "flex items-center gap-1 rounded border border-[#6e5a3b] bg-[#3b2a1a] px-1.5 py-0.5 transition-colors duration-150 hover:border-[#f5d97b]/60"
                        : "flex items-center gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 transition-colors duration-150 hover:border-white/40"
                    }
                  >
                    <button
                      type="button"
                      className={
                        entry.pending
                          ? "min-w-0 flex-1 cursor-pointer truncate border-none bg-transparent p-0 text-left font-inherit text-[#f5d97b] transition-colors duration-150 hover:text-[#f5d97b]/80"
                          : "min-w-0 flex-1 cursor-pointer truncate border-none bg-transparent p-0 text-left font-inherit text-foreground transition-colors duration-150 hover:text-accent"
                      }
                      onClick={(e) => handleEntryClick(entry, e)}
                    >
                      {entry.label}
                    </button>
                    {entry.type === "item" && (
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
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      {openPopups.map((popup, index) => (
        <DetailPopup
          key={popup.key}
          entry={popup.entry}
          onClose={() => handleClose(popup.key)}
          anchorRect={popup.anchorRect}
          stackIndex={index}
          existingPositions={getExistingPositions(index)}
          onPositionCalculated={(pos) => handlePositionCalculated(popup.key, pos)}
        />
      ))}
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
            handleSellItem(itemDialog.item, quantity, price)
          }
        />
      )}
      {itemDialog?.action === "move" && (
        <ItemMoveDialog
          open
          onOpenChange={(open) => { if (!open) setItemDialog(null); }}
          itemName={itemDialog.item.name}
          maxQuantity={itemDialog.count}
          unitTypes={["heroes", "stash"]}
          units={moveTargets}
          onConfirm={({ quantity, unitType, unitId }) =>
            handleMoveItem(itemDialog.item, quantity, unitType, unitId)
          }
        />
      )}
    </>
  );
}

