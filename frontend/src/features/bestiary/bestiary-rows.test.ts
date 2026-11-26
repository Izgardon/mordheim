import { describe, expect, it } from "vitest";

import { bestiaryEntry, warhorse } from "@/test/catalogue-fixtures";

import { beastRows, type BeastSort } from "./bestiary-rows";

// William, 26 Nov 2026: the Kind filter goes; the Bestiary sorts by name, cost and type
const ENTRIES = [
  warhorse, // a mount, 80 gc
  bestiaryEntry(), // the Warhound, a creature, 15 gc
  bestiaryEntry({ id: 7, name: "Cat", kind: "pet", available_in_shop: false }),
  bestiaryEntry({ id: 8, name: "Boar", kind: "mount" }), // 15 gc
];
const order = (sort: BeastSort, query = "") =>
  beastRows(ENTRIES, { query, openId: null, sort }).map((entry) => entry.name);

describe("beastRows", () => {
  it("lists by name, by cost either way (one not sold last) or by kind, each tie by name", () => {
    expect(order("name")).toEqual(["Boar", "Cat", "Warhorse", "Warhound"]);
    expect(order("cost")).toEqual(["Boar", "Warhound", "Warhorse", "Cat"]);
    expect(order("-cost")).toEqual(["Warhorse", "Boar", "Warhound", "Cat"]);
    expect(order("kind")).toEqual(["Boar", "Warhorse", "Cat", "Warhound"]);
    expect(order("name", "pet")).toEqual(["Cat"]);
  });
});
