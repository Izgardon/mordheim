import { describe, expect, it } from "vitest";

import type { Item, ItemAvailability } from "../types/item-types";
import type { WarbandTypeBrief } from "@/features/warbands/types/warband-types";

import { allows, buyerOf, offerFor, priceLabel, storeCategory, variableDice } from "./store-items";

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

const kind = (name: string, groups: string[]): WarbandTypeBrief => ({
  id: name.length,
  name,
  slug: name.toLowerCase(),
  campaign_id: null,
  setting: null,
  source: "",
  link_url: "",
  groups,
});
const pestilens = buyerOf(
  { warband_type: kind("Skaven of Clan Pestilens", ["Skaven", "Evil"]), counts_as: [] },
  ["Mordheim"]
);
const reiklanders = buyerOf(
  { warband_type: kind("Reiklanders", ["Humans", "Mercenaries", "Good"]), counts_as: [] },
  ["Mordheim", "Khemri"]
);

describe("who may buy", () => {
  it("reads a warband's type, the types it counts as and their groups", () => {
    const warband = { id: 5, type: "Warband", restriction: "Marauders of Chaos" };
    expect(allows(warband, reiklanders)).toBe(false);
    const counting = buyerOf(
      {
        warband_type: kind("Reiklanders", ["Humans"]),
        counts_as: [kind("Marauders of Chaos", ["Chaos"])],
      },
      []
    );
    expect(allows(warband, counting)).toBe(true);
    expect(allows({ id: 6, type: "Warband Group", restriction: "Chaos Dwarfs" }, counting)).toBe(
      false
    );
    expect(allows({ id: 7, type: "Warband Group", restriction: "Chaos" }, counting)).toBe(true);
  });

  it("meets a setting restriction when its setting is in play, Nehekhara being Khemri", () => {
    const khemri = { id: 8, type: "Setting", restriction: "Khemri Setting" };
    const nehekhara = { id: 9, type: "Setting", restriction: "Nehekharan Setting" };
    expect([allows(khemri, reiklanders), allows(nehekhara, reiklanders)]).toEqual([true, true]);
    expect(allows(khemri, pestilens)).toBe(false);
    expect(allows({ id: 10, type: "Setting", restriction: "Cathay Setting" }, reiklanders)).toBe(
      false
    );
  });
});

describe("the store's offer", () => {
  it("offers the commonest availability the warband may use, else the first with its warning", () => {
    const claws = item([
      availability({ id: 1, rarity: 7, restrictions: [restricted(5, "Warband", "Skaven")] }),
    ]);
    expect(offerFor(claws, pestilens)).toMatchObject({ warning: "" });
    expect(offerFor(claws, reiklanders).warning).toBe("Skaven only");

    const both = item([
      availability({ id: 1, rarity: 9 }),
      availability({
        id: 2,
        rarity: 2,
        restrictions: [restricted(6, "Warband Group", "Non-Skaven")],
      }),
    ]);
    expect(offerFor(both, reiklanders).availability?.id).toBe(2);
    expect(offerFor(both, pestilens).availability?.id).toBe(1);
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
