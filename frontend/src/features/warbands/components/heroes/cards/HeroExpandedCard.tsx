import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { motion } from "framer-motion";

import { getWarbandHeroDetail } from "../../../api/warbands-api";
import { calculateHeroTotalPrice, createHeroXpSaver } from "../../../utils/warband-utils";
import type { WarbandHero } from "../../../types/warband-types";
import UnitStatsTable from "@/features/warbands/components/shared/unit_details/UnitStatsTable";
import { toRaceUnitStats, toUnitStats } from "../../shared/utils/unit-stats-mapper";
import { getHeroLevelInfo } from "../utils/hero-level";
import ExperienceBar from "../../shared/unit_details/ExperienceBar";
import HeroListBlocks from "../blocks/HeroListBlocks";
import NewSpellDialog from "@/features/spells/components/NewSpellDialog";
import NewSkillDialog from "@/features/skills/components/NewSkillDialog";

import basicBar from "@/assets/containers/basic_bar.webp";
import cardDetailed from "@/assets/containers/card_detailed.webp";
import exitIcon from "@/assets/components/exit.webp";
import { Tooltip } from "@/components/ui/tooltip";
import CollapsibleSection from "@/components/ui/collapsible-section";

type HeroExpandedCardProps = {
  hero: WarbandHero;
  warbandId: number;
  onClose: () => void;
  onHeroUpdated?: (updatedHero: WarbandHero) => void;
  levelUpControl?: ReactNode;
  onPendingEntryClick?: (heroId: number, tab: "skills" | "spells" | "special") => void;
  layoutVariant?: "default" | "mobile";
  levelThresholds?: readonly number[];
  canEdit?: boolean;
};

const bgStyle = {
  backgroundImage: `url(${basicBar})`,
  backgroundSize: "100% 100%",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "center",
} as const;

export default function HeroExpandedCard({
  hero: initialHero,
  warbandId,
  onClose,
  onHeroUpdated,
  levelUpControl,
  onPendingEntryClick,
  layoutVariant = "default",
  levelThresholds,
  canEdit = false,
}: HeroExpandedCardProps) {
  const [hero, setHero] = useState<WarbandHero>(initialHero);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newSpellOpen, setNewSpellOpen] = useState(false);
  const [newSkillOpen, setNewSkillOpen] = useState(false);
  const [isDeedsCollapsed, setIsDeedsCollapsed] = useState(true);
  const isMobileLayout = layoutVariant === "mobile";

  const handleHeroUpdated = (updatedHero: WarbandHero) => {
    if (updatedHero.id === hero.id) {
      setHero(updatedHero);
    }
    onHeroUpdated?.(updatedHero);
  };

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const data = await getWarbandHeroDetail(warbandId, initialHero.id);
        setHero(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load hero details");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [warbandId, initialHero.id]);

  useEffect(() => {
    setHero(initialHero);
  }, [initialHero]);

  const heroStats = toUnitStats(hero);
  const raceStats = toRaceUnitStats(hero);
  const spellTypes = [...new Set((hero.spells ?? []).map((s) => s.type).filter((t) => t && t !== "Pending"))] as string[];
  const { basePrice, totalPrice } = calculateHeroTotalPrice(hero);
  const xpSaver = createHeroXpSaver(warbandId, hero, handleHeroUpdated);
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
          <p className="text-muted-foreground">Loading hero details...</p>
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
                  {hero.name || "Unnamed Hero"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {hero.race_name || hero.race?.name || "Unknown Race"} -{" "}
                  {hero.unit_type || "Unknown Type"}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">XP</span>
                <p className="text-lg font-semibold">{hero.xp ?? 0}</p>
              </div>
            </div>
          </div>

          <div className="w-full">
            <UnitStatsTable
              stats={heroStats}
              raceStats={raceStats}
              variant="race"
              wrapperClassName="h-full w-full max-w-none"
            />
          </div>

          <ExperienceBar
            xp={hero.xp}
            halfRate={hero.half_rate ?? false}
            getLevelInfo={(xp) => getHeroLevelInfo(xp, levelThresholds)}
            onSave={xpSaver}
          />

          <div className="flex flex-wrap items-center gap-3">
            {hero.large && (
              <div className="px-3 py-2" style={bgStyle}>
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Size</span>
                <p className="text-sm font-semibold">Large</p>
              </div>
            )}
            {hero.caster && hero.caster !== "No" && (
              <Tooltip
                trigger={
                  <div className="px-3 py-2 cursor-help transition-[filter] duration-150 hover:brightness-125" style={bgStyle}>
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">Caster</span>
                    <p className="text-sm font-semibold decoration-dotted underline underline-offset-4 decoration-muted-foreground/50">
                      {hero.caster}
                    </p>
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
            <Tooltip
              trigger={
                <div className="px-3 py-2 cursor-help transition-[filter] duration-150 hover:brightness-125" style={bgStyle}>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">Total Cost</span>
                  <p className="text-sm font-semibold decoration-dotted underline underline-offset-4 decoration-muted-foreground/50">
                    {totalPrice}
                  </p>
                </div>
              }
              content={
                <div className="flex flex-col gap-1 text-sm not-italic">
                  <div className="flex justify-between gap-4">
                    <span>Base Cost</span>
                    <span className="font-semibold">{basePrice}</span>
                  </div>
                  {(hero.items ?? []).map((item) => (
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
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Kills</span>
              <p className="text-sm font-semibold">{hero.kills ?? 0}</p>
            </div>
          </div>

          <CollapsibleSection
            title="Deeds"
            collapsed={isDeedsCollapsed}
            onToggle={() => setIsDeedsCollapsed((current) => !current)}
          >
            <div className="w-full p-3" style={bgStyle}>
              {hero.deeds ? (
                <p className="whitespace-pre-line text-foreground">{hero.deeds}</p>
              ) : (
                <p className="text-muted-foreground">No deeds recorded yet.</p>
              )}
            </div>
          </CollapsibleSection>

          <HeroListBlocks
            hero={hero}
            warbandId={warbandId}
            variant="summary"
            fullWidthItems
            summaryRowCount={4}
            summaryScrollable={false}
            onHeroUpdated={handleHeroUpdated}
            onPendingEntryClick={onPendingEntryClick}
            onPendingSpellClick={() => setNewSpellOpen(true)}
            onPendingSkillClick={() => setNewSkillOpen(true)}
            canEdit={canEdit}
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
                        {hero.name || "Unnamed Hero"}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {hero.race_name || hero.race?.name || "Unknown Race"} -{" "}
                        {hero.unit_type || "Unknown Type"}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-xs uppercase tracking-widest text-muted-foreground">XP</span>
                      <p className="text-lg font-semibold">{hero.xp ?? 0}</p>
                    </div>
                  </div>
                </div>

                <div className="min-w-[260px] flex-1">
                  <UnitStatsTable
                    stats={heroStats}
                    raceStats={raceStats}
                    variant="race"
                    wrapperClassName="h-full w-full max-w-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-start justify-between gap-3 text-right">
                <div className="flex flex-wrap gap-3">
                  {hero.large && (
                    <div className="p-2" style={bgStyle}>
                      <span className="text-xs uppercase tracking-widest text-muted-foreground">Size</span>
                      <p className="text-sm font-semibold">Large</p>
                    </div>
                  )}
                  {hero.caster && hero.caster !== "No" && (
                    <Tooltip
                      trigger={
                        <div className="p-2 cursor-help transition-[filter] duration-150 hover:brightness-125" style={bgStyle}>
                          <span className="text-xs uppercase tracking-widest text-muted-foreground">Caster</span>
                          <p className="text-sm font-semibold decoration-dotted underline underline-offset-4 decoration-muted-foreground/50">
                            {hero.caster}
                          </p>
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
                  <Tooltip
                    trigger={
                      <div className="p-2 cursor-help transition-[filter] duration-150 hover:brightness-125" style={bgStyle}>
                        <span className="text-xs uppercase tracking-widest text-muted-foreground">Total Cost</span>
                        <p className="text-sm font-semibold decoration-dotted underline underline-offset-4 decoration-muted-foreground/50">
                          {totalPrice}
                        </p>
                      </div>
                    }
                    content={
                      <div className="flex flex-col gap-1 text-sm not-italic">
                        <div className="flex justify-between gap-4">
                          <span>Base Cost</span>
                          <span className="font-semibold">{basePrice}</span>
                        </div>
                        {(hero.items ?? []).map((item) => (
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
                      <span className="text-sm font-bold leading-none">{hero.kills ?? 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex min-w-[200px] w-[40%] p-3 flex-col overflow-hidden" style={bgStyle}>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Deeds</p>
              <div className="mt-2 max-h-[130px] flex-1 overflow-y-auto pr-1 text-sm">
                {hero.deeds ? (
                  <p className="whitespace-pre-line text-foreground">{hero.deeds}</p>
                ) : (
                  <p className="text-muted-foreground">No deeds recorded yet.</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[220px] flex-1">
              <ExperienceBar
                xp={hero.xp}
                halfRate={hero.half_rate ?? false}
                getLevelInfo={(xp) => getHeroLevelInfo(xp, levelThresholds)}
                onSave={xpSaver}
              />
            </div>
          </div>

          <HeroListBlocks
            hero={hero}
            warbandId={warbandId}
            variant="detailed"
            onHeroUpdated={handleHeroUpdated}
            onPendingEntryClick={onPendingEntryClick}
            onPendingSpellClick={() => setNewSpellOpen(true)}
            onPendingSkillClick={() => setNewSkillOpen(true)}
            canEdit={canEdit}
          />
        </div>
      )}

      <NewSpellDialog
        hero={hero}
        warbandId={warbandId}
        open={newSpellOpen}
        onOpenChange={setNewSpellOpen}
        onHeroUpdated={handleHeroUpdated}
      />
      <NewSkillDialog
        hero={hero}
        warbandId={warbandId}
        open={newSkillOpen}
        onOpenChange={setNewSkillOpen}
        onHeroUpdated={handleHeroUpdated}
      />
    </motion.div>
  );
}
