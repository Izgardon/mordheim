import { useEffect, useState } from "react";

import { getWarbandHeroDetail } from "../../../../api/warbands-api";
import type { WarbandHero } from "../../../../types/warband-types";
import UnitStatsTable from "@/components/units/UnitStatsTable";
import { heroRaceToUnitStats, heroToUnitStats } from "../hero-unit-stats";

import basicBar from "@/assets/containers/basic_bar.png";
import cardDetailed from "@/assets/containers/card_detailed.png";
import exitIcon from "@/assets/components/exit.png";
import exitHoverIcon from "@/assets/components/exit_hover.png";

type HeroExpandedCardProps = {
  hero: WarbandHero;
  warbandId: number;
  onClose: () => void;
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
}: HeroExpandedCardProps) {
  const [hero, setHero] = useState<WarbandHero>(initialHero);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exitHovered, setExitHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

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

  const spells = hero.spells ?? [];
  const featureEntries = hero.features ?? [];
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
      {/* Exit button */}
      <button
        type="button"
        className="icon-button absolute right-1 top-1 z-10 flex h-7 w-7 cursor-pointer items-center justify-center border-none bg-transparent p-0"
        onClick={onClose}
        onMouseEnter={() => setExitHovered(true)}
        onMouseLeave={() => setExitHovered(false)}
      >
        <img
          src={exitHovered ? exitHoverIcon : exitIcon}
          alt="Close"
          className="h-7 w-7"
        />
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
          </div>

          {/* Bottom Half - Items, Skills, Spells, Features */}
          <div className="grid grid-cols-4 gap-4">
            {/* Items */}
            <div className="flex flex-col gap-2 p-3" style={bgStyle}>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Items</h3>
              <div className="flex flex-col gap-1">
                {(hero.items ?? []).length > 0 ? (
                  hero.items.map((item, index) => (
                    <span key={`${item.id}-${index}`} className="text-sm">
                      {item.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">None</span>
                )}
              </div>
            </div>

            {/* Skills */}
            <div className="flex flex-col gap-2 p-3" style={bgStyle}>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Skills</h3>
              <div className="flex flex-col gap-1">
                {(hero.skills ?? []).length > 0 ? (
                  hero.skills.map((skill) => (
                    <span key={skill.id} className="text-sm">
                      {skill.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">None</span>
                )}
              </div>
            </div>

            {/* Spells */}
            <div className="flex flex-col gap-2 p-3" style={bgStyle}>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Spells</h3>
              <div className="flex flex-col gap-1">
                {spells.length > 0 ? (
                  spells.map((spell) => (
                    <span key={spell.id} className="text-sm">
                      {spell.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">None</span>
                )}
              </div>
            </div>

            {/* Features */}
            <div className="flex flex-col gap-2 p-3" style={bgStyle}>
              <h3 className="text-xs uppercase tracking-widest text-muted-foreground">Features</h3>
              <div className="flex flex-col gap-1">
                {featureEntries.length > 0 ? (
                  featureEntries.map((entry, index) => (
                    <span key={`${entry.id}-${index}`} className="text-sm">
                      {entry.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">None</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


