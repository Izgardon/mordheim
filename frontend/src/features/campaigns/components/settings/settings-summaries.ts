import type { CampaignSummary, Setting, SettingPreset } from "../../types/campaign-types";
import { presetOf, typesInScope, withAlwaysOn } from "./content-in-play";

/** "A", "A and B", "A, B and C". */
export function andList(words: string[]) {
  return words.length > 1
    ? `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`
    : words.join("");
}

const plural = (count: number, word: string) => `${count} ${count === 1 ? word : `${word}s`}`;

/** The campaign-wide switches, in the order the Features row lists them. */
export const FEATURES = [
  { key: "enable_encampments", label: "Encampments" },
  { key: "enable_locations", label: "Trade locations" },
  { key: "enable_campaign_points", label: "Plots and CP" },
  { key: "enable_blood_pacts", label: "Blood pacts" },
] as const;

/** "Encampments and Blood pacts on", "All on", "All off". */
export function featuresSummary(campaign: CampaignSummary) {
  const on = FEATURES.filter((feature) => campaign[feature.key]).map((feature) => feature.label);
  if (on.length === FEATURES.length) return "All on";
  return on.length ? `${andList(on)} on` : "All off";
}

/** "500 gc to start · Up to 6 heroes and 3 hired swords · D66 death roll". */
export function warbandsSummary(campaign: CampaignSummary) {
  const heroes = campaign.max_heroes ?? 6;
  return [
    `${campaign.starting_gold ?? 500} gc to start`,
    `Up to ${heroes} ${heroes === 1 ? "hero" : "heroes"} and ${plural(campaign.max_hired_swords ?? 3, "hired sword")}`,
    `${(campaign.hero_death_roll ?? "d66").toUpperCase()} death roll`,
  ].join(" · ");
}

/** "21 levels for heroes, 4 for henchmen, 4 for hired swords", from the tables as saved. */
export function levelUpsSummary(hero: number[], henchmen: number[], hiredSword: number[]) {
  return `${plural(hero.length, "level")} for heroes, ${henchmen.length} for henchmen, ${hiredSword.length} for hired swords`;
}

/** "Up to 1c · 9 of 21 settings · 73 warband types", or "Adjusted by hand · ..." off a grade. */
export function contentSummary(ids: number[], settings: Setting[], presets: SettingPreset[]) {
  const grade = presetOf(ids, presets, settings);
  const label = presets.find((preset) => preset.grade === grade)?.label ?? "Adjusted by hand";
  const ticked = settings.filter((setting) => withAlwaysOn(ids, settings).includes(setting.id));
  return [
    label,
    `${ticked.length} of ${plural(settings.length, "setting")}`,
    plural(typesInScope(ids, settings), "warband type"),
  ].join(" · ");
}
