import type { WarbandHero } from "../../../types/warband-types";
import { getHeroLevelInfo } from "../utils/hero-level";

type HeroCardHeaderProps = {
  hero: WarbandHero;
};

export default function HeroCardHeader({ hero }: HeroCardHeaderProps) {
  const { level } = getHeroLevelInfo(hero.xp);

  return (
    <div className="flex items-start justify-between gap-3 py-1 pl-4">
      <div>
        <p className="text-xl font-bold">{hero.name || "Untitled hero"}</p>
        <p className="text-sm text-muted-foreground">
          Level {level} {hero.unit_type || "Hero"}
        </p>
      </div>
    </div>
  );
}

