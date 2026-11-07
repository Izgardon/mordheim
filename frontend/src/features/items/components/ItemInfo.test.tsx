import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeItem } from "@/test/warband-fixtures";

import type { ItemAvailability } from "../types/item-types";
import ItemInfo from "./ItemInfo";

const row: ItemAvailability = {
  id: 9,
  label: "",
  cost: 35,
  dice: null,
  dice_multiplier: null,
  cost_note: "",
  rarity: 8,
  for_everyone: true,
  warbands: [],
  note: "",
};

const halberd = makeItem({
  id: 7,
  name: "Halberd",
  type: "Weapon",
  subtype: "Melee",
  range: "Close Combat",
  strength: "As user +1",
  flavour: "A long pole with an axe head.",
  availabilities: [row],
  rules: [
    {
      id: 1,
      rule_id: 4,
      shared: true,
      name: "Two-handed",
      summary: "No shield, no second weapon.",
      text: "A model using it may not use a shield or a second weapon.",
      table: [],
    },
    {
      id: 2,
      rule_id: null,
      shared: false,
      name: "Hooked",
      summary: "Pulls riders down.",
      text: "Roll against a rider:\n{{table:1}}",
      table: [
        {
          columns: ["D6", "Result"],
          rows: [
            ["1-3", "Nothing"],
            ["4-6", "Unhorsed"],
          ],
        },
      ],
    },
  ],
});

describe("ItemInfo", () => {
  it("shows the figures, the price and rarity, and the rules with their tables, not the flavour", () => {
    render(<ItemInfo item={halberd} availability={row} onClose={vi.fn()} />);

    const info = screen.getByRole("region", { name: "Halberd" });
    expect(info).toHaveTextContent("Melee");
    expect(within(info).getByText("Close Combat")).toBeInTheDocument();
    expect(within(info).getByText("As user +1")).toBeInTheDocument();
    expect(within(info).getByText("35 gc")).toBeInTheDocument();
    expect(within(info).getByText("Rare 8")).toBeInTheDocument();
    expect(within(info).getByText("No shield, no second weapon.")).toBeInTheDocument();
    expect(within(info).getByText("Hooked")).toBeInTheDocument();
    expect(within(info).getByRole("cell", { name: "Unhorsed" })).toBeInTheDocument();
    expect(info).not.toHaveTextContent("A long pole with an axe head.");
  });

  it("titles a shared rule with its name and tag, the item's own by its name or, unnamed, the item's", () => {
    // William, 7 Nov 2026: "on items with their own rule can we change the Rule title to the items
    // name and drop the this item pill"
    const blessed = makeItem({
      ...halberd,
      rules: [
        ...(halberd.rules ?? []),
        { id: 3, rule_id: null, shared: false, name: "", summary: "", text: "Thrown.", table: [] },
      ],
    });
    render(<ItemInfo item={blessed} availability={row} onClose={vi.fn()} />);

    const info = screen.getByRole("region", { name: "Halberd" });
    expect(
      within(info)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent)
    ).toEqual(["Halberd", "Two-handedshared rule", "Hooked", "Halberd"]);
    expect(info).not.toHaveTextContent("this item");
  });

  it("closes from its close button", () => {
    const onClose = vi.fn();
    render(<ItemInfo item={halberd} availability={null} onClose={onClose} />);

    screen.getByRole("button", { name: "Close details" }).click();

    expect(onClose).toHaveBeenCalled();
  });
});
