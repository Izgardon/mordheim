import { useState, type MouseEvent, type ReactNode } from "react";
import { ChevronDown, Maximize2 } from "lucide-react";
import { Button } from "@components/button";
import { AnimatePresence, motion } from "framer-motion";

import UnitExpandedCard from "./UnitExpandedCard";
import UnitListBlocks, { type PendingTab } from "./UnitListBlocks";
import ExperienceBar from "../shared/unit_details/ExperienceBar";
import UnitStatsTable from "../shared/unit_details/UnitStatsTable";
import { WARBAND_DARK_TOOLTIP_CONTENT_CLASSNAME } from "../shared/unit_details/warband-tooltip-styles";
import { toUnitStats } from "../shared/utils/unit-stats-mapper";
import { cardPanelStyle } from "./expanded/ExpandedTiles";
import { useUnitXpSaver } from "../../hooks/units/useUnitMutations";

import type { Spell } from "../../../spells/types/spell-types";
import type { Unit, UnitKindKey } from "../../types/units";
import type { UnitKindConfig } from "../../units/unit-kind-types";

export type UnitCardProps<K extends UnitKindKey> = {
  kind: UnitKindConfig<K>;
  unit: Unit<K>;
  warbandId: number;
  onUnitUpdated?: (updated: Unit<K>) => void;
  onPendingEntryClick?: (unitId: number, tab: PendingTab) => void;
  levelUpControl?: ReactNode;
  levelThresholds?: readonly number[];
  layoutVariant?: "default" | "mobile";
  /** `edit`: XP +/-, the trading action and pending skill and spell picks (BUG-31). */
  canEdit?: boolean;
  /** `manage_items`: the item menus (defaults to canEdit). */
  canManageItems?: boolean;
};

type UnitSummaryCardProps<K extends UnitKindKey> = UnitCardProps<K> & {
  isExpanded?: boolean;
  renderExpandedCard?: boolean;
  expandButtonPlacement?: "hover" | "bottom";
  fullWidthItems?: boolean;
  onToggle?: () => void;
  onCollapse?: () => void;
  availableSpells?: Spell[];
  showLoadoutOnMobile?: boolean;
};

/** The roster card: header, stats, XP bar and loadout tabs; expands in place. */
export default function UnitSummaryCard<K extends UnitKindKey>({
  kind,
  unit,
  warbandId,
  isExpanded = false,
  renderExpandedCard = true,
  expandButtonPlacement = "hover",
  fullWidthItems = false,
  onToggle,
  onCollapse,
  levelUpControl,
  onUnitUpdated,
  onPendingEntryClick,
  availableSpells = [],
  levelThresholds,
  layoutVariant = "default",
  showLoadoutOnMobile = false,
  canEdit = false,
  canManageItems = canEdit,
}: UnitSummaryCardProps<K>) {
  const [newSpellOpen, setNewSpellOpen] = useState(false);
  const [newSkillOpen, setNewSkillOpen] = useState(false);
  const { SummaryHeader, PendingAdvanceDialogs } = kind.slots;
  const spellLookup = availableSpells.reduce<Record<number, Spell>>((acc, spell) => {
    acc[spell.id] = spell;
    return acc;
  }, {});
  const handleCollapse = onCollapse ?? onToggle ?? (() => {});
  const saveXp = useUnitXpSaver(kind, warbandId, unit, onUnitUpdated);

  const handleExpandClick = (e: MouseEvent) => {
    e.stopPropagation();
    onToggle?.();
  };

  const loadout = (
    <UnitListBlocks
      kind={kind}
      unit={unit}
      warbandId={warbandId}
      onUnitUpdated={onUnitUpdated}
      onPendingEntryClick={onPendingEntryClick}
      onPendingSpellClick={() => setNewSpellOpen(true)}
      onPendingSkillClick={() => setNewSkillOpen(true)}
      spellLookup={spellLookup}
      fullWidthItems={fullWidthItems}
      canEdit={canEdit}
      canManageItems={canManageItems}
    />
  );

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {isExpanded && renderExpandedCard ? (
        <UnitExpandedCard
          key={`${unit.id}-expanded`}
          kind={kind}
          unit={unit}
          warbandId={warbandId}
          onClose={handleCollapse}
          onUnitUpdated={onUnitUpdated}
          levelUpControl={levelUpControl}
          onPendingEntryClick={onPendingEntryClick}
          levelThresholds={levelThresholds}
          layoutVariant={layoutVariant}
          canEdit={canEdit}
          canManageItems={canManageItems}
        />
      ) : (
        <motion.div
          key={`${unit.id}-summary`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className={`warband-hero-card ${kind.cardClassName} group relative`}
        >
          {levelUpControl}
          <div style={cardPanelStyle}>
            <SummaryHeader
              unit={unit}
              warbandId={warbandId}
              level={kind.getLevelInfo(unit.xp, levelThresholds).level}
              canEdit={canEdit}
              onUnitUpdated={onUnitUpdated}
            />
          </div>
          <div style={cardPanelStyle}>
            <UnitStatsTable
              stats={toUnitStats(unit)}
              variant="summary"
              tooltipContentClassName={WARBAND_DARK_TOOLTIP_CONTENT_CLASSNAME}
            />
          </div>
          {kind.showsXpBar(unit) ? (
            <ExperienceBar
              xp={unit.xp}
              halfRate={unit.half_rate ?? false}
              getLevelInfo={(xp) => kind.getLevelInfo(xp, levelThresholds)}
              onSave={saveXp}
              readOnly={!canEdit}
            />
          ) : null}
          {layoutVariant !== "mobile" || showLoadoutOnMobile ? (
            kind.summaryLoadoutClassName ? (
              <div className={kind.summaryLoadoutClassName}>{loadout}</div>
            ) : (
              loadout
            )
          ) : null}
          {PendingAdvanceDialogs ? (
            <PendingAdvanceDialogs
              unit={unit}
              warbandId={warbandId}
              spellOpen={newSpellOpen}
              onSpellOpenChange={setNewSpellOpen}
              skillOpen={newSkillOpen}
              onSkillOpenChange={setNewSkillOpen}
              onUnitUpdated={onUnitUpdated}
            />
          ) : null}

          {/* Shown on hover, and always there for the keyboard and screen readers (UX-03). */}
          {expandButtonPlacement === "hover" && onToggle ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              opaque
              className="hero-expand-btn absolute right-1 top-1 z-10 h-7 w-7 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
              onClick={handleExpandClick}
              aria-expanded={false}
              aria-label={`Expand ${unit.name || kind.labels.untitled}`}
            >
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}

          {expandButtonPlacement === "bottom" && onToggle ? (
            <Button
              type="button"
              variant="icon"
              size="icon"
              aria-expanded={isExpanded}
              aria-label="Expand details"
              className="absolute bottom-0 left-1/2 z-10 h-8 w-8 -translate-x-1/2 translate-y-1/2 rounded-full"
              onClick={handleExpandClick}
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
