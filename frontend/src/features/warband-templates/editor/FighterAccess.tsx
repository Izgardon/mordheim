import { useMemo } from "react";

import { Chip } from "@/components/ui/chip";
import { SearchMultiSelect, type SearchOption } from "@/components/ui/search-select";
import { useSettingsById } from "@/features/campaigns/api/settings-queries";
import { spellOptions } from "@/features/catalogue/search-options";
import { CORE_GROUPS, useSkillGroups } from "@/features/skills/skill-groups";
import { useCatalogue } from "@/lib/catalogue-queries";

import type { Spell } from "@/features/spells/types/spell-types";

import type { TemplateSpellType } from "../types/template-types";
import { spellLabel } from "../template-view";
import { CAPTION } from "./editor-ui";

const fold = (name: string) => name.trim().toLowerCase();

/** A spell's row with its lore, and "Prayer" for a prayer list's (Funerary Rites says nothing). */
const marked = (option: SearchOption, spell: Spell | undefined): SearchOption =>
  spell?.is_prayer
    ? { ...option, subtitle: [option.subtitle, "Prayer"].filter(Boolean).join(" · ") }
    : option;

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

/**
 * The spells he starts with (the Black Dwarfs' Sorcerer's Sacrificial Ritual): every hire of his
 * has them, besides the first a caster picks. His lores' spells come first, each with its lore.
 */
export function StartingSpellsField({
  campaignId,
  lores,
  caster,
  picks,
  value,
  saved,
  onChange,
}: {
  campaignId: number;
  /** His caster ("No", "Wizard", "Priest") and how many random picks a hire gets (null: one). */
  caster: string;
  picks: number | null;
  /** The lores he casts from, offered first. */
  lores: string[];
  value: number[];
  /** The spells he was saved with, shown while the campaign's spells load. */
  saved: Spell[];
  onChange: (ids: number[]) => void;
}) {
  const spells = useCatalogue("spells", campaignId).data;
  const settings = useSettingsById();
  const known = new Map<number, Spell>(saved.map((spell) => [spell.id, spell]));
  spells.forEach((spell) => known.set(spell.id, spell));
  const sorted = [...spells].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className={CAPTION}>Starting spells</span>
      {caster !== "No" || picks ? (
        <p className="m-0 text-xs text-text2">{randomPicksLine(caster, picks ?? 1)}</p>
      ) : null}
      <SearchMultiSelect
        values={value.map((id) => {
          const spell = known.get(id);
          // a picked spell's chip names its lore alone, which a chip has room for
          const chip = { id, title: spell?.name ?? "", subtitle: spell?.type ?? undefined };
          return marked(chip, spell);
        })}
        options={spellOptions(sorted, settings, lores).map((option) =>
          marked(option, known.get(Number(option.id)))
        )}
        addLabel="Spell"
        placeholder="Search spells"
        emptyText="No spell by that name."
        onChange={(next) => onChange(next.map((option) => Number(option.id)))}
      />
    </div>
  );
}

/** What every hire of his gets besides his starting spells (William, 27 Nov 2026: "regardless"). */
export function randomPicksLine(caster: string, picks: number) {
  const noun = caster === "Priest" ? "prayer" : "spell";
  return picks === 1
    ? `Plus one random ${noun} at hire.`
    : `Plus ${picks} random ${noun}s at hire.`;
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
