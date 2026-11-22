import { describe, expect, it } from "vitest";

import type { WeaponMaterial } from "../types/item-types";
import { materialRows } from "./material-rows";

const material = (change: Partial<WeaponMaterial>): WeaponMaterial => ({
  slug: "gromril",
  name: "Gromril",
  row_name: "Gromril Weapon",
  prefix: "Gromril",
  for_everyone: true,
  rarity: 11,
  price_note: "4 x Price",
  multiplier: 4,
  addition: null,
  rules: [],
  only: null,
  can_take: true,
  reason: "",
  in_play: true,
  ...change,
});
const SILVER = material({
  slug: "silver",
  name: "Silver",
  row_name: "Silver Weapon",
  can_take: false,
  reason: "Grade 3 isn't in this campaign.",
  in_play: false,
});
const everything = { query: "", category: "all" as const, onlyMine: false };
const names = (rows: ReturnType<typeof materialRows>) => rows.map((row) => row.name);

describe("materialRows on Their list", () => {
  it("never shows a material whose setting isn't in play, even with Warband Only off", () => {
    // William, 22 Nov 2026: silver "shouldn't be showing at all when the His List toggle is on"
    const hero = { lines: [], melee: [], open: true };
    expect(names(materialRows([material({}), SILVER], [], everything, hero))).toEqual([
      "Gromril Weapon",
    ]);

    const sold = {
      ...hero,
      lines: [
        { slug: "silver", name: "Silvered blade", priceNote: "+60 gc", off: "", choices: [] },
      ],
    };
    expect(names(materialRows([SILVER], [], everything, sold))).toEqual([]);
  });

  it("gives a henchmen group only the materials their list sells", () => {
    const group = {
      lines: [
        { slug: "gromril", name: "Gromril blade", priceNote: "3 × price", off: "", choices: [] },
      ],
      melee: [],
      open: false,
    };
    const ithilmar = material({ slug: "ithilmar", name: "Ithilmar", row_name: "Ithilmar Weapon" });
    expect(names(materialRows([material({}), ithilmar], [], everything, group))).toEqual([
      "Gromril blade",
    ]);
  });

  it("shows a material out of play in the warband's store, with its reason", () => {
    expect(names(materialRows([SILVER], [], everything))).toEqual(["Silver Weapon"]);
  });
});
