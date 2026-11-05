/**
 * Search everything finds the Boons & Banes the reference lists, each linking to its row on the
 * Boons & Banes page (William, 5 Nov 2026).
 */
import { describe, expect, it } from "vitest";

import { referenceSpecials } from "@/features/special/boons-banes";
import type { Special } from "@/features/special/types/special-types";

import { searchEverything, type SearchSources } from "./search-everything";

const nothing: SearchSources = {
  items: [],
  skills: [],
  skillGroups: [],
  spells: [],
  specials: [],
  beasts: [],
  hiredSwords: [],
  personae: [],
  rules: [],
  houseRules: [],
  locations: [],
  campaign: undefined,
  myWarbandId: null,
};

const special = (overrides: Partial<Special> & Pick<Special, "id" | "name">): Special => ({
  type: "Mutation",
  owner_kind: "general",
  description: "",
  in_play: true,
  ...overrides,
});

describe("Search everything's Boons & Banes", () => {
  it("are the ones the reference lists, each opening its row", () => {
    const specials = referenceSpecials([
      special({ id: 1, name: "Spiked Tail", description: "A tail with spikes." }),
      special({ id: 2, name: "Scorpion Tail", description: "A venomous tail." }),
      special({ id: 3, name: "Tail Whip", owner_kind: "hired_sword" }),
      special({ id: 4, name: "Tailed Beast", in_play: false }),
      special({
        id: 5,
        name: "Crazed",
        type: "Warband - Cult of the Possessed",
        owner_kind: "warband",
      }),
    ]);

    const groups = searchEverything("tail", { ...nothing, specials });

    expect(groups.map((group) => group.label)).toEqual(["Boons & Banes"]);
    expect(groups[0].hits.map((hit) => [hit.title, hit.meta, hit.to])).toEqual([
      ["Scorpion Tail", "Mutation", "boons-banes?open=2"],
      ["Spiked Tail", "Mutation", "boons-banes?open=1"],
    ]);
    expect(searchEverything("crazed", { ...nothing, specials })).toEqual([]);
  });
});
