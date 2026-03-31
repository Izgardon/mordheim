import { useState, useEffect, useMemo } from "react";

import UnitListBlocks, { type UnitListPopup } from "../../shared/blocks/UnitListBlocks";
import type { PopupPosition } from "../../shared/unit_details/DetailPopup";
import UnitItemDialogs from "../../shared/UnitItemDialogs";

import type { WarbandHero } from "../../../types/warband-types";
import { isPendingByName } from "../utils/pending-entries";
import { groupItemsById } from "../../../utils/warband-utils";
import { buildSpellCountMap, deduplicateSpells, getAdjustedSpellDc, getSpellDisplayName } from "../../../utils/spell-display";
import { heroPayload } from "../../../utils/unit-item-actions";

import { getWarbandHeroDetail, updateWarbandHero } from "../../../api/warbands-api";
import useUnitItemMenu from "../../../hooks/useUnitItemMenu";

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

type HeroListBlocksProps = {
  hero: WarbandHero;
  warbandId: number;
  variant?: "summary" | "detailed";
  fullWidthItems?: boolean;
  summaryRowCount?: number;
  summaryScrollable?: boolean;
  onHeroUpdated?: (updatedHero: WarbandHero) => void;
  onPendingEntryClick?: (heroId: number, tab: "skills" | "spells" | "special") => void;
  onPendingSpellClick?: () => void;
  onPendingSkillClick?: () => void;
  spellLookup?: Record<number, { dc?: string | number | null }>;
  canEdit?: boolean;
};

export default function HeroListBlocks({
  hero,
  warbandId,
  variant = "summary",
  fullWidthItems = false,
  summaryRowCount,
  summaryScrollable,
  onHeroUpdated,
  onPendingEntryClick,
  onPendingSpellClick,
  onPendingSkillClick,
  spellLookup,
  canEdit = false,
}: HeroListBlocksProps) {
  const [openPopups, setOpenPopups] = useState<UnitListPopup[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const spellCounts = useMemo(() => buildSpellCountMap(hero.spells ?? []), [hero.spells]);
  const deduplicatedSpells = useMemo(() => deduplicateSpells(hero.spells ?? []), [hero.spells]);

  const itemMenu = useUnitItemMenu({
    warbandId,
    unit: hero,
    unitType: "heroes",
    canEdit,
    updateSource: updateWarbandHero,
    buildSourcePayload: heroPayload,
    fetchSource: getWarbandHeroDetail,
    onSourceUpdated: onHeroUpdated,
    onMoveComplete: (result) => {
      if (result.targetUnitType === "heroes" && result.target) {
        onHeroUpdated?.(result.target as WarbandHero);
      }
    },
  });

  const itemBlock: BlockEntry[] = groupItemsById(hero.items ?? []).map(({ item, count }) => ({
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

  const spellBlock: BlockEntry[] = deduplicatedSpells.map((spell, index) => ({
    id: `spell-${spell.id}-${index}`,
    visibleId: spell.id,
    label: getSpellDisplayName(spell, spellCounts),
    type: "spell",
    dc: getAdjustedSpellDc(spell.dc ?? spellLookup?.[spell.id]?.dc ?? null, spell, spellCounts),
    pending: isPendingByName("spell", spell.name),
  }));

  const specialBlock: BlockEntry[] = (hero.specials ?? []).map((entry, index) => ({
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

  useEffect(() => {
    if (!activeTab || !blocks.some((block) => block.id === activeTab)) {
      setActiveTab(blocks[0]?.id ?? null);
    }
  }, [activeTab, blocks]);

  if (blocks.length === 0) {
    return null;
  }

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
      onPendingEntryClick(hero.id, entry.type === "skill" ? "skills" : entry.type === "spell" ? "spells" : "special");
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
            dc: entry.type === "spell" ? entry.dc : undefined,
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

  const renderEntry = (entry: BlockEntry, _block: NormalizedBlock) => (
    <div
      className={
        entry.pending
          ? "unit-list-entry unit-list-entry--pending flex items-start gap-1 rounded px-1.5 py-0.5 transition-colors duration-150"
          : "unit-list-entry flex items-start gap-1 rounded px-1.5 py-0.5 transition-colors duration-150"
      }
    >
      <button
        type="button"
        className={
          entry.pending
            ? "unit-list-entry-button unit-list-entry-button--pending min-w-0 flex-1 cursor-pointer whitespace-normal break-words border-none bg-transparent p-0 text-left font-inherit transition-colors duration-150"
            : "unit-list-entry-button min-w-0 flex-1 cursor-pointer whitespace-normal break-words border-none bg-transparent p-0 text-left font-inherit transition-colors duration-150"
        }
        onClick={(e) => handleEntryClick(entry, e)}
      >
        {entry.label}
      </button>
      {entry.type === "spell" && entry.dc !== undefined && entry.dc !== null && entry.dc !== "" ? (
        <span className="unit-list-entry-meta whitespace-nowrap text-[0.6rem] uppercase tracking-[0.3em]">
          DC {entry.dc}
        </span>
      ) : null}
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

  const gridClassName = (block: NormalizedBlock, view: "summary" | "detailed") => {
    if (view === "detailed") {
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
        summaryRowCount={summaryRowCount}
        summaryScrollable={summaryScrollable}
        getGridClassName={fullWidthItems ? gridClassName : undefined}
        popups={openPopups}
        onPopupClose={handleClose}
        onPopupPositionCalculated={handlePositionCalculated}
      />
      <UnitItemDialogs
        {...itemMenu}
        canEdit={canEdit}
        selfExcludeType="heroes"
        selfId={hero.id}
        presetUnitType="heroes"
        onAcquire={async () => {
          const freshHero = await getWarbandHeroDetail(warbandId, hero.id);
          onHeroUpdated?.(freshHero);
        }}
      />
    </>
  );
}
