/** Wargear lists what can be bought: an unsold beast's item stays off it (William, 25 Nov 2026). */
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makeItem } from "@/test/warband-fixtures";

import { useWargearRows } from "./wargear-rows";

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
        openId: null,
      })
    );
    expect(result.current.rows.map((row) => row.item.name)).toEqual(["Sword", "Warhorse"]);
  });
});
