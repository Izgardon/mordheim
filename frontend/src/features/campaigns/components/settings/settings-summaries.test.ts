import { describe, expect, it } from "vitest";

import { campaignSummary } from "@/test/campaign-fixtures";

import type { Setting, SettingPreset } from "../../types/campaign-types";
import {
  andList,
  contentSummary,
  featuresSummary,
  levelUpsSummary,
  warbandsSummary,
} from "./settings-summaries";

const setting = (id: number, grade: string, types: number, always_on = false) =>
  ({ id, grade, warband_types: types, always_on, name: `S${id}` }) as unknown as Setting;
const SETTINGS = [setting(1, "1a", 10, true), setting(2, "1b", 5), setting(3, "2a", 3)];
const PRESETS: SettingPreset[] = [
  { grade: "1a", label: "Up to 1a", description: "", setting_ids: [1] },
  { grade: "1b", label: "Up to 1b", description: "", setting_ids: [1, 2] },
];

describe("the closed sections' summaries", () => {
  it("joins words as a sentence does", () => {
    expect(andList([])).toBe("");
    expect(andList(["A"])).toBe("A");
    expect(andList(["A", "B", "C"])).toBe("A, B and C");
  });

  it("says which features are on", () => {
    const off = campaignSummary({
      enable_encampments: false,
      enable_locations: false,
      enable_campaign_points: false,
      enable_blood_pacts: false,
    });
    expect(featuresSummary(off)).toBe("All off");
    expect(featuresSummary({ ...off, enable_encampments: true, enable_blood_pacts: true })).toBe(
      "Encampments and Blood pacts on"
    );
    expect(
      featuresSummary({
        ...off,
        enable_encampments: true,
        enable_locations: true,
        enable_campaign_points: true,
        enable_blood_pacts: true,
      })
    ).toBe("All on");
  });

  it("gives the warbands' gold, limits and death roll", () => {
    const campaign = campaignSummary({
      starting_gold: 600,
      max_heroes: 1,
      max_hired_swords: 2,
      hero_death_roll: "d100",
    });
    expect(warbandsSummary(campaign)).toBe(
      "600 gc to start · Up to 1 hero and 2 hired swords · D100 death roll"
    );
  });

  it("counts the level-up tables", () => {
    expect(levelUpsSummary([2, 4], [2, 5, 9, 14], [3])).toBe(
      "2 levels for heroes, 4 for henchmen, 1 for hired swords"
    );
  });

  it("names the grade preset the content is, or says it was adjusted", () => {
    expect(contentSummary([2], SETTINGS, PRESETS)).toBe(
      "Up to 1b · 2 of 3 settings · 15 warband types"
    );
    expect(contentSummary([3], SETTINGS, PRESETS)).toBe(
      "Adjusted by hand · 2 of 3 settings · 13 warband types"
    );
  });
});
