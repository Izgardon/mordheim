/**
 * An item's own rule carries its pre-battle roll through the item form (the coordinator, 5 Nov
 * 2026: items' own rules roll too): the form opens on it and a save sends it back, so editing the
 * item keeps it; a shared rule's roll is the shared rule's, and its link sends none.
 */
import { describe, expect, it } from "vitest";

import { item } from "@/test/catalogue-fixtures";

import { blankRule, itemPayload, itemValuesOf } from "./item-form-values";

const JESTER = "At the beginning of the battle roll a D6.";

const mask = item({
  name: "Evil Jester Mask",
  rules: [
    {
      id: 1,
      rule_id: null,
      shared: false,
      name: "Evil Jester Mask",
      summary: "",
      text: JESTER,
      table: [],
      prebattle_roll: "D6",
      prebattle_text: JESTER,
    },
    {
      id: 2,
      rule_id: 7,
      shared: true,
      name: "Cursed",
      summary: "",
      text: "Cursed.",
      table: [],
      prebattle_roll: "2D6",
      prebattle_text: "The shared rule's.",
    },
  ],
});

describe("An item's own rule's pre-battle roll", () => {
  it("opens with the item and goes back with a save; a shared rule's link sends none", () => {
    const values = itemValuesOf(mask);
    expect(values.rules.map((rule) => [rule.prebattleRoll, rule.prebattleText])).toEqual([
      ["D6", JESTER],
      ["", ""],
    ]);
    const sent = itemPayload(values).rules ?? [];
    expect(sent.map((rule) => [rule.prebattle_roll, rule.prebattle_text])).toEqual([
      ["D6", JESTER],
      ["", ""],
    ]);
  });

  it("is none on a new rule", () => {
    expect(blankRule()).toMatchObject({ prebattleRoll: "", prebattleText: "" });
  });
});
