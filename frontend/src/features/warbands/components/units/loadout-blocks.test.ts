import { describe, expect, it } from "vitest";

import { buildLoadoutBlocks } from "./loadout-blocks";
import { heroKind } from "../../units/kinds/hero";
import { henchmenKind } from "../../units/kinds/henchmen";

import { makeSkill, makeVeteranHenchmenGroup, makeVeteranHero } from "@/test/warband-fixtures";

describe("buildLoadoutBlocks", () => {
  it("gives heroes items, skills, spells and specials, marking pending placeholders", () => {
    const hero = makeVeteranHero({
      skills: [makeSkill({ id: 299, name: "New Skill", type: "Pending" })],
    });

    const blocks = buildLoadoutBlocks(heroKind, hero);

    expect(blocks.map((block) => block.id)).toEqual(["items", "skills", "spells", "special"]);
    expect(blocks[1].entries[0]).toMatchObject({ label: "New Skill", pending: true });
    expect(blocks[0].entries.find((entry) => entry.label === "Dagger x 2")).toBeTruthy();
  });

  it("gives groups a roster first, no spells, no pending flags and item counts", () => {
    const group = makeVeteranHenchmenGroup({ spells: [{ id: 1, name: "Ignored" }] } as never);

    const blocks = buildLoadoutBlocks(henchmenKind, group);

    expect(blocks.map((block) => block.title)).toEqual([
      "Roster 3/5",
      "Items",
      "Skills",
      "Specials",
    ]);
    expect(blocks[1].entries[0]).toHaveProperty("count", 3);
    expect(blocks[2].entries[0]).not.toHaveProperty("pending");
  });

  it("drops empty blocks", () => {
    const hero = makeVeteranHero({ items: [], skills: [], spells: [], specials: [] });

    expect(buildLoadoutBlocks(heroKind, hero)).toEqual([]);
  });
});
