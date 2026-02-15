import { useState, type ReactNode } from "react";

import { getHenchmenLevelInfo } from "../utils/henchmen-level";
import { updateWarbandHenchmenGroup } from "../../../api/warbands-api";
import ExperienceBar from "../../heroes/blocks/ExperienceBar";
import HenchmenListBlocks from "../blocks/HenchmenListBlocks";
import HenchmenExpandedCard from "./HenchmenExpandedCard";
import UnitStatsTable from "@/components/units/UnitStatsTable";
import type { UnitStats } from "@/components/units/UnitStatsTable";
import type { HenchmenGroup } from "../../../types/warband-types";

import basicBar from "@/assets/containers/basic_bar.webp";
import expandIcon from "@/assets/components/expand.webp";

type HenchmenSummaryCardProps = {
  group: HenchmenGroup;
  warbandId: number;
  isExpanded?: boolean;
  onToggle?: () => void;
  onCollapse?: () => void;
  onGroupUpdated?: (updatedGroup: HenchmenGroup) => void;
  levelUpControl?: ReactNode;
};

const groupToUnitStats = (group: HenchmenGroup): UnitStats => ({
  movement: group.movement,
  weapon_skill: group.weapon_skill,
  ballistic_skill: group.ballistic_skill,
  strength: group.strength,
  toughness: group.toughness,
  wounds: group.wounds,
  initiative: group.initiative,
  attacks: group.attacks,
  leadership: group.leadership,
  armour_save: group.armour_save,
});

export default function HenchmenSummaryCard({
  group,
  warbandId,
  isExpanded = false,
  onToggle,
  onCollapse,
  onGroupUpdated,
  levelUpControl,
}: HenchmenSummaryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { level } = getHenchmenLevelInfo(group.xp);
  const stats = groupToUnitStats(group);
  const totalCount = (group.henchmen ?? []).length;
  const maxSize = group.max_size ?? 5;

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggle) {
      onToggle();
    }
  };

  if (isExpanded) {
    return (
      <HenchmenExpandedCard
        group={group}
        warbandId={warbandId}
        onClose={onCollapse ?? (() => {})}
        onGroupUpdated={onGroupUpdated}
        levelUpControl={levelUpControl}
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
        <div className="flex items-start justify-between gap-3 py-1 pl-4">
          <div>
            <p className="text-xl font-bold">{group.name || "Untitled group"}</p>
            <p className="text-sm text-muted-foreground">
              Level {level} {group.unit_type || "Henchmen"}{" "}
              <span className="text-xs">({totalCount}/{maxSize})</span>
            </p>
          </div>
        </div>
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
        xp={group.xp}
        getLevelInfo={getHenchmenLevelInfo}
        onSave={async (newXp) => {
          const updated = await updateWarbandHenchmenGroup(warbandId, group.id, {
            name: group.name, unit_type: group.unit_type, race: group.race_id ?? null, price: group.price, xp: newXp,
          });
          onGroupUpdated?.(updated);
          return Number(updated.xp ?? newXp) || 0;
        }}
      />
      <HenchmenListBlocks group={group} warbandId={warbandId} onGroupUpdated={onGroupUpdated} />

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
