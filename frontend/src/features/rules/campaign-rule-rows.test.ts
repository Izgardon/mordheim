import { describe, expect, it } from "vitest";

import {
  chartRowKey,
  chartRowSub,
  chartRows,
  ruleRowKey,
  ruleRowSub,
  ruleRowWords,
  ruleRows,
} from "./campaign-rule-rows";
import type { CampaignChart, CampaignRule } from "./types/rule-types";

const rule = (
  overrides: Partial<CampaignRule> & Pick<CampaignRule, "id" | "title">
): CampaignRule => ({
  campaign_id: 1,
  kind: "campaign",
  body: "",
  umbrella: "",
  order: 0,
  chart: null,
  ...overrides,
});

const chart = (
  overrides: Partial<CampaignChart> & Pick<CampaignChart, "id" | "title">
): CampaignChart => ({
  campaign_id: 1,
  description: "",
  dice: "D6",
  note: "",
  umbrella: "",
  order: 0,
  rows: [],
  ...overrides,
});

describe("the rows of the Campaign rules page", () => {
  it("keeps each list to its own kind", () => {
    const rules = [rule({ id: 1, title: "Points" }), rule({ id: 2, kind: "battle", title: "Fog" })];

    expect(ruleRows(rules, "campaign").map((row) => row.name)).toEqual(["Points"]);
    expect(ruleRows(rules, "battle").map((row) => row.name)).toEqual(["Fog"]);
  });

  it("makes the rules sharing an umbrella one row where the first of them sits", () => {
    const rules = [
      rule({ id: 1, title: "Fog", umbrella: "Weather" }),
      rule({ id: 2, title: "Curfew" }),
      rule({ id: 3, title: "Hail", umbrella: "weather" }), // the same umbrella, cased differently
    ];

    const rows = ruleRows(rules, "campaign");

    expect(rows.map((row) => [row.name, row.rules.length])).toEqual([
      ["Weather", 2],
      ["Curfew", 1],
    ]);
    expect(rows[0].rules.map((entry) => entry.title)).toEqual(["Fog", "Hail"]);
  });

  it("keys an umbrella by its name and a lone entry by its id, one list apart from another", () => {
    expect(ruleRowKey(rule({ id: 4, title: "Curfew" }))).toBe("r4");
    expect(ruleRowKey(rule({ id: 4, kind: "battle", title: "Fog" }))).toBe("b4");
    expect(ruleRowKey(rule({ id: 4, kind: "battle", title: "Fog", umbrella: " Weather " }))).toBe(
      "bu:weather"
    );
    expect(chartRowKey(chart({ id: 4, title: "Monsters" }))).toBe("c4");
    expect(chartRowKey(chart({ id: 4, title: "Monsters", umbrella: "Encounters" }))).toBe(
      "cu:encounters"
    );
  });

  it("gives a row the key the grouping gives it", () => {
    const rules = [rule({ id: 1, kind: "battle", title: "Fog", umbrella: "Weather" })];

    expect(ruleRows(rules, "battle")[0].key).toBe(ruleRowKey(rules[0]));
  });

  it("counts an umbrella's members and a lone chart's results", () => {
    const rules = [
      rule({ id: 1, title: "Fog", umbrella: "Weather" }),
      rule({ id: 2, title: "Hail", umbrella: "Weather" }),
      rule({ id: 3, title: "Curfew" }),
    ];
    const charts = [
      chart({
        id: 4,
        title: "Monsters",
        dice: "2D6",
        rows: [{ result: "2", name: "Squig", text: "" }],
      }),
      chart({ id: 5, title: "Locations", dice: "", rows: [] }),
    ];
    const [weather, curfew] = ruleRows(rules, "campaign");

    expect([ruleRowSub(weather), ruleRowSub(curfew)]).toEqual(["2 rules", ""]);
    expect(chartRows(charts).map(chartRowSub)).toEqual(["2D6 · 1 result", "0 results"]);
  });

  it("finds a row by its heading and by every rule's own words", () => {
    const rules = [
      rule({ id: 1, title: "Fog", body: "Visibility is 12 inches.", umbrella: "Weather" }),
    ];

    expect(ruleRowWords(ruleRows(rules, "campaign")[0])).toEqual([
      "Weather",
      "Fog",
      "Visibility is 12 inches.",
    ]);
  });
});
