/**
 * Search everything finds the Boons & Banes the reference lists, each linking to its row on the
 * Boons & Banes page (William, 5 Nov 2026), and the warband types, shared wargear rules and skill
 * groups (William, 8 Nov 2026: "the reference search doesnt search warbands yet, might be other
 * new things as well it doesnt search").
 */
import { describe, expect, it } from "vitest";

import type { Item, ItemRule } from "@/features/items/types/item-types";
import type { Skill, SkillGroup } from "@/features/skills/types/skill-types";
import { referenceSpecials } from "@/features/special/boons-banes";
import type { Special } from "@/features/special/types/special-types";
import { typeRows } from "@/features/warband-templates/template-view";
import type {
  TemplateContents,
  WarbandTemplateSummary,
} from "@/features/warband-templates/types/template-types";

import { searchEverything, type SearchSources } from "./search-everything";

const nothing: SearchSources = {
  warbandTypes: [],
  items: [],
  itemRules: [],
  skills: [],
  skillGroups: [],
  spells: [],
  specials: [],
  beasts: [],
  hiredSwords: [],
  personae: [],
  rules: [],
  houseRules: [],
  campaignRules: [],
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
      special({ id: 6, name: "Tail Sweep (Hydra)", type: "Animal", owner_kind: "beast" }),
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

describe("Search everything's campaign rules", () => {
  it("finds a campaign rule by its title or its text, each opening its row", () => {
    const campaignRules = [
      {
        id: 3,
        campaign_id: 1,
        title: "The Comet's Fall",
        body: "Each night a shard falls.",
        order: 0,
      },
      {
        id: 4,
        campaign_id: 1,
        title: "Curfew",
        body: "No warband leaves after the bell.",
        order: 1,
      },
    ];

    const groups = searchEverything("bell", { ...nothing, campaignRules });

    expect(groups.map((group) => group.label)).toEqual(["Campaign rules"]);
    expect(groups[0].hits.map((hit) => [hit.title, hit.to])).toEqual([
      ["Curfew", "campaign-rules?open=4"],
    ]);
  });
});

const type = (id: number, name: string, inPlay: boolean | null = true) => ({
  id,
  name,
  slug: name.toLowerCase(),
  source_code: "",
  setting_id: null,
  campaign_id: null,
  variant: "",
  archived: false,
  in_play: inPlay,
});

const template = (
  id: number,
  name: string,
  types: WarbandTemplateSummary["types"],
  contents: TemplateContents
) =>
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
    in_play: true,
    contents,
  }) satisfies WarbandTemplateSummary;

type Fighter = TemplateContents["fighters"][number];

const fighter = (name: string, overrides: Partial<Fighter> = {}): Fighter => ({
  name,
  plural: "",
  kind: "hero",
  skill_types: [],
  rules: [],
  skills: [],
  ...overrides,
});

const skill = (id: number, name: string): Skill => ({ id, name, description: "", in_play: true });

const group = (overrides: Partial<SkillGroup> & Pick<SkillGroup, "id" | "name">): SkillGroup => ({
  access_name: overrides.name,
  for_everyone: false,
  warbands: [],
  large_only: false,
  learn_note: "",
  skill_ids: [],
  in_play: true,
  ...overrides,
});

const nuln = template(1, "Gunnery School of Nuln", [type(10, "Gunnery School of Nuln")], {
  fighters: [
    fighter("Senior Gunnery Officer", { rules: ["Leader"], skills: ["Hunter"] }),
    fighter("Marksman", { kind: "henchman", plural: "Marksmen" }),
  ],
  rules: [
    { title: "Impeccable Care", warband_type_id: null },
    { title: "Proud To A Fault!", warband_type_id: 99 },
  ],
  upgrades: [],
});
const monks = template(2, "Battle Monks of Cathay", [type(20, "Battle Monks of Cathay")], {
  fighters: [fighter("Dragon Monk", { skill_types: ["Combat", "Battle Monks of Cathay"] })],
  rules: [],
  upgrades: ["Jade Amulet"],
});
const clans = template(
  3,
  "Skaven",
  [type(30, "Clan Eshin"), type(31, "Clan Pestilens"), type(32, "Clan Skryre", false)],
  { fighters: [fighter("Assassin Adept")], rules: [], upgrades: [] }
);

const warbandSources: SearchSources = {
  ...nothing,
  warbandTypes: typeRows([nuln, monks, clans]),
  skills: [skill(1, "Heron Strike"), skill(2, "Hunter"), skill(3, "Strike to Injure")],
  skillGroups: [
    group({ id: 5, name: "Battle Monks of Cathay", skill_ids: [1] }),
    group({ id: 6, name: "Combat", for_everyone: true, skill_ids: [3] }),
  ],
};

/** The warband types found: each one's name, its line (the snippet as it reads) and its link. */
const typeHits = (query: string, sources = warbandSources) =>
  searchEverything(query, sources)
    .find((entry) => entry.id === "warband-types")
    ?.hits.map((hit) => [
      hit.title,
      hit.snippet ? `${hit.snippet.before}${hit.snippet.match}${hit.snippet.after}` : "",
      hit.to,
    ]);

describe("Search everything's warband types", () => {
  it("finds a warband type by its name, opening its row on the Warbands page", () => {
    expect(typeHits("gunnery")).toEqual([
      ["Gunnery School of Nuln", "", "warband-templates?open=1-10"],
    ]);
  });

  it("finds a type by its template's name too, each type in play once", () => {
    expect(typeHits("skaven")).toEqual([
      ["Clan Eshin", "", "warband-templates?open=3-30"],
      ["Clan Pestilens", "", "warband-templates?open=3-31"],
    ]);
  });

  it("finds a fighter's type, the fighter as its line", () => {
    expect(typeHits("senior gunnery officer")).toEqual([
      ["Gunnery School of Nuln", "Hero: Senior Gunnery Officer", "warband-templates?open=1-10"],
    ]);
    expect(typeHits("marksmen")).toEqual([
      ["Gunnery School of Nuln", "Henchmen: Marksmen", "warband-templates?open=1-10"],
    ]);
  });

  it("finds a type by its rules, starting skills, special skills and upgrades", () => {
    expect(typeHits("impeccable")).toEqual([
      ["Gunnery School of Nuln", "Warband rule: Impeccable Care", "warband-templates?open=1-10"],
    ]);
    expect(typeHits("proud to")).toBeUndefined(); // a rule for another type
    expect(typeHits("leader")?.[0]?.[1]).toBe("Rule: Leader (Senior Gunnery Officer)");
    expect(typeHits("hunter")?.[0]?.[1]).toBe("Starts with: Hunter (Senior Gunnery Officer)");
    expect(typeHits("heron")).toEqual([
      ["Battle Monks of Cathay", "Special skill: Heron Strike", "warband-templates?open=2-20"],
    ]);
    expect(typeHits("strike to injure")).toBeUndefined(); // a group for everyone
    expect(typeHits("jade")?.[0]?.[1]).toBe("Upgrade: Jade Amulet");
  });

  it("puts a match on a type's name before one on what it holds", () => {
    const named = template(4, "Monk Hunters", [type(40, "Monk Hunters")], {
      fighters: [],
      rules: [],
      upgrades: [],
    });
    const sources = { ...warbandSources, warbandTypes: typeRows([nuln, monks, clans, named]) };
    expect(typeHits("monk", sources)?.map((hit) => hit[0])).toEqual([
      "Monk Hunters",
      "Battle Monks of Cathay",
    ]);
  });
});

const item = (id: number, name: string, ruleIds: number[]): Item => ({
  id,
  name,
  type: "Miscellaneous",
  in_play: true,
  availabilities: [],
  rules: ruleIds.map((ruleId) => ({
    id: ruleId * 10 + id,
    rule_id: ruleId,
    shared: true,
    name: "",
    summary: "",
    text: "",
    table: [],
  })),
});

const itemRule = (id: number, name: string, text = ""): ItemRule => ({
  id,
  campaign_id: null,
  name,
  summary: "",
  text,
});

describe("Search everything's wargear rules and skill groups", () => {
  it("finds a shared rule an item holds, opening Wargear searched for it at its first item", () => {
    const sources = {
      ...nothing,
      items: [item(7, "Pneumatic Arm", [1]), item(8, "Mordheim Map", [2])],
      itemRules: [
        itemRule(1, "Experimental Technology", "Roll for a misfire."),
        itemRule(2, "Map"),
        itemRule(3, "Experimental Engine"), // no item in play holds it
      ],
    };
    const rules = searchEverything("experimental", sources).find(
      (entry) => entry.id === "item-rules"
    );
    expect(rules?.hits.map((hit) => [hit.title, hit.meta, hit.to])).toEqual([
      ["Experimental Technology", "Pneumatic Arm", "items?q=Experimental%20Technology&open=7"],
    ]);
    expect(searchEverything("misfire", sources)[0].hits[0].title).toBe("Experimental Technology");
  });

  it("finds a skill group in play, opening its row on the Skills page", () => {
    const skillGroups = [
      group({ id: 5, name: "Battle Monks of Cathay" }),
      group({ id: 7, name: "Monkey Business", in_play: false }),
    ];
    const [groups] = searchEverything("monk", { ...nothing, skillGroups });
    expect([groups.label, groups.hits.map((hit) => [hit.title, hit.to])]).toEqual([
      "Skill groups",
      [["Battle Monks of Cathay", "skills?group=5"]],
    ]);
  });
});

describe("Search everything's groups", () => {
  it("come in the reference nav's order, then the rules, then the campaign's own", () => {
    const sources: SearchSources = {
      ...warbandSources,
      items: [item(7, "Monk Staff", [1])],
      itemRules: [itemRule(1, "Monk Discipline")],
      skills: [skill(1, "Monk Strike")],
      skillGroups: [group({ id: 5, name: "Battle Monks of Cathay", skill_ids: [1] })],
      campaign: {
        warbands: [{ id: 2, name: "The Monks", type_name: "Battle Monks of Cathay", user_id: 3 }],
        units: [],
      },
    };
    expect(searchEverything("monk", sources).map((entry) => entry.label)).toEqual([
      "Warband types",
      "Wargear",
      "Wargear rules",
      "Skills",
      "Skill groups",
      "Warbands",
    ]);
  });
});
