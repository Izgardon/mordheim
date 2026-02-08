import { useEffect, useState, type ReactNode } from "react";

import { getWarbandHeroDetail } from "../../../api/warbands-api";
import type { WarbandHero } from "../../../types/warband-types";
import UnitStatsTable from "@/components/units/UnitStatsTable";
import { heroRaceToUnitStats, heroToUnitStats } from "../utils/hero-unit-stats";
import ExperienceBar from "./ExperienceBar";
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
          <div className="flex flex-col gap-4">
            {/* Header row */}
            <div className="flex items-start gap-4 pr-10">
              {/* Title */}
              <div className="p-4" style={bgStyle}>
                <h2 className="text-2xl font-bold text-foreground">{hero.name || "Unnamed Hero"}</h2>
                <p className="text-sm text-muted-foreground">
                  {hero.race_name || hero.race?.name || "Unknown Race"} - {hero.unit_type || "Unknown Type"}
                </p>
              </div>
              {/* XP, Kills, Rating */}
              <div className="flex gap-4 text-right p-4" style={bgStyle}>
                <div>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">XP</span>
                  <p className="text-lg font-semibold">{hero.xp ?? 0}</p>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">Kills</span>
                  <p className="text-lg font-semibold">{hero.kills ?? 0}</p>
                </div>
                <div>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">Rating</span>
                  <p className="text-lg font-semibold">{hero.xp ?? 0}</p>
                </div>
                {hero.large && (
                  <div>
                    <span className="text-xs uppercase tracking-widest text-muted-foreground">Size</span>
                    <p className="text-lg font-semibold">Large</p>
                  </div>
                )}
              </div>
            </div>

            {/* Stats table */}
            <UnitStatsTable stats={heroStats} raceStats={raceStats} variant="race" />

            {/* Experience bar */}
            <ExperienceBar hero={hero} warbandId={warbandId} onHeroUpdated={handleHeroUpdated} />
          </div>

          {/* Bottom Half - Items, Skills, Spells, Features */}
          <HeroListBlocks hero={hero} warbandId={warbandId} variant="detailed" onHeroUpdated={handleHeroUpdated} />
        </div>
      )}
    </div>
  );
}


