import { describe, expect, it } from "vitest";

import { makeHenchmenGroup, makeHero } from "@/test/warband-fixtures";

import { placeOf, unitSections } from "./unit-sections";
import type { RosterUnit } from "./unit-view";

const vrask = { kind: "hero", unit: makeHero({ id: 1, name: "Vrask the Hidden" }) } as RosterUnit;
const krekk = { kind: "hero", unit: makeHero({ id: 2, name: "Krekk Blackfur" }) } as RosterUnit;
const pack = {
  kind: "henchmen_group",
  unit: makeHenchmenGroup({ id: 5, name: "Verminkin Pack" }),
} as RosterUnit;
const tisk = {
  kind: "hireling",
  unit: { ...makeHero({ id: 7, name: "Tisk" }), kind: "hired_sword" },
} as unknown as RosterUnit;

describe("unitSections", () => {
  it("sorts units under Heroes, Henchmen and Hired swords", () => {
    expect(unitSections([pack, tisk, vrask, krekk])).toEqual([
      {
        label: "Heroes",
        options: [
          { value: "hero:1", label: "Vrask the Hidden" },
          { value: "hero:2", label: "Krekk Blackfur" },
        ],
      },
      { label: "Henchmen", options: [{ value: "henchmen_group:5", label: "Verminkin Pack" }] },
      { label: "Hired swords", options: [{ value: "hireling:7", label: "Tisk" }] },
    ]);
  });

  it("leaves a section with no units empty, for the dropdown to drop", () => {
    const [, henchmen, swords] = unitSections([vrask]);
    expect(henchmen.options).toEqual([]);
    expect(swords.options).toEqual([]);
  });
});

describe("placeOf", () => {
  it("reads a picked value back as the place an item goes", () => {
    expect(placeOf("henchmen_group:5")).toEqual({ type: "henchmen_group", id: 5 });
    expect(placeOf("")).toBeNull();
  });
});
