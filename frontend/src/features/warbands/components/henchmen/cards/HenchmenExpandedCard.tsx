import { useEffect, useState, type ReactNode } from "react";

import { getWarbandHenchmenGroupDetail, updateWarbandHenchmenGroup } from "../../../api/warbands-api";
import type { HenchmenGroup } from "../../../types/warband-types";
import type { UnitStats } from "@/components/units/UnitStatsTable";
import UnitStatsTable from "@/components/units/UnitStatsTable";
import { getHenchmenLevelInfo } from "../utils/henchmen-level";
import ExperienceBar from "../../heroes/blocks/ExperienceBar";
import HenchmenListBlocks from "../blocks/HenchmenListBlocks";

import basicBar from "@/assets/containers/basic_bar.webp";
import cardDetailed from "@/assets/containers/card_detailed.webp";
import exitIcon from "@/assets/components/exit.webp";
import { Tooltip } from "@/components/ui/tooltip";

type HenchmenExpandedCardProps = {
  group: HenchmenGroup;
  warbandId: number;
  onClose: () => void;
  onGroupUpdated?: (updatedGroup: HenchmenGroup) => void;
  levelUpControl?: ReactNode;
};

const bgStyle = {
  backgroundImage: `url(${basicBar})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
} as const;

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

const groupRaceToUnitStats = (group: HenchmenGroup): UnitStats | null => {
  if (!group.race) return null;
  return {
    movement: group.race.movement,
    weapon_skill: group.race.weapon_skill,
    ballistic_skill: group.race.ballistic_skill,
    strength: group.race.strength,
    toughness: group.race.toughness,
    wounds: group.race.wounds,
    initiative: group.race.initiative,
    attacks: group.race.attacks,
    leadership: group.race.leadership,
  };
};

export default function HenchmenExpandedCard({
  group: initialGroup,
  warbandId,
  onClose,
  onGroupUpdated,
  levelUpControl,
}: HenchmenExpandedCardProps) {
  const [group, setGroup] = useState<HenchmenGroup>(initialGroup);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

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

  const stats = groupToUnitStats(group);
  const raceStats = groupRaceToUnitStats(group);
  const basePrice = Number(group.price ?? 0) || 0;
  const henchmenCount = (group.henchmen ?? []).length;
  const itemCounts = (group.items ?? []).reduce<Map<number, { item: typeof group.items[number]; count: number }>>(
    (acc, item) => {
      const existing = acc.get(item.id);
      if (existing) {
        existing.count += 1;
      } else {
        acc.set(item.id, { item, count: 1 });
      }
      return acc;
    },
    new Map()
  );
  const itemBreakdown = Array.from(itemCounts.values()).map(({ item, count }) => {
    const itemCost = Number(item.cost ?? 0);
    const normalizedCost = Number.isFinite(itemCost) ? itemCost : 0;
    let multiplier = 1;
    if (henchmenCount > 0 && count >= henchmenCount * 2) {
      multiplier = 2;
    }
    return {
      item,
      multiplier,
      cost: normalizedCost * multiplier,
    };
  });
  const itemsPrice = itemBreakdown.reduce((sum, entry) => sum + entry.cost, 0);
  const xpCost = (Number(group.xp ?? 0) || 0) * 2;
  const totalPrice = basePrice + itemsPrice + xpCost;
  const totalKills = (group.henchmen ?? []).reduce((sum, h) => sum + (h.kills || 0), 0);

  return (
    <div
      className={[
        "relative w-full max-h-[500px] overflow-y-auto p-6 transition-all duration-500 ease-out",
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

      <button
        type="button"
        className="icon-button absolute right-1 top-1 z-10 flex h-7 w-7 cursor-pointer items-center justify-center border-none bg-transparent p-0 transition-[filter] hover:brightness-125"
        onClick={onClose}
      >
        <img src={exitIcon} alt="Close" className="h-7 w-7" />
      </button>

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
          <div className="flex flex-col gap-4 lg:flex-row flex-wrap">
            <div className="flex min-w-0 basis-0 flex-1 w-[50%] flex-col gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
                <div className="min-w-[260px] h-full p-4" style={bgStyle}>
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

                <div className="min-w-[260px] flex-1">
                  <UnitStatsTable
                    stats={stats}
                    raceStats={raceStats}
                    variant="race"
                    wrapperClassName="h-full w-full max-w-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-start justify-between gap-3 text-right">
                <div className="flex flex-wrap gap-3">
                  {group.large && (
                    <div className="p-2" style={bgStyle}>
                      <span className="text-xs uppercase tracking-widest text-muted-foreground">Size</span>
                      <p className="text-sm font-semibold">Large</p>
                    </div>
                  )}
                  <Tooltip
                    trigger={
                      <div className="p-2 cursor-help transition-[filter] duration-150 hover:brightness-125" style={bgStyle}>
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
                </div>
                <div
                  className="relative flex items-center overflow-hidden rounded-lg border border-border/60 px-2 py-1.5 shadow-[0_16px_26px_rgba(6,3,2,0.4)]"
                  style={{
                    backgroundImage: `linear-gradient(135deg, rgba(92,28,24,0.25), rgba(16,12,10,0.55)), url(${basicBar})`,
                    backgroundSize: "100% 100%",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                  }}
                >
                  <div className="absolute -right-6 -top-6 h-16 w-16 rounded-full bg-rose-500/20 blur-2xl" />
                  <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-rose-500/70 via-amber-400/50 to-transparent" />
                  <div className="relative flex flex-col items-center gap-2 text-center">
                    <span className="text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
                      Kills
                    </span>
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-rose-400/50 bg-rose-500/15 text-foreground shadow-[0_8px_14px_rgba(92,28,24,0.3)]">
                      <span className="text-sm font-bold leading-none">{totalKills}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex min-w-[200px] w-[40%] p-3 flex-col overflow-hidden" style={bgStyle}>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Deeds</p>
              <div className="mt-2 max-h-[130px] flex-1 overflow-y-auto pr-1 text-sm">
                {group.deeds ? (
                  <p className="whitespace-pre-line text-foreground">{group.deeds}</p>
                ) : (
                  <p className="text-muted-foreground">No deeds recorded yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[220px] flex-1">
              <ExperienceBar
                xp={group.xp}
                getLevelInfo={getHenchmenLevelInfo}
                onSave={async (newXp) => {
                  const updated = await updateWarbandHenchmenGroup(warbandId, group.id, {
                    name: group.name, unit_type: group.unit_type, race: group.race_id ?? null, price: group.price, xp: newXp,
                  });
                  handleGroupUpdated(updated);
                  return Number(updated.xp ?? newXp) || 0;
                }}
              />
            </div>
          </div>

          <HenchmenListBlocks group={group} warbandId={warbandId} variant="detailed" onGroupUpdated={handleGroupUpdated} />
        </div>
      )}
    </div>
  );
}
