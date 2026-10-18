import { describe, expect, it } from "vitest";

import { stashEntries } from "./useItemActionMenu";
import { makeStashItem } from "@/test/warband-fixtures";

describe("stashEntries", () => {
  it("lists each stash row by its item, with the copies it holds", () => {
    expect(
      stashEntries([
        makeStashItem({ id: 101, name: "Sword", quantity: 2 }),
        makeStashItem({ id: 120, name: "Rope", quantity: 1 }),
      ])
    ).toEqual([
      { id: "stash-item-101", visibleId: 101, label: "Sword x 2" },
      { id: "stash-item-120", visibleId: 120, label: "Rope" },
    ]);
  });
});
