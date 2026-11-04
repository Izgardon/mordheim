import { useMemo } from "react";

import { useCatalogue } from "@/lib/catalogue-queries";

import type { SkillGroup } from "./types/skill-types";

/** The five core groups, in the book's order: every list of groups starts with them. */
export const CORE_GROUPS = ["Combat", "Shooting", "Academic", "Strength", "Speed"];

const key = (name: string) => name.trim().toLowerCase();

/** One of the five core groups (a campaign's version of one by its book name). */
export const isCore = (group: SkillGroup) =>
  CORE_GROUPS.some((name) => key(name) === key(group.access_name));

/**
 * The campaign's skill groups (in the server's order: the core five, then by name) and what the
 * pages look up in them: a group by id, the groups holding a skill, and a group by the name a
 * unit's skill access stores (`access_name`).
 */
export type SkillGroupIndex = {
  groups: SkillGroup[];
  byId: Map<number, SkillGroup>;
  bySkill: Map<number, SkillGroup[]>;
  byAccess: Map<string, SkillGroup>;
};

export function groupIndex(groups: SkillGroup[]): SkillGroupIndex {
  const bySkill = new Map<number, SkillGroup[]>();
  for (const group of groups) {
    for (const skillId of group.skill_ids)
      bySkill.set(skillId, [...(bySkill.get(skillId) ?? []), group]);
  }
  return {
    groups,
    byId: new Map(groups.map((group) => [group.id, group])),
    bySkill,
    byAccess: new Map(groups.map((group) => [key(group.access_name), group])),
  };
}

/** The groups holding a skill, in group order. */
export const groupsOf = (index: SkillGroupIndex, skillId: number) =>
  index.bySkill.get(skillId) ?? [];

/**
 * A unit's skill access (group names) as the campaign's groups, in his order: a book group's name
 * finds the campaign's version of it too. A name no group answers to is left out.
 */
export const unitGroups = (index: SkillGroupIndex, names: string[]) =>
  names
    .map((name) => index.byAccess.get(key(name)))
    .filter((group): group is SkillGroup => Boolean(group))
    .filter((group, at, all) => all.indexOf(group) === at);

/** The group a skill shows under for a unit: the first of his groups holding it, else its first. */
export function cameThrough(index: SkillGroupIndex, skillId: number, his: SkillGroup[] = []) {
  const holding = groupsOf(index, skillId);
  return his.find((group) => holding.includes(group)) ?? holding[0];
}

/** The campaign's skill groups, indexed (cached with the catalogue lists). */
export function useSkillGroups(campaignId: number | null | undefined) {
  const groups = useCatalogue("skill-groups", campaignId);
  const index = useMemo(() => groupIndex(groups.data), [groups.data]);
  return { ...index, isLoading: groups.isLoading, error: groups.error };
}
