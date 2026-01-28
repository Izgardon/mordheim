import type { HeroFormEntry } from "../../../types/warband-types";

type SkillField = {
  key: string;
  label: string;
};

type HeroAvailableSkillsProps = {
  hero: HeroFormEntry;
  index: number;
  skillFields: readonly SkillField[];
  onUpdate: (index: number, updater: (hero: HeroFormEntry) => HeroFormEntry) => void;
};

export default function HeroAvailableSkills({
  hero,
  index,
  skillFields,
  onUpdate,
}: HeroAvailableSkillsProps) {
  return (
    <div className="space-y-2 rounded-xl border border-border/60 bg-background/50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-accent">
        Available skills
      </p>
      <div className="flex flex-wrap gap-3">
        {skillFields.map((field) => (
          <label key={field.key} className="flex items-center gap-2 text-xs text-foreground">
            <input
              type="checkbox"
              checked={hero.available_skills[field.key]}
              onChange={(event) =>
                onUpdate(index, (current) => ({
                  ...current,
                  available_skills: {
                    ...current.available_skills,
                    [field.key]: event.target.checked,
                  },
                }))
              }
            />
            {field.label}
          </label>
        ))}
      </div>
    </div>
  );
}
