/** Wargear lists what can be bought: an unsold beast's item stays off it (William, 25 Nov 2026). */
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makeItem } from "@/test/warband-fixtures";

import { useWargearRows, type WargearSort } from "./wargear-rows";

describe("useWargearRows", () => {
  it("leaves out an Animal item the shop doesn't sell", () => {
    const items = [
      makeItem({ id: 1, name: "Warhorse", type: "Animal", subtype: "Mount", listed: true }),
      makeItem({ id: 2, name: "Hydra", type: "Animal", subtype: "Creature", listed: false }),
      makeItem({ id: 3, name: "Sword", type: "Weapon", subtype: "Melee" }),
    ];
    const { result } = renderHook(() =>
      useWargearRows({
        items,
        settings: new Map(),
        offers: null,
        warbandName: null,
        onlyMine: false,
        query: "",
        category: "all",
        setting: "all",
        sort: "name",
        openId: null,
      })
    );
    expect(result.current.rows.map((row) => row.item.name)).toEqual(["Sword", "Warhorse"]);
  });
});

// William, 26 Nov 2026: name, cost either way and rarity ("wargear doesn't need type or range")
describe("Wargear's orders", () => {
  const price = (id: number, cost: number | null, rarity: number | null) => ({
    id,
    label: "",
    cost,
    dice: null,
    dice_multiplier: null,
    cost_note: "",
    rarity,
    for_everyone: true,
    warbands: [],
    note: "",
  });
  const items = [
    makeItem({ id: 1, name: "Axe", availabilities: [price(1, 5, null)] }),
    makeItem({ id: 2, name: "Banner", availabilities: [price(2, 10, 5)] }),
    makeItem({ id: 3, name: "Crossbow", availabilities: [price(3, 25, null)] }),
    makeItem({ id: 4, name: "Dragon Bow", availabilities: [price(4, 25, 11)] }),
    makeItem({ id: 5, name: "Elven Cloak", availabilities: [] }),
  ];
  const order = (sort: WargearSort) =>
    renderHook(() =>
      useWargearRows({
        items,
        settings: new Map(),
        offers: null,
        warbandName: null,
        onlyMine: false,
        query: "",
        category: "all",
        setting: "all",
        sort,
        openId: null,
      })
    ).result.current.rows.map((row) => row.item.name);

  it("sorts by cost either way, then by rarity, an unpriced item last and a tie by name", () => {
    expect(order("name")).toEqual(["Axe", "Banner", "Crossbow", "Dragon Bow", "Elven Cloak"]);
    expect(order("cost")).toEqual(["Axe", "Banner", "Crossbow", "Dragon Bow", "Elven Cloak"]);
    expect(order("-cost")).toEqual(["Crossbow", "Dragon Bow", "Banner", "Axe", "Elven Cloak"]);
    expect(order("rarity")).toEqual(["Axe", "Crossbow", "Banner", "Dragon Bow", "Elven Cloak"]);
  });
});
