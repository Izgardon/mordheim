/**
 * The Skills page's rows (William, 5 Nov 2026: "grouped in their skill group just like the spells
 * page"): a row per group with its skills by name, a skill in several groups under each, the
 * skills in no group last; a search or a setting keeps the groups with a match.
 */
import { describe, expect, it } from "vitest";

import { settingsById } from "@/features/campaigns/api/settings-queries";
import type { Setting } from "@/features/campaigns/types/campaign-types";
import { skill, skillGroup } from "@/test/catalogue-fixtures";

import { openRowOf, skillGroupRows, skillSettingOptions } from "./skill-group-rows";

const setting = (id: number, slug: string, name: string): Setting => ({
  id,
  slug,
  name,
  grade: "1a",
  grade_label: "Official",
  sort_order: id,
  always_on: id === 1,
  warband_types: 0,
});
const settings = settingsById([
  setting(1, "mordheim", "Mordheim 1a"),
  setting(2, "mordheim-1b", "Mordheim 1b"),
  setting(5, "empire-in-flames", "Empire in Flames"),
]);

const web = skill({
  id: 2,
  name: "Web of Steel",
  description: "+1 to critical hits.",
  setting_id: 1,
});
const strike = skill({ id: 1, name: "Strike to Injure", setting_id: 2 });
const leap = skill({ id: 3, name: "Leap", description: 'Leaps D6".', setting_id: null });
const ride = skill({ id: 4, name: "Ride", setting_id: 5 });
const lone = skill({ id: 7, name: "Lone Wolf", campaign_id: 9 }); // the campaign's own, in no group
const combat = skillGroup({ id: 10, name: "Combat", skill_ids: [2, 1] });
const speed = skillGroup({ id: 11, name: "Speed", skill_ids: [3, 2, 99] }); // 99: not in play
const empty = skillGroup({ id: 12, name: "Riders", skill_ids: [] });
const groups = [combat, speed, empty];
const skills = [web, strike, leap, ride, lone];

const rowsOf = (query = "", chosen = "all", openId: string | null = null) =>
  skillGroupRows(groups, skills, { query, setting: chosen, settings, openId }).map((row) => [
    row.name,
    row.skills.map((entry) => entry.name),
    `${row.matches}/${row.total}`,
  ]);

describe("the Skills page's rows", () => {
  it("are the groups in order, each with its skills by name, then the skills in no group", () => {
    expect(rowsOf()).toEqual([
      ["Combat", ["Strike to Injure", "Web of Steel"], "2/2"],
      ["Speed", ["Leap", "Web of Steel"], "2/2"],
      ["Riders", [], "0/0"],
      ["No group", ["Lone Wolf", "Ride"], "2/2"],
    ]);
  });

  it("keep, while searching, the groups with a match and only their matches", () => {
    expect(rowsOf("critical")).toEqual([
      ["Combat", ["Web of Steel"], "1/2"],
      ["Speed", ["Web of Steel"], "1/2"],
    ]);
    // a group's name matches all of its skills
    expect(rowsOf("speed")).toEqual([["Speed", ["Leap", "Web of Steel"], "2/2"]]);
    // the skill a link opened stays
    expect(rowsOf("leap", "all", "1")).toEqual([
      ["Combat", ["Strike to Injure"], "0/2"],
      ["Speed", ["Leap"], "1/2"],
    ]);
  });

  it("filter by setting, Mordheim's grades and its ungraded book skills as one", () => {
    expect(rowsOf("", "mordheim")).toEqual([
      ["Combat", ["Strike to Injure", "Web of Steel"], "2/2"],
      ["Speed", ["Leap", "Web of Steel"], "2/2"],
    ]);
    expect(rowsOf("", "5")).toEqual([["No group", ["Ride"], "1/2"]]);
    expect(rowsOf("", "own")).toEqual([["No group", ["Lone Wolf"], "1/2"]]);
    expect(skillSettingOptions(skills, settings).map((option) => option.label)).toEqual([
      "All settings",
      "Mordheim",
      "Empire in Flames",
      "This campaign",
    ]);
  });

  it("open a skill in the group named while it holds the skill, else in its first", () => {
    const rows = skillGroupRows(groups, skills, {
      query: "",
      setting: "all",
      settings,
      openId: "2",
    });

    expect(openRowOf(rows, "2", "group-11")).toBe("group-11");
    expect(openRowOf(rows, "2", "group-12")).toBe("group-10");
    expect(openRowOf(rows, "2", null)).toBe("group-10");
    expect(openRowOf(rows, "7", null)).toBe("group-none");
    expect(openRowOf(rows, "404", "group-11")).toBeNull();
  });
});
