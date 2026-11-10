import type { BestiaryEntrySummary } from "@/features/bestiary/types/bestiary-types";
import { beastKindLabel } from "@/features/bestiary/bestiary-kinds";
import type { CampaignLocation } from "@/features/campaigns/types/campaign-types";
import { hirelingRace } from "@/features/hirelings/hireling-catalogue-kinds";
import type { HirelingProfile } from "@/features/hirelings/types/hireling-catalogue-types";
import { kindOf } from "@/features/items/store/store-items";
import type { Item } from "@/features/items/types/item-types";
import type { RuleEntry } from "@/features/rules/rules-index";
import { ruleSnippet } from "@/features/rules/rules-index";
import type { CampaignRule, HouseRule } from "@/features/rules/types/rule-types";
import type { Skill, SkillGroup } from "@/features/skills/types/skill-types";
import type { Special } from "@/features/special/types/special-types";
import type { Spell } from "@/features/spells/types/spell-types";

import type { CampaignSearchAnswer } from "./api/search-api";
import { ranked, words, type SearchGroup } from "./search-ranking";

export type { SearchGroup, SearchHit, SearchSnippet } from "./search-ranking";

export type SearchSources = {
  items: Item[];
  skills: Skill[];
  /** The campaign's skill groups: a skill's hit names the groups holding it. */
  skillGroups: SkillGroup[];
  spells: Spell[];
  /** The Boons & Banes the reference lists (`referenceSpecials`). */
  specials: Special[];
  beasts: BestiaryEntrySummary[];
  hiredSwords: HirelingProfile[];
  personae: HirelingProfile[];
  rules: RuleEntry[];
  houseRules: HouseRule[];
  campaignRules: CampaignRule[];
  locations: CampaignLocation[];
  campaign: CampaignSearchAnswer | undefined;
  /** Your warband: its links go to `warband` rather than `warbands/:id`. */
  myWarbandId: number | null;
};

/**
 * Search everything: one search over the reference (items, skills, spells, Boons & Banes, beasts,
 * hired swords, dramatis personae), the rulebook's text, the house rules and the campaign rules,
 * and this campaign's warbands, units and locations; grouped by kind, empty groups left out.
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
          text: [
            item.flavour,
            ...(item.rules ?? []).map((rule) => rule.name),
            ...(item.tags ?? []),
          ].join(" "),
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
        meta: sources.skillGroups
          .filter((group) => group.skill_ids.includes(entry.id))
          .map((group) => group.name)
          .join(", "),
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
      id: "boons-banes",
      label: "Boons & Banes",
      hits: ranked(
        sources.specials.map((special) => ({
          entry: special,
          name: special.name,
          text: words(special.description),
        })),
        needle
      ).map(({ entry, snippet }) => ({
        key: `special-${entry.id}`,
        title: entry.name,
        meta: entry.type ?? "",
        snippet,
        to: `boons-banes?open=${entry.id}`,
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
      id: "campaign-rules",
      label: "Campaign rules",
      hits: ranked(
        sources.campaignRules.map((rule) => ({
          entry: rule,
          name: rule.title,
          text: words(rule.body),
        })),
        needle
      ).map(({ entry, snippet }) => ({
        key: `campaign-rule-${entry.id}`,
        title: entry.title,
        meta: "Campaign rule",
        snippet,
        to: `campaign-rules?open=${entry.id}`,
      })),
    },
    {
      id: "warbands",
      label: "Warbands",
      hits: (sources.campaign?.warbands ?? []).map((warband) => ({
        key: `warband-${warband.id}`,
        title: warband.name,
        meta: warband.type_name,
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
