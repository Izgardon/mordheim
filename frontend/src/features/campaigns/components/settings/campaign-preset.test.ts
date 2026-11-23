import { describe, expect, it } from "vitest";

import type { CampaignPreset } from "../../types/campaign-types";
import { defaultPreset, pageDepartures, presetPages, setsLine } from "./campaign-preset";

const preset = (changes: Partial<CampaignPreset> = {}): CampaignPreset => ({
  id: 2,
  slug: "mutiny-in-marienburg",
  name: "Mutiny in Marienburg",
  sort_order: 12,
  setting_ids: [9],
  setting_names: ["Mutiny in Marienburg"],
  sets: [
    {
      field: "enable_locations",
      label: "Trade locations",
      value: true,
      text: "on",
      departure: "Mutiny in Marienburg sets Trade locations: on.",
    },
    {
      field: "max_heroes",
      label: "Most heroes",
      value: 6,
      text: "6",
      departure: "Mutiny in Marienburg sets Most heroes: 6.",
    },
  ],
  rule_count: 18,
  chart_count: 0,
  ...changes,
});

const mordheim = preset({ id: 1, slug: "mordheim", name: "Mordheim", sets: [], rule_count: 0 });

describe("the campaign preset helpers", () => {
  it("starts a new campaign on Mordheim, else on the first the server lists", () => {
    expect(defaultPreset([preset(), mordheim])?.slug).toBe("mordheim");
    expect(defaultPreset([preset()])?.slug).toBe("mutiny-in-marienburg");
    expect(defaultPreset([])).toBeUndefined();
  });

  it("says what a preset sets on one line, and nothing for one that dictates nothing", () => {
    expect(setsLine(preset().sets)).toBe("Trade locations on · Most heroes 6");
    expect(setsLine(mordheim.sets)).toBe("");
  });

  it("reads the pages a preset switches, leaving out the ones it says nothing about", () => {
    expect(presetPages(preset())).toEqual({ enable_locations: true });
    expect(presetPages(mordheim)).toEqual({});
  });

  it("warns, in the server's words, for a page the player has departed from", () => {
    const pages = { enable_encampments: false, enable_locations: false };
    expect(pageDepartures(preset(), pages)).toEqual([
      "Mutiny in Marienburg sets Trade locations: on.",
    ]);
    expect(pageDepartures(preset(), { ...pages, enable_locations: true })).toEqual([]);
    expect(pageDepartures(mordheim, pages)).toEqual([]);
  });
});
