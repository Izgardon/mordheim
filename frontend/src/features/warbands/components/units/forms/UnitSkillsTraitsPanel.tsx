import { useEffect, useMemo, type ReactNode } from "react";

import { Checkbox } from "@components/checkbox";
import TraitDropdown from "./TraitDropdown";
import { syncCasterSpecials, syncLargeSpecial } from "./trait-specials";
import { skillAbbrevToType, skillFields } from "../../../utils/warband-utils";

import type { Skill } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import type { HeroCaster } from "../../../types/warband-types";
import type { CasterUnitForm } from "./form-types";

const BASE_SKILL_TYPES = new Set(Object.values(skillAbbrevToType));

type UnitSkillsTraitsPanelProps<T extends CasterUnitForm> = {
  form: T;
  index: number;
  availableSkills: Skill[];
  availableSpecials: Special[];
  onUpdate: (index: number, updater: (form: T) => T) => void;
  /** Kind-specific trait toggles after Large and Caster (blood pact, leader, trading action). */
  extraTraits?: ReactNode;
};

const traitLabelClassName = "flex items-center gap-2 text-xs text-foreground";

/** Skill access (C Sh A St Sp + special lists) and traits, on hero and hired-sword cards. */
export default function UnitSkillsTraitsPanel<T extends CasterUnitForm>({
  form,
  index,
  availableSkills,
  availableSpecials,
  onUpdate,
  extraTraits,
}: UnitSkillsTraitsPanelProps<T>) {
  const skillTypeOptions = useMemo(() => {
    const unique = new Set(availableSkills.map((s) => s.type).filter(Boolean));
    return Array.from(unique)
      .filter((type) => !BASE_SKILL_TYPES.has(type))
      .sort((a, b) => a.localeCompare(b));
  }, [availableSkills]);

  // Full base type names ("Combat") belong under their abbreviations, not the special lists.
  useEffect(() => {
    let hasBaseType = false;
    for (const type of BASE_SKILL_TYPES) {
      if (form.available_skills[type]) {
        hasBaseType = true;
        break;
      }
    }
    if (!hasBaseType) return;
    onUpdate(index, (current) => {
      const next = { ...current.available_skills };
      let changed = false;
      for (const type of BASE_SKILL_TYPES) {
        if (next[type]) {
          delete next[type];
          changed = true;
        }
      }
      return changed ? { ...current, available_skills: next } : current;
    });
  }, [index, onUpdate, form.available_skills]);

  const setSkill = (key: string, enabled: boolean) =>
    onUpdate(index, (current) => ({
      ...current,
      available_skills: { ...current.available_skills, [key]: enabled },
    }));
  const setCaster = (caster: HeroCaster) =>
    onUpdate(index, (current) => ({
      ...current,
      caster,
      specials: syncCasterSpecials(current.specials, caster, availableSpecials),
    }));

  return (
    <div className="grid gap-4 rounded-xl border border-border/60 bg-background/50 p-3 sm:grid-cols-[3fr_2fr]">
      <div className="flex flex-col justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Available skills
        </p>
        <div className="flex min-h-[28px] flex-wrap items-end gap-3">
          {skillFields
            .filter((f) => f.key !== "Spc")
            .map((field) => (
              <label
                key={field.key}
                className="flex flex-col items-center gap-1 text-xs text-foreground"
              >
                {field.label}
                <Checkbox
                  checked={form.available_skills[field.key]}
                  onChange={(event) => setSkill(field.key, event.target.checked)}
                />
              </label>
            ))}
          <label className="flex flex-col items-center gap-1 text-xs text-foreground">
            Spc
            <Checkbox
              checked={form.available_skills.Spc}
              onChange={(event) => {
                const checked = event.target.checked;
                onUpdate(index, (current) => {
                  const next: Record<string, boolean> = {
                    ...current.available_skills,
                    Spc: checked,
                  };
                  if (!checked) {
                    for (const t of skillTypeOptions) delete next[t];
                  }
                  return { ...current, available_skills: next };
                });
              }}
            />
          </label>
          {form.available_skills.Spc && (
            <TraitDropdown
              options={skillTypeOptions}
              selected={skillTypeOptions.filter((t) => form.available_skills[t])}
              onSelect={(type) =>
                onUpdate(index, (current) => ({
                  ...current,
                  available_skills: {
                    ...current.available_skills,
                    [type]: !current.available_skills[type],
                  },
                }))
              }
              multi
              searchable
              placeholder="Select types..."
            />
          )}
        </div>
      </div>
      <div className="flex flex-col justify-between border-t border-border/60 pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          Traits
        </p>
        <div className="flex min-h-[28px] flex-wrap items-center gap-3">
          <label className={traitLabelClassName}>
            <Checkbox
              checked={form.large}
              onChange={(event) => {
                const checked = event.target.checked;
                onUpdate(index, (current) => ({
                  ...current,
                  large: checked,
                  specials: syncLargeSpecial(current.specials, checked, availableSpecials),
                }));
              }}
            />
            Large
          </label>
          <label className={traitLabelClassName}>
            <Checkbox
              checked={form.caster !== "No"}
              onChange={(event) => setCaster(event.target.checked ? "Wizard" : "No")}
            />
            Caster
          </label>
          {form.caster !== "No" && (
            <TraitDropdown
              options={["Wizard", "Priest"]}
              selected={[form.caster]}
              onSelect={(value) => setCaster(value as HeroCaster)}
            />
          )}
          {extraTraits}
        </div>
      </div>
    </div>
  );
}

export function TraitToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className={traitLabelClassName}>
      <Checkbox checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}
