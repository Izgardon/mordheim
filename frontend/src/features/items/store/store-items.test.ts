import { describe, expect, it } from "vitest";

import { availability, item } from "@/test/catalogue-fixtures";

import { diceLabel, priceLabel, rarityLabel, rolledPrice, whoLine } from "../utils/item-prices";
import { itemKindLine } from "../item-kind";
import { STORE_CATEGORIES, itemName, kindOf, searchWords, storeCategory } from "./store-items";

const line = (name: string, excluded = false, group = false) => ({
  warband_type_id: group ? null : name.length,
  warband_group_id: group ? name.length : null,
  name,
  excluded,
});

describe("price rows", () => {
  it("label a plain price, dice, a multiplier and a cost note", () => {
    expect(priceLabel(availability({ cost: 15 }))).toBe("15 gc");
    expect(priceLabel(availability({ cost: 25, dice: 2 }))).toBe("25 + 2D6 gc");
    expect(priceLabel(availability({ cost: 200, dice: 1, dice_multiplier: 25 }))).toBe(
      "200 + D6×25 gc"
    );
    expect(priceLabel(availability({ cost: 35, cost_note: "per pair" }))).toBe("35 gc · per pair");
    expect(priceLabel(availability({ cost: null, cost_note: "4 x Price" }))).toBe("4 x Price");
    // a long note stays on the card, out of the list's price column
    const spent = "Gold is spent even on unsuccessful rare roll";
    expect(priceLabel(availability({ cost: 20, dice: 1, cost_note: spent }))).toBe("20 + D6 gc");
    expect(priceLabel(null)).toBe("-");
  });

  it("roll into a price at the multiplier, and say Common for no rarity", () => {
    expect(rolledPrice(availability({ cost: 25, dice: 2 }), 7)).toBe(32);
    expect(rolledPrice(availability({ cost: 200, dice: 1, dice_multiplier: 25 }), 3)).toBe(275);
    expect(diceLabel(availability({ dice: 3 }))).toBe("3D6");
    expect([rarityLabel(null), rarityLabel(9)]).toEqual(["Common", "Rare 9"]);
  });

  it("say who may buy them", () => {
    expect(whoLine(availability())).toBe("For everyone");
    expect(whoLine(availability({ warbands: [line("Dark Elves", true)] }))).toBe(
      "Everyone except Dark Elves"
    );
    expect(
      whoLine(availability({ for_everyone: false, warbands: [line("Skaven"), line("Lizardmen")] }))
    ).toBe("For Skaven, Lizardmen");
    expect(
      whoLine(
        availability({
          for_everyone: false,
          warbands: [line("Humans", false, true), line("Witch Hunters", true)],
        })
      )
    ).toBe("For Humans, not Witch Hunters");
  });

  it("tell two types of one name apart by their source codes, as the type picker does", () => {
    const norse = (code: string) => ({ ...line("Norse Explorers"), source_code: code });
    expect(
      whoLine(
        availability({
          for_everyone: false,
          warbands: [norse("BTB"), { ...line("Lizardmen"), source_code: "LUS" }, norse("TC13")],
        })
      )
    ).toBe("For Norse Explorers (BTB), Lizardmen, Norse Explorers (TC13)");
  });
});

describe("store items", () => {
  it("label a bow with the word its chip uses, on the store row and the unit card", () => {
    const bow = item({ type: "Weapon", subtype: "Ranged" });
    const chip = STORE_CATEGORIES.find((entry) => entry.id === storeCategory(bow));
    expect(chip?.label).toBe(kindOf(bow));
    expect(itemKindLine(bow)).toBe("Ranged weapon");
  });

  it("sort into the store's chips, name a variant, and are found by their rules and tags", () => {
    const blunderbuss = item({ subtype: "Blackpowder" });
    expect(storeCategory(blunderbuss)).toBe("missile");
    expect(storeCategory(item({ type: "Animal", subtype: "Mount" }))).toBe("animals");
    expect(itemName(item({ name: "Lamp", variant: "Mutiny in Marienburg" }))).toBe(
      "Lamp (Mutiny in Marienburg)"
    );
    expect(searchWords(item({ tags: ["scimitar"] }))).toContain("scimitar");
  });
});
