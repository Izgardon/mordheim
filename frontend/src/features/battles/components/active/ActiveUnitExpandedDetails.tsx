import { useEffect, useMemo, useRef, useState } from "react";

import UnitListBlocks, { type UnitListPopup } from "@/features/warbands/components/shared/blocks/UnitListBlocks";
import type { PopupPosition } from "@/features/warbands/components/shared/unit_details/DetailPopup";
import type {
  PrebattleUnit,
  UnitItemEntry,
} from "@/features/battles/components/prebattle/prebattle-types";
import type { BattleUnitInformationEntry } from "@/features/battles/types/battle-types";
import "@/features/warbands/styles/warband.css";
import { useMediaQuery } from "@/lib/use-media-query";
import { buildSpellCountMap, deduplicateSpells, getAdjustedSpellDc, getSpellDisplayName } from "@/features/warbands/utils/spell-display";

type ActiveUnitExpandedDetailsProps = {
  unit: PrebattleUnit;
  unitInformation?: BattleUnitInformationEntry;
  canInteract: boolean;
  onSaveNotes?: (notes: string) => Promise<void> | void;
  onUseSingleUseItem?: (item: UnitItemEntry) => Promise<void> | void;
  getUsedSingleUseItemCount?: (itemId: number) => number;
  activeItemActionKey?: string | null;
};

type BlockEntry = {
  id: string;
  visibleId: number;
  label: string;
  type: "item" | "skill" | "spell" | "special" | "notes";
  dc?: string | number | null;
  item?: UnitItemEntry;
  remainingSingleUse?: number;
};

type NormalizedBlock = {
  id: string;
  title: string;
  entries: BlockEntry[];
};

export default function ActiveUnitExpandedDetails({
  unit,
  unitInformation,
  canInteract,
  onSaveNotes,
  onUseSingleUseItem,
  getUsedSingleUseItemCount,
  activeItemActionKey,
}: ActiveUnitExpandedDetailsProps) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [openPopups, setOpenPopups] = useState<UnitListPopup[]>([]);
  const sourceNotes = unitInformation?.notes ?? "";
  const [draftNotes, setDraftNotes] = useState(sourceNotes);
  const [lastSavedNotes, setLastSavedNotes] = useState(sourceNotes);
  const [saveState, setSaveState] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const saveSequenceRef = useRef(0);

  const itemSource: UnitItemEntry[] = useMemo(() => {
    if (unit.items?.length) {
      return unit.items;
    }
    return (unit.singleUseItems ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      count: item.quantity,
      singleUse: true,
    }));
  }, [unit.items, unit.singleUseItems]);

  const blocks: NormalizedBlock[] = useMemo(() => {
    const itemBlock: BlockEntry[] = itemSource.map((item) => {
      const used = getUsedSingleUseItemCount?.(item.id) ?? 0;
      const remainingSingleUse = item.singleUse ? Math.max(0, item.count - used) : 0;
      return {
        id: `item-${item.id}`,
        visibleId: item.id,
        label: item.count > 1 ? `${item.name} x ${item.count}` : item.name,
        type: "item",
        item,
        remainingSingleUse,
      };
    });

    const skillBlock: BlockEntry[] = (unit.skills ?? []).map((skill, index) => ({
      id: `skill-${skill.id}-${index}`,
      visibleId: skill.id,
      label: skill.name,
      type: "skill",
    }));

    const spells = unit.spells ?? [];
    const spellCounts = buildSpellCountMap(spells);
    const spellBlock: BlockEntry[] = deduplicateSpells(spells).map((spell, index) => ({
      id: `spell-${spell.id}-${index}`,
      visibleId: spell.id,
      label: getSpellDisplayName(spell, spellCounts),
      type: "spell",
      dc: getAdjustedSpellDc(spell.dc ?? null, spell, spellCounts),
    }));

    const specialBlock: BlockEntry[] = (unit.specials ?? []).map((special, index) => ({
      id: `special-${special.id}-${index}`,
      visibleId: special.id,
      label: special.name,
      type: "special",
    }));

    return [
      { id: "items", title: "Items", entries: itemBlock },
      { id: "skills", title: "Skills", entries: skillBlock },
      { id: "spells", title: "Spells", entries: spellBlock },
      { id: "special", title: "Specials", entries: specialBlock },
      {
        id: "notes",
        title: "Notes",
        entries: [
          {
            id: `notes-${unit.key}`,
            visibleId: 0,
            label: "",
            type: "notes",
          },
        ],
      },
    ].filter((block) => block.entries.length > 0);
  }, [getUsedSingleUseItemCount, itemSource, unit.key, unit.skills, unit.specials, unit.spells]);

  useEffect(() => {
    if (!activeTab || !blocks.some((block) => block.id === activeTab)) {
      setActiveTab(blocks[0]?.id ?? null);
    }
  }, [activeTab, blocks]);

  useEffect(() => {
    setDraftNotes(sourceNotes);
    setLastSavedNotes(sourceNotes);
    setSaveState("idle");
  }, [sourceNotes, unit.key]);

  useEffect(() => {
    if (!canInteract || !onSaveNotes) {
      return;
    }

    if (draftNotes === lastSavedNotes) {
      return;
    }

    setSaveState("pending");
    const nextSequence = saveSequenceRef.current + 1;
    saveSequenceRef.current = nextSequence;

    const timeoutHandle = window.setTimeout(() => {
      setSaveState("saving");
      Promise.resolve(onSaveNotes(draftNotes))
        .then(() => {
          if (saveSequenceRef.current !== nextSequence) {
            return;
          }
          setLastSavedNotes(draftNotes);
          setSaveState("saved");
          window.setTimeout(() => {
            if (saveSequenceRef.current === nextSequence) {
              setSaveState("idle");
            }
          }, 1200);
        })
        .catch(() => {
          if (saveSequenceRef.current !== nextSequence) {
            return;
          }
          setSaveState("error");
        });
    }, 1000);

    return () => {
      window.clearTimeout(timeoutHandle);
    };
  }, [canInteract, draftNotes, lastSavedNotes, onSaveNotes]);

  const handleEntryClick = (entry: BlockEntry, event: React.MouseEvent) => {
    if (entry.type === "notes") {
      return;
    }
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
          type: entry.type,
          name: entry.label,
          dc: entry.type === "spell" ? entry.dc : undefined,
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

  const renderEntry = (entry: BlockEntry) => {
    if (entry.type === "notes") {
      return (
        <div>
          <textarea
            value={draftNotes}
            onChange={(event) => {
              setDraftNotes(event.currentTarget.value.slice(0, 500));
              if (saveState === "error") {
                setSaveState("idle");
              }
            }}
            readOnly={!canInteract || !onSaveNotes}
            maxLength={500}
            placeholder="Add unit notes..."
            aria-label={`Notes for ${unit.displayName}`}
            className="min-h-[8.5rem] max-h-[14rem] w-full resize-none overflow-y-auto rounded-md border border-border/60 bg-black/25 px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-[#8b6a31] focus:ring-1 focus:ring-[#8b6a31]/50 read-only:cursor-default read-only:opacity-80"
          />
        </div>
      );
    }

    const isSingleUse = entry.type === "item" && Boolean(entry.item?.singleUse);
    const remaining = entry.remainingSingleUse ?? 0;
    const actionKey = `${unit.key}:${entry.visibleId}`;
    const isUsingItem = activeItemActionKey === actionKey;

    return (
      <div className="unit-list-entry flex items-start gap-1 rounded px-1.5 py-0.5 transition-colors duration-150">
        <button
          type="button"
          className="unit-list-entry-button min-w-0 flex-1 cursor-pointer whitespace-normal break-words border-none bg-transparent p-0 text-left font-inherit transition-colors duration-150"
          onClick={(event) => handleEntryClick(entry, event)}
        >
          {entry.label}
        </button>
        {entry.type === "spell" && entry.dc !== undefined && entry.dc !== null && entry.dc !== "" ? (
          <span className="unit-list-entry-meta whitespace-nowrap text-[0.6rem] uppercase tracking-[0.3em]">
            DC {entry.dc}
          </span>
        ) : null}
        {isSingleUse ? (
          <div className="flex items-center gap-1">
            <span className="unit-list-entry-meta text-[0.58rem] uppercase tracking-[0.18em]">
              {remaining}/{entry.item?.count ?? 0}
            </span>
            {canInteract && onUseSingleUseItem ? (
              <button
                type="button"
                className="battle-toolbar-button px-1.5 py-0.5 text-[0.58rem] uppercase tracking-[0.16em] text-foreground disabled:opacity-50"
                onClick={() => {
                  if (!entry.item || remaining <= 0 || isUsingItem) {
                    return;
                  }
                  void onUseSingleUseItem(entry.item);
                }}
                disabled={remaining <= 0 || isUsingItem}
              >
                {isUsingItem ? "..." : "Use"}
              </button>
            ) : null}
          </div>
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
