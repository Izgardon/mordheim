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

  it("adds the switched-on companions' entries after the unit's own, marked with their beast", () => {
    const charge = { id: 900, name: "Thunderous Charge", type: "Mount" };
    const hex = { id: 901, name: "Hoof Hex", type: "Beast", dc: "7", description: "" };
    const sharp = { id: 902, name: "Sharp Eyes", type: "Ability", description: "" };
    const raven = { item_row_id: 3, item_id: 141, name: "Raven", has_profile: false, stats: null };
    const hero = makeVeteranHero({
      mount: {
        item_row_id: 2,
        item_id: 140,
        name: "Warhorse",
        movement: 8,
        rating_bonus: 5,
        has_profile: true,
        stats: null,
        skills: [charge],
        specials: [],
        spells: [hex],
      },
      // Two copies of one pet bring its entries once.
      pets: [
        { ...raven, specials: [sharp] },
        { ...raven, item_row_id: 4, specials: [sharp] },
      ],
    });

    const blocks = buildLoadoutBlocks(heroKind, hero);
    const entries = (id: string) => blocks.find((block) => block.id === id)?.entries ?? [];

    expect(entries("skills").map((entry) => [entry.label, entry.companion?.name])).toEqual([
      ["Mighty Blow", undefined],
      ["Thunderous Charge", "Warhorse"],
    ]);
    expect(entries("skills")[1]).toMatchObject({ visibleId: 900, type: "skill" });
    expect(entries("skills")[1]).not.toHaveProperty("pending");
    expect(entries("spells").slice(-1)[0]).toMatchObject({
      label: "Hoof Hex",
      dc: "7",
      companion: { kind: "mount", name: "Warhorse" },
    });
    expect(entries("special").filter((entry) => entry.companion)).toEqual([
      expect.objectContaining({ label: "Sharp Eyes", companion: { kind: "pet", name: "Raven" } }),
    ]);
  });

  it("gives a group a Spells block for its mount's spells only", () => {
    const group = makeVeteranHenchmenGroup({
      mount: {
        item_row_id: 2,
        item_id: 140,
        name: "Warhorse",
        movement: 8,
        rating_bonus: 5,
        has_profile: true,
        stats: null,
        spells: [{ id: 901, name: "Hoof Hex", type: "Beast", dc: "7", description: "" }],
      },
    });

    const blocks = buildLoadoutBlocks(henchmenKind, group);

    expect(blocks.map((block) => block.id)).toContain("spells");
    expect(blocks.find((block) => block.id === "spells")?.entries).toHaveLength(1);
  });

  it("drops empty blocks", () => {
    const hero = makeVeteranHero({ items: [], skills: [], spells: [], specials: [] });

    expect(buildLoadoutBlocks(heroKind, hero)).toEqual([]);
  });
});
