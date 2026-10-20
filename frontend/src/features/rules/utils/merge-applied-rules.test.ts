import { describe, expect, it } from "vitest";

import { mergeAppliedRules } from "./merge-applied-rules";

import type { HouseRule } from "../types/rule-types";

const rule = (id: number, title: string): HouseRule => ({
  id,
  campaign_id: 1,
  title,
  description: "",
  effect_key: null,
  created_at: "2026-10-19T10:00:00Z",
  updated_at: "2026-10-19T10:00:00Z",
});

describe("mergeAppliedRules", () => {
  it("puts new rules first and replaces one the server already had where it is (BUG-52)", () => {
    const rules = [rule(1, "Parry"), rule(2, "Cheap armour")];

    expect(mergeAppliedRules(rules, [rule(3, "Miscasts"), rule(2, "Half Price Armour")])).toEqual([
      rule(3, "Miscasts"),
      rule(1, "Parry"),
      rule(2, "Half Price Armour"),
    ]);
  });

  it("leaves the list as it is when nothing was applied", () => {
    const rules = [rule(1, "Parry")];

    expect(mergeAppliedRules(rules, [])).toEqual(rules);
  });
});
