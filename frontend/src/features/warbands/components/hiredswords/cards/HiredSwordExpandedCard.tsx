import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

import { getWarbandHiredSwordDetail } from "../../../api/warbands-api";
import { createHiredSwordXpSaver } from "../../../utils/warband-utils";
import type { WarbandHiredSword } from "../../../types/warband-types";
import UnitStatsTable from "@/features/warbands/components/shared/unit_details/UnitStatsTable";
import { toRaceUnitStats, toUnitStats } from "../../shared/utils/unit-stats-mapper";
import { getHenchmenLevelInfo } from "../../henchmen/utils/henchmen-level";
import ExperienceBar from "../../shared/unit_details/ExperienceBar";
import HiredSwordListBlocks from "../blocks/HiredSwordListBlocks";
import NewHiredSwordSpellDialog from "@/features/spells/components/NewHiredSwordSpellDialog";
import NewHiredSwordSkillDialog from "@/features/skills/components/NewHiredSwordSkillDialog";

import basicBar from "@/assets/containers/basic_bar.webp";
import cardDetailed from "@/assets/containers/card_detailed.webp";
import exitIcon from "@/assets/components/exit.webp";
import { Tooltip } from "@/components/ui/tooltip";
import CollapsibleSection from "@/components/ui/collapsible-section";

type HiredSwordExpandedCardProps = {
  hiredSword: WarbandHiredSword;
  warbandId: number;
  onClose: () => void;
  onHiredSwordUpdated?: (updated: WarbandHiredSword) => void;
  levelUpControl?: ReactNode;
  onPendingEntryClick?: (hiredSwordId: number, tab: "skills" | "spells" | "special") => void;
  layoutVariant?: "default" | "mobile";
  levelThresholds?: readonly number[];
};

const bgStyle = {
  backgroundImage: `url(${basicBar})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
} as const;

export default function HiredSwordExpandedCard({
  hiredSword: initialHiredSword,
  warbandId,
  onClose,
  onHiredSwordUpdated,
  levelUpControl,
  onPendingEntryClick,
  layoutVariant = "default",
  levelThresholds,
}: HiredSwordExpandedCardProps) {
  const [hiredSword, setHiredSword] = useState<WarbandHiredSword>(initialHiredSword);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newSpellOpen, setNewSpellOpen] = useState(false);
  const [newSkillOpen, setNewSkillOpen] = useState(false);
  const [isDeedsCollapsed, setIsDeedsCollapsed] = useState(true);
  const isMobileLayout = layoutVariant === "mobile";

  const handleHiredSwordUpdated = (updated: WarbandHiredSword) => {
    if (updated.id === hiredSword.id) {
      setHiredSword(updated);
    }
    onHiredSwordUpdated?.(updated);
  };

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const data = await getWarbandHiredSwordDetail(warbandId, initialHiredSword.id);
        setHiredSword(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load hired sword details");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [warbandId, initialHiredSword.id]);

  useEffect(() => {
    setHiredSword(initialHiredSword);
  }, [initialHiredSword]);

  const stats = toUnitStats(hiredSword);
  const raceStats = toRaceUnitStats(hiredSword);
  const spellTypes = [...new Set((hiredSword.spells ?? []).map((s) => s.type).filter((t) => t && t !== "Pending"))] as string[];
  const basePrice = Number(hiredSword.price ?? 0) || 0;
  const upkeepPrice = Number(hiredSword.upkeep_price ?? 0) || 0;
  const itemsPrice = (hiredSword.items ?? []).reduce((sum, item) => {
    const cost = Number(item.cost ?? 0);
    return sum + (Number.isFinite(cost) ? cost : 0);
  }, 0);
  const totalPrice = basePrice + itemsPrice;
  const killCount = hiredSword.kills ?? 0;
  const xpSaver = createHiredSwordXpSaver(warbandId, hiredSword, handleHiredSwordUpdated);
  const containerStyle = isMobileLayout
    ? {
        backgroundColor: "rgba(8, 6, 4, 0.6)",
        border: "1px solid rgba(110, 90, 59, 0.45)",
      }
    : {
        backgroundImage: `url(${cardDetailed})`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={[
        "relative w-full",
        isMobileLayout ? "min-h-[calc(100vh-14rem)] overflow-visible" : "max-h-[500px] overflow-y-auto",
        isMobileLayout ? "p-3 pb-6" : "p-6",
      ].join(" ")}
      style={containerStyle}
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
          <p className="text-muted-foreground">Loading hired sword details...</p>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-8">
          <p className="text-red-500">{error}</p>
        </div>
      ) : isMobileLayout ? (
        <div className="flex flex-col gap-4">
          <div className="w-full p-4" style={bgStyle}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {hiredSword.name || "Unnamed Hired Sword"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {hiredSword.race_name || hiredSword.race?.name || "Unknown Race"} -{" "}
                  {hiredSword.unit_type || "Unknown Type"}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">XP</span>
                <p className="text-lg font-semibold">{hiredSword.xp ?? 0}</p>
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
            xp={hiredSword.xp}
            halfRate={hiredSword.half_rate ?? false}
            getLevelInfo={(xp) => getHenchmenLevelInfo(xp, levelThresholds)}
            onSave={xpSaver}
          />

          <div className="flex flex-wrap items-center gap-3">
            {hiredSword.large && (
              <div className="px-3 py-2" style={bgStyle}>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Size</span>
                <p className="text-sm font-semibold">Large</p>
              </div>
            )}
            {hiredSword.caster && hiredSword.caster !== "No" && (
              <Tooltip
                trigger={
                  <div className="px-3 py-2 cursor-help transition-[filter] duration-150 hover:brightness-125" style={bgStyle}>
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">Caster</span>
                    <p className="text-sm font-semibold decoration-dotted underline underline-offset-4 decoration-muted-foreground/50">{hiredSword.caster}</p>
                  </div>
                }
                content={
                  <div className="flex flex-col gap-1 text-sm not-italic">
                    <span className="font-semibold">Spell Lists</span>
                    {spellTypes.length > 0 ? (
                      spellTypes.map((type) => (
                        <span key={type}>{type}</span>
                      ))
                    ) : (
                      <span className="text-muted-foreground">No spells known</span>
                    )}
                  </div>
                }
                minWidth={140}
                maxWidth={240}
              />
            )}
            {hiredSword.blood_pacted ? (
              <div className="px-3 py-2" style={bgStyle}>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Bloodpacted</span>
                <p className="text-sm font-semibold">Yes</p>
              </div>
            ) : null}
            <Tooltip
              trigger={
                <div className="px-3 py-2 cursor-help transition-[filter] duration-150 hover:brightness-125" style={bgStyle}>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">Hire Cost</span>
                  <p className="text-sm font-semibold decoration-dotted underline underline-offset-4 decoration-muted-foreground/50">{totalPrice}</p>
                </div>
              }
              content={
                <div className="flex flex-col gap-1 text-sm not-italic">
                  <div className="flex justify-between gap-4">
                    <span>Base Cost</span>
                    <span className="font-semibold">{basePrice}</span>
                  </div>
                  {(hiredSword.items ?? []).map((item) => (
                    <div key={item.id} className="flex justify-between gap-4">
                      <span>{item.name}</span>
                      <span className="font-semibold">{Number(item.cost ?? 0)}</span>
                    </div>
                  ))}
                </div>
              }
              minWidth={180}
              maxWidth={280}
            />
            <div className="px-3 py-2" style={bgStyle}>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Upkeep</span>
              <p className="text-sm font-semibold">{upkeepPrice}</p>
            </div>
            <div className="px-3 py-2" style={bgStyle}>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Kills</span>
              <p className="text-sm font-semibold">{killCount}</p>
            </div>
          </div>

          <CollapsibleSection
            title="Deeds"
            collapsed={isDeedsCollapsed}
            onToggle={() => setIsDeedsCollapsed((current) => !current)}
          >
            <div className="w-full p-3" style={bgStyle}>
              {hiredSword.deeds ? (
                <p className="whitespace-pre-line text-foreground">{hiredSword.deeds}</p>
              ) : (
                <p className="text-muted-foreground">No deeds recorded yet.</p>
              )}
            </div>
          </CollapsibleSection>

          <HiredSwordListBlocks
            hiredSword={hiredSword}
            warbandId={warbandId}
            variant="summary"
            fullWidthItems
            summaryRowCount={4}
            summaryScrollable={false}
            onHiredSwordUpdated={handleHiredSwordUpdated}
            onPendingEntryClick={onPendingEntryClick}
            onPendingSpellClick={() => setNewSpellOpen(true)}
            onPendingSkillClick={() => setNewSkillOpen(true)}
          />
          <button
            type="button"
            aria-label="Close details"
            className="icon-button absolute bottom-0 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border border-border/70 bg-black/60 text-muted-foreground transition hover:text-foreground"
            onClick={onClose}
          >
            <ChevronDown className="h-4 w-4 rotate-180 transition-transform" />
          </button>
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
                        {hiredSword.name || "Unnamed Hired Sword"}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {hiredSword.race_name || hiredSword.race?.name || "Unknown Race"} -{" "}
                        {hiredSword.unit_type || "Unknown Type"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs uppercase tracking-widest text-muted-foreground">XP</span>
                      <p className="text-lg font-semibold">{hiredSword.xp ?? 0}</p>
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
                  {hiredSword.large && (
                    <div className="p-2" style={bgStyle}>
                      <span className="text-xs uppercase tracking-widest text-muted-foreground">Size</span>
                      <p className="text-sm font-semibold">Large</p>
                    </div>
                  )}
                  {hiredSword.caster && hiredSword.caster !== "No" && (
                    <Tooltip
                      trigger={
                        <div className="p-2 cursor-help transition-[filter] duration-150 hover:brightness-125" style={bgStyle}>
                          <span className="text-xs uppercase tracking-widest text-muted-foreground">Caster</span>
                          <p className="text-sm font-semibold decoration-dotted underline underline-offset-4 decoration-muted-foreground/50">{hiredSword.caster}</p>
                        </div>
                      }
                      content={
                        <div className="flex flex-col gap-1 text-sm not-italic">
                          <span className="font-semibold">Spell Lists</span>
                          {spellTypes.length > 0 ? (
                            spellTypes.map((type) => (
                              <span key={type}>{type}</span>
                            ))
                          ) : (
                            <span className="text-muted-foreground">No spells known</span>
                          )}
                        </div>
                      }
                      minWidth={140}
                      maxWidth={240}
                    />
                  )}
                  {hiredSword.blood_pacted ? (
                    <div className="p-2" style={bgStyle}>
                      <span className="text-xs uppercase tracking-widest text-muted-foreground">Bloodpacted</span>
                      <p className="text-sm font-semibold">Yes</p>
                    </div>
                  ) : null}
                  <Tooltip
                    trigger={
                      <div className="p-2 cursor-help transition-[filter] duration-150 hover:brightness-125" style={bgStyle}>
                        <span className="text-xs uppercase tracking-widest text-muted-foreground">Hire Cost</span>
                        <p className="text-sm font-semibold decoration-dotted underline underline-offset-4 decoration-muted-foreground/50">{totalPrice}</p>
                      </div>
                    }
                    content={
                      <div className="flex flex-col gap-1 text-sm not-italic">
                        <div className="flex justify-between gap-4">
                          <span>Base Cost</span>
                          <span className="font-semibold">{basePrice}</span>
                        </div>
                        {(hiredSword.items ?? []).map((item) => (
                          <div key={item.id} className="flex justify-between gap-4">
                            <span>{item.name}</span>
                            <span className="font-semibold">{Number(item.cost ?? 0)}</span>
                          </div>
                        ))}
                      </div>
                    }
                    minWidth={180}
                    maxWidth={280}
                  />
                  <div className="p-2" style={bgStyle}>
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">Upkeep</span>
                    <p className="text-sm font-semibold">{upkeepPrice}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex min-w-[200px] w-[40%] p-3 flex-col overflow-hidden" style={bgStyle}>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Deeds</p>
              <div className="mt-2 max-h-[130px] flex-1 overflow-y-auto pr-1 text-sm">
                {hiredSword.deeds ? (
                  <p className="whitespace-pre-line text-foreground">{hiredSword.deeds}</p>
                ) : (
                  <p className="text-muted-foreground">No deeds recorded yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[220px] flex-1">
              <ExperienceBar
                xp={hiredSword.xp}
                halfRate={hiredSword.half_rate ?? false}
                getLevelInfo={(xp) => getHenchmenLevelInfo(xp, levelThresholds)}
                onSave={xpSaver}
              />
            </div>
          </div>

          <HiredSwordListBlocks
            hiredSword={hiredSword}
            warbandId={warbandId}
            variant="detailed"
            onHiredSwordUpdated={handleHiredSwordUpdated}
            onPendingEntryClick={onPendingEntryClick}
            onPendingSpellClick={() => setNewSpellOpen(true)}
            onPendingSkillClick={() => setNewSkillOpen(true)}
          />
        </div>
      )}

      <NewHiredSwordSpellDialog
        hiredSword={hiredSword}
        warbandId={warbandId}
        open={newSpellOpen}
        onOpenChange={setNewSpellOpen}
        onHiredSwordUpdated={handleHiredSwordUpdated}
      />
      <NewHiredSwordSkillDialog
        hiredSword={hiredSword}
        warbandId={warbandId}
        open={newSkillOpen}
        onOpenChange={setNewSkillOpen}
        onHiredSwordUpdated={handleHiredSwordUpdated}
      />
    </motion.div>
  );
}
