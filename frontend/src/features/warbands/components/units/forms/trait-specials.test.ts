import { describe, expect, it } from "vitest";

import { syncCasterSpecials, syncLargeSpecial } from "./trait-specials";

import { makeSpecial } from "@/test/warband-fixtures";

const large = makeSpecial({ id: 1, name: "Large" });
const wizard = makeSpecial({ id: 2, name: "Wizard" });
const priest = makeSpecial({ id: 3, name: " priest " });
const catalogue = [large, wizard, priest];

describe("syncLargeSpecial", () => {
  it("adds the catalogue's Large special when the trait is ticked, once", () => {
    expect(syncLargeSpecial([], true, catalogue)).toEqual([large]);
    expect(syncLargeSpecial([large], true, catalogue)).toEqual([large]);
  });

  it("removes it when the trait is cleared, and does nothing without a catalogue entry", () => {
    expect(syncLargeSpecial([large, wizard], false, catalogue)).toEqual([wizard]);
    expect(syncLargeSpecial([], true, [wizard])).toEqual([]);
  });
});

describe("syncCasterSpecials", () => {
  it("keeps exactly the special matching the caster type", () => {
    expect(syncCasterSpecials([], "Wizard", catalogue)).toEqual([wizard]);
    expect(syncCasterSpecials([wizard], "Priest", catalogue)).toEqual([priest]);
    expect(syncCasterSpecials([priest, large], "No", catalogue)).toEqual([large]);
  });
});
