import { useEffect, useMemo, useState } from "react";

// types
import type { WarbandHero } from "../../types/warband-types";

type HeroSummaryCardProps = {
  hero: WarbandHero;
  isExpanded: boolean;
  overlayClassName?: string;
  onToggle: () => void;
  onCollapse: () => void;
};

export default function HeroSummaryCard({
  hero,
}: HeroSummaryCardProps) {
  const statFields = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld", "AS"] as const;
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

  const formatValue = (value?: number | string | null) => {
    if (value === null || value === undefined || value === "") {
      return "-";
    }
    return String(value);
  };

  const formatCost = (value?: number | null) =>
    value === null || value === undefined ? "-" : `${value}gc`;
  const formatXp = (value?: number | null) =>
    value === null || value === undefined ? "-" : `${value}xp`;

  const statValueMap = {
    M: hero.movement,
    WS: hero.weapon_skill,
    BS: hero.ballistic_skill,
    S: hero.strength,
    T: hero.toughness,
    W: hero.wounds,
    I: hero.initiative,
    A: hero.attacks,
    Ld: hero.leadership,
    AS: hero.armour_save,
  };

  const listBlockLimit = 6;
  const normalizeEntries = <T,>(
    entries: T[],
    getLabel: (entry: T) => string,
    getKey: (entry: T, index: number) => string
  ) => {
    const mapped = entries.map((entry, index) => ({
      id: getKey(entry, index),
      label: getLabel(entry),
    }));
    if (!isMobile) {
      return { visible: mapped, hiddenCount: 0 };
    }
    const visible = mapped.slice(0, listBlockLimit);
    return { visible, hiddenCount: Math.max(0, mapped.length - visible.length) };
  };

  const itemBlock = useMemo(
    () =>
      normalizeEntries(
        hero.items ?? [],
        (item) => item.name,
        (item, index) => `${item.id}-${index}`
      ),
    [hero.items, isMobile]
  );

  const skillBlock = useMemo(
    () =>
      normalizeEntries(
        hero.skills ?? [],
        (skill) => skill.name,
        (skill) => String(skill.id)
      ),
    [hero.skills, isMobile]
  );

  const spellBlock = useMemo(
    () =>
      normalizeEntries(
        hero.spells ?? [],
        (spell) => spell.name,
        (spell) => String(spell.id)
      ),
    [hero.spells, isMobile]
  );

  const otherBlock = useMemo(
    () =>
      normalizeEntries(
        hero.other ?? [],
        (entry) => entry.name,
        (entry) => String(entry.id)
      ),
    [hero.other, isMobile]
  );

  const blocks = [
    { id: "items", entries: itemBlock },
    { id: "skills", entries: skillBlock },
    { id: "spells", entries: spellBlock },
    { id: "other", entries: otherBlock },
  ].filter((block) => block.entries.visible.length > 0);

  const levelUpReady = Boolean(hero.level_up);

  return (
    <div className="warband-hero-card">
      <div className="warband-hero-header">
        <div>
          <p className="warband-hero-name">{hero.name || "Untitled hero"}</p>
          {hero.race_name ? (
            <p className="warband-hero-race">{hero.race_name}</p>
          ) : null}
        </div>
        {levelUpReady ? <span className="warband-hero-level">Level up!</span> : null}
      </div>

      <div className="warband-hero-meta-grid">
        <div className="warband-hero-meta-block">
          <p className="warband-hero-meta-label">Type</p>
          <p className="warband-hero-meta-value">{hero.unit_type || "-"}</p>
        </div>
        <div className="warband-hero-meta-block">
          <p className="warband-hero-meta-label">Total cost</p>
          <p className="warband-hero-meta-value">{formatCost(hero.price)}</p>
        </div>
        <div className="warband-hero-meta-block">
          <p className="warband-hero-meta-label">Exp total</p>
          <p className="warband-hero-meta-value">{formatXp(hero.xp)}</p>
        </div>
      </div>

      <div className="warband-hero-stats-wrapper">
        <table className="warband-hero-stats-table">
          <thead>
            <tr>
              {statFields.map((stat) => (
                <th key={stat}>{stat}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {statFields.map((stat) => (
                <td key={stat}>{formatValue(statValueMap[stat])}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {blocks.length > 0 ? (
        <div className="warband-hero-blocks">
          {blocks.map((block) => (
            <div
              key={block.id}
              className={[
                "warband-hero-block",
                isMobile ? "warband-hero-block--mobile" : "warband-hero-block--scroll",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="warband-hero-block-grid">
                {block.entries.visible.map((entry) => (
                  <div key={entry.id} className="warband-hero-block-item">
                    {entry.label}
                  </div>
                ))}
              </div>
              {block.entries.hiddenCount > 0 ? (
                <div className="warband-hero-block-more">
                  +{block.entries.hiddenCount}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}




