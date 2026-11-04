import { describe, expect, it } from "vitest";

import {
  countLabel,
  groupLabel,
  lineName,
  priceLabel,
  rulesFor,
  skillsFor,
  typeRows,
  whoLabel,
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

  it("names who may take it and the list's own name for it", () => {
    const fighters = [
      { key: "gaolers", name: "Gaoler" },
      { key: "corsairs", name: "Corsair" },
      { key: "questing-knight", name: "Questing Knight" },
    ];
    expect(whoLabel({}, fighters)).toBe("");
    expect(whoLabel({ fighters: ["gaolers"] }, fighters)).toBe("Gaoler only");
    expect(whoLabel({ heroes: true, fighters: ["corsairs"] }, fighters)).toBe(
      "Heroes and Corsair only"
    );
    expect(whoLabel({ except: ["questing-knight"] }, fighters)).toBe("Not Questing Knight");
    const item = { id: 1, name: "Dagger", variant: "", type: "Weapon" };
    expect(lineName({ item, shown_as: "Jambiya" })).toBe("Jambiya (Dagger)");
    expect(lineName({ item, shown_as: "" })).toBe("Dagger");
  });
});

describe("rulesFor", () => {
  it("is every variant's rules, the variant's own and a type's own", () => {
    const rule = (id: number, variant: string) => ({
      id,
      title: `Rule ${id}`,
      description: "",
      variant,
    });
    const template = {
      variants: [
        { key: "reikland", name: "Reikland" },
        { key: "middenheim", name: "Middenheim" },
      ],
      rules: [rule(1, ""), rule(2, "reikland"), rule(3, "middenheim"), rule(4, "ostermark")],
    } as unknown as WarbandTemplate;
    expect(rulesFor(template, "middenheim").map((entry) => entry.id)).toEqual([1, 3, 4]);
  });
});
