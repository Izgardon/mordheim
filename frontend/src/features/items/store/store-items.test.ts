import { describe, expect, it } from "vitest";

import type { Item, ItemAvailability } from "../types/item-types";
import { offerFor, priceLabel, storeCategory, variableDice } from "./store-items";

const restricted = (id: number, type: string, name: string) => ({
  restriction: { id, type, restriction: name },
  additional_note: "",
});
const availability = (patch: Partial<ItemAvailability>): ItemAvailability => ({
  id: 1,
  cost: 35,
  rarity: 7,
  restrictions: [],
  ...patch,
});
const item = (availabilities: ItemAvailability[]) =>
  ({ id: 9, name: "Fighting Claws", type: "Weapon", subtype: "Melee", availabilities }) as Item;

describe("the store's offer", () => {
  it("offers the commonest availability the warband may use, else the first with its warning", () => {
    const claws = item([
      availability({ id: 1, rarity: 7, restrictions: [restricted(5, "Warband", "Skaven")] }),
    ]);
    expect(offerFor(claws, { faction: "Skaven (Clan Eshin)" })).toMatchObject({ warning: "" });
    expect(offerFor(claws, { faction: "Reiklanders" }).warning).toBe("Skaven only");

    const both = item([
      availability({ id: 1, rarity: 9 }),
      availability({
        id: 2,
        rarity: 2,
        restrictions: [restricted(6, "Warband Group", "Non-Skaven")],
      }),
    ]);
    expect(offerFor(both, { faction: "Reiklanders" }).availability?.id).toBe(2);
    expect(offerFor(both, { faction: "Skaven" }).availability?.id).toBe(1);
  });

  it("reads a variable price's dice and sorts weapons into melee and missile", () => {
    expect(variableDice("+D6x10 gc")).toEqual({ count: 1, times: 10 });
    expect(variableDice("+2D6")).toEqual({ count: 2, times: 1 });
    expect(variableDice("3xPrice")).toBeNull();
    expect(priceLabel(availability({ cost: 100, variable_cost: "+(1D6x10)" }))).toBe(
      "100 + 1D6×10"
    );
    expect(storeCategory({ type: "Weapon", subtype: "Blackpowder" })).toBe("missile");
    expect(storeCategory({ type: "Miscellaneous", subtype: "" })).toBe("misc");
  });
});
