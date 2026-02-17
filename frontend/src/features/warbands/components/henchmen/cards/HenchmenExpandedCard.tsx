import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

import { getWarbandHenchmenGroupDetail } from "../../../api/warbands-api";
import { createHenchmenGroupXpSaver } from "../../../utils/warband-utils";
import type { HenchmenGroup } from "../../../types/warband-types";
import UnitStatsTable from "@/features/warbands/components/shared/unit_details/UnitStatsTable";
import { toRaceUnitStats, toUnitStats } from "../../shared/utils/unit-stats-mapper";
import { getHenchmenLevelInfo } from "../utils/henchmen-level";
import ExperienceBar from "../../shared/unit_details/ExperienceBar";
import HenchmenListBlocks from "../blocks/HenchmenListBlocks";
import { calculateHenchmenReinforceCost } from "../utils/henchmen-cost";

import basicBar from "@/assets/containers/basic_bar.webp";
import cardDetailed from "@/assets/containers/card_detailed.webp";
import exitIcon from "@/assets/components/exit.webp";
import { Tooltip } from "@/components/ui/tooltip";
import CollapsibleSection from "@/components/ui/collapsible-section";

type HenchmenExpandedCardProps = {
  group: HenchmenGroup;
  warbandId: number;
  onClose: () => void;
  onGroupUpdated?: (updatedGroup: HenchmenGroup) => void;
  levelUpControl?: ReactNode;
  layoutVariant?: "default" | "mobile";
  levelThresholds?: readonly number[];
};

const bgStyle = {
  backgroundImage: `url(${basicBar})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
} as const;


export default function HenchmenExpandedCard({
  group: initialGroup,
  warbandId,
  onClose,
  onGroupUpdated,
  levelUpControl,
  layoutVariant = "default",
  levelThresholds,
}: HenchmenExpandedCardProps) {
  const [group, setGroup] = useState<HenchmenGroup>(initialGroup);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDeedsCollapsed, setIsDeedsCollapsed] = useState(true);
  const isMobileLayout = layoutVariant === "mobile";

  const handleGroupUpdated = (updatedGroup: HenchmenGroup) => {
    if (updatedGroup.id === group.id) {
      setGroup(updatedGroup);
    }
    onGroupUpdated?.(updatedGroup);
  };

  useEffect(() => {
    setIsVisible(true);
    const fetchDetails = async () => {
      try {
        const data = await getWarbandHenchmenGroupDetail(warbandId, initialGroup.id);
        setGroup(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load group details");
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [warbandId, initialGroup.id]);

  useEffect(() => {
    setGroup(initialGroup);
  }, [initialGroup]);

  const stats = toUnitStats(group);
  const raceStats = toRaceUnitStats(group);
  const {
    baseCost: basePrice,
    xpCost,
    totalCost: totalPrice,
    itemBreakdown,
  } = calculateHenchmenReinforceCost({
    price: group.price,
    xp: group.xp,
    items: group.items,
    henchmen: group.henchmen,
  });
  const totalKills = (group.henchmen ?? []).reduce((sum, h) => sum + (h.kills || 0), 0);

  return (
    <div
      className={[
        "relative w-full transition-all duration-500 ease-out",
        "min-h-[calc(100vh-14rem)] overflow-visible",
        isMobileLayout ? "p-4" : "p-6",
        isVisible ? "opacity-100 scale-100" : "opacity-0 scale-[0.98]",
      ].join(" ")}
      style={{
        backgroundImage: `url(${cardDetailed})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
    >
      {levelUpControl}

      {!isMobileLayout ? (
        <button
          type="button"
          className="icon-button absolute right-1 top-1 z-10 flex h-7 w-7 cursor-pointer items-center justify-center border-none bg-transparent p-0 transition-[filter] hover:brightness-125"
          onClick={onClose}
        >
          <img src={exitIcon} alt="Close" className="h-7 w-7" />
        </button>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">Loading group details...</p>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-red-500">{error}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="w-full p-4" style={bgStyle}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {group.name || "Unnamed Group"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {group.race_name || group.race?.name || "Unknown Race"} -{" "}
                  {group.unit_type || "Unknown Type"}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">XP</span>
                <p className="text-lg font-semibold">{group.xp ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="w-full">
            <UnitStatsTable
              stats={stats}
              raceStats={raceStats}
              variant="race"
              wrapperClassName="h-full w-full max-w-none"
            />
          </div>

          <ExperienceBar
            xp={group.xp}
            getLevelInfo={(xp) => getHenchmenLevelInfo(xp, levelThresholds)}
            onSave={createHenchmenGroupXpSaver(warbandId, group, handleGroupUpdated)}
          />

          <div className="flex flex-wrap items-center gap-3">
            {group.large && (
              <div className="px-3 py-2" style={bgStyle}>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Size</span>
                <p className="text-sm font-semibold">Large</p>
              </div>
            )}
            <Tooltip
              trigger={
                <div className="px-3 py-2 cursor-help transition-[filter] duration-150 hover:brightness-125" style={bgStyle}>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">Reinforce Cost</span>
                  <p className="text-sm font-semibold decoration-dotted underline underline-offset-4 decoration-muted-foreground/50">{totalPrice}</p>
                </div>
              }
              content={
                <div className="flex flex-col gap-1 text-sm not-italic">
                  <div className="flex justify-between gap-4">
                    <span>Base Cost</span>
                    <span className="font-semibold">{basePrice}</span>
                  </div>
                  {itemBreakdown.map(({ item, multiplier, cost }) => (
                    <div key={item.id} className="flex justify-between gap-4">
                      <span>{item.name}{multiplier > 1 ? ` x${multiplier}` : ""}</span>
                      <span className="font-semibold">{cost}</span>
                    </div>
                  ))}
                  <div className="flex justify-between gap-4">
                    <span>Experience</span>
                    <span className="font-semibold">{xpCost}</span>
                  </div>
                </div>
              }
              minWidth={180}
              maxWidth={280}
            />
            <div className="px-3 py-2" style={bgStyle}>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Kills</span>
              <p className="text-sm font-semibold">{totalKills}</p>
            </div>
          </div>

          <CollapsibleSection
            title="Deeds"
            collapsed={isDeedsCollapsed}
            onToggle={() => setIsDeedsCollapsed((current) => !current)}
          >
            <div className="w-full p-3" style={bgStyle}>
              {group.deeds ? (
                <p className="whitespace-pre-line text-foreground">{group.deeds}</p>
              ) : (
                <p className="text-muted-foreground">No deeds recorded yet.</p>
              )}
            </div>
          </CollapsibleSection>

          <HenchmenListBlocks
            group={group}
            warbandId={warbandId}
            variant="summary"
            fullWidthItems={isMobileLayout}
            summaryRowCount={8}
            summaryScrollable={false}
            onGroupUpdated={handleGroupUpdated}
          />
          {isMobileLayout ? (
            <button
              type="button"
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-border/70 bg-black/40 py-2 text-[0.6rem] uppercase tracking-[0.35em] text-muted-foreground transition hover:text-foreground"
              onClick={onClose}
            >
              <ChevronDown className="h-4 w-4 rotate-180 transition-transform" />
              Close
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
