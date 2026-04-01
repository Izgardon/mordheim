import { useState, type ReactNode } from "react";
import { ChevronDown, Maximize2 } from "lucide-react";
import { Button } from "@components/button";
import { AnimatePresence, motion } from "framer-motion";

import HiredSwordCardHeader from "../blocks/HiredSwordCardHeader";
import HiredSwordListBlocks from "../blocks/HiredSwordListBlocks";
import HiredSwordExpandedCard from "./HiredSwordExpandedCard";
import ExperienceBar from "../../shared/unit_details/ExperienceBar";
import UnitStatsTable from "@/features/warbands/components/shared/unit_details/UnitStatsTable";
import { WARBAND_DARK_TOOLTIP_CONTENT_CLASSNAME } from "@/features/warbands/components/shared/unit_details/warband-tooltip-styles";
import { toUnitStats } from "../../shared/utils/unit-stats-mapper";
import { getHenchmenLevelInfo } from "../../henchmen/utils/henchmen-level";
import { createHiredSwordXpSaver } from "../../../utils/warband-utils";
import NewHiredSwordSpellDialog from "@/features/spells/components/NewHiredSwordSpellDialog";
import NewHiredSwordSkillDialog from "@/features/skills/components/NewHiredSwordSkillDialog";

import type { Spell } from "../../../../spells/types/spell-types";
import type { WarbandHiredSword } from "../../../types/warband-types";

type HiredSwordSummaryCardProps = {
  hiredSword: WarbandHiredSword;
  warbandId: number;
  isExpanded?: boolean;
  renderExpandedCard?: boolean;
  expandButtonPlacement?: "hover" | "bottom";
  fullWidthItems?: boolean;
  onToggle?: () => void;
  onCollapse?: () => void;
  levelUpControl?: ReactNode;
  onHiredSwordUpdated?: (updated: WarbandHiredSword) => void;
  onPendingEntryClick?: (hiredSwordId: number, tab: "skills" | "spells" | "special") => void;
  availableSpells?: Spell[];
  levelThresholds?: readonly number[];
  layoutVariant?: "default" | "mobile";
  showLoadoutOnMobile?: boolean;
  canEdit?: boolean;
};

const bgStyle = {
  border: "1px solid rgba(var(--unit-card-border-rgb), 0.5)",
  backgroundColor: "var(--unit-card-panel-bg)",
} as const;

export default function HiredSwordSummaryCard({
  hiredSword,
  warbandId,
  isExpanded = false,
  renderExpandedCard = true,
  expandButtonPlacement = "hover",
  fullWidthItems = false,
  onToggle,
  onCollapse,
  levelUpControl,
  onHiredSwordUpdated,
  onPendingEntryClick,
  availableSpells = [],
  levelThresholds,
  layoutVariant = "default",
  showLoadoutOnMobile = false,
  canEdit = false,
}: HiredSwordSummaryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [newSpellOpen, setNewSpellOpen] = useState(false);
  const [newSkillOpen, setNewSkillOpen] = useState(false);
  const stats = toUnitStats(hiredSword);
  const spellLookup = availableSpells.reduce<Record<number, Spell>>((acc, spell) => {
    acc[spell.id] = spell;
    return acc;
  }, {});
  const handleCollapse = onCollapse ?? onToggle ?? (() => {});

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle?.();
  };

  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {isExpanded && renderExpandedCard ? (
        <HiredSwordExpandedCard
          key={`${hiredSword.id}-expanded`}
          hiredSword={hiredSword}
          warbandId={warbandId}
          onClose={handleCollapse}
          onHiredSwordUpdated={onHiredSwordUpdated}
          levelUpControl={levelUpControl}
          onPendingEntryClick={onPendingEntryClick}
          levelThresholds={levelThresholds}
          layoutVariant={layoutVariant}
          canEdit={canEdit}
        />
      ) : (
        <motion.div
          key={`${hiredSword.id}-summary`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="warband-hero-card warband-card--hired-sword relative"
          onMouseEnter={expandButtonPlacement === "hover" ? () => setIsHovered(true) : undefined}
          onMouseLeave={expandButtonPlacement === "hover" ? () => setIsHovered(false) : undefined}
        >
          {levelUpControl}
          <div style={bgStyle}>
            <HiredSwordCardHeader hiredSword={hiredSword} levelThresholds={levelThresholds} />
          </div>
          <div style={bgStyle}>
            <UnitStatsTable
              stats={stats}
              variant="summary"
              tooltipContentClassName={WARBAND_DARK_TOOLTIP_CONTENT_CLASSNAME}
            />
          </div>
          <ExperienceBar
            xp={hiredSword.xp}
            halfRate={hiredSword.half_rate ?? false}
            getLevelInfo={(xp) => getHenchmenLevelInfo(xp, levelThresholds)}
            onSave={createHiredSwordXpSaver(warbandId, hiredSword, onHiredSwordUpdated)}
          />
          {(layoutVariant !== "mobile" || showLoadoutOnMobile) ? (
            <HiredSwordListBlocks
              hiredSword={hiredSword}
              warbandId={warbandId}
              onHiredSwordUpdated={onHiredSwordUpdated}
              onPendingEntryClick={onPendingEntryClick}
              onPendingSpellClick={() => setNewSpellOpen(true)}
              onPendingSkillClick={() => setNewSkillOpen(true)}
              spellLookup={spellLookup}
              fullWidthItems={fullWidthItems}
              canEdit={canEdit}
            />
          ) : null}
          <NewHiredSwordSpellDialog
            hiredSword={hiredSword}
            warbandId={warbandId}
            open={newSpellOpen}
            onOpenChange={setNewSpellOpen}
            onHiredSwordUpdated={onHiredSwordUpdated}
          />
          <NewHiredSwordSkillDialog
            hiredSword={hiredSword}
            warbandId={warbandId}
            open={newSkillOpen}
            onOpenChange={setNewSkillOpen}
            onHiredSwordUpdated={onHiredSwordUpdated}
          />

          {expandButtonPlacement === "hover" && isHovered ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              opaque
              className="hero-expand-btn absolute right-1 top-1 z-10 h-7 w-7"
              onClick={handleExpandClick}
              aria-label="Expand"
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
