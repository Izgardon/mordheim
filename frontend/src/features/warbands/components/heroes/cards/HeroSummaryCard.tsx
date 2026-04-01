import { useState, type ReactNode } from "react";
import { ChevronDown, Maximize2 } from "lucide-react";
import { Button } from "@components/button";
import { AnimatePresence, motion } from "framer-motion";

import HeroCardHeader from "../blocks/HeroCardHeader";
import HeroListBlocks from "../blocks/HeroListBlocks";
import HeroExpandedCard from "./HeroExpandedCard";
import ExperienceBar from "../../shared/unit_details/ExperienceBar";
import UnitStatsTable from "@/features/warbands/components/shared/unit_details/UnitStatsTable";
import { WARBAND_DARK_TOOLTIP_CONTENT_CLASSNAME } from "@/features/warbands/components/shared/unit_details/warband-tooltip-styles";
import { toUnitStats } from "../../shared/utils/unit-stats-mapper";
import { getHeroLevelInfo } from "../utils/hero-level";
import { createHeroXpSaver } from "../../../utils/warband-utils";
import NewSpellDialog from "@/features/spells/components/NewSpellDialog";
import NewSkillDialog from "@/features/skills/components/NewSkillDialog";

import type { Spell } from "../../../../spells/types/spell-types";
import type { WarbandHero } from "../../../types/warband-types";

type HeroSummaryCardProps = {
  hero: WarbandHero;
  warbandId: number;
  isExpanded?: boolean;
  renderExpandedCard?: boolean;
  expandButtonPlacement?: "hover" | "bottom";
  fullWidthItems?: boolean;
  onToggle?: () => void;
  onCollapse?: () => void;
  levelUpControl?: ReactNode;
  onHeroUpdated?: (updatedHero: WarbandHero) => void;
  onPendingEntryClick?: (heroId: number, tab: "skills" | "spells" | "special") => void;
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

export default function HeroSummaryCard({
  hero,
  warbandId,
  isExpanded = false,
  renderExpandedCard = true,
  expandButtonPlacement = "hover",
  fullWidthItems = false,
  onToggle,
  onCollapse,
  levelUpControl,
  onHeroUpdated,
  onPendingEntryClick,
  availableSpells = [],
  levelThresholds,
  layoutVariant = "default",
  showLoadoutOnMobile = false,
  canEdit = false,
}: HeroSummaryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [newSpellOpen, setNewSpellOpen] = useState(false);
  const [newSkillOpen, setNewSkillOpen] = useState(false);
  const heroStats = toUnitStats(hero);
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
        <HeroExpandedCard
          key={`${hero.id}-expanded`}
          hero={hero}
          warbandId={warbandId}
          onClose={handleCollapse}
          onHeroUpdated={onHeroUpdated}
          levelUpControl={levelUpControl}
          onPendingEntryClick={onPendingEntryClick}
          levelThresholds={levelThresholds}
          layoutVariant={layoutVariant}
          canEdit={canEdit}
        />
      ) : (
        <motion.div
          key={`${hero.id}-summary`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="warband-hero-card warband-card--hero relative"
          onMouseEnter={expandButtonPlacement === "hover" ? () => setIsHovered(true) : undefined}
          onMouseLeave={expandButtonPlacement === "hover" ? () => setIsHovered(false) : undefined}
        >
          {levelUpControl}
          <div style={bgStyle}>
            <HeroCardHeader
              hero={hero}
              warbandId={warbandId}
              levelThresholds={levelThresholds}
              onHeroUpdated={onHeroUpdated}
            />
          </div>
          <div style={bgStyle}>
            <UnitStatsTable
              stats={heroStats}
              variant="summary"
              tooltipContentClassName={WARBAND_DARK_TOOLTIP_CONTENT_CLASSNAME}
            />
          </div>
          <ExperienceBar
            xp={hero.xp}
            halfRate={hero.half_rate ?? false}
            getLevelInfo={(xp) => getHeroLevelInfo(xp, levelThresholds)}
            onSave={createHeroXpSaver(warbandId, hero, onHeroUpdated)}
          />
          {(layoutVariant !== "mobile" || showLoadoutOnMobile) ? (
            <HeroListBlocks
              hero={hero}
              warbandId={warbandId}
              onHeroUpdated={onHeroUpdated}
              onPendingEntryClick={onPendingEntryClick}
              onPendingSpellClick={() => setNewSpellOpen(true)}
              onPendingSkillClick={() => setNewSkillOpen(true)}
              spellLookup={spellLookup}
              fullWidthItems={fullWidthItems}
              canEdit={canEdit}
            />
          ) : null}
          <NewSpellDialog
            hero={hero}
            warbandId={warbandId}
            open={newSpellOpen}
            onOpenChange={setNewSpellOpen}
            onHeroUpdated={onHeroUpdated}
          />
          <NewSkillDialog
            hero={hero}
            warbandId={warbandId}
            open={newSkillOpen}
            onOpenChange={setNewSkillOpen}
            onHeroUpdated={onHeroUpdated}
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
