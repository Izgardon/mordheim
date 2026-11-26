import { describe, expect, it } from "vitest";

import { hiredSword } from "@/test/catalogue-fixtures";

import { blankFee } from "./fees";
import { HIRELING_SORTS, hirelingOrder, type HirelingSort } from "./hireling-sorts";

const gold = (amount: number | null) => ({ ...blankFee(), gold: amount });
const ENTRIES = [
  hiredSword({ id: 1, name: "Ogre", hire_fee: gold(80), upkeep_fee: gold(30), rating: 25 }),
  hiredSword({ id: 2, name: "Halfling", hire_fee: gold(15), upkeep_fee: gold(5), rating: 5 }),
  hiredSword({
    id: 3,
    name: "Bretonnian",
    hire_fee: { ...blankFee(), kind: "replaces_hero" },
    upkeep_fee: { ...blankFee(), kind: "none" },
    rating: null,
  }),
];
const order = (sort: HirelingSort) =>
  [...ENTRIES].sort(hirelingOrder(sort)).map((entry) => entry.name);

// William, 26 Nov 2026: name, hire fee, upkeep and (the hired swords') rating
describe("the hired swords' orders", () => {
  it("offers rating to the hired swords and not to the dramatis personae", () => {
    expect(HIRELING_SORTS["hired-swords"].map((option) => option.id)).toContain("-rating");
    expect(HIRELING_SORTS["dramatis-personae"].map((option) => option.id)).not.toContain("rating");
  });

  it("sorts by gold either way, a fee with no gold to compare last, no upkeep as 0", () => {
    expect(order("hire")).toEqual(["Halfling", "Ogre", "Bretonnian"]);
    expect(order("-hire")).toEqual(["Ogre", "Halfling", "Bretonnian"]);
    expect(order("upkeep")).toEqual(["Bretonnian", "Halfling", "Ogre"]);
    expect(order("-rating")).toEqual(["Ogre", "Halfling", "Bretonnian"]);
    expect(order("name")).toEqual(["Ogre", "Halfling", "Bretonnian"]); // left as they came
  });
});
