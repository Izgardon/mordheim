import { useState, type ReactNode } from "react";

import HeroCardHeader from "../blocks/HeroCardHeader";
import HeroListBlocks from "../blocks/HeroListBlocks";
import HeroExpandedCard from "./HeroExpandedCard";
import UnitStatsTable from "@/components/units/UnitStatsTable";
import { heroToUnitStats } from "../hero-unit-stats";

import type { WarbandHero } from "../../../../types/warband-types";
import basicBar from "@/assets/containers/basic_bar.png";
import expandIcon from "@/assets/components/expand.png";

type HeroSummaryCardProps = {
  hero: WarbandHero;
  warbandId: number;
  isExpanded?: boolean;
  onToggle?: () => void;
  onCollapse?: () => void;
  levelUpControl?: ReactNode;
};

export default function HeroSummaryCard({
  hero,
  warbandId,
  isExpanded = false,
  onToggle,
  onCollapse,
  levelUpControl,
}: HeroSummaryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const heroStats = heroToUnitStats(hero);

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
      <HeroListBlocks hero={hero} />

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

