import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

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
}: HeroExpandedCardProps) {
  const [hero, setHero] = useState<WarbandHero>(initialHero);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
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
    setIsVisible(true);
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
  const { basePrice, itemsPrice, totalPrice } = calculateHeroTotalPrice(hero);

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

      {/* Exit button */}
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
      ) : (
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
            onSave={createHeroXpSaver(warbandId, hero, handleHeroUpdated)}
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
            fullWidthItems={isMobileLayout}
            summaryRowCount={8}
            summaryScrollable={false}
            onHeroUpdated={handleHeroUpdated}
            onPendingEntryClick={onPendingEntryClick}
            onPendingSpellClick={() => setNewSpellOpen(true)}
            onPendingSkillClick={() => setNewSkillOpen(true)}
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
    </div>
  );
}


