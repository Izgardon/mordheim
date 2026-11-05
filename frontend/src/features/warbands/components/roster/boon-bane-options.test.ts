import { describe, expect, it } from "vitest";

import { makeSpecial } from "@/test/warband-fixtures";

import { boonBaneOptions } from "./boon-bane-options";

describe("boonBaneOptions", () => {
  const specials = [
    makeSpecial({ id: 1, name: "Tentacle", owner_kind: "general" }),
    makeSpecial({ id: 2, name: "Spines", owner_kind: "general" }),
    makeSpecial({ id: 3, name: "Hideous", owner_kind: "general" }),
    makeSpecial({ id: 4, name: "Ogre's own", owner_kind: "hired_sword" }),
  ];

  it("offers the general ones he hasn't got, as the Edit form's list does", () => {
    const held = [specials[0], specials[1]];
    expect(boonBaneOptions(specials, new Map(), held).map((row) => row.title)).toEqual(["Hideous"]);
    expect(boonBaneOptions(specials, new Map()).map((row) => row.title)).toEqual([
      "Tentacle",
      "Spines",
      "Hideous",
    ]);
  });
});
