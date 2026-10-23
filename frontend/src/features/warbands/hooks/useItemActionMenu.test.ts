import { describe, expect, it } from "vitest";

import { stashEntries } from "./useItemActionMenu";
import { makeStashItem } from "@/test/warband-fixtures";

describe("stashEntries", () => {
  it("lists each stash row by its item, with the copies it holds and a beast's kind", () => {
    expect(
      stashEntries([
        makeStashItem({ id: 101, name: "Sword", quantity: 2 }),
        makeStashItem({ id: 120, name: "Rope", quantity: 1 }),
        makeStashItem({ id: 140, name: "Warhorse", quantity: 1, beast_kind: "mount" }),
      ])
    ).toEqual([
      { id: "stash-item-101", visibleId: 101, label: "Sword x 2", costs: "", beastKind: null },
      { id: "stash-item-120", visibleId: 120, label: "Rope", costs: "", beastKind: null },
      { id: "stash-item-140", visibleId: 140, label: "Warhorse", costs: "", beastKind: "mount" },
    ]);
  });

  it("lists the costs of a row holding copies at several (BUG-117)", () => {
    const sword = makeStashItem({
      id: 101,
      name: "Sword",
      quantity: 3,
      costs: [
        { cost: 12, quantity: 1 },
        { cost: null, quantity: 2 },
      ],
    });

    expect(stashEntries([sword])[0].costs).toBe("1 at 12 gc, 2 at unknown cost");
  });
});
