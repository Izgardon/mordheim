import { describe, expect, it } from "vitest";

import type { Setting, SettingPreset } from "../../types/campaign-types";
import { presetOf, scopeLine, toggleSetting, typesInScope, withAlwaysOn } from "./content-in-play";

const setting = (
  id: number,
  name: string,
  grade: string,
  warband_types: number,
  always_on = false
): Setting => ({
  id,
  slug: name.toLowerCase(),
  name,
  grade,
  grade_label: "",
  sort_order: id,
  always_on,
  warband_types,
});

const mordheim = setting(1, "Mordheim", "1a", 13, true);
const lustria = setting(2, "Lustria", "1b", 12);
const sylvania = setting(3, "Sylvania", "2a", 5);
const SETTINGS = [mordheim, lustria, sylvania];
const PRESETS: SettingPreset[] = [
  { grade: "1a", label: "Up to 1a", description: "Official", setting_ids: [1] },
  { grade: "1b", label: "Up to 1b", description: "Unofficial", setting_ids: [1, 2] },
  { grade: "2a", label: "Up to 2a", description: "Reliable", setting_ids: [1, 2, 3] },
];

describe("content in play", () => {
  it("names the preset a selection is, and none once adjusted by hand", () => {
    expect(presetOf([2, 1], PRESETS, SETTINGS)).toBe("1b");
    expect(presetOf([2], PRESETS, SETTINGS)).toBe("1b"); // Mordheim is always in
    expect(presetOf([1, 3], PRESETS, SETTINGS)).toBeNull();
  });

  it("keeps Mordheim ticked and toggles the rest", () => {
    expect(toggleSetting([1, 2], mordheim)).toEqual([1, 2]);
    expect(toggleSetting([1, 2], lustria)).toEqual([1]);
    expect(toggleSetting([1], sylvania)).toEqual([1, 3]);
    expect(withAlwaysOn([3], SETTINGS)).toEqual([3, 1]);
  });

  it("counts the warband types the selection brings in", () => {
    expect(typesInScope([2], SETTINGS)).toBe(25);
    expect(scopeLine([1, 2, 3], SETTINGS)).toBe(
      "30 warband types in scope. The rest stay listed, greyed out."
    );
  });
});
