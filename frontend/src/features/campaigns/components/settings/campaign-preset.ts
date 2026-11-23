import type { CampaignPreset, CampaignPresetSet } from "../../types/campaign-types";

/** The published campaign a new one starts on (William, 17 Nov 2026: "campaign preset is just mordheim"). */
export const DEFAULT_PRESET_SLUG = "mordheim";

/** The preset a new campaign starts on: Mordheim, else the first the server lists. */
export function defaultPreset(presets: CampaignPreset[] | undefined) {
  return (presets ?? []).find((preset) => preset.slug === DEFAULT_PRESET_SLUG) ?? presets?.[0];
}

/** What a preset dictates, on one line: "Trade locations on · Most heroes 6" ("" when it dictates nothing). */
export function setsLine(sets: CampaignPresetSet[]) {
  return sets.map((entry) => `${entry.label} ${entry.text}`).join(" · ");
}

/** A page the creation dialog's chips switch. */
export type PresetPageField = "enable_encampments" | "enable_locations";

/** The pages a preset switches on or off, for the creation dialog's chips (left out: it says nothing). */
export function presetPages(preset: CampaignPreset | undefined) {
  const pages: Partial<Record<PresetPageField, boolean>> = {};
  for (const entry of preset?.sets ?? []) {
    if (entry.field === "enable_encampments" || entry.field === "enable_locations") {
      pages[entry.field] = Boolean(entry.value);
    }
  }
  return pages;
}

/**
 * The server's warning for each page the chips now disagree with the preset about ("Mutiny in
 * Marienburg sets Trade locations: on."). Greyed but clickable: departing warns, it never blocks.
 */
export function pageDepartures(
  preset: CampaignPreset | undefined,
  pages: Record<PresetPageField, boolean>
) {
  return (preset?.sets ?? [])
    .filter(
      (entry) =>
        (entry.field === "enable_encampments" || entry.field === "enable_locations") &&
        Boolean(entry.value) !== pages[entry.field]
    )
    .map((entry) => entry.departure);
}
