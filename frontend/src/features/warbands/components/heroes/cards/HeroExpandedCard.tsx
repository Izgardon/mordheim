import { useEffect, useState, type ReactNode } from "react";

import { getWarbandHeroDetail } from "../../../api/warbands-api";
import type { WarbandHero } from "../../../types/warband-types";
import UnitStatsTable from "@/components/units/UnitStatsTable";
import { heroRaceToUnitStats, heroToUnitStats } from "../utils/hero-unit-stats";
import ExperienceBar from "../blocks/ExperienceBar";
import HeroListBlocks from "../blocks/HeroListBlocks";

import basicBar from "@/assets/containers/basic_bar.webp";
import cardDetailed from "@/assets/containers/card_detailed.webp";
import exitIcon from "@/assets/components/exit.webp";

type HeroExpandedCardProps = {
  hero: WarbandHero;
  warbandId: number;
  onClose: () => void;
  onHeroUpdated?: (updatedHero: WarbandHero) => void;
  levelUpControl?: ReactNode;
  onPendingEntryClick?: (heroId: number, tab: "skills" | "spells" | "special") => void;
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
}: HeroExpandedCardProps) {
  const [hero, setHero] = useState<WarbandHero>(initialHero);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);

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

  const heroStats = heroToUnitStats(hero);
  const raceStats = heroRaceToUnitStats(hero);

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

      {/* Exit button */}
      <button
        type="button"
        className="icon-button absolute right-1 top-1 z-10 flex h-7 w-7 cursor-pointer items-center justify-center border-none bg-transparent p-0 transition-[filter] hover:brightness-125"
        onClick={onClose}
      >
        <img src={exitIcon} alt="Close" className="h-7 w-7" />
      </button>

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
          {/* Top Half - Hero Info */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-4">
              {/* Header row */}
              <div className="flex flex-wrap items-start gap-4">
                {/* Title */}
                <div className="p-4" style={bgStyle}>
                  <h2 className="text-2xl font-bold text-foreground">{hero.name || "Unnamed Hero"}</h2>
                  <p className="text-sm text-muted-foreground">
                    {hero.race_name || hero.race?.name || "Unknown Race"} - {hero.unit_type || "Unknown Type"}
                  </p>
                </div>
                {/* XP, Kills, Rating */}
                <div className="flex flex-wrap gap-3 text-right">
                  <div className="p-3" style={bgStyle}>
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">XP</span>
                    <p className="text-lg font-semibold">{hero.xp ?? 0}</p>
                  </div>
                  <div className="p-3" style={bgStyle}>
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">Kills</span>
                    <p className="text-lg font-semibold">{hero.kills ?? 0}</p>
                  </div>
                  <div className="p-3" style={bgStyle}>
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">Rating</span>
                    <p className="text-lg font-semibold">{hero.xp ?? 0}</p>
                  </div>
                  {hero.large && (
                    <div className="p-3" style={bgStyle}>
                      <span className="text-xs uppercase tracking-widest text-muted-foreground">Size</span>
                      <p className="text-lg font-semibold">Large</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats table */}
              <UnitStatsTable stats={heroStats} raceStats={raceStats} variant="race" />
            </div>

            <div className="flex h-full flex-col overflow-hidden p-4" style={bgStyle}>
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Deeds</p>
              <div className="mt-2 flex-1 overflow-y-auto pr-1 text-sm">
                {hero.deeds ? (
                  <p className="whitespace-pre-line text-foreground">{hero.deeds}</p>
                ) : (
                  <p className="text-muted-foreground">No deeds recorded yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Experience bar */}
          <ExperienceBar hero={hero} warbandId={warbandId} onHeroUpdated={handleHeroUpdated} />

          {/* Bottom Half - Items, Skills, Spells, Specials */}
          <HeroListBlocks hero={hero} warbandId={warbandId} variant="detailed" onHeroUpdated={handleHeroUpdated} onPendingEntryClick={onPendingEntryClick} />
        </div>
      )}
    </div>
  );
}


