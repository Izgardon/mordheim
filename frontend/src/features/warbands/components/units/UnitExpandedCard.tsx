import { useState, type ReactNode } from "react";
import { ChevronDown, X } from "lucide-react";
import { motion } from "framer-motion";

import { Button } from "@components/button";
import UnitStatsTable from "../shared/unit_details/UnitStatsTable";
import ExperienceBar from "../shared/unit_details/ExperienceBar";
import { WARBAND_DARK_TOOLTIP_CONTENT_CLASSNAME } from "../shared/unit_details/warband-tooltip-styles";
import { toRaceUnitStats, toUnitStats } from "../shared/utils/unit-stats-mapper";
import UnitListBlocks, { type PendingTab } from "./UnitListBlocks";
import { cardPanelStyle } from "./expanded/ExpandedTiles";
import {
  CollapsibleDeeds,
  DeedsPanel,
  ExpandedIdentity,
  KillsBadge,
  KillsTile,
} from "./expanded/ExpandedParts";
import { useUnitXpSaver } from "../../hooks/units/useUnitMutations";
import { unitApi } from "../../units/unit-api";

import type { Unit, UnitKindKey } from "../../types/units";
import type { UnitKindConfig } from "../../units/unit-kind-types";

type UnitExpandedCardProps<K extends UnitKindKey> = {
  kind: UnitKindConfig<K>;
  unit: Unit<K>;
  warbandId: number;
  onClose: () => void;
  onUnitUpdated?: (updated: Unit<K>) => void;
  levelUpControl?: ReactNode;
  onPendingEntryClick?: (unitId: number, tab: PendingTab) => void;
  layoutVariant?: "default" | "mobile";
  levelThresholds?: readonly number[];
  canEdit?: boolean;
};

/** The expanded roster card (the sheet's units carry the race profile, deeds and kills). */
export default function UnitExpandedCard<K extends UnitKindKey>({
  kind,
  unit,
  warbandId,
  onClose,
  onUnitUpdated,
  levelUpControl,
  onPendingEntryClick,
  layoutVariant = "default",
  levelThresholds,
  canEdit = false,
}: UnitExpandedCardProps<K>) {
  const [newSpellOpen, setNewSpellOpen] = useState(false);
  const [newSkillOpen, setNewSkillOpen] = useState(false);
  const isMobileLayout = layoutVariant === "mobile";
  const layout = isMobileLayout ? "mobile" : "default";
  const { ExpandedTitle, ExpandedTiles, PendingAdvanceDialogs } = kind.slots;

  const handleUnitUpdated = (updated: Unit<K>) => onUnitUpdated?.(updated);
  const saveXp = useUnitXpSaver(kind, warbandId, unit, onUnitUpdated);

  const xpBar = kind.showsXpBar(unit) ? (
    <ExperienceBar
      xp={unit.xp}
      halfRate={kind.flags.xpBarHalfRate ? (unit.half_rate ?? false) : undefined}
      getLevelInfo={(xp) => kind.getLevelInfo(xp, levelThresholds)}
      onSave={saveXp}
    />
  ) : null;
  const identity = (
    <ExpandedIdentity
      title={<ExpandedTitle unit={unit} />}
      raceName={unit.race_name || unit.race?.name}
      unitType={unit.unit_type}
      xp={unit.xp}
    />
  );
  const statsTable = (
    <UnitStatsTable
      stats={toUnitStats(unit)}
      raceStats={toRaceUnitStats(unit)}
      variant="race"
      wrapperClassName="h-full w-full max-w-none"
      tooltipContentClassName={WARBAND_DARK_TOOLTIP_CONTENT_CLASSNAME}
    />
  );
  const tiles = (
    <ExpandedTiles
      unit={unit}
      warbandId={warbandId}
      layout={layout}
      canEdit={canEdit}
      onUnitUpdated={handleUnitUpdated}
      reportUnitUpdated={onUnitUpdated}
    />
  );
  const kills = {
    kills: kind.killCount(unit),
    name: unit.name || kind.labels.killsName,
    loadKillHistory: () => unitApi(kind.key).killHistory(warbandId, unit.id),
  };
  const blocks = (variant: "summary" | "detailed") => (
    <UnitListBlocks
      kind={kind}
      unit={unit}
      warbandId={warbandId}
      variant={variant}
      {...(variant === "summary"
        ? { fullWidthItems: true, summaryRowCount: 4, summaryScrollable: false }
        : {})}
      onUnitUpdated={handleUnitUpdated}
      onPendingEntryClick={onPendingEntryClick}
      onPendingSpellClick={() => setNewSpellOpen(true)}
      onPendingSkillClick={() => setNewSkillOpen(true)}
      canEdit={canEdit}
    />
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={[
        "relative w-full",
        `warband-card-shell ${kind.cardClassName}`,
        isMobileLayout
          ? "min-h-[calc(100vh-14rem)] overflow-visible"
          : "max-h-[500px] overflow-y-auto",
        isMobileLayout ? "p-3 pb-6" : "p-6",
      ].join(" ")}
    >
      {levelUpControl}

      {!isMobileLayout ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          opaque
          className="absolute right-1 top-1 z-10 h-7 w-7"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      ) : null}

      {isMobileLayout ? (
        <div className="flex flex-col gap-4">
          <div className="w-full p-4" style={cardPanelStyle}>
            {identity}
          </div>
          <div className="w-full">{statsTable}</div>
          {xpBar}
          <div className="flex flex-wrap items-center gap-3">
            {tiles}
            <KillsTile {...kills} />
          </div>
          <CollapsibleDeeds deeds={unit.deeds} />
          {blocks("summary")}
          <Button
            type="button"
            variant="icon"
            size="icon"
            aria-label="Close details"
            className="absolute bottom-0 left-1/2 z-10 h-8 w-8 -translate-x-1/2 translate-y-1/2 rounded-full"
            onClick={onClose}
          >
            <ChevronDown className="h-4 w-4 rotate-180 transition-transform" />
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row flex-wrap">
            <div className="flex min-w-0 basis-0 flex-1 w-[50%] flex-col gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
                <div className="min-w-[260px] h-full p-4" style={cardPanelStyle}>
                  {identity}
                </div>
                <div className="min-w-[260px] flex-1">{statsTable}</div>
              </div>
              <div className="flex flex-wrap items-start justify-between gap-3 text-right">
                <div className="flex flex-wrap gap-3">{tiles}</div>
                <KillsBadge {...kills} />
              </div>
            </div>
            <DeedsPanel deeds={unit.deeds} />
          </div>
          {xpBar ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[220px] flex-1">{xpBar}</div>
            </div>
          ) : null}
          {blocks("detailed")}
        </div>
      )}

      {PendingAdvanceDialogs ? (
        <PendingAdvanceDialogs
          unit={unit}
          warbandId={warbandId}
          spellOpen={newSpellOpen}
          onSpellOpenChange={setNewSpellOpen}
          skillOpen={newSkillOpen}
          onSkillOpenChange={setNewSkillOpen}
          onUnitUpdated={handleUnitUpdated}
        />
      ) : null}
    </motion.div>
  );
}
