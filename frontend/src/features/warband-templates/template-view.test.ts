import { describe, expect, it } from "vitest";

import {
  countLabel,
  groupLabel,
  inVariant,
  lineName,
  priceLabel,
  rulesFor,
  skillsFor,
  termsFor,
  typeRows,
  fightersFor,
  listsFor,
} from "./template-view";
import type {
  TemplateFighter,
  WarbandTemplate,
  WarbandTemplateSummary,
} from "./types/template-types";

const type = (id: number, name: string, variant = "", inPlay: boolean | null = true) => ({
  id,
  name,
  slug: name.toLowerCase(),
  source_code: "",
  setting_id: null,
  campaign_id: null,
  variant,
  archived: false,
  in_play: inPlay,
});

const summary = (id: number, name: string, types: WarbandTemplateSummary["types"], inPlay = true) =>
  ({
    id,
    name,
    campaign_id: null,
    setting_id: null,
    slug: name.toLowerCase(),
    starting_gold: 500,
    gold: 500,
    max_models: 15,
    most_warriors: 15,
    variants: [],
    source: "",
    link_url: "",
    types,
    in_play: inPlay,
  }) satisfies WarbandTemplateSummary;

describe("typeRows", () => {
  it("is a row per warband type in play with a template in play, by name", () => {
    const mercenaries = summary(1, "Mercenaries", [
      type(10, "Reiklanders", "reikland"),
      type(11, "Ostermarkers", "", false),
      { ...type(12, "Marienburgers", "marienburg"), archived: true },
    ]);
    const skaven = summary(2, "Skaven", [type(20, "Skaven")]);
    const tombs = summary(3, "Tomb Guardians", [type(30, "Tomb Guardians")], false);
    expect(
      typeRows([skaven, mercenaries, tombs]).map((row) => [row.typeName, row.variant])
    ).toEqual([
      ["Reiklanders", "reikland"],
      ["Skaven", ""],
    ]);
  });

  it("tells two types of one name apart by their source", () => {
    const goblins = (id: number, code: string) =>
      summary(id, `Night Goblins ${code}`, [
        { ...type(id * 10, "Night Goblins"), source_code: code },
      ]);
    expect(typeRows([goblins(1, "WEB"), goblins(2, "MIC")]).map((row) => row.typeName)).toEqual([
      "Night Goblins (MIC)",
      "Night Goblins (WEB)",
    ]);
  });

  it("names the template under the type only when it serves several types", () => {
    const mercenaries = summary(1, "Mercenaries", [
      type(10, "Reiklanders", "reikland"),
      type(11, "Ostermarkers", "", false),
    ]);
    const cavalcade = summary(2, "The Cursed Cavalcade", [type(20, "Cursed Cavalcade")]);
    const lone = summary(3, "Averlander Mercenaries", [
      type(30, "Averlanders"),
      { ...type(31, "Averlanders (old)"), archived: true },
    ]);
    expect(typeRows([mercenaries, cavalcade, lone]).map((row) => [row.typeName, row.sub])).toEqual([
      ["Averlanders", undefined],
      ["Cursed Cavalcade", undefined],
      ["Reiklanders", "Mercenaries"],
    ]);
  });

  it("names each template under a type that two templates serve, the book's by its name", () => {
    const book = summary(1, "Cult of the Possessed", [type(10, "Cult of the Possessed")]);
    const copy = { ...summary(2, "Review Copy Cult", [type(10, "Cult of the Possessed")]) };
    expect(typeRows([book, copy]).map((row) => [row.typeName, row.sub])).toEqual([
      ["Cult of the Possessed", "Cult of the Possessed"],
      ["Cult of the Possessed", "Review Copy Cult"],
    ]);
  });

  it("lists a template serving no warband type as a row of its own, to open, edit and delete", () => {
    const blank = summary(5, "Review Blank Band", []);
    const gone = summary(6, "Old Band", [{ ...type(60, "Old Type"), archived: true }]);
    const skaven = summary(2, "Skaven", [type(20, "Skaven")]);
    expect(
      typeRows([skaven, blank, gone]).map((row) => [row.typeName, row.sub, row.typeId, row.id])
    ).toEqual([
      ["Old Band", "No warband type", null, "template-6"],
      ["Review Blank Band", "No warband type", null, "template-5"],
      ["Skaven", undefined, 20, "2-20"],
    ]);
    expect(typeRows([summary(7, "Elsewhere", [], false)])).toEqual([]);
  });
});

const fighter = (fields: Partial<TemplateFighter>) => fields as TemplateFighter;

describe("a fighter's labels", () => {
  it("counts him, sizes his group and reads his variant's skill groups", () => {
    expect(countLabel({ min_count: 1, max_count: 1 })).toBe("1");
    expect(countLabel({ min_count: 0, max_count: 2 })).toBe("0–2");
    expect(countLabel({ min_count: 0, max_count: null })).toBe("any");
    expect(countLabel({ min_count: 3, max_count: null })).toBe("3+");
    expect(groupLabel({ group_min: 1, group_max: 5 })).toBe("groups of 1–5");
    expect(groupLabel({ group_min: null, group_max: null })).toBe("");
    const champion = fighter({
      skill_types: ["Combat", "Shooting"],
      variant_changes: { middenheim: { skill_types: ["Combat", "Strength"] } },
    });
    expect(skillsFor(champion, "middenheim")).toEqual(["Combat", "Strength"]);
    expect(skillsFor(champion, "reikland")).toEqual(["Combat", "Shooting"]);
  });
});

describe("a list line's labels", () => {
  const line = { cost: 2, cost_note: "", first_free: false, brace_cost: null };
  it("prices a free dagger, a brace, a multiple and dice", () => {
    expect(priceLabel({ ...line, first_free: true })).toBe("1st free / 2 gc");
    expect(priceLabel({ ...line, cost: 15, brace_cost: 30 })).toBe("15 gc, brace 30");
    expect(priceLabel({ ...line, cost: null, cost_note: "3 × price" })).toBe("3 × price");
    expect(priceLabel({ ...line, cost: 200, cost_note: "+10D6" })).toBe("200 gc +10D6");
  });

  it("names a line's item as the list names it", () => {
    const item = { id: 1, name: "Dagger", variant: "", type: "Weapon" };
    expect(lineName({ item, shown_as: "Jambiya" })).toBe("Jambiya (Dagger)");
    expect(lineName({ item, shown_as: "" })).toBe("Dagger");
  });
});

describe("rulesFor", () => {
  it("is every variant's rules, the variant's own and a type's own", () => {
    const rule = (id: number, variant: string, typeId: number | null = null) => ({
      id,
      title: `Rule ${id}`,
      description: "",
      variant,
      warband_type_id: typeId,
    });
    const template = {
      variants: [
        { key: "reikland", name: "Reikland" },
        { key: "middenheim", name: "Middenheim" },
      ],
      rules: [rule(1, ""), rule(2, "reikland"), rule(3, "middenheim"), rule(4, "", 12)],
    } as unknown as WarbandTemplate;
    expect(rulesFor(template, "middenheim", 11).map((entry) => entry.id)).toEqual([1, 3]);
    expect(rulesFor(template, "", 12).map((entry) => entry.id)).toEqual([1, 4]);
  });
});

describe("a variant's numbers", () => {
  it("are its own gold and size, else the template's", () => {
    const template = {
      gold: 500,
      most_warriors: 15,
      variants: [
        { key: "reikland", name: "Reikland" },
        { key: "marienburg", name: "Marienburg", starting_gold: 600, max_models: 12 },
      ],
    };
    expect(termsFor(template, "marienburg")).toEqual({ gold: 600, mostWarriors: 12 });
    expect(termsFor(template, "reikland")).toEqual({ gold: 500, mostWarriors: 15 });
  });

  it("change his profile as written, his skills and his most", () => {
    const champion = {
      strength: 3,
      attacks: 1,
      movement: null,
      max_count: 2,
      skill_types: ["Combat"],
      written_stats: { attacks: "(2)", movement: "D6" },
      variant_changes: {
        middenheim: {
          skill_types: ["Strength"],
          stats: { strength: 4, attacks: "2(2)", movement: 5 },
        },
        kurgan: { max_count: null },
      },
    } as unknown as TemplateFighter;
    const middenheim = inVariant(champion, "middenheim");
    expect([middenheim.strength, middenheim.attacks, middenheim.movement]).toEqual([4, 2, 5]);
    expect(middenheim.written_stats).toEqual({ attacks: "(2)" });
    expect(middenheim.skill_types).toEqual(["Strength"]);
    expect(inVariant(champion, "kurgan").max_count).toBeNull();
    expect(inVariant(champion, "reikland")).toBe(champion);
  });
});

describe("what a variant has", () => {
  // William, 11 Nov 2026: the Sartosa Orc Pirates and Savage Orcs are variants of the Orc Mob, so a Mordheim Orc
  // Mob must see neither their fighters nor their lists
  const fighter = (name: string, changes: object) =>
    ({ name, max_count: 1, variant_changes: changes }) as unknown as TemplateFighter;

  it("leaves out a fighter it allows none of", () => {
    const fighters = [
      fighter("Orc Boss", {}),
      fighter("Goblin Swabbie", { "orc-mob": { max_count: 0 } }),
      fighter("Goblin Warrior", { "orc-pirates": { max_count: 0 } }),
    ];
    expect(fightersFor(fighters, "orc-mob").map((row) => row.name)).toEqual([
      "Orc Boss",
      "Goblin Warrior",
    ]);
    expect(fightersFor(fighters, "orc-pirates").map((row) => row.name)).toEqual([
      "Orc Boss",
      "Goblin Swabbie",
    ]);
  });

  it("leaves out a list with no line of its own", () => {
    const lists = [
      { name: "Orc Equipment List", lines: [{ variant: "orc-mob" }] },
      { name: "Goblin Swabbie Equipment List", lines: [{ variant: "orc-pirates" }] },
      { name: "Everyone's", lines: [{ variant: "" }] },
    ];
    expect(listsFor(lists, "orc-mob").map((list) => list.name)).toEqual([
      "Orc Equipment List",
      "Everyone's",
    ]);
    expect(listsFor(lists, "orc-pirates").map((list) => list.name)).toEqual([
      "Goblin Swabbie Equipment List",
      "Everyone's",
    ]);
  });
});
