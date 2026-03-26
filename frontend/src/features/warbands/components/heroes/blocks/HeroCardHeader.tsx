import type { WarbandHero } from "../../../types/warband-types";
import { getHeroLevelInfo } from "../utils/hero-level";

type HeroCardHeaderProps = {
  hero: WarbandHero;
  levelThresholds?: readonly number[];
};

export default function HeroCardHeader({ hero, levelThresholds }: HeroCardHeaderProps) {
  const { level } = getHeroLevelInfo(hero.xp, levelThresholds);

  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-2 pb-1">
      <div className="min-w-0">
        <p className="text-xl font-bold">{hero.name || "Untitled hero"}</p>
        <p className="text-sm text-muted-foreground">
          Level {level} {hero.unit_type || "Hero"}
        </p>
      </div>
      {hero.is_leader ? (
        <span className="self-start shrink-0 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-amber-200">
          Leader
        </span>
      ) : null}
    </div>
  );
}

