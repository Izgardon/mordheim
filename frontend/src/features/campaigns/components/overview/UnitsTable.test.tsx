import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import UnitsTable from "./UnitsTable";

const units = [
  {
    id: 1,
    category: "Heroes" as const,
    name: "Captain",
    unit_type: "Leader",
    movement: 4,
    weapon_skill: 4,
    ballistic_skill: 4,
    strength: 4,
    toughness: 3,
    wounds: 1,
    initiative: 4,
    attacks: 1,
    leadership: 8,
    armour_save: "5+",
  },
  {
    id: 2,
    category: "Henchmen" as const,
    name: "Marksman",
    unit_type: "Shooter",
    movement: 4,
    weapon_skill: 3,
    ballistic_skill: 3,
    strength: 3,
    toughness: 3,
    wounds: 1,
    initiative: 3,
    attacks: 1,
    leadership: 7,
    armour_save: "",
  },
  {
    id: 3,
    category: "Hired Swords" as const,
    name: "Ogre Bodyguard",
    unit_type: "Brute",
    movement: 6,
    weapon_skill: 4,
    ballistic_skill: 2,
    strength: 4,
    toughness: 4,
    wounds: 3,
    initiative: 3,
    attacks: 3,
    leadership: 7,
    armour_save: "6+",
  },
];

describe("UnitsTable", () => {
  it("uses the same desktop column widths for each unit category table", () => {
    render(<UnitsTable units={units} />);

    const expectedWidths = ["22%", "18%", ...Array(10).fill("6%")];

    for (const table of screen.getAllByRole("table")) {
      const cols = Array.from(table.querySelectorAll("col"));

      expect(cols).toHaveLength(expectedWidths.length);
      cols.forEach((col, index) => {
        expect(col.style.width).toBe(expectedWidths[index]);
      });
    }
  });
});
