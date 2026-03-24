import { useEffect, useMemo, useState } from "react";

import UnitListBlocks, { type UnitListPopup } from "@/features/warbands/components/shared/blocks/UnitListBlocks";
import type { PopupPosition } from "@/features/warbands/components/shared/unit_details/DetailPopup";
import type {
  PrebattleUnit,
  UnitItemEntry,
} from "@/features/battles/components/prebattle/prebattle-types";
import { useMediaQuery } from "@/lib/use-media-query";
import type { BattleUnitInformationEntry } from "@/features/battles/types/battle-types";
import type { UnitOverride } from "@/features/battles/components/prebattle/prebattle-types";

import equipmentIcon from "@/assets/components/equipment.webp";
import skillIcon from "@/assets/components/skill.webp";
import spellIcon from "@/assets/components/spell.webp";
import specialIcon from "@/assets/components/special.webp";

import { buildSpellCountMap, deduplicateSpells, getAdjustedSpellDc, getSpellDisplayName } from "@/features/warbands/utils/spell-display";
import ActiveUnitStatEditor from "./ActiveUnitStatEditor";

type ActiveUnitExpandedDetailsProps = {
  unit: PrebattleUnit;
  canInteract: boolean;
  unitInformation?: BattleUnitInformationEntry;
  canEditStats?: boolean;
  onSaveOverride?: (unitKey: string, override: UnitOverride | undefined) => Promise<void>;
  isSavingOverride?: boolean;
  onUseSingleUseItem?: (item: UnitItemEntry) => Promise<void> | void;
  getUsedSingleUseItemCount?: (itemId: number) => number;
  activeItemActionKey?: string | null;
};

type BlockEntry = {
  id: string;
  visibleId: number;
  label: string;
  type: "item" | "skill" | "spell" | "special";
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
  canInteract,
  unitInformation,
  canEditStats = false,
  onSaveOverride,
  isSavingOverride = false,
  onUseSingleUseItem,
  getUsedSingleUseItemCount,
  activeItemActionKey,
}: ActiveUnitExpandedDetailsProps) {
  const isMobile = useMediaQuery("(max-width: 960px)");
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [openPopups, setOpenPopups] = useState<UnitListPopup[]>([]);

  const fallbackIcons = useMemo(
    () => [equipmentIcon, skillIcon, spellIcon, specialIcon],
    []
  );
  const tabIcons = useMemo(
    () => ({
      items: equipmentIcon,
      skills: skillIcon,
      spells: spellIcon,
      special: specialIcon,
    }),
    []
  );

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
    ].filter((block) => block.entries.length > 0);
  }, [getUsedSingleUseItemCount, itemSource, unit.skills, unit.specials, unit.spells]);

  useEffect(() => {
    if (!activeTab || !blocks.some((block) => block.id === activeTab)) {
      setActiveTab(blocks[0]?.id ?? null);
    }
  }, [activeTab, blocks]);

  const resolveTabIcon = (id: string) => {
    const mapped = tabIcons[id as keyof typeof tabIcons];
    const hash = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const fallback = fallbackIcons[hash % fallbackIcons.length];
    return {
      primary: mapped ?? fallback,
      fallback,
    };
  };

  const handleEntryClick = (entry: BlockEntry, event: React.MouseEvent) => {
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
    const isSingleUse = entry.type === "item" && Boolean(entry.item?.singleUse);
    const remaining = entry.remainingSingleUse ?? 0;
    const actionKey = `${unit.key}:${entry.visibleId}`;
    const isUsingItem = activeItemActionKey === actionKey;

    return (
      <div className="flex items-start gap-1 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 transition-colors duration-150 hover:border-white/40">
        <button
          type="button"
          className="min-w-0 flex-1 cursor-pointer whitespace-normal break-words border-none bg-transparent p-0 text-left font-inherit text-foreground transition-colors duration-150 hover:text-accent"
          onClick={(event) => handleEntryClick(entry, event)}
        >
          {entry.label}
        </button>
        {entry.type === "spell" && entry.dc !== undefined && entry.dc !== null && entry.dc !== "" ? (
          <span className="whitespace-nowrap text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
            DC {entry.dc}
          </span>
        ) : null}
        {isSingleUse ? (
          <div className="flex items-center gap-1">
            <span className="text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground">
              {remaining}/{entry.item?.count ?? 0}
            </span>
            {canInteract && onUseSingleUseItem ? (
              <button
                type="button"
                className="rounded border border-[#6e5a3b]/45 bg-black/35 px-1.5 py-0.5 text-[0.58rem] uppercase tracking-[0.16em] text-foreground disabled:opacity-50"
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
    <div className="px-3 pb-3">
      {onSaveOverride ? (
        <ActiveUnitStatEditor
          unit={unit}
          unitInformation={unitInformation}
          editable={canEditStats}
          onSaveOverride={onSaveOverride}
          isSaving={isSavingOverride}
        />
      ) : null}
      {blocks.length ? (
        <UnitListBlocks
          blocks={blocks}
          variant={isMobile ? "summary" : "detailed"}
          activeTab={activeTab}
          onActiveTabChange={setActiveTab}
          getGridClassName={() => "grid grid-cols-1 gap-y-1 text-sm"}
          resolveTabIcon={(id) => resolveTabIcon(id)}
          renderEntry={(entry) => renderEntry(entry)}
          summaryRowCount={4}
          summaryScrollable
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
