import { useEffect, useState } from "react";

import HeroCardHeader from "../blocks/HeroCardHeader";
import HeroListBlocks from "../blocks/HeroListBlocks";
import HeroMetaGrid from "../blocks/HeroMetaGrid";
import HeroStatsTable from "../blocks/HeroStatsTable";

import type { WarbandHero } from "../../../../types/warband-types";

type HeroDetailCardProps = {
  hero: WarbandHero;
};

export default function HeroDetailCard({ hero }: HeroDetailCardProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const media = window.matchMedia("(max-width: 767px)");
    const handleChange = () => setIsMobile(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  return (
    <div className="warband-hero-card">
      <HeroCardHeader hero={hero} />
      <HeroMetaGrid hero={hero} />
      <HeroStatsTable hero={hero} />
      <HeroListBlocks hero={hero} isMobile={isMobile} />
    </div>
  );
}
