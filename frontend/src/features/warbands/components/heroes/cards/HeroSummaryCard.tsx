import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import HeroCardHeader from "../blocks/HeroCardHeader";
import HeroListBlocks from "../blocks/HeroListBlocks";
import HeroExpandedCard from "./HeroExpandedCard";
import ExperienceBar from "../../shared/unit_details/ExperienceBar";
import UnitStatsTable from "@/features/warbands/components/shared/unit_details/UnitStatsTable";
import { toUnitStats } from "../../shared/utils/unit-stats-mapper";
import { getHeroLevelInfo } from "../utils/hero-level";
import { createHeroXpSaver } from "../../../utils/warband-utils";
import NewSpellDialog from "@/features/spells/components/NewSpellDialog";
import NewSkillDialog from "@/features/skills/components/NewSkillDialog";

import type { Spell } from "../../../../spells/types/spell-types";
import type { WarbandHero } from "../../../types/warband-types";
import basicBar from "@/assets/containers/basic_bar.webp";
import expandIcon from "@/assets/components/expand.webp";

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
};

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
}: HeroSummaryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [newSpellOpen, setNewSpellOpen] = useState(false);
  const [newSkillOpen, setNewSkillOpen] = useState(false);
  const heroStats = toUnitStats(hero);
  const spellLookup = availableSpells.reduce<Record<number, Spell>>((acc, spell) => {
    acc[spell.id] = spell;
    return acc;
  }, {});
  const layoutId = `hero-card-${hero.id}`;
  const cardTransition = {
    layout: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
    opacity: { duration: 0.2 },
  };
  const handleCollapse = onCollapse ?? onToggle ?? (() => {});

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggle) {
      onToggle();
    }
  };

  return (
    <AnimatePresence initial={false}>
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
          layoutId={layoutId}
        />
      ) : (
        <motion.div
          key={`${hero.id}-summary`}
          layout
          layoutId={layoutId}
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={cardTransition}
          className="warband-hero-card relative"
          onMouseEnter={expandButtonPlacement === "hover" ? () => setIsHovered(true) : undefined}
          onMouseLeave={expandButtonPlacement === "hover" ? () => setIsHovered(false) : undefined}
        >
          {levelUpControl}
          <div
            style={{
              backgroundImage: `url(${basicBar})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
            }}
          >
            <HeroCardHeader hero={hero} levelThresholds={levelThresholds} />
          </div>
          <div
            style={{
              backgroundImage: `url(${basicBar})`,
              backgroundSize: "100% 100%",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
            }}
          >
            <UnitStatsTable stats={heroStats} variant="summary" />
          </div>
          <ExperienceBar
            xp={hero.xp}
            halfRate={hero.half_rate ?? false}
            getLevelInfo={(xp) => getHeroLevelInfo(xp, levelThresholds)}
            onSave={createHeroXpSaver(warbandId, hero, onHeroUpdated)}
          />
          <HeroListBlocks
            hero={hero}
            warbandId={warbandId}
            onHeroUpdated={onHeroUpdated}
            onPendingEntryClick={onPendingEntryClick}
            onPendingSpellClick={() => setNewSpellOpen(true)}
            onPendingSkillClick={() => setNewSkillOpen(true)}
            spellLookup={spellLookup}
            fullWidthItems={fullWidthItems}
          />

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

          {/* Expand button */}
          {expandButtonPlacement === "hover" && isHovered ? (
            <button
              type="button"
              className="hero-expand-btn icon-button absolute right-1 top-1 z-10 cursor-pointer border-none bg-transparent p-0 brightness-125 transition-[filter] hover:brightness-150"
              onClick={handleExpandClick}
            >
              <img
                src={expandIcon}
                alt="Expand"
                className="h-7 w-7"
              />
            </button>
          ) : null}

          {expandButtonPlacement === "bottom" && onToggle ? (
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-label={isExpanded ? "Collapse details" : "Expand details"}
              className="icon-button absolute bottom-0 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-black/60 text-muted-foreground transition hover:text-foreground"
              onClick={handleExpandClick}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
            </button>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

