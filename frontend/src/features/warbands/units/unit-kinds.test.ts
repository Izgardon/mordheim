import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { buildStatPayload } from "./unit-form-helpers";
import { currentHireCost } from "../components/henchmen/utils/henchmen-cost";
import { useUnitXpSaver } from "../hooks/units/useUnitMutations";
import { heroKind, mapHeroToForm, validateHeroForm } from "./kinds/hero";
import { henchmenKind, mapHenchmenGroupToForm, validateHenchmenGroupForm } from "./kinds/henchmen";
import { hirelingKind, mapHirelingToForm, validateHirelingForm } from "./kinds/hireling";
import { unitKinds } from "./unit-kinds";

import {
  makeHenchmenGroup,
  makeHero,
  makeHireling,
  makeVeteranHenchmenGroup,
  makeVeteranHero,
  makeVeteranHireling,
} from "@/test/warband-fixtures";
import { createQueryWrapper } from "@/test/query-test-utils";

import type { Unit, UnitKindKey } from "../types/units";
import type { UnitKindConfig } from "./unit-kind-types";

const api = vi.hoisted(() => ({
  updateWarbandHero: vi.fn(),
  updateWarbandHireling: vi.fn(),
  updateWarbandHenchmenGroup: vi.fn(),
}));

vi.mock("./unit-api", async () => (await import("@/test/unit-api-mock")).unitApiModuleMock(api));

/** The cards' XP save (`useUnitXpSaver`), taken out of a card. */
const createUnitXpSaver = <K extends UnitKindKey>(
  kind: UnitKindConfig<K>,
  warbandId: number,
  unit: Unit<K>,
  onUpdated?: (updated: Unit<K>) => void
) =>
  renderHook(() => useUnitXpSaver(kind, warbandId, unit, onUpdated), {
    wrapper: createQueryWrapper(),
  }).result.current;

const veteranStats = { M: "4", WS: "4", BS: "4", S: "3", T: "3", W: "1", I: "4", A: "1", Ld: "8" };

describe("mapHeroToForm", () => {
  it("maps every hero field to its form string or flag", () => {
    const hero = makeVeteranHero();

    expect(mapHeroToForm(hero)).toEqual({
      id: 11,
      name: "Aldric the Bold",
      unit_type: "Captain",
      race_id: 1,
      race_name: "Human",
      race: hero.race,
      stats: veteranStats,
      xp: "7",
      level_up: "1",
      savedLevelUp: 1,
      missing_games: "0",
      missing_reason: "",
      price: "60",
      armour_save: "5+",
      deeds: "Slew the Possessed at the well.",
      is_leader: true,
      trading_action: true,
      large: false,
      caster: "Wizard",
      half_rate: false,
      available_skills: { C: true, Sh: false, A: true, St: false, Sp: false, Spc: false },
      items: hero.items,
      skills: hero.skills,
      spells: hero.spells,
      specials: hero.specials,
    });
  });

  it("fills blanks for missing values", () => {
    const form = mapHeroToForm(
      makeHero({
        name: null,
        unit_type: null,
        race_id: null,
        xp: null,
        price: null,
        armour_save: null,
        movement: null,
        caster: null,
        spells: undefined,
        specials: undefined,
      })
    );

    expect(form).toMatchObject({
      name: "",
      unit_type: "",
      race_id: null,
      race_name: "",
      race: null,
      xp: "0",
      price: "0",
      armour_save: "",
      deeds: "",
      is_leader: false,
      trading_action: false,
      caster: "No",
      spells: [],
      specials: [],
    });
    expect(form.stats.M).toBe("");
    expect(form.available_skills).toEqual({
      C: false,
      Sh: false,
      A: false,
      St: false,
      Sp: false,
      Spc: false,
    });
  });

  it.each([
    ["priest", "Priest"],
    [" Wizard ", "Wizard"],
    ["Necromancer", "No"],
    ["", "No"],
  ])("normalises caster %j to %j", (caster, expected) => {
    expect(mapHeroToForm(makeHero({ caster: caster as never })).caster).toBe(expected);
  });
});

describe("mapHirelingToForm", () => {
  it("maps hero fields plus upkeep, rating, the hired sword flags and its terms", () => {
    const hireling = makeVeteranHireling({
      blood_pacted: true,
      no_level_ups: true,
      kind: "dramatis_persona",
      injury_table: "hero",
      stays: "one_battle",
      payment_note: "a favour",
    });

    expect(mapHirelingToForm(hireling)).toEqual({
      id: 31,
      name: "Brother Hal",
      unit_type: "Warrior Priest",
      kind: "dramatis_persona",
      injury_table: "hero",
      stays: "one_battle",
      payment_note: "a favour",
      race_id: 1,
      race_name: "Human",
      race: hireling.race,
      stats: { M: "4", WS: "4", BS: "3", S: "3", T: "3", W: "1", I: "3", A: "1", Ld: "8" },
      xp: "4",
      level_up: "1",
      savedLevelUp: 1,
      missing_games: "0",
      missing_reason: "",
      price: "40",
      upkeep_price: "15",
      rating: "25",
      armour_save: "4+",
      deeds: "Blessed the warband before the storm.",
      is_leader: false,
      trading_action: false,
      large: false,
      caster: "Priest",
      half_rate: false,
      blood_pacted: true,
      no_level_ups: true,
      available_skills: { C: true, Sh: false, A: true, St: false, Sp: false, Spc: false },
      items: hireling.items,
      skills: hireling.skills,
      spells: hireling.spells,
      specials: hireling.specials,
    });
  });

  it("never carries a leader or trading action, whatever the payload says", () => {
    const form = mapHirelingToForm({
      ...makeHireling(),
      is_leader: true,
      trading_action: true,
    } as never);

    expect(form.is_leader).toBe(false);
    expect(form.trading_action).toBe(false);
  });

  it("defaults upkeep and rating to 0", () => {
    const form = mapHirelingToForm(makeHireling({ upkeep_price: null, rating: null }));

    expect(form.upkeep_price).toBe("0");
    expect(form.rating).toBe("0");
  });
});

describe("mapHenchmenGroupToForm", () => {
  it("keeps the server's hire_cost only while the price, XP and items are as it priced them (decision 7)", () => {
    const form = mapHenchmenGroupToForm(makeVeteranHenchmenGroup({ hire_cost: 43 }));

    expect(currentHireCost(form)).toBe(43);
    expect(currentHireCost({ ...form, xp: "6" })).toBeUndefined();
    expect(currentHireCost({ ...form, price: "30" })).toBeUndefined();
    expect(currentHireCost({ ...form, items: form.items.slice(1) })).toBeUndefined();
  });

  it("maps the group without caster, spells or skill access, keeping its members", () => {
    const group = makeVeteranHenchmenGroup();

    expect(mapHenchmenGroupToForm(group)).toEqual({
      id: 21,
      source_beast_id: null, // a group recruited from a creature: its validation asks for less
      name: "Black Knives",
      unit_type: "Thugs",
      race_id: 1,
      race_name: "Human",
      race: group.race,
      stats: { M: "4", WS: "3", BS: "3", S: "3", T: "3", W: "1", I: "3", A: "1", Ld: "7" },
      xp: "4",
      level_up: "1",
      savedLevelUp: 1,
      missing_games: "0",
      missing_reason: "",
      max_size: "5",
      hireCostFor: "25|4|104,104,104,102,102,102",
      price: "25",
      armour_save: "6+",
      deeds: "Held the bridge for a whole turn.",
      large: false,
      half_rate: false,
      no_level_ups: false,
      items: group.items,
      skills: group.skills,
      specials: group.specials,
      henchmen: group.henchmen,
    });
  });

  it("defaults the group size to 5", () => {
    expect(mapHenchmenGroupToForm(makeHenchmenGroup({ max_size: null })).max_size).toBe("5");
  });
});

describe("form validators", () => {
  const emptyHero = mapHeroToForm(makeHero({ name: " ", unit_type: "", race_id: null }));

  it("lists the missing hero fields in order", () => {
    expect(validateHeroForm(emptyHero)).toEqual({
      fields: ["name", "unit_type", "race_id"],
      message: "Missing: Name, Type, Race",
    });
    expect(validateHeroForm(mapHeroToForm(makeVeteranHero()))).toBeNull();
  });

  it("validates hired swords on name and type, leaving the race optional (a hire may have none)", () => {
    const form = mapHirelingToForm(makeHireling({ name: "", race_id: null }));

    expect(validateHirelingForm(form)).toEqual({ fields: ["name"], message: "Missing: Name" });
    expect(validateHirelingForm({ ...form, name: "Grukk" })).toBeNull();
  });

  it("reads an older payload without terms as a hired sword on the henchman table who stays", () => {
    const form = mapHirelingToForm(makeHireling());

    expect(form).toMatchObject({
      kind: "hired_sword",
      injury_table: "henchman",
      stays: "always",
      payment_note: "",
    });
  });

  it("also requires every henchman to have a name", () => {
    const group = mapHenchmenGroupToForm(makeVeteranHenchmenGroup());
    group.henchmen = [...group.henchmen, { id: 0, name: "  ", kills: 0, dead: false }];

    expect(validateHenchmenGroupForm(group)).toEqual({
      fields: ["henchmen_names"],
      message: "Missing: Henchmen names",
    });
    expect(
      validateHenchmenGroupForm(mapHenchmenGroupToForm(makeVeteranHenchmenGroup()))
    ).toBeNull();
  });

  it("asks a group recruited from a creature for no race or member names (it has neither by design)", () => {
    const kennel = makeVeteranHenchmenGroup({
      name: "Kennel",
      unit_type: "Wardogs",
      race_id: null,
      race_name: null,
      source_beast_id: 3,
      beast_kind: "creature",
      henchmen: [{ id: 6, name: "", kills: 0, dead: false }],
    });

    expect(validateHenchmenGroupForm(mapHenchmenGroupToForm(kennel))).toBeNull();
    expect(validateHenchmenGroupForm(mapHenchmenGroupToForm({ ...kennel, name: "" }))).toEqual({
      fields: ["name"],
      message: "Missing: Name",
    });
    expect(
      validateHenchmenGroupForm(mapHenchmenGroupToForm({ ...kennel, source_beast_id: null }))
    ).toEqual({ fields: ["race_id", "henchmen_names"], message: "Missing: Race, Henchmen names" });
  });
});

describe("stat payload builders", () => {
  const profileOf = (unit: ReturnType<typeof makeVeteranHero> | typeof group) => ({
    movement: unit.movement,
    weapon_skill: unit.weapon_skill,
    ballistic_skill: unit.ballistic_skill,
    strength: unit.strength,
    toughness: unit.toughness,
    wounds: unit.wounds,
    initiative: unit.initiative,
    attacks: unit.attacks,
    leadership: unit.leadership,
  });
  const group = makeVeteranHenchmenGroup();

  it("round-trips the stat profile of every kind through its form", () => {
    const hero = makeVeteranHero();
    const hireling = makeVeteranHireling();

    expect(buildStatPayload(mapHeroToForm(hero))).toEqual(profileOf(hero));
    expect(buildStatPayload(mapHirelingToForm(hireling))).toEqual(profileOf(hireling as never));
    expect(buildStatPayload(mapHenchmenGroupToForm(group))).toEqual(profileOf(group));
  });

  it("drops blank and non-numeric stats instead of sending them", () => {
    const form = mapHeroToForm(makeVeteranHero());
    form.stats = { ...form.stats, M: "", WS: "abc", BS: " 5 " };

    const payload = buildStatPayload(form);

    expect(payload).not.toHaveProperty("movement");
    expect(payload).not.toHaveProperty("weapon_skill");
    expect(payload.ballistic_skill).toBe(5);
  });
});

describe("XP savers (XP +/- on the cards)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the new XP alone, for every kind (BUG-63)", async () => {
    const hero = makeVeteranHero();
    const onUpdated = vi.fn();
    api.updateWarbandHero.mockResolvedValue({ ...hero, xp: 8 });
    api.updateWarbandHireling.mockResolvedValue({ ...makeVeteranHireling(), xp: 5 });
    api.updateWarbandHenchmenGroup.mockResolvedValue({ ...makeVeteranHenchmenGroup(), xp: 5 });

    const resolved = await createUnitXpSaver(heroKind, 9, hero, onUpdated)(8);
    await createUnitXpSaver(hirelingKind, 9, makeVeteranHireling())(5);
    await createUnitXpSaver(henchmenKind, 9, makeVeteranHenchmenGroup())(5);

    // No name, type, race or price from a possibly stale card to undo edits made elsewhere.
    expect(api.updateWarbandHero).toHaveBeenCalledWith(9, 11, { xp: 8 });
    expect(api.updateWarbandHireling).toHaveBeenCalledWith(9, 31, { xp: 5 });
    expect(api.updateWarbandHenchmenGroup).toHaveBeenCalledWith(9, 21, { xp: 5 });
    expect(onUpdated).toHaveBeenCalledWith({ ...hero, xp: 8 });
    expect(resolved).toBe(8);
  });

  it("falls back to the requested XP when the response has none", async () => {
    api.updateWarbandHero.mockResolvedValue({ ...makeHero(), xp: null });

    await expect(createUnitXpSaver(heroKind, 9, makeHero())(3)).resolves.toBe(3);
  });

  it("lets a failed save reject", async () => {
    api.updateWarbandHenchmenGroup.mockRejectedValue(new Error("Forbidden"));

    await expect(createUnitXpSaver(henchmenKind, 9, makeHenchmenGroup())(1)).rejects.toThrow(
      "Forbidden"
    );
  });
});

describe("kind registry", () => {
  it("keys each kind by its item-transfer type and its section", () => {
    expect(unitKinds.hero.section).toBe("heroes");
    expect(unitKinds.henchmen_group.section).toBe("henchmen");
    expect(unitKinds.hireling.section).toBe("hirelings");
    for (const [key, kind] of Object.entries(unitKinds)) {
      expect(kind.key).toBe(key);
    }
  });

  it("counts heroes and hired swords on the heroes' table and fractional XP, henchmen on whole XP (decision 8)", () => {
    expect(heroKind.getLevelInfo(7.5).level).toBe(4);
    expect(hirelingKind.getLevelInfo(7.5).level).toBe(4);
    expect(hirelingKind.getLevelInfo(4.5).nextLevelAt).toBe(6);
    expect(hirelingKind.thresholdsKey).toBe("hero_level_thresholds");
    expect(henchmenKind.getLevelInfo(4.5).nextLevelAt).toBe(5);
  });

  it("names each kind's list in the sheet payload", () => {
    expect(heroKind.collection).toBe("heroes");
    expect(henchmenKind.collection).toBe("henchmen_groups");
    expect(hirelingKind.collection).toBe("hirelings");
  });

  it("lets only henchmen and hired swords switch off XP and level-ups", () => {
    expect(heroKind.showsXpBar(makeHero({ no_level_ups: true } as never))).toBe(true);
    expect(heroKind.canLevelUp(makeHero({ level_up: 1, no_level_ups: true } as never))).toBe(true);
    expect(henchmenKind.showsXpBar(makeHenchmenGroup({ no_level_ups: true }))).toBe(false);
    expect(hirelingKind.canLevelUp(makeHireling({ level_up: 1, no_level_ups: true }))).toBe(false);
    expect(hirelingKind.canLevelUp(makeHireling({ level_up: 1 }))).toBe(true);
  });

  it("sends level_up 0 for a session-created unit of every kind (BUG-65)", () => {
    const hero = mapHeroToForm(makeVeteranHero());
    const group = mapHenchmenGroupToForm(makeVeteranHenchmenGroup());
    const hired = mapHirelingToForm(makeVeteranHireling());

    expect(heroKind.buildPayload(hero, { isSessionCreated: true }).level_up).toBe(0);
    expect(heroKind.buildPayload(hero, { isSessionCreated: false })).not.toHaveProperty("level_up");
    expect(henchmenKind.buildPayload(group, { isSessionCreated: true }).level_up).toBe(0);
    expect(hirelingKind.buildPayload(hired, { isSessionCreated: true }).level_up).toBe(0);
    expect(hirelingKind.buildPayload(hired, { isSessionCreated: false })).not.toHaveProperty(
      "level_up"
    );
  });

  it("sends an edited pending level-up count as level_up and leaves an unchanged one out (decision 5)", () => {
    const hero = mapHeroToForm(makeVeteranHero({ level_up: 2 }));
    const group = mapHenchmenGroupToForm(makeVeteranHenchmenGroup({ level_up: 1 }));

    expect(
      heroKind.buildPayload({ ...hero, xp: "3" }, { isSessionCreated: false })
    ).not.toHaveProperty("level_up");
    expect(heroKind.buildPayload({ ...hero, level_up: "0" }, { isSessionCreated: false })).toEqual(
      expect.objectContaining({ level_up: 0 })
    );
    expect(heroKind.buildPayload({ ...hero, level_up: "3" }, { isSessionCreated: false })).toEqual(
      expect.objectContaining({ level_up: 3 })
    );
    // A cleared or negative count is sent as 0.
    expect(
      henchmenKind.buildPayload({ ...group, level_up: "" }, { isSessionCreated: false })
    ).toEqual(expect.objectContaining({ level_up: 0 }));
    expect(
      henchmenKind.buildPayload({ ...group, level_up: "-2" }, { isSessionCreated: false })
    ).toEqual(expect.objectContaining({ level_up: 0 }));
  });

  it("offers the kind's advances", () => {
    expect(heroKind.advanceOptions).toEqual(hirelingKind.advanceOptions);
    expect(heroKind.advanceOptions).toContain("Spell");
    expect(henchmenKind.advanceOptions).toEqual(["WS", "BS", "S", "I", "A", "Ld"]);
  });
});
