import { useState, useEffect, useMemo } from "react";

import UnitListBlocks, { type UnitListPopup } from "../../shared/blocks/UnitListBlocks";
import type { PopupPosition } from "../../shared/unit_details/DetailPopup";
import UnitItemDialogs from "../../shared/UnitItemDialogs";

import type { WarbandHiredSword } from "../../../types/warband-types";
import { isPendingByName } from "../../heroes/utils/pending-entries";
import { groupItemsById } from "../../../utils/warband-utils";
import { hiredSwordPayload } from "../../../utils/unit-item-actions";
import { buildSpellCountMap, deduplicateSpells, getAdjustedSpellDc, getSpellDisplayName } from "../../../utils/spell-display";

import equipmentIcon from "@/assets/components/equipment.webp";
import skillIcon from "@/assets/components/skill.webp";
import spellIcon from "@/assets/components/spell.webp";
import specialIcon from "@/assets/components/special.webp";
import { getWarbandHiredSwordDetail, updateWarbandHiredSword } from "../../../api/warbands-api";
import { emitWarbandUpdate } from "../../../api/warbands-events";
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

type HiredSwordListBlocksProps = {
  hiredSword: WarbandHiredSword;
  warbandId: number;
  variant?: "summary" | "detailed";
  fullWidthItems?: boolean;
  summaryRowCount?: number;
  summaryScrollable?: boolean;
  onHiredSwordUpdated?: (updated: WarbandHiredSword) => void;
  onPendingEntryClick?: (hiredSwordId: number, tab: "skills" | "spells" | "special") => void;
  onPendingSpellClick?: () => void;
  onPendingSkillClick?: () => void;
  spellLookup?: Record<number, { dc?: string | number | null }>;
  canEdit?: boolean;
};

export default function HiredSwordListBlocks({
  hiredSword,
  warbandId,
  variant = "summary",
  fullWidthItems = false,
  summaryRowCount,
  summaryScrollable,
  onHiredSwordUpdated,
  onPendingEntryClick,
  onPendingSpellClick,
  onPendingSkillClick,
  spellLookup,
  canEdit = false,
}: HiredSwordListBlocksProps) {
  const [openPopups, setOpenPopups] = useState<UnitListPopup[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const spellCounts = useMemo(() => buildSpellCountMap(hiredSword.spells ?? []), [hiredSword.spells]);
  const deduplicatedSpells = useMemo(() => deduplicateSpells(hiredSword.spells ?? []), [hiredSword.spells]);

  const itemMenu = useUnitItemMenu({
    warbandId,
    unit: hiredSword,
    unitType: "hiredswords",
    canEdit,
    updateSource: updateWarbandHiredSword,
    buildSourcePayload: hiredSwordPayload,
    fetchSource: getWarbandHiredSwordDetail,
    onSourceUpdated: onHiredSwordUpdated,
    onMoveComplete: (result) => {
      if (result.targetUnitType === "hiredswords" && result.target) {
        onHiredSwordUpdated?.(result.target as WarbandHiredSword);
      }
      if (result.targetUnitType === "heroes") {
        emitWarbandUpdate(warbandId);
      }
    },
  });

  const itemBlock: BlockEntry[] = groupItemsById(hiredSword.items ?? []).map(({ item, count }) => ({
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

  const spellBlock: BlockEntry[] = deduplicatedSpells.map((spell, index) => ({
    id: `spell-${spell.id}-${index}`,
    visibleId: spell.id,
    label: getSpellDisplayName(spell, spellCounts),
    type: "spell",
    dc: getAdjustedSpellDc(spell.dc ?? spellLookup?.[spell.id]?.dc ?? null, spell, spellCounts),
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

  const tabIcons = useMemo(
    () => ({
      items: equipmentIcon,
      skills: skillIcon,
      spells: spellIcon,
      special: specialIcon,
    }),
    []
  );

  const fallbackIcons = useMemo(
    () => [equipmentIcon, skillIcon, spellIcon, specialIcon],
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
      {entry.type === "item" && canEdit && (
        <button
          type="button"
          className="flex h-5 w-4 flex-shrink-0 cursor-pointer items-center justify-center border-none bg-transparent p-0 text-foreground/50 transition-colors duration-150 hover:text-foreground"
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
        resolveTabIcon={(id, _index) => resolveTabIcon(id)}
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
        selfExcludeType="hiredswords"
        selfId={hiredSword.id}
        presetUnitType="hiredswords"
        onAcquire={async () => {
          const fresh = await getWarbandHiredSwordDetail(warbandId, hiredSword.id);
          onHiredSwordUpdated?.(fresh);
        }}
      />
    </>
  );
}
