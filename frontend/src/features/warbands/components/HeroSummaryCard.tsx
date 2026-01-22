import type { WarbandHero } from "../types/warband-types";

type HeroSummaryCardProps = {
  hero: WarbandHero;
};

export default function HeroSummaryCard({ hero }: HeroSummaryCardProps) {
  const statFields = ["M", "WS", "BS", "S", "T", "W", "I", "A", "Ld"] as const;
  return (
    <div className="grid gap-4 rounded-2xl border border-rose-500/40 bg-slate-950/85 p-4 text-slate-100 shadow-lg shadow-rose-900/40 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        <div>
          <p className="text-lg font-semibold text-slate-100">
            {hero.name || "Untitled hero"}
          </p>
          <p className="text-xs uppercase tracking-[0.3em] text-rose-200">
            {hero.unit_type || "Unknown type"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-200">
          <span>{hero.race || "Unknown"}</span>
          <span className="text-rose-300/70">•</span>
          <span>XP {hero.experience ?? 0}</span>
          <span className="text-rose-300/70">•</span>
          <span>Hire {hero.hire_cost ?? 0}</span>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-rose-500/30 bg-slate-900/70 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-rose-200">
          Stats
        </p>
        <div className="grid grid-cols-9 gap-1">
          {statFields.map((stat) => (
            <div
              key={stat}
              className="rounded-md border border-rose-500/20 bg-slate-950/60 px-1 py-1 text-center"
            >
              <p className="text-[9px] uppercase text-rose-200">{stat}</p>
              <p className="text-xs font-semibold text-slate-100">
                {hero.stats?.[stat] ?? "-"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-rose-500/30 bg-slate-900/70 p-3">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-rose-200">
            Items
          </p>
          {hero.items.length === 0 ? (
            <p className="text-sm text-slate-300">No items equipped.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {hero.items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-rose-500/20 bg-slate-950/60 px-2 py-2"
                >
                  <p className="font-semibold text-slate-100">{item.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-rose-200">
                    {item.type}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-rose-200">
            Skills
          </p>
          {hero.skills.length === 0 ? (
            <p className="text-sm text-slate-300">No skills yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {hero.skills.map((skill) => (
                <div
                  key={skill.id}
                  className="rounded-md border border-rose-500/20 bg-slate-950/60 px-2 py-2"
                >
                  <p className="font-semibold text-slate-100">{skill.name}</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-rose-200">
                    {skill.type}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
