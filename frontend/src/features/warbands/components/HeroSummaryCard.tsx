// types
import type { WarbandHero } from "../types/warband-types";

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
        <p className="warband-hero-muted">{hero.race || "Unknown"}</p>
        <div className="warband-hero-meta">
          <p>XP {hero.experience ?? 0}</p>
          <p>Hire {hero.hire_cost ?? 0}</p>
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
                  <p className="warband-hero-stat-value">{hero.stats?.[stat] ?? "-"}</p>
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
                  {hero.items.map((item) => (
                    <div key={item.id} className="warband-hero-pill">
                      <p className="warband-hero-pill-title">{item.name}</p>
                      <p className="warband-hero-pill-subtitle">{item.type}</p>
                    </div>
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
                    <div key={skill.id} className="warband-hero-pill">
                      <p className="warband-hero-pill-title">{skill.name}</p>
                      <p className="warband-hero-pill-subtitle">{skill.type}</p>
                    </div>
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
