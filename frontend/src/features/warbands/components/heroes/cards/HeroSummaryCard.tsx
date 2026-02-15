import { useState, type ReactNode } from "react";

import HeroCardHeader from "../blocks/HeroCardHeader";
import HeroListBlocks from "../blocks/HeroListBlocks";
import HeroExpandedCard from "./HeroExpandedCard";
import ExperienceBar from "../../shared/unit_details/ExperienceBar";
import UnitStatsTable from "@/features/warbands/components/shared/unit_details/UnitStatsTable";
import { toUnitStats } from "../../shared/utils/unit-stats-mapper";
import { getHeroLevelInfo } from "../utils/hero-level";
import { updateWarbandHero } from "../../../api/warbands-api";
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
  onToggle?: () => void;
  onCollapse?: () => void;
  levelUpControl?: ReactNode;
  onHeroUpdated?: (updatedHero: WarbandHero) => void;
  onPendingEntryClick?: (heroId: number, tab: "skills" | "spells" | "special") => void;
  availableSpells?: Spell[];
};

export default function HeroSummaryCard({
  hero,
  warbandId,
  isExpanded = false,
  onToggle,
  onCollapse,
  levelUpControl,
  onHeroUpdated,
  onPendingEntryClick,
  availableSpells = [],
}: HeroSummaryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [newSpellOpen, setNewSpellOpen] = useState(false);
  const [newSkillOpen, setNewSkillOpen] = useState(false);
  const heroStats = toUnitStats(hero);
  const spellLookup = availableSpells.reduce<Record<number, Spell>>((acc, spell) => {
    acc[spell.id] = spell;
    return acc;
  }, {});

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggle) {
      onToggle();
    }
  };

  if (isExpanded) {
    return (
      <HeroExpandedCard
        hero={hero}
        warbandId={warbandId}
        onClose={onCollapse ?? (() => {})}
        onHeroUpdated={onHeroUpdated}
        levelUpControl={levelUpControl}
        onPendingEntryClick={onPendingEntryClick}
      />
    );
  }

  return (
    <div
      className="warband-hero-card relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
        <HeroCardHeader hero={hero} />
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
        getLevelInfo={getHeroLevelInfo}
        onSave={async (newXp) => {
          const updated = await updateWarbandHero(warbandId, hero.id, {
            name: hero.name, unit_type: hero.unit_type, race: hero.race_id ?? null, price: hero.price, xp: newXp,
          });
          onHeroUpdated?.(updated);
          return Number(updated.xp ?? newXp) || 0;
        }}
      />
      <HeroListBlocks
        hero={hero}
        warbandId={warbandId}
        onHeroUpdated={onHeroUpdated}
        onPendingEntryClick={onPendingEntryClick}
        onPendingSpellClick={() => setNewSpellOpen(true)}
        onPendingSkillClick={() => setNewSkillOpen(true)}
        spellLookup={spellLookup}
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
      {isHovered && (
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
      )}

    </div>
  );
}

