import { useState, type ReactNode } from "react";
import { ChevronDown, TriangleAlert } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Tooltip } from "@/components/ui/tooltip";

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
  canEdit?: boolean;
};

const bgStyle = {
  backgroundImage: `url(${basicBar})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
} as const;

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
  canEdit = false,
}: HenchmenSummaryCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { level } = getHenchmenLevelInfo(group.xp, levelThresholds);
  const stats = toUnitStats(group);
  const totalCount = (group.henchmen ?? []).length;
  const maxSize = group.max_size ?? 5;

  const hasItemMismatch = totalCount > 0 && Object.values(
    (group.items ?? []).reduce<Record<number, number>>((acc, item) => {
      acc[item.id] = (acc[item.id] ?? 0) + 1;
      return acc;
    }, {})
  ).some((count) => count % totalCount !== 0);
  const handleCollapse = onCollapse ?? onToggle ?? (() => {});

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle?.();
  };

  return (
    <AnimatePresence mode="popLayout" initial={false}>
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
          canEdit={canEdit}
        />
      ) : (
        <motion.div
          key={`${group.id}-summary`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="warband-hero-card relative"
          onMouseEnter={expandButtonPlacement === "hover" ? () => setIsHovered(true) : undefined}
          onMouseLeave={expandButtonPlacement === "hover" ? () => setIsHovered(false) : undefined}
        >
          {levelUpControl}
          <div style={bgStyle}>
            <div className="flex items-start justify-between gap-4 py-1 px-4">
              <div className="min-w-0">
                <p className="text-xl font-bold text-foreground">
                  {group.name || "Untitled group"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Level {level} {group.unit_type || "Henchmen"}{" "}
                  <span className="text-xs">({totalCount}/{maxSize})</span>
                </p>
              </div>
              {hasItemMismatch ? (
                <Tooltip
                  trigger={<TriangleAlert className="h-4 w-4 shrink-0 text-amber-400" />}
                  content="Some items don't divide evenly across all henchmen ? adjust item counts to match the group size."
                  maxWidth={240}
                  className="mt-1"
                />
              ) : null}
            </div>
          </div>
          <div style={bgStyle}>
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
            canEdit={canEdit}
          />

          {expandButtonPlacement === "hover" && isHovered ? (
            <button
              type="button"
              className="hero-expand-btn icon-button absolute right-1 top-1 z-10 cursor-pointer border-none bg-transparent p-0 brightness-125 transition-[filter] hover:brightness-150"
              onClick={handleExpandClick}
            >
              <img src={expandIcon} alt="Expand" className="h-7 w-7" />
            </button>
          ) : null}

          {expandButtonPlacement === "bottom" && onToggle ? (
            <button
              type="button"
              aria-expanded={isExpanded}
              aria-label="Expand details"
              className="icon-button absolute bottom-0 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-black/60 text-muted-foreground transition hover:text-foreground"
              onClick={handleExpandClick}
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
