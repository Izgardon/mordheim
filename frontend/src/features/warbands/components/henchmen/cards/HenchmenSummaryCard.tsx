import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { getHenchmenLevelInfo } from "../utils/henchmen-level";
import { createHenchmenGroupXpSaver } from "../../../utils/warband-utils";
import ExperienceBar from "../../shared/unit_details/ExperienceBar";
import HenchmenListBlocks from "../blocks/HenchmenListBlocks";
import HenchmenExpandedCard from "./HenchmenExpandedCard";
import UnitStatsTable from "@/features/warbands/components/shared/unit_details/UnitStatsTable";
import { toUnitStats } from "../../shared/utils/unit-stats-mapper";
import type { HenchmenGroup } from "../../../types/warband-types";

import basicBar from "@/assets/containers/basic_bar.webp";
import expandIcon from "@/assets/components/expand.webp";

type HenchmenSummaryCardProps = {
  group: HenchmenGroup;
  warbandId: number;
  isExpanded?: boolean;
  renderExpandedCard?: boolean;
  expandButtonPlacement?: "hover" | "bottom";
  fullWidthItems?: boolean;
  onToggle?: () => void;
  onCollapse?: () => void;
  onGroupUpdated?: (updatedGroup: HenchmenGroup) => void;
  levelUpControl?: ReactNode;
  levelThresholds?: readonly number[];
  layoutVariant?: "default" | "mobile";
};

export default function HenchmenSummaryCard({
  group,
  warbandId,
  isExpanded = false,
  renderExpandedCard = true,
  expandButtonPlacement = "hover",
  fullWidthItems = false,
  onToggle,
  onCollapse,
  onGroupUpdated,
  levelUpControl,
  levelThresholds,
  layoutVariant = "default",
}: HenchmenSummaryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { level } = getHenchmenLevelInfo(group.xp, levelThresholds);
  const stats = toUnitStats(group);
  const totalCount = (group.henchmen ?? []).length;
  const maxSize = group.max_size ?? 5;
  const layoutId = `henchmen-card-${group.id}`;
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
        <HenchmenExpandedCard
          key={`${group.id}-expanded`}
          group={group}
          warbandId={warbandId}
          onClose={handleCollapse}
          onGroupUpdated={onGroupUpdated}
          levelUpControl={levelUpControl}
          levelThresholds={levelThresholds}
          layoutVariant={layoutVariant}
          layoutId={layoutId}
        />
      ) : (
        <motion.div
          key={`${group.id}-summary`}
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
            getLevelInfo={(xp) => getHenchmenLevelInfo(xp, levelThresholds)}
            onSave={createHenchmenGroupXpSaver(warbandId, group, onGroupUpdated)}
          />
          <HenchmenListBlocks
            group={group}
            warbandId={warbandId}
            onGroupUpdated={onGroupUpdated}
            fullWidthItems={fullWidthItems}
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
