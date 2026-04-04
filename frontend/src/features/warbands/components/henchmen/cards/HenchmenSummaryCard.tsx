import { useState, type ReactNode } from "react";
import { ChevronDown, Maximize2, TriangleAlert } from "lucide-react";
import { Button } from "@components/button";
import { AnimatePresence, motion } from "framer-motion";
import { Tooltip } from "@/components/ui/tooltip";

import { getHenchmenLevelInfo } from "../utils/henchmen-level";
import { createHenchmenGroupXpSaver } from "../../../utils/warband-utils";
import ExperienceBar from "../../shared/unit_details/ExperienceBar";
import HenchmenListBlocks from "../blocks/HenchmenListBlocks";
import HenchmenExpandedCard from "./HenchmenExpandedCard";
import UnitStatsTable from "@/features/warbands/components/shared/unit_details/UnitStatsTable";
import { WARBAND_DARK_TOOLTIP_CONTENT_CLASSNAME } from "@/features/warbands/components/shared/unit_details/warband-tooltip-styles";
import { toUnitStats } from "../../shared/utils/unit-stats-mapper";
import type { HenchmenGroup } from "../../../types/warband-types";

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
  showLoadoutOnMobile?: boolean;
  canEdit?: boolean;
};

const bgStyle = {
  border: "1px solid rgba(var(--unit-card-border-rgb), 0.5)",
  backgroundColor: "var(--unit-card-panel-bg)",
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
  showLoadoutOnMobile = false,
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
          className="warband-hero-card warband-card--henchmen relative"
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
                  content="Some items don't divide evenly across all henchmen — adjust item counts to match the group size."
                  maxWidth={240}
                  className="mt-1"
                  contentClassName={WARBAND_DARK_TOOLTIP_CONTENT_CLASSNAME}
                />
              ) : null}
            </div>
          </div>
          <div style={bgStyle}>
            <UnitStatsTable
              stats={stats}
              variant="summary"
              tooltipContentClassName={WARBAND_DARK_TOOLTIP_CONTENT_CLASSNAME}
            />
          </div>
          {group.no_level_ups ? null : (
            <ExperienceBar
              xp={group.xp}
              getLevelInfo={(xp) => getHenchmenLevelInfo(xp, levelThresholds)}
              onSave={createHenchmenGroupXpSaver(warbandId, group, onGroupUpdated)}
            />
          )}
          {(layoutVariant !== "mobile" || showLoadoutOnMobile) ? (
            <HenchmenListBlocks
              group={group}
              warbandId={warbandId}
              onGroupUpdated={onGroupUpdated}
              fullWidthItems={fullWidthItems}
              canEdit={canEdit}
            />
          ) : null}

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
