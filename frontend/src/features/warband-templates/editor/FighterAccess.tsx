import { useMemo } from "react";

import { Chip } from "@/components/ui/chip";
import { SearchMultiSelect, type SearchOption } from "@/components/ui/search-select";
import { CORE_GROUPS, useSkillGroups } from "@/features/skills/skill-groups";
import { useCatalogue } from "@/lib/catalogue-queries";

import type { TemplateSpellType } from "../types/template-types";
import { spellLabel } from "../template-view";
import { CAPTION } from "./editor-ui";

const fold = (name: string) => name.trim().toLowerCase();

/** His skill groups: the core five as chips, then the others (a special list) picked by name. */
export function SkillTypesField({
  campaignId,
  value,
  onChange,
}: {
  campaignId: number;
  value: string[];
  onChange: (names: string[]) => void;
}) {
  const { groups } = useSkillGroups(campaignId);
  const has = (name: string) => value.some((held) => fold(held) === fold(name));
  const toggle = (name: string) =>
    onChange(has(name) ? value.filter((held) => fold(held) !== fold(name)) : [...value, name]);
  const others = value.filter((name) => !CORE_GROUPS.some((core) => fold(core) === fold(name)));
  const options: SearchOption[] = groups
    .filter((group) => !CORE_GROUPS.some((core) => fold(core) === fold(group.access_name)))
    .map((group) => ({
      id: group.access_name,
      title: group.name,
      subtitle: group.learn_note || undefined,
    }));
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className={CAPTION}>Skills</span>
      <div className="flex flex-wrap gap-1.5">
        {CORE_GROUPS.map((name) => (
          <Chip key={name} pressed={has(name)} onClick={() => toggle(name)}>
            {name}
          </Chip>
        ))}
      </div>
      <SearchMultiSelect
        values={others.map((name) => ({ id: name, title: name }))}
        options={options}
        addLabel="Special list"
        emptyText="No skill group by that name."
        onChange={(next) =>
          onChange([
            ...value.filter((name) => CORE_GROUPS.some((core) => fold(core) === fold(name))),
            ...next.map((option) => String(option.id)),
          ])
        }
      />
    </div>
  );
}

/** The skills he starts with (the Senior Gunnery Officer's Hunter): every hire of his has them. */
export function StartingSkillsField({
  campaignId,
  value,
  saved,
  onChange,
}: {
  campaignId: number;
  value: number[];
  /** The skills he was saved with, named while the campaign's skills load. */
  saved: { id: number; name: string }[];
  onChange: (ids: number[]) => void;
}) {
  const skills = useCatalogue("skills", campaignId).data;
  const names = new Map<number, string>(saved.map((skill) => [skill.id, skill.name]));
  skills.forEach((skill) => names.set(skill.id, skill.name));
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className={CAPTION}>Starts with</span>
      <SearchMultiSelect
        values={value.map((id) => ({ id, title: names.get(id) ?? "" }))}
        options={[...skills]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((skill) => ({ id: skill.id, title: skill.name }))}
        addLabel="Skill"
        placeholder="Search skills"
        emptyText="No skill by that name."
        onChange={(next) => onChange(next.map((option) => Number(option.id)))}
      />
    </div>
  );
}

/** The lores he casts from (each with its note, kept as it is: "with the Mark of Tchar"). */
export function SpellTypesField({
  campaignId,
  value,
  onChange,
}: {
  campaignId: number;
  value: TemplateSpellType[];
  onChange: (lores: TemplateSpellType[]) => void;
}) {
  const spells = useCatalogue("spells", campaignId);
  const lores = useMemo(
    () =>
      [...new Set(spells.data.map((spell) => spell.type))]
        .filter((type): type is string => Boolean(type))
        .sort(),
    [spells.data]
  );
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className={CAPTION}>Spell lores</span>
      <SearchMultiSelect
        values={value.map((lore) => ({
          id: spellLabel(lore),
          title: lore.name,
          subtitle: lore.note || undefined,
        }))}
        options={lores.map((name) => ({ id: name, title: name }))}
        addLabel="Lore"
        emptyText="No lore by that name."
        onChange={(next) =>
          onChange(
            next.map(
              (option) =>
                value.find((lore) => spellLabel(lore) === option.id) ?? {
                  name: option.title,
                  note: "",
                }
            )
          )
        }
      />
    </div>
  );
}
