import { useEffect, useMemo, useState } from "react";

import UnitListBlocks, {
  type UnitListPopup,
} from "@/features/warbands/components/shared/blocks/UnitListBlocks";
import type { PopupPosition } from "@/features/warbands/components/shared/unit_details/DetailPopup";
import type {
  PrebattleUnit,
  UnitItemEntry,
} from "@/features/battles/components/prebattle/prebattle-types";
import type { BattleUnitInformationEntry } from "@/features/battles/types/battle-types";
import { useUnitNotesAutosave } from "@/features/battles/hooks/useUnitNotesAutosave";
import { battleCompanionSources, onFoot } from "@/features/battles/utils/battle-companions";
import type { CompanionSource } from "@/features/warbands/utils/companions";
import "@/features/warbands/styles/warband.css";
import { useMediaQuery } from "@/lib/use-media-query";

import {
  CompanionEntryFrom,
  CompanionEntryMark,
} from "@/features/warbands/components/units/beasts/CompanionEntryMark";

import { ActiveNotesBox, ActiveSingleUseControls } from "./ActiveEntryParts";
import { activeItemSource, buildActiveBlocks, type ActiveBlockEntry } from "./active-blocks";

type ActiveUnitExpandedDetailsProps = {
  unit: PrebattleUnit;
  unitInformation?: BattleUnitInformationEntry;
  canInteract: boolean;
  onSaveNotes?: (notes: string) => Promise<void> | void;
  onUseSingleUseItem?: (item: UnitItemEntry) => Promise<void> | void;
  getUsedSingleUseItemCount?: (itemId: number) => number;
  /** Undoes the latest use of the item (BUG-11); shown once one is used. */
  onUndoSingleUseItem?: (itemId: number) => Promise<void> | void;
  activeItemActionKey?: string | null;
  /** Whose entries the tabs list: a group's riding members'; the unit's own by default. */
  companions?: CompanionSource[];
};

const ENTRY_BUTTON_CLASS =
  "unit-list-entry-button min-w-0 flex-1 cursor-pointer whitespace-normal break-words border-none bg-transparent p-0 text-left font-inherit transition-colors duration-150";

export default function ActiveUnitExpandedDetails({
  unit,
  unitInformation,
  canInteract,
  onSaveNotes,
  onUseSingleUseItem,
  getUsedSingleUseItemCount,
  onUndoSingleUseItem,
  activeItemActionKey,
  companions,
}: ActiveUnitExpandedDetailsProps) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [openPopups, setOpenPopups] = useState<UnitListPopup[]>([]);
  const notes = useUnitNotesAutosave({
    sourceNotes: unitInformation?.notes ?? "",
    unitKey: unit.key,
    canSave: canInteract,
    onSaveNotes,
  });

  const itemSource: UnitItemEntry[] = useMemo(() => activeItemSource(unit), [unit]);

  // A dismounted rider's mount brings nothing more (step 5).
  const dismounted = Boolean(unitInformation?.dismounted);
  const blocks = useMemo(
    () =>
      buildActiveBlocks(
        unit,
        itemSource,
        getUsedSingleUseItemCount,
        companions ?? battleCompanionSources(onFoot(unit, { dismounted }))
      ),
    [companions, dismounted, getUsedSingleUseItemCount, itemSource, unit]
  );

  useEffect(() => {
    if (!activeTab || !blocks.some((block) => block.id === activeTab)) {
      setActiveTab(blocks[0]?.id ?? null);
    }
  }, [activeTab, blocks]);

  const handleEntryClick = (entry: ActiveBlockEntry, event: React.MouseEvent) => {
    if (entry.type === "notes") {
      return;
    }
    const entryType = entry.type;
    const entryKey = entry.id;
    const existingIndex = openPopups.findIndex((popup) => popup.key === entryKey);
    if (existingIndex !== -1) {
      setOpenPopups((prev) => prev.filter((popup) => popup.key !== entryKey));
      return;
    }

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setOpenPopups((prev) => [
      ...prev,
      {
        entry: {
          id: entry.visibleId,
          type: entryType,
          name: entry.label,
          dc: entryType === "spell" ? entry.dc : undefined,
        },
        anchorRect: rect,
        key: entryKey,
      },
    ]);
  };

  const handlePopupClose = (key: string) => {
    setOpenPopups((prev) => prev.filter((popup) => popup.key !== key));
  };

  const handlePopupPositionCalculated = (key: string, position: PopupPosition) => {
    setOpenPopups((prev) =>
      prev.map((popup) => (popup.key === key ? { ...popup, position } : popup))
    );
  };

  const renderEntry = (entry: ActiveBlockEntry) => {
    if (entry.type === "notes") {
      return (
        <ActiveNotesBox
          name={unit.displayName}
          value={notes.draftNotes}
          readOnly={!canInteract || !onSaveNotes}
          onChange={(value) => {
            notes.setDraftNotes(value);
            if (notes.saveState === "error") {
              notes.setSaveState("idle");
            }
          }}
        />
      );
    }

    const isSingleUse = entry.type === "item" && Boolean(entry.item?.singleUse);
    const actionKey = `${unit.key}:${entry.visibleId}`;

    return (
      <div className="unit-list-entry flex items-start gap-1 rounded px-1.5 py-0.5 transition-colors duration-150">
        <button
          type="button"
          className={ENTRY_BUTTON_CLASS}
          onClick={(event) => handleEntryClick(entry, event)}
        >
          {entry.label}
          {entry.companion ? <CompanionEntryFrom {...entry.companion} /> : null}
        </button>
        {entry.type === "spell" &&
        entry.dc !== undefined &&
        entry.dc !== null &&
        entry.dc !== "" ? (
          <span className="unit-list-entry-meta whitespace-nowrap text-[0.6rem] uppercase tracking-[0.3em]">
            DC {entry.dc}
          </span>
        ) : null}
        {entry.companion ? <CompanionEntryMark {...entry.companion} /> : null}
        {isSingleUse && entry.item ? (
          <ActiveSingleUseControls
            item={entry.item}
            remaining={entry.remainingSingleUse ?? 0}
            canInteract={canInteract}
            isUsingItem={activeItemActionKey === actionKey}
            onUse={onUseSingleUseItem}
            onUndo={onUndoSingleUseItem}
          />
        ) : null}
      </div>
    );
  };

  return (
    <div className="px-3 pb-3 pt-3">
      {blocks.length ? (
        <UnitListBlocks
          blocks={blocks}
          variant={isMobile ? "summary" : "detailed"}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          getGridClassName={(block, view) => {
            if (view === "detailed") {
              return "grid grid-cols-1 gap-y-1 text-sm";
            }
            if (block.id === "items" || block.id === "notes") {
              return "grid grid-cols-1 gap-y-1 text-sm";
            }
            return "grid grid-cols-2 gap-x-3 gap-y-1 text-sm";
          }}
          renderEntry={(entry) => renderEntry(entry)}
          summaryRowCount={4}
          summaryScrollable={false}
          popups={openPopups}
          onPopupClose={handlePopupClose}
          onPopupPositionCalculated={handlePopupPositionCalculated}
        />
      ) : (
        <p className="text-xs text-muted-foreground">No items, skills, spells, or specials.</p>
      )}
    </div>
  );
}
