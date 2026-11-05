import type { Setting } from "@/features/campaigns/types/campaign-types";
import { ALL_SETTINGS, entrySettingKey, settingKeyOptions } from "@/features/reference/in-play";
import { matchesSearchQuery } from "@/lib/matches-search-query";

import type { Skill, SkillGroup } from "./types/skill-types";

/** A Skills page row: a skill group (or the skills in none), with the skills it shows. */
export type SkillGroupRow = {
  /** The row's key in the page (`group-12`, `group-none`), apart from the skills' ids. */
  key: string;
  /** Null: the skills no group holds. */
  group: SkillGroup | null;
  name: string;
  /** Its skills by name: all, or while searching or filtering the matches (the open one stays). */
  skills: Skill[];
  matches: number;
  total: number;
};

export const NO_GROUP_KEY = "group-none";
export const groupRowKey = (group: SkillGroup) => `group-${group.id}`;

type SkillGroupFilters = {
  query: string;
  setting: string;
  settings: Map<number, Setting>;
  /** The skill a link opened (`?open=`): it stays in its groups whatever the filters. */
  openId: string | null;
};

const byName = (a: Skill, b: Skill) => a.name.localeCompare(b.name);

/**
 * The Skills page (William, 5 Nov 2026: "grouped in their skill group just like the spells page"):
 * a row per skill group in the server's order (the core five, then by name), each with its skills
 * in play by name, a skill in several groups under each, then the skills in no group. A search
 * (name, group or rules) or a setting keeps the groups with a match, each with only its matches;
 * with neither, every group shows, an empty one too.
 */
export function skillGroupRows(
  groups: SkillGroup[],
  skills: Skill[],
  { query, setting, settings, openId }: SkillGroupFilters
): SkillGroupRow[] {
  const byId = new Map(skills.map((skill) => [skill.id, skill]));
  const grouped = new Set(groups.flatMap((group) => group.skill_ids));
  const filtering = Boolean(query.trim()) || setting !== ALL_SETTINGS;
  const row = (key: string, group: SkillGroup | null, name: string, held: Skill[]) => {
    const sorted = [...held].sort(byName);
    const matching = sorted.filter(
      (skill) =>
        (setting === ALL_SETTINGS || entrySettingKey(skill, settings) === setting) &&
        matchesSearchQuery(query, skill.name, name, skill.description)
    );
    return {
      key,
      group,
      name,
      skills: sorted.filter((skill) => matching.includes(skill) || String(skill.id) === openId),
      matches: matching.length,
      total: sorted.length,
    };
  };
  const rows = groups.map((group) =>
    row(
      groupRowKey(group),
      group,
      group.name,
      group.skill_ids.flatMap((id) => byId.get(id) ?? [])
    )
  );
  const loose = skills.filter((skill) => !grouped.has(skill.id));
  if (loose.length) rows.push(row(NO_GROUP_KEY, null, "No group", loose));
  return rows.filter((entry) => entry.skills.length > 0 || (!filtering && entry.group));
}

/** The Setting filter's options for the skills in play. */
export const skillSettingOptions = (skills: Skill[], settings: Map<number, Setting>) =>
  settingKeyOptions(
    skills.map((skill) => entrySettingKey(skill, settings)),
    settings
  );

/**
 * The row a skill opens in: the group a link or a click named while it still holds the skill,
 * else its first group, else No group.
 */
export function openRowOf(rows: SkillGroupRow[], skillId: string, named: string | null) {
  const holding = rows.filter((entry) =>
    entry.skills.some((skill) => String(skill.id) === skillId)
  );
  return (holding.find((entry) => entry.key === named) ?? holding[0])?.key ?? null;
}
