import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import HiredSwordCardHeader from "../blocks/HiredSwordCardHeader";
import HiredSwordListBlocks from "../blocks/HiredSwordListBlocks";
import HiredSwordExpandedCard from "./HiredSwordExpandedCard";
import ExperienceBar from "../../shared/unit_details/ExperienceBar";
import UnitStatsTable from "@/features/warbands/components/shared/unit_details/UnitStatsTable";
import { toUnitStats } from "../../shared/utils/unit-stats-mapper";
import { getHenchmenLevelInfo } from "../../henchmen/utils/henchmen-level";
import { createHiredSwordXpSaver } from "../../../utils/warband-utils";
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
};

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

  if (isExpanded && renderExpandedCard) {
    return (
      <HiredSwordExpandedCard
        hiredSword={hiredSword}
        warbandId={warbandId}
        onClose={onCollapse ?? (() => {})}
        onHiredSwordUpdated={onHiredSwordUpdated}
        levelUpControl={levelUpControl}
        onPendingEntryClick={onPendingEntryClick}
        levelThresholds={levelThresholds}
      />
    );
  }

  return (
    <div
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
        <HiredSwordCardHeader hiredSword={hiredSword} levelThresholds={levelThresholds} />
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
        getLevelInfo={(xp) => getHenchmenLevelInfo(xp, levelThresholds)}
        onSave={createHiredSwordXpSaver(warbandId, hiredSword, onHiredSwordUpdated)}
      />
      <HiredSwordListBlocks
        hiredSword={hiredSword}
        warbandId={warbandId}
        onHiredSwordUpdated={onHiredSwordUpdated}
        onPendingEntryClick={onPendingEntryClick}
        onPendingSpellClick={() => setNewSpellOpen(true)}
        onPendingSkillClick={() => setNewSkillOpen(true)}
        spellLookup={spellLookup}
        fullWidthItems={fullWidthItems}
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
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-border/70 bg-black/40 py-2 text-[0.6rem] uppercase tracking-[0.35em] text-muted-foreground transition hover:text-foreground"
          onClick={handleExpandClick}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
          Details
        </button>
      ) : null}
    </div>
  );
}
