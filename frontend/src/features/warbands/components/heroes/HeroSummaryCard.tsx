// types
import type { WarbandHero } from "../../types/warband-types";

// components
import { MetaRow } from "@components/meta-row";

type HeroSummaryCardProps = {
  hero: WarbandHero;
  isExpanded: boolean;
  overlayClassName?: string;
  onToggle: () => void;
  onCollapse: () => void;
};

export default function HeroSummaryCard({
  hero,
  isExpanded,
  overlayClassName,
  onToggle,
  onCollapse,
}: HeroSummaryCardProps) {
  const statFields = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"] as const;
  const formatRarity = (value?: number | null) => {
    if (value === 2) {
      return "Common";
    }
    if (value === null || value === undefined) {
      return "—";
    }
    return String(value);
  };
  const formatCost = (value?: number | null) => {
    if (value === null || value === undefined) {
      return "—";
    }
    return String(value) + "gc";
  };
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
  };

  return (
    <div
      className={[
        "warband-hero-card",
        isExpanded ? "warband-hero-card--expanded" : "warband-hero-card--collapsed",
        isExpanded ? overlayClassName ?? "" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="button"
      tabIndex={0}
      onClick={isExpanded ? undefined : onToggle}
      onKeyDown={(event) => {
        if (!isExpanded && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onToggle();
        }
      }}
    >
      {isExpanded ? (
        <button
          type="button"
          className="warband-hero-close"
          onClick={(event) => {
            event.stopPropagation();
            onCollapse();
          }}
          aria-label="Collapse hero card"
        >
          x
        </button>
      ) : null}

      <div className="warband-hero-summary">
        <p className="warband-hero-title">{hero.name || "Untitled hero"}</p>
        <p className="warband-hero-subtitle">{hero.unit_type || "Unknown type"}</p>
        <p className="warband-hero-muted">{hero.race_name || "Unknown"}</p>
        <div className="warband-hero-meta">
          <p>XP {hero.xp ?? 0}</p>
          <p>Hire cost {hero.price ?? 0} gc</p>
        </div>
      </div>

      {isExpanded ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div className="warband-hero-section">
            <p className="warband-hero-section-title">Stats</p>
            <div className="warband-hero-stats">
              {statFields.map((stat) => (
                <div key={stat} className="warband-hero-stat-card">
                  <p className="warband-hero-stat-label">{stat}</p>
                  <p className="warband-hero-stat-value">{statValueMap[stat] ?? "-"}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="warband-hero-section">
            <p className="warband-hero-section-title">Items</p>
            <div className="warband-hero-section-body">
              {hero.items.length === 0 ? (
                <p className="warband-hero-muted">No items equipped.</p>
              ) : (
                <div className="warband-hero-pill-grid">
                  {hero.items.map((item, itemIndex) => (
                    <MetaRow
                      key={`${item.id}-${itemIndex}`}
                      label={item.name}
                      meta={formatCost(item.cost)}
                      metaClassName="text-xs text-muted-foreground"
                      tooltip={
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                            Item
                          </p>
                          <p className="text-sm font-semibold text-foreground">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Price: {formatCost(item.cost)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Rarity: {formatRarity(item.rarity)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Restricted: {item.unique_to || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.description || "No description yet."}
                          </p>
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="warband-hero-section">
            <p className="warband-hero-section-title">Skills</p>
            <div className="warband-hero-section-body">
              {hero.skills.length === 0 ? (
                <p className="warband-hero-muted">No skills yet.</p>
              ) : (
                <div className="warband-hero-pill-grid">
                  {hero.skills.map((skill) => (
                    <MetaRow
                      key={skill.id}
                      label={skill.name}
                      meta={skill.type || "Unknown"}
                      metaClassName="text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
                      tooltip={
                        <div className="space-y-1">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
                            Skill
                          </p>
                          <p className="text-sm font-semibold text-foreground">{skill.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Type: {skill.type || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {skill.description || "No description yet."}
                          </p>
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}




