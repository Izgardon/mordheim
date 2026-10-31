import { describe, expect, it } from "vitest";

import type { Item } from "@/features/items/types/item-types";

import type { Henchman } from "../types/warband-types";
import {
  copiesForGroup,
  eachCarries,
  gapLine,
  loadoutLine,
  memberGaps,
  memberShare,
  sitsOut,
} from "./loadout";

const row = (rowId: number, name: string) => ({ id: rowId * 10, name, row_id: rowId }) as Item;
const group = { items: [row(1, "Sword"), row(2, "Light Armour"), row(3, "Horse")] };
const skritt: Henchman = {
  id: 7,
  name: "Skritt",
  kills: 0,
  dead: false,
  gaps: [
    { id: 1, row_id: 3, item_id: 30, reason: "lost", left: false },
    { id: 2, row_id: 2, item_id: 20, reason: "kit_taken", left: false },
  ],
};

describe("henchmen loadouts", () => {
  it("words what each member carries and the loadout's cost", () => {
    expect(eachCarries(group)).toBe("Each carries Sword, Light Armour, Horse");
    expect(eachCarries({ items: [] })).toBe("Each carries nothing");
    expect(loadoutLine({ loadout_each: 45, loadout_total: 180 })).toBe(
      "Loadout 45 gc each · 180 gc"
    );
  });

  it("names a member's gaps by their rows and why", () => {
    const gaps = memberGaps(group, skritt);

    expect(gaps.map((gap) => gap.row.name)).toEqual(["Horse", "Light Armour"]);
    expect(gapLine(skritt, gaps[0])).toBe("Skritt has no Horse (lost after the last battle).");
  });

  it("says a member whose kit was taken sits out, and what his share is", () => {
    expect(sitsOut(group, skritt)).toBe("His kit went to the stash (Light Armour)");
    expect(sitsOut(group, { ...skritt, gaps: [] })).toBeNull();
    expect(memberShare(group, skritt).map((item) => item.name)).toEqual(["Sword"]);
  });

  it("equips a group with one copy each, up to what the stash holds", () => {
    const members = { henchmen: [skritt, { ...skritt, id: 8 }, { ...skritt, id: 9, dead: true }] };

    expect([
      copiesForGroup(members, 5),
      copiesForGroup(members, 1),
      copiesForGroup(members, 0),
    ]).toEqual([2, 1, 1]);
  });
});
