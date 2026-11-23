import { describe, expect, it } from "vitest";

import { makeItem } from "@/test/warband-fixtures";

import type { Item } from "../types/item-types";
import { itemRuleLines } from "./item-rules";

const beast = {
  id: 1,
  name: "Warhorse",
  kind: "mount",
  has_profile: false,
  specials: [{ id: 5, name: "Cavalry", description: "May charge 16 inches." }],
} as unknown as Item["bestiary_entry"];

// William, 23 Nov 2026: "Mounts in a units profile still double show their rules"
describe("itemRuleLines", () => {
  it("reads a mount's rules once: the item's own, not its beast's again", () => {
    const horse = makeItem({
      name: "Warhorse",
      type: "Animal",
      bestiary_entry: beast,
      rules: [
        {
          id: 3,
          rule_id: null,
          shared: false,
          name: "Cavalry",
          text: "May charge 16 inches.",
          summary: "",
          table: [],
        },
      ],
    } as unknown as Partial<Item>);

    expect(itemRuleLines(horse).map((line) => line.name)).toEqual(["Cavalry"]);
  });

  it("reads the beast's specials when the item has no rules of its own", () => {
    const horse = makeItem({ name: "Warhorse", type: "Animal", bestiary_entry: beast, rules: [] });

    expect(itemRuleLines(horse)).toEqual([{ name: "Cavalry", text: "May charge 16 inches." }]);
  });
});
