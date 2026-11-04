import { createElement } from "react";

import { SkillListIcon, SpecialKindIcon } from "@/components/ui/game-icons";
import type { SearchOption } from "@/components/ui/search-select";
import { outOfPlay } from "@/features/campaigns/api/settings-queries";
import type { Setting } from "@/features/campaigns/types/campaign-types";
import type { Race } from "@/features/races/types/race-types";
import { cameThrough, type SkillGroupIndex } from "@/features/skills/skill-groups";
import { largeWarning, learningNotes } from "@/features/skills/skill-learning";
import { skillList } from "@/features/skills/skill-list";
import type { Skill, SkillGroup } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import type { Spell } from "@/features/spells/types/spell-types";

/**
 * The searchable select's rows for the catalogue (William: "titles and subtitles with skill
 * category, spell school as subtitles"): a skill's group, a spell's lore and difficulty, a
 * special's type, a race's maximums. Skills carry their group's icon and specials their kind's
 * (Boons & Banes); spells none. Rows outside the campaign or the unit's skill groups carry a
 * warning and stay pickable.
 */

type Settings = Map<number, Setting>;

/** A skill outside the unit's skill groups: a warning, never a block. */
export const OUTSIDE_ACCESS = "Not in his skill groups";

export type SkillContext = {
  settings: Settings;
  /** The campaign's skill groups (`useSkillGroups`). */
  groups: SkillGroupIndex;
  /** The unit is Large: a skill through a Large unit's group warns for any other. */
  large?: boolean | null;
  /** The groups the unit may pick from (`unitGroups`; empty: any). */
  access?: SkillGroup[];
  /** The warband's special skills (who-can), listed first. */
  specials?: Set<number>;
};

const joined = (...parts: (string | null | undefined | false)[]) =>
  parts.filter(Boolean).join(" · ");

/** A skill's row: the group it comes through for the unit (`cameThrough`), with that group's notes. */
export function skillOption(skill: Skill, context: SkillContext): SearchOption {
  const special = Boolean(context.specials?.has(skill.id));
  const access = context.access ?? [];
  const via = cameThrough(context.groups, skill.id, access);
  const inAccess = access.some((group) => group.skill_ids.includes(skill.id));
  const outside = access.length && !special && !inAccess ? OUTSIDE_ACCESS : "";
  const notes = learningNotes(
    via && { ...via, large_only: Boolean(context.large && via.large_only) }
  );
  return {
    id: skill.id,
    title: skill.name,
    icon: createElement(SkillListIcon, {
      list: skillList(via?.access_name),
      className: "text-kind-skill",
    }),
    subtitle: joined(via?.name, ...notes),
    warning: outOfPlay(skill, context.settings) || largeWarning(via, context.large) || outside,
    group: special ? "Your warband's" : undefined,
  };
}

/** Skills: the warband's own first, then those with no warning, then the rest. */
export function skillOptions(skills: Skill[], context: SkillContext) {
  const rows = skills.map((skill) => skillOption(skill, context));
  const anySpecial = rows.some((row) => row.group);
  const rank = (row: SearchOption) => (row.group ? 0 : row.warning ? 2 : 1);
  return rows
    .map((row) => (anySpecial && !row.group ? { ...row, group: "Other skills" } : row))
    .sort((a, b) => rank(a) - rank(b));
}

export const spellOption = (spell: Spell, settings: Settings): SearchOption => ({
  id: spell.id,
  title: spell.name,
  subtitle: joined(
    spell.type,
    spell.dc !== null && spell.dc !== undefined && spell.dc !== "" && `Difficulty ${spell.dc}`
  ),
  warning: outOfPlay(spell, settings),
});

export const specialOption = (special: Special, settings: Settings): SearchOption => ({
  id: special.id,
  title: special.name,
  icon: createElement(SpecialKindIcon, { kind: special.kind, className: "text-kind-special" }),
  subtitle: special.type ?? undefined,
  warning: outOfPlay(special, settings),
});

const MAXIMUMS = [
  ["M", "movement"],
  ["WS", "weapon_skill"],
  ["BS", "ballistic_skill"],
  ["S", "strength"],
  ["T", "toughness"],
  ["W", "wounds"],
  ["I", "initiative"],
  ["A", "attacks"],
  ["Ld", "leadership"],
] as const;

/** "M4 WS6 BS6 S4 T4 W3 I6 A4 Ld9": a race's maximums. */
export const raceMaximums = (race: Race) =>
  MAXIMUMS.map(([key, field]) => `${key}${race[field]}`).join(" ");

export const raceOption = (race: Race, settings: Settings): SearchOption => ({
  id: race.id,
  title: race.name,
  subtitle: joined(raceMaximums(race), Boolean(race.campaign_id) && "This campaign"),
  warning: outOfPlay(race, settings),
});

/** Rows with no warning first, keeping their order otherwise (the greyed rows last). */
export const warnedLast = (rows: SearchOption[]) =>
  [...rows].sort((a, b) => Number(Boolean(a.warning)) - Number(Boolean(b.warning)));
