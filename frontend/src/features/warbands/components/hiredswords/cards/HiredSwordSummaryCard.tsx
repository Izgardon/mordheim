import { useState, type ReactNode } from "react";

import HiredSwordCardHeader from "../blocks/HiredSwordCardHeader";
import HiredSwordListBlocks from "../blocks/HiredSwordListBlocks";
import HiredSwordExpandedCard from "./HiredSwordExpandedCard";
import ExperienceBar from "../../shared/unit_details/ExperienceBar";
import UnitStatsTable from "@/features/warbands/components/shared/unit_details/UnitStatsTable";
import { toUnitStats } from "../../shared/utils/unit-stats-mapper";
import { getHenchmenLevelInfo } from "../../henchmen/utils/henchmen-level";
import { updateWarbandHiredSword } from "../../../api/warbands-api";
import NewHiredSwordSpellDialog from "@/features/spells/components/NewHiredSwordSpellDialog";
import NewHiredSwordSkillDialog from "@/features/skills/components/NewHiredSwordSkillDialog";

import type { Spell } from "../../../../spells/types/spell-types";
import type { WarbandHiredSword } from "../../../types/warband-types";
import basicBar from "@/assets/containers/basic_bar.webp";
import expandIcon from "@/assets/components/expand.webp";

type HiredSwordSummaryCardProps = {
  hiredSword: WarbandHiredSword;
  warbandId: number;
  isExpanded?: boolean;
  onToggle?: () => void;
  onCollapse?: () => void;
  levelUpControl?: ReactNode;
  onHiredSwordUpdated?: (updated: WarbandHiredSword) => void;
  onPendingEntryClick?: (hiredSwordId: number, tab: "skills" | "spells" | "special") => void;
  availableSpells?: Spell[];
};

export default function HiredSwordSummaryCard({
  hiredSword,
  warbandId,
  isExpanded = false,
  onToggle,
  onCollapse,
  levelUpControl,
  onHiredSwordUpdated,
  onPendingEntryClick,
  availableSpells = [],
}: HiredSwordSummaryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [newSpellOpen, setNewSpellOpen] = useState(false);
  const [newSkillOpen, setNewSkillOpen] = useState(false);
  const stats = toUnitStats(hiredSword);
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
      <HiredSwordExpandedCard
        hiredSword={hiredSword}
        warbandId={warbandId}
        onClose={onCollapse ?? (() => {})}
        onHiredSwordUpdated={onHiredSwordUpdated}
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
        <HiredSwordCardHeader hiredSword={hiredSword} />
      </div>
      <div
        style={{
          backgroundImage: `url(${basicBar})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
        }}
      >
        <UnitStatsTable stats={stats} variant="summary" />
      </div>
      <ExperienceBar
        xp={hiredSword.xp}
        halfRate={hiredSword.half_rate ?? false}
        getLevelInfo={getHenchmenLevelInfo}
        onSave={async (newXp) => {
          const updated = await updateWarbandHiredSword(warbandId, hiredSword.id, {
            name: hiredSword.name,
            unit_type: hiredSword.unit_type,
            race: hiredSword.race_id ?? null,
            price: hiredSword.price,
            upkeep_price: hiredSword.upkeep_price ?? 0,
            xp: newXp,
          });
          onHiredSwordUpdated?.(updated);
          return Number(updated.xp ?? newXp) || 0;
        }}
      />
      <HiredSwordListBlocks
        hiredSword={hiredSword}
        warbandId={warbandId}
        onHiredSwordUpdated={onHiredSwordUpdated}
        onPendingEntryClick={onPendingEntryClick}
        onPendingSpellClick={() => setNewSpellOpen(true)}
        onPendingSkillClick={() => setNewSkillOpen(true)}
        spellLookup={spellLookup}
      />

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
