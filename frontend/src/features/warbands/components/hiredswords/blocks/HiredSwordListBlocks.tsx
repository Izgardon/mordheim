import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

import DetailPopup, { type DetailEntry, type PopupPosition } from "../../shared/unit_details/DetailPopup";
import ItemSellDialog from "../../shared/dialogs/ItemSellDialog";
import ItemMoveDialog from "../../shared/dialogs/ItemMoveDialog";
import AcquireItemDialog from "../../../../items/components/AcquireItemDialog/AcquireItemDialog";

import type { HenchmenGroup, WarbandHiredSword, WarbandHero } from "../../../types/warband-types";
import type { Item } from "../../../../items/types/item-types";
import { isPendingByName } from "../../heroes/utils/pending-entries";

import cardDetailed from "@/assets/containers/basic_bar.webp";
import chestIcon from "@/assets/icons/chest.webp";
import skillIcon from "@/assets/components/skill.webp";
import spellIcon from "@/assets/components/spell.webp";
import specialIcon from "@/assets/components/scroll_box.webp";
import { getWarbandHiredSwordDetail, listWarbandHenchmenGroups } from "../../../api/warbands-api";
import { emitWarbandUpdate } from "../../../api/warbands-events";
import { sellHiredSwordItem, moveHiredSwordItem } from "../utils/hiredsword-item-actions";
import { useAppStore } from "@/stores/app-store";
import { getItem } from "@/features/items/api/items-api";

type BlockEntry = {
  id: string;
  visibleId: number;
  label: string;
  type: "item" | "skill" | "spell" | "special";
  dc?: string | number | null;
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

type HiredSwordListBlocksProps = {
  hiredSword: WarbandHiredSword;
  warbandId: number;
  variant?: "summary" | "detailed";
  onHiredSwordUpdated?: (updated: WarbandHiredSword) => void;
  onPendingEntryClick?: (hiredSwordId: number, tab: "skills" | "spells" | "special") => void;
  onPendingSpellClick?: () => void;
  onPendingSkillClick?: () => void;
  spellLookup?: Record<number, { dc?: string | number | null }>;
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

export default function HiredSwordListBlocks({
  hiredSword,
  warbandId,
  variant = "summary",
  onHiredSwordUpdated,
  onPendingEntryClick,
  onPendingSpellClick,
  onPendingSkillClick,
  spellLookup,
}: HiredSwordListBlocksProps) {
  const isDetailed = variant === "detailed";
  const [openPopups, setOpenPopups] = useState<OpenPopup[]>([]);
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialogState>(null);
  const [buyAgainItem, setBuyAgainItem] = useState<Item | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { warband } = useAppStore();
  const [henchmenGroups, setHenchmenGroups] = useState<HenchmenGroup[]>([]);

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
    (hiredSword.items ?? []).reduce<Record<number, { item: typeof hiredSword.items[number]; count: number }>>((acc, item) => {
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

  const skillBlock: BlockEntry[] = (hiredSword.skills ?? []).map((skill, index) => ({
    id: `skill-${skill.id}-${index}`,
    visibleId: skill.id,
    label: skill.name,
    type: "skill",
    pending: isPendingByName("skill", skill.name),
  }));

  const spellBlock: BlockEntry[] = (hiredSword.spells ?? []).map((spell, index) => ({
    id: `spell-${spell.id}-${index}`,
    visibleId: spell.id,
    label: spell.name,
    type: "spell",
    dc: spell.dc ?? spellLookup?.[spell.id]?.dc ?? null,
    pending: isPendingByName("spell", spell.name),
  }));

  const specialBlock: BlockEntry[] = (hiredSword.specials ?? []).map((entry, index) => ({
    id: `special-${entry.id}-${index}`,
    visibleId: entry.id,
    label: entry.name,
    type: "special",
    pending: isPendingByName("special", entry.name),
  }));

  const blocks: NormalizedBlock[] = [
    { id: "items", title: "Items", entries: itemBlock },
    { id: "skills", title: "Skills", entries: skillBlock },
    { id: "spells", title: "Spells", entries: spellBlock },
    { id: "special", title: "Specials", entries: specialBlock },
  ].filter((block) => block.entries.length > 0);

  if (blocks.length === 0) {
    return null;
  }

  const tabIcons = useMemo(
    () => ({
      items: "frontend/src/assets/icons/svgrepo/equipment.svg",
      skills: "frontend/src/assets/icons/svgrepo/skills.svg",
      spells: "frontend/src/assets/icons/svgrepo/spells.svg",
      special: "frontend/src/assets/icons/svgrepos/special.svg",
    }),
    []
  );

  const fallbackIcons = useMemo(
    () => [chestIcon, skillIcon, spellIcon, specialIcon],
    []
  );

  const resolveTabIcon = (id: string) => {
    const mapped = tabIcons[id as keyof typeof tabIcons];
    const hash = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const fallback = fallbackIcons[hash % fallbackIcons.length];
    return {
      primary: mapped ?? fallback,
      fallback,
    };
  };

  useEffect(() => {
    if (!activeTab || !blocks.some((block) => block.id === activeTab)) {
      setActiveTab(blocks[0]?.id ?? null);
    }
  }, [activeTab, blocks]);

  const handleEntryClick = (entry: BlockEntry, event: React.MouseEvent) => {
    if (entry.pending && entry.type === "spell" && onPendingSpellClick) {
      onPendingSpellClick();
      return;
    }
    if (entry.pending && entry.type === "skill" && onPendingSkillClick) {
      onPendingSkillClick();
      return;
    }
    if (entry.pending && onPendingEntryClick && (entry.type === "skill" || entry.type === "spell" || entry.type === "special")) {
      onPendingEntryClick(hiredSword.id, entry.type === "skill" ? "skills" : entry.type === "spell" ? "spells" : "special");
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
    const item = (hiredSword.items ?? []).find((i) => i.id === entry.visibleId);
    if (!item) return;
    if (action === "Sell" || action === "Move") {
      const count = (hiredSword.items ?? []).filter((i) => i.id === entry.visibleId).length;
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
    const updated = await sellHiredSwordItem(warbandId, hiredSword, item, sellQty, sellPrice);
    onHiredSwordUpdated?.(updated);
  };

  const handleMoveItem = async (item: Item, moveQty: number, unitType: string, unitId: string) => {
    const result = await moveHiredSwordItem(warbandId, hiredSword, item, moveQty, unitType, unitId);
    onHiredSwordUpdated?.(result.source);
    if (result.target && "id" in result.target) {
      if ("upkeep_price" in result.target) {
        onHiredSwordUpdated?.(result.target as WarbandHiredSword);
      }
    }
    if (unitType === "heroes") {
      emitWarbandUpdate(warbandId);
    }
  };

  const renderBlockEntries = (block: NormalizedBlock) => (
    <div
      className="relative p-2.5"
      style={{
        backgroundImage: `url(${cardDetailed})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
    >
      <div className={isDetailed ? "overflow-y-auto pr-1" : "min-h-[7rem] max-h-[7rem] overflow-y-auto pr-1"}>
        <div className={isDetailed ? "grid grid-cols-1 gap-y-1 text-sm" : "grid grid-cols-2 gap-x-3 gap-y-1 text-sm"}>
          {block.entries.map((entry) => (
            <div
              key={entry.id}
              className={
                entry.pending
                  ? "flex items-start gap-1 rounded border border-[#6e5a3b] bg-[#3b2a1a] px-1.5 py-0.5 transition-colors duration-150 hover:border-[#f5d97b]/60"
                  : "flex items-start gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 transition-colors duration-150 hover:border-white/40"
              }
            >
              <button
                type="button"
                className={
                  entry.pending
                    ? "min-w-0 flex-1 cursor-pointer whitespace-normal break-words border-none bg-transparent p-0 text-left font-inherit text-[#f5d97b] transition-colors duration-150 hover:text-[#f5d97b]/80"
                    : "min-w-0 flex-1 cursor-pointer whitespace-normal break-words border-none bg-transparent p-0 text-left font-inherit text-foreground transition-colors duration-150 hover:text-accent"
                }
                onClick={(e) => handleEntryClick(entry, e)}
              >
                {entry.label}
              </button>
              {entry.type === "spell" && entry.dc !== undefined && entry.dc !== null && entry.dc !== "" ? (
                <span className="whitespace-nowrap text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
                  DC {entry.dc}
                </span>
              ) : null}
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
  );

  const activeBlock = blocks.find((block) => block.id === activeTab) ?? blocks[0];

  return (
    <>
      {isDetailed ? (
        <div className="grid grid-cols-4 gap-4">
          {blocks.map((block) => (
            <div key={block.id} className="space-y-1">
              <p className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
                {block.title}
              </p>
              {renderBlockEntries(block)}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            {blocks.map((block) => {
              const { primary, fallback } = resolveTabIcon(block.id);
              const isActive = block.id === activeBlock.id;
              return (
                <button
                  key={block.id}
                  type="button"
                  aria-label={block.title}
                  onClick={() => setActiveTab(block.id)}
                  className={[
                    "relative h-8 w-8 -mb-2 rounded-full border border-white/20 transition-all",
                    "bg-black/40 shadow-[0_0_12px_rgba(5,20,24,0.35)]",
                    isActive ? "ring-2 ring-emerald-400/60" : "hover:brightness-110",
                  ].join(" ")}
                  style={{
                    backgroundImage: `url(${primary}), url(${fallback})`,
                    backgroundSize: "100% 100%",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                  }}
                />
              );
            })}
          </div>
          {activeBlock ? renderBlockEntries(activeBlock) : null}
        </div>
      )}
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
          unitTypes={["heroes", "hiredswords", "henchmen", "stash"]}
          units={{
            heroes: warband?.heroes ?? [],
            hiredswords: (warband?.hired_swords ?? []).filter((hs) => hs.id !== hiredSword.id),
            henchmen: henchmenGroups,
          }}
          onConfirm={({ quantity, unitType, unitId }) =>
            handleMoveItem(itemDialog.item, quantity, unitType, unitId)
          }
        />
      )}
      {buyAgainItem && (
        <AcquireItemDialog
          item={buyAgainItem}
          open
          onOpenChange={(open) => { if (!open) setBuyAgainItem(null); }}
          trigger={null}
          presetUnitType="hiredswords"
          presetUnitId={hiredSword.id}
          disableUnitSelection
          defaultUnitSectionCollapsed
          defaultRaritySectionCollapsed={false}
          defaultPriceSectionCollapsed={false}
          onAcquire={async () => {
            const fresh = await getWarbandHiredSwordDetail(warbandId, hiredSword.id);
            onHiredSwordUpdated?.(fresh);
          }}
        />
      )}
    </>
  );
}
