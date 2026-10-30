import type { BestiaryEntrySummary } from "@/features/bestiary/types/bestiary-types";
import { beastKindLabel } from "@/features/bestiary/bestiary-kinds";
import type { CampaignLocation } from "@/features/campaigns/types/campaign-types";
import { hirelingRace } from "@/features/hirelings/hireling-catalogue-kinds";
import type { HirelingProfile } from "@/features/hirelings/types/hireling-catalogue-types";
import { kindOf } from "@/features/items/store/store-items";
import type { Item } from "@/features/items/types/item-types";
import type { RuleEntry } from "@/features/rules/rules-index";
import { ruleSnippet } from "@/features/rules/rules-index";
import type { HouseRule } from "@/features/rules/types/rule-types";
import type { Skill } from "@/features/skills/types/skill-types";
import type { Spell } from "@/features/spells/types/spell-types";

import type { CampaignSearchAnswer } from "./api/search-api";

export type SearchSnippet = { before: string; match: string; after: string };

/** One result: what it is, a line about it, and the page (with its row open) it links to. */
export type SearchHit = {
  key: string;
  title: string;
  meta: string;
  snippet?: SearchSnippet | null;
  /** Below `/campaigns/:id/`. */
  to: string;
};

export type SearchGroup = { id: string; label: string; hits: SearchHit[] };

export type SearchSources = {
  items: Item[];
  skills: Skill[];
  spells: Spell[];
  beasts: BestiaryEntrySummary[];
  hiredSwords: HirelingProfile[];
  personae: HirelingProfile[];
  rules: RuleEntry[];
  houseRules: HouseRule[];
  locations: CampaignLocation[];
  campaign: CampaignSearchAnswer | undefined;
  /** Your warband: its links go to `warband` rather than `warbands/:id`. */
  myWarbandId: number | null;
};

/**
 * How well a name matches (lower is better): it starts with the search, a word in it does, it
 * holds it anywhere; or null.
 */
function nameScore(name: string, needle: string) {
  const text = name.toLowerCase();
  if (text.startsWith(needle)) return 0;
  if (text.includes(` ${needle}`) || text.includes(`(${needle}`)) return 1;
  if (text.includes(needle)) return 2;
  return null;
}

type Candidate<T> = { entry: T; name: string; text?: string | null };

/**
 * The entries whose name (best) or text matches, best first then by name, each with the words
 * around a match found only in its text.
 */
function ranked<T>(candidates: Candidate<T>[], needle: string) {
  return candidates
    .map((candidate) => {
      const byName = nameScore(candidate.name, needle);
      if (byName !== null) return { ...candidate, score: byName, snippet: null };
      const snippet = candidate.text ? ruleSnippet(candidate.text, needle, 50) : null;
      return snippet ? { ...candidate, score: 3, snippet } : null;
    })
    .filter((hit): hit is NonNullable<typeof hit> => hit !== null)
    .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
}

const words = (text?: string | null) => (text ?? "").replace(/\s+/g, " ").trim();

/**
 * Search everything: one search over the reference (items, skills, spells, beasts,
 * hired swords, dramatis personae), the rulebook's text and the house rules, and this campaign's
 * warbands, units and locations; grouped by kind, empty groups left out.
 */
export function searchEverything(query: string, sources: SearchSources): SearchGroup[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const warbandPath = (id: number) => (id === sources.myWarbandId ? "warband" : `warbands/${id}`);
  const groups: SearchGroup[] = [
    {
      id: "items",
      label: "Wargear",
      hits: ranked(
        sources.items.map((item) => ({
          entry: item,
          name: item.name,
          text: [item.description, ...(item.properties ?? []).map((rule) => rule.name)].join(" "),
        })),
        needle
      ).map(({ entry, snippet }) => ({
        key: `item-${entry.id}`,
        title: entry.name,
        meta: kindOf(entry),
        snippet,
        to: `items?open=${entry.id}`,
      })),
    },
    {
      id: "skills",
      label: "Skills",
      hits: ranked(
        sources.skills.map((skill) => ({
          entry: skill,
          name: skill.name,
          text: words(skill.description),
        })),
        needle
      ).map(({ entry, snippet }) => ({
        key: `skill-${entry.id}`,
        title: entry.name,
        meta: entry.type.replace(/_/g, " "),
        snippet,
        to: `skills?open=${entry.id}`,
      })),
    },
    {
      id: "spells",
      label: "Spells",
      hits: ranked(
        sources.spells.map((spell) => ({
          entry: spell,
          name: spell.name,
          text: words(spell.description),
        })),
        needle
      ).map(({ entry, snippet }) => ({
        key: `spell-${entry.id}`,
        title: entry.name,
        meta: (entry.type ?? "").replace(/_/g, " "),
        snippet,
        to: `spells?open=${entry.id}`,
      })),
    },
    {
      id: "bestiary",
      label: "Bestiary",
      hits: ranked(
        sources.beasts.map((beast) => ({
          entry: beast,
          name: beast.name,
          text: words(beast.description),
        })),
        needle
      ).map(({ entry, snippet }) => ({
        key: `beast-${entry.id}`,
        title: entry.name,
        meta: beastKindLabel(entry.kind),
        snippet,
        to: `bestiary?open=${entry.id}`,
      })),
    },
    ...(
      [
        ["hired-swords", "Hired swords", sources.hiredSwords],
        ["dramatis-personae", "Dramatis personae", sources.personae],
      ] as const
    ).map(([path, label, entries]) => ({
      id: path,
      label,
      hits: ranked(
        entries.map((entry) => ({ entry, name: entry.name, text: words(entry.description) })),
        needle
      ).map(({ entry, snippet }) => ({
        key: `${path}-${entry.id}`,
        title: entry.name,
        meta: hirelingRace(entry),
        snippet,
        to: `${path}?open=${entry.id}`,
      })),
    })),
    {
      id: "rules",
      label: "Rules",
      hits: ranked(
        sources.rules.map((entry) => ({ entry, name: entry.title, text: entry.text })),
        needle
      ).map(({ entry, snippet }) => ({
        key: `rule-${entry.id}`,
        title: entry.title,
        meta: entry.section,
        snippet: snippet ?? ruleSnippet(entry.text, needle, 50),
        to: `rules?open=${entry.id}&q=${encodeURIComponent(query.trim())}`,
      })),
    },
    {
      id: "house-rules",
      label: "House rules",
      hits: ranked(
        sources.houseRules.map((rule) => ({
          entry: rule,
          name: rule.title,
          text: words(rule.description),
        })),
        needle
      ).map(({ entry, snippet }) => ({
        key: `house-rule-${entry.id}`,
        title: entry.title,
        meta: "House rule",
        snippet,
        to: `house-rules?open=${entry.id}`,
      })),
    },
    {
      id: "warbands",
      label: "Warbands",
      hits: (sources.campaign?.warbands ?? []).map((warband) => ({
        key: `warband-${warband.id}`,
        title: warband.name,
        meta: warband.faction,
        to: warbandPath(warband.id),
      })),
    },
    {
      id: "units",
      label: "Units",
      hits: (sources.campaign?.units ?? []).map((unit) => ({
        key: `unit-${unit.kind}-${unit.id}`,
        title: unit.name?.trim() || unit.unit_type || "Unnamed",
        meta: [unit.name?.trim() ? unit.unit_type : "", unit.warband_name]
          .filter(Boolean)
          .join(" · "),
        to: `${warbandPath(unit.warband_id)}?unit=${unit.kind}-${unit.id}`,
      })),
    },
    {
      id: "locations",
      label: "Locations",
      hits: ranked(
        sources.locations.map((place) => ({
          entry: place,
          name: place.name,
          text: words(`${place.area} ${place.content}`),
        })),
        needle
      ).map(({ entry, snippet }) => ({
        key: `location-${entry.id}`,
        title: entry.name,
        meta: entry.area || "Location",
        snippet,
        to: `warband?panel=locations&place=${encodeURIComponent(entry.name)}`,
      })),
    },
  ];
  return groups.filter((group) => group.hits.length > 0);
}
