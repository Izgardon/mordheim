import { describe, expect, it } from "vitest";

import { henchmenQuantityFor } from "./usePurchaseTarget";
import { makeVeteranHenchmenGroup } from "@/test/warband-fixtures";

import type { HenchmenGroup } from "@/features/warbands/types/warband-types";

/** A group of `members` henchmen carrying `owned` copies of item 120. */
const groupWith = (members: number, owned: number): HenchmenGroup => {
  const group = makeVeteranHenchmenGroup();
  return {
    ...group,
    henchmen: Array.from({ length: members }, (_, index) => ({
      ...(group.henchmen ?? [])[0],
      id: index + 1,
    })),
    items: Array.from({ length: owned }, () => ({ ...(group.items ?? [])[0], id: 120 })),
  } as HenchmenGroup;
};

describe("henchmenQuantityFor", () => {
  it("suggests one copy per member the group still lacks", () => {
    expect(henchmenQuantityFor(groupWith(3, 0), 120)).toBe(3);
    expect(henchmenQuantityFor(groupWith(3, 1), 120)).toBe(2);
  });

  it("suggests enough for the next round once every member has one", () => {
    expect(henchmenQuantityFor(groupWith(3, 4), 120)).toBe(2);
    expect(henchmenQuantityFor(groupWith(3, 6), 120)).toBe(3);
  });

  it("suggests at least one, and one for a group without members", () => {
    expect(henchmenQuantityFor(groupWith(3, 3), 120)).toBe(1);
    expect(henchmenQuantityFor(groupWith(0, 2), 120)).toBe(1);
  });

  it("counts only copies of the item being bought", () => {
    expect(henchmenQuantityFor(groupWith(3, 2), 999)).toBe(3);
  });
});
