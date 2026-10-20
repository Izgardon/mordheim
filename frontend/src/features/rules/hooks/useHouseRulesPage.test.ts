import { describe, expect, it } from "vitest";

import { itemEffectSignature } from "./useHouseRulesPage";

import type { HouseRule } from "../types/rule-types";

const rule = (id: number, effect_key: string | null): HouseRule => ({
  id,
  campaign_id: 1,
  title: `Rule ${id}`,
  description: "",
  effect_key,
  created_at: "2026-10-19T10:00:00Z",
  updated_at: "2026-10-19T10:00:00Z",
});

describe("itemEffectSignature", () => {
  it("names the item-pricing effects in play, once each and in order", () => {
    expect(
      itemEffectSignature([
        rule(1, "improved_shields"),
        rule(2, null),
        rule(3, "half_price_armour"),
        rule(4, "improved_shields"),
      ])
    ).toBe("half_price_armour|improved_shields");
  });

  it("ignores text-only rules and effects that don't touch item prices", () => {
    expect(itemEffectSignature([rule(1, null), rule(2, "two_weapon_fighting")])).toBe("");
  });

  it("is unchanged by a rule edit that keeps the effects (no item list re-read)", () => {
    const before = [rule(1, "half_price_armour"), rule(2, null)];
    const after = [{ ...rule(1, "half_price_armour"), title: "Cheap armour" }, rule(2, null)];
    expect(itemEffectSignature(after)).toBe(itemEffectSignature(before));
  });
});
