import { useState, useEffect } from "react";

import UnitListBlocks, { type UnitListPopup } from "../../shared/blocks/UnitListBlocks";
import type { PopupPosition } from "../../shared/unit_details/DetailPopup";
import UnitItemDialogs from "../../shared/UnitItemDialogs";

import type { HenchmenGroup } from "../../../types/warband-types";
import { groupItemsById } from "../../../utils/warband-utils";

import { emitWarbandUpdate } from "../../../api/warbands-events";
import { getWarbandHenchmenGroupDetail } from "../../../api/warbands-api";
import useUnitItemMenu from "../../../hooks/useUnitItemMenu";

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
  const [activeTab, setActiveTab] = useState<string | null>(null);

  const itemMenu = useUnitItemMenu({
    warbandId,
    unit: group,
    unitType: "henchmen",
    canEdit,
    onSourceUpdated: onGroupUpdated,
    onMutationComplete: (result) => {
      emitWarbandUpdate(warbandId, {
        summary: result.summary,
        henchmenGroups: [group, result.source, result.target]
          .filter((entry): entry is HenchmenGroup => Boolean(entry) && !("quantity" in entry)),
        stashItems: result.stash_item ? [result.stash_item] : undefined,
        removedStashItemIds: result.removed_stash_item_id ? [result.removed_stash_item_id] : undefined,
      });
    },
  });

  const rosterCount = (group.henchmen ?? []).length;
  const maxSize = group.max_size ?? 5;

  const itemBlock: BlockEntry[] = groupItemsById(group.items ?? []).map(({ item, count }) => ({
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

  const blocks: NormalizedBlock[] = [
    { id: "roster", title: `Roster ${rosterCount}/${maxSize}`, entries: rosterBlock },
    { id: "items", title: "Items", entries: itemBlock },
    { id: "skills", title: "Skills", entries: skillBlock },
    { id: "special", title: "Specials", entries: specialBlock },
  ].filter((block) => block.entries.length > 0);

  useEffect(() => {
    if (!activeTab || !blocks.some((block) => block.id === activeTab)) {
      setActiveTab(blocks[0]?.id ?? null);
    }
  }, [activeTab, blocks]);

  if (blocks.length === 0) {
    return null;
  }

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

  const renderEntry = (entry: BlockEntry, _block: NormalizedBlock) => {
    if (entry.type === "roster") {
      return (
        <div
          key={entry.id}
          className={`unit-list-entry flex min-h-[26px] items-center justify-between gap-2 rounded px-2 py-1 text-xs ${
            entry.dead
              ? "unit-list-entry--dead line-through"
              : ""
          }`}
        >
          <span className="min-w-0 truncate">{entry.label}</span>
          <span className="unit-list-entry-meta shrink-0">{entry.kills} kills</span>
        </div>
      );
    }

    const isItemMismatch =
      entry.type === "item" && rosterCount > 0 && (entry.count ?? 0) % rosterCount !== 0;

    return (
      <div
        key={entry.id}
        className={`unit-list-entry flex items-start gap-1 rounded px-1.5 py-0.5 transition-colors duration-150 ${
          isItemMismatch
            ? "unit-list-entry--alert"
            : ""
        }`}
      >
        <button
          type="button"
          className="unit-list-entry-button min-w-0 flex-1 cursor-pointer whitespace-normal break-words border-none bg-transparent p-0 text-left font-inherit transition-colors duration-150"
          onClick={(e) => handleEntryClick(entry, e)}
        >
          {entry.label}
        </button>
        {entry.type === "item" && canEdit && (
          <button
            type="button"
            className="unit-list-entry-menu flex h-5 w-4 flex-shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 transition-colors duration-150"
            onClick={(e) => itemMenu.handleMenuToggle(entry, e)}
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
        renderEntry={renderEntry}
        getGridClassName={gridClassName}
        summaryRowCount={summaryRowCount}
        summaryScrollable={summaryScrollable}
        popups={openPopups}
        onPopupClose={handleClose}
        onPopupPositionCalculated={handlePositionCalculated}
      />
      <UnitItemDialogs
        {...itemMenu}
        canEdit={canEdit}
        selfExcludeType="henchmen"
        selfId={group.id}
        presetUnitType="henchmen"
        onAcquire={async () => {
          const freshGroup = await getWarbandHenchmenGroupDetail(warbandId, group.id);
          onGroupUpdated?.(freshGroup);
        }}
      />
    </>
  );
}
