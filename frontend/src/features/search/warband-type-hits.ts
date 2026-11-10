import { inPlayOnly } from "@/features/reference/in-play";
import { groupIndex, unitGroups } from "@/features/skills/skill-groups";
import type { Skill, SkillGroup } from "@/features/skills/types/skill-types";
import type { TemplateTypeRow } from "@/features/warband-templates/template-view";

import { nameScore, type SearchHit, type SearchSnippet } from "./search-ranking";

/** A name a warband type is found by besides its own: what it is there, and whose. */
type Held = { label: string; name: string; also?: string; of?: string };

/**
 * What a type's row on the Warbands page holds by name: its template's fighters (a group by its
 * plural, found by its singular too), the warband rules for every type or this one, each
 * fighter's rules and the skills he starts with, the warband's special skills (the skills of the
 * groups its fighters learn from that aren't for everyone) and the upgrades.
 */
function heldBy(row: TemplateTypeRow, specialSkills: (groups: string[]) => string[]): Held[] {
  const contents = row.template?.contents;
  if (!contents) return [];
  const { fighters } = contents;
  return [
    ...fighters.map((fighter) =>
      fighter.kind === "hero"
        ? { label: "Hero", name: fighter.name }
        : { label: "Henchmen", name: fighter.plural || fighter.name, also: fighter.name }
    ),
    ...contents.rules
      .filter((rule) => rule.warband_type_id === null || rule.warband_type_id === row.typeId)
      .map((rule) => ({ label: "Warband rule", name: rule.title })),
    ...fighters.flatMap((fighter) => [
      ...fighter.rules.map((name) => ({ label: "Rule", name, of: fighter.name })),
      ...fighter.skills.map((name) => ({ label: "Starts with", name, of: fighter.name })),
    ]),
    ...specialSkills(fighters.flatMap((fighter) => fighter.skill_types)).map((name) => ({
      label: "Special skill",
      name,
    })),
    ...contents.upgrades.map((name) => ({ label: "Upgrade", name })),
  ];
}

/** "Hero: Senior Gunnery Officer", the match marked; whose it is after ("Rule: Fear (Zombie)"). */
function heldSnippet(held: Held, needle: string): SearchSnippet {
  const shown = held.name.toLowerCase().includes(needle) ? held.name : (held.also ?? held.name);
  const at = Math.max(0, shown.toLowerCase().indexOf(needle));
  return {
    before: `${held.label}: ${shown.slice(0, at)}`,
    match: shown.slice(at, at + needle.length),
    after: `${shown.slice(at + needle.length)}${held.of ? ` (${held.of})` : ""}`,
  };
}

const best = (scores: (number | null)[]) =>
  scores.reduce<number | null>(
    (low, score) => (score === null ? low : low === null ? score : Math.min(low, score)),
    null
  );

/**
 * Search everything's warband types: each row the Warbands page lists (a type in play and its
 * template) whose type or template name matches, first, then those whose template holds a
 * fighter, rule or skill of that name, shown as the hit's line ("Hero: Senior Gunnery Officer").
 * Each opens its row on the Warbands page.
 */
export function warbandTypeHits(
  rows: TemplateTypeRow[],
  needle: string,
  { skillGroups, skills }: { skillGroups: SkillGroup[]; skills: Skill[] }
): SearchHit[] {
  const index = groupIndex(inPlayOnly(skillGroups));
  const skillNames = new Map(skills.map((skill) => [skill.id, skill.name]));
  const specialSkills = (groups: string[]) => [
    ...new Set(
      unitGroups(index, groups)
        .filter((group) => !group.for_everyone)
        .flatMap((group) => group.skill_ids.flatMap((id) => skillNames.get(id) ?? []))
    ),
  ];
  return rows
    .map((row) => {
      const own = best([
        nameScore(row.typeName, needle),
        nameScore(row.template?.name ?? "", needle),
      ]);
      if (own !== null) return { row, score: own, snippet: null };
      let found: { held: Held; score: number } | null = null;
      for (const held of heldBy(row, specialSkills)) {
        const score = best([nameScore(held.name, needle), nameScore(held.also ?? "", needle)]);
        if (score !== null && (!found || score < found.score)) found = { held, score };
      }
      return found
        ? { row, score: 3 + found.score, snippet: heldSnippet(found.held, needle) }
        : null;
    })
    .filter((hit): hit is NonNullable<typeof hit> => hit !== null)
    .sort((a, b) => a.score - b.score || a.row.typeName.localeCompare(b.row.typeName))
    .map(({ row, snippet }) => ({
      key: `warband-type-${row.id}`,
      title: row.typeName,
      meta: row.sub ?? "",
      snippet,
      to: `warband-templates?open=${row.id}`,
    }));
}
