/**
 * What a weapon made of a material costs (weapon materials): the store shows the server's own
 * price for the row, and only a row with dice (whose price isn't known until they are rolled)
 * applies the material's stated shape to the rolled price, as `rolledPrice` applies the row's dice.
 */
import { describe, expect, it } from "vitest";

import { makeItem } from "@/test/warband-fixtures";

import type { ItemAvailability, WeaponMaterial } from "../types/item-types";
import { materialPrice } from "./item-prices";

const row = (change: Partial<ItemAvailability> = {}): ItemAvailability => ({
  id: 7,
  label: "",
  cost: 25,
  dice: null,
  dice_multiplier: null,
  cost_note: "",
  rarity: null,
  for_everyone: true,
  warbands: [],
  note: "",
  ...change,
});
const material = (change: Partial<WeaponMaterial>): WeaponMaterial => ({
  slug: "gromril",
  name: "Gromril",
  rarity: 11,
  price_note: "4 x Price",
  multiplier: 4,
  addition: null,
  on_owned: null,
  rules: [],
  can_take: true,
  reason: "",
  ...change,
});
const weapon = makeItem({ material_prices: { "7": { gromril: 100, silver: 85 } } });

describe("materialPrice", () => {
  it("is the row's own price for a plain copy", () => {
    expect(materialPrice(weapon, row(), null)).toBe(25);
  });

  it("is the server's price for the row, whatever the material's shape says", () => {
    // the server sent 100 for gromril and 85 for silver: neither is worked out here
    expect(materialPrice(weapon, row(), material({}))).toBe(100);
    expect(
      materialPrice(weapon, row(), material({ slug: "silver", multiplier: null, addition: 60 }))
    ).toBe(85);
  });

  it("applies the material to a rolled price, which the server has no figure for", () => {
    const dice = row({ cost: 25, dice: 2 });

    expect(materialPrice(weapon, dice, material({}), 7)).toBe(128); // (25 + 7) x 4
    expect(
      materialPrice(weapon, dice, material({ slug: "silver", multiplier: null, addition: 60 }), 7)
    ).toBe(92); // 25 + 7 + 60
  });

  it("falls back to the material's shape for a row the server sent no price for", () => {
    expect(materialPrice(makeItem({}), row({ id: 9 }), material({}))).toBe(100);
  });
});
