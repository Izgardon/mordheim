import { describe, expect, it } from "vitest";

import { statsPayload } from "./useUnitEditDraft";

describe("statsPayload", () => {
  it("saves an empty stat box as 0 and an empty save as none", () => {
    const stats = statsPayload({
      movement: "",
      weapon_skill: "4",
      ballistic_skill: null,
      strength: 3,
      armour_save: "",
    });
    expect(stats).toMatchObject({
      movement: 0,
      weapon_skill: 4,
      ballistic_skill: 0,
      strength: 3,
      toughness: 0,
      leadership: 0,
      armour_save: null,
    });
  });

  it("keeps a typed save", () => {
    expect(statsPayload({ armour_save: "5" }).armour_save).toBe(5);
  });
});
