import type { WarbandHero } from "../../../../types/warband-types";

type HeroCardHeaderProps = {
  hero: WarbandHero;
};

export default function HeroCardHeader({ hero }: HeroCardHeaderProps) {
  const levelUpReady = Boolean(hero.level_up);

  return (
    <div className="warband-hero-header">
      <div>
        <p className="warband-hero-name">{hero.name || "Untitled hero"}</p>
        {hero.race_name ? (
          <p className="warband-hero-race">{hero.race_name}</p>
        ) : null}
      </div>
      {levelUpReady ? <span className="warband-hero-level">Level up!</span> : null}
    </div>
  );
}
