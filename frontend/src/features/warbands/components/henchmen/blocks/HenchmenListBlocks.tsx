import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";

import UnitListBlocks, { type UnitListPopup } from "../../shared/blocks/UnitListBlocks";
import type { PopupPosition } from "../../shared/unit_details/DetailPopup";
import ItemSellDialog from "../../shared/dialogs/ItemSellDialog";
import ItemMoveDialog from "../../shared/dialogs/ItemMoveDialog";
import AcquireItemDialog from "../../../../items/components/AcquireItemDialog/AcquireItemDialog";

import type { HenchmenGroup } from "../../../types/warband-types";
import type { Item } from "../../../../items/types/item-types";

import equipmentIcon from "@/assets/components/equipment.webp";
import rosterIcon from "@/assets/components/roster.webp";
import skillIcon from "@/assets/components/skill.webp";
import specialIcon from "@/assets/components/special.webp";
import { getWarbandHenchmenGroupDetail, listWarbandHenchmenGroups } from "../../../api/warbands-api";
import { useAppStore } from "@/stores/app-store";
import { moveHenchmenGroupItem, sellHenchmenGroupItem } from "../utils/henchmen-item-actions";
import { getItem } from "@/features/items/api/items-api";

type BlockEntry = {
  id: string;
  visibleId: number;
  label: string;
  type: "item" | "skill" | "special" | "roster";
  dead?: boolean;
  kills?: number;
  count?: number;
};

type NormalizedBlock = {
  id: string;
  title: string;
  entries: BlockEntry[];
};

type HenchmenListBlocksProps = {
  group: HenchmenGroup;
  warbandId: number;
  variant?: "summary" | "detailed";
  fullWidthItems?: boolean;
  summaryRowCount?: number;
  summaryScrollable?: boolean;
  onGroupUpdated?: (updatedGroup: HenchmenGroup) => void;
  canEdit?: boolean;
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

export default function HenchmenListBlocks({
  group,
  warbandId,
  variant = "summary",
  fullWidthItems = false,
  summaryRowCount,
  summaryScrollable,
  onGroupUpdated,
  canEdit = false,
}: HenchmenListBlocksProps) {
  const [openPopups, setOpenPopups] = useState<UnitListPopup[]>([]);
  const [openMenu, setOpenMenu] = useState<OpenMenu | null>(null);
  const [itemDialog, setItemDialog] = useState<ItemDialogState>(null);
  const [buyAgainItem, setBuyAgainItem] = useState<Item | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { warband } = useAppStore();
  const [otherHenchmenGroups, setOtherHenchmenGroups] = useState<HenchmenGroup[]>([]);

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

  const itemBlock: BlockEntry[] = Object.values(
    (group.items ?? []).reduce<Record<number, { item: typeof group.items[number]; count: number }>>((acc, item) => {
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
    count,
  }));

  const skillBlock: BlockEntry[] = (group.skills ?? []).map((skill, index) => ({
    id: `skill-${skill.id}-${index}`,
    visibleId: skill.id,
    label: skill.name,
    type: "skill",
  }));

  const specialBlock: BlockEntry[] = (group.specials ?? []).map((entry, index) => ({
    id: `special-${entry.id}-${index}`,
    visibleId: entry.id,
    label: entry.name,
    type: "special",
  }));

  const rosterBlock: BlockEntry[] = (group.henchmen ?? [])
    .filter((henchman) => henchman.name?.trim())
    .map((henchman) => ({
      id: `roster-${henchman.id}`,
      visibleId: henchman.id,
      label: henchman.name,
      type: "roster",
      dead: henchman.dead,
      kills: henchman.kills ?? 0,
    }));

  const rosterCount = (group.henchmen ?? []).length;
  const maxSize = group.max_size ?? 5;

  const blocks: NormalizedBlock[] = [
    { id: "roster", title: `Roster ${rosterCount}/${maxSize}`, entries: rosterBlock },
    { id: "items", title: "Items", entries: itemBlock },
    { id: "skills", title: "Skills", entries: skillBlock },
    { id: "special", title: "Specials", entries: specialBlock },
  ].filter((block) => block.entries.length > 0);

  if (blocks.length === 0) {
    return null;
  }

  const tabIcons = useMemo(
    () => ({
      roster: rosterIcon,
      items: equipmentIcon,
      skills: skillIcon,
      special: specialIcon,
    }),
    []
  );

  const fallbackIcons = useMemo(
    () => [rosterIcon, equipmentIcon, skillIcon, specialIcon],
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
    const resolvedType =
      entry.type === "item"
        ? "item"
        : entry.type === "skill"
          ? "skill"
          : entry.type === "special"
            ? "special"
            : null;
    if (!resolvedType) {
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
            type: resolvedType,
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


  const handleMenuToggle = (entry: BlockEntry, e: React.MouseEvent) => {
    if (!canEdit) {
      return;
    }
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
    const item = (group.items ?? []).find((i) => i.id === entry.visibleId);
    if (!item) return;
    if (action === "Sell" || action === "Move") {
      const count = (group.items ?? []).filter((i) => i.id === entry.visibleId).length;
      if (action === "Move" && warband) {
        listWarbandHenchmenGroups(warband.id)
          .then(setOtherHenchmenGroups)
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
    const updatedGroup = await sellHenchmenGroupItem(warbandId, group, item, sellQty, sellPrice);
    onGroupUpdated?.(updatedGroup);
  };

  const handleMoveItem = async (item: Item, moveQty: number, unitType: string, unitId: string) => {
    const result = await moveHenchmenGroupItem(warbandId, group, item, moveQty, unitType, unitId);
    onGroupUpdated?.(result.source);
  };

  const renderEntry = (entry: BlockEntry, _block: NormalizedBlock) => {
    if (entry.type === "roster") {
      return (
        <div
          key={entry.id}
          className={`flex min-h-[26px] items-center justify-between gap-2 rounded px-2 py-1 text-xs ${
            entry.dead
              ? "border border-red-500/20 bg-red-500/5 text-red-400 line-through"
              : "border border-white/10 bg-white/5 text-foreground"
          }`}
        >
          <span className="min-w-0 truncate">{entry.label}</span>
          <span className="shrink-0 text-muted-foreground">{entry.kills} kills</span>
        </div>
      );
    }

    const isItemMismatch =
      entry.type === "item" && rosterCount > 0 && (entry.count ?? 0) % rosterCount !== 0;

    return (
      <div
        key={entry.id}
        className={`flex items-start gap-1 rounded border px-1.5 py-0.5 transition-colors duration-150 ${
          isItemMismatch
            ? "border-red-500/60 bg-white/5 hover:border-red-500/80"
            : "border-white/10 bg-white/5 hover:border-white/40"
        }`}
      >
        <button
          type="button"
          className="min-w-0 flex-1 cursor-pointer whitespace-normal break-words border-none bg-transparent p-0 text-left font-inherit text-foreground transition-colors duration-150 hover:text-accent"
          onClick={(e) => handleEntryClick(entry, e)}
        >
          {entry.label}
        </button>
        {entry.type === "item" && canEdit && (
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
    );
  };

  const gridClassName = (block: NormalizedBlock, view: "summary" | "detailed") => {
    if (view === "detailed" || block.id === "roster") {
      return "grid grid-cols-1 gap-y-1 text-sm";
    }
    if (fullWidthItems && block.id === "items") {
      return "grid grid-cols-1 gap-y-1 text-sm";
    }
    return "grid grid-cols-2 gap-x-3 gap-y-1 text-sm";
  };

  return (
    <>
      <UnitListBlocks
        blocks={blocks}
        variant={variant}
        activeTab={activeTab}
        onActiveTabChange={setActiveTab}
        resolveTabIcon={(id, _index) => resolveTabIcon(id)}
        renderEntry={renderEntry}
        getGridClassName={gridClassName}
        summaryRowCount={summaryRowCount}
        summaryScrollable={summaryScrollable}
        popups={openPopups}
        onPopupClose={handleClose}
        onPopupPositionCalculated={handlePositionCalculated}
      />
      {openMenu && canEdit &&
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
            hiredswords: warband?.hired_swords ?? [],
            henchmen: otherHenchmenGroups.filter((g) => g.id !== group.id),
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
          presetUnitType="henchmen"
          presetUnitId={group.id}
          disableUnitSelection
          defaultUnitSectionCollapsed
          defaultRaritySectionCollapsed={false}
          defaultPriceSectionCollapsed={false}
          onAcquire={async () => {
            const freshGroup = await getWarbandHenchmenGroupDetail(warbandId, group.id);
            onGroupUpdated?.(freshGroup);
          }}
        />
      )}
    </>
  );
}
