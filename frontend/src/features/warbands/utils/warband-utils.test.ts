import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildAvailableSkillsPayload,
  buildHenchmenGroupStatPayload,
  buildStatPayload,
  createHenchmenGroupXpSaver,
  createHeroXpSaver,
  createHiredSwordXpSaver,
  mapHenchmenGroupToForm,
  mapHeroToForm,
  mapHiredSwordToForm,
  parseAvailableSkills,
  validateHenchmenGroupForm,
  validateHeroForm,
  validateHiredSwordForm,
} from "./warband-utils";

import {
  makeHenchmenGroup,
  makeHero,
  makeHiredSword,
  makeVeteranHenchmenGroup,
  makeVeteranHero,
  makeVeteranHiredSword,
} from "@/test/warband-fixtures";

const api = vi.hoisted(() => ({
  updateWarbandHero: vi.fn(),
  updateWarbandHiredSword: vi.fn(),
  updateWarbandHenchmenGroup: vi.fn(),
}));

vi.mock("../api/warbands-api", () => api);

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
      price: "60",
      armour_save: "5",
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

describe("mapHiredSwordToForm", () => {
  it("maps hero fields plus upkeep, rating and the hired-sword flags", () => {
    const hiredSword = makeVeteranHiredSword({ blood_pacted: true, no_level_ups: true });

    expect(mapHiredSwordToForm(hiredSword)).toEqual({
      id: 31,
      name: "Brother Hal",
      unit_type: "Warrior Priest",
      race_id: 1,
      race_name: "Human",
      race: hiredSword.race,
      stats: { M: "4", WS: "4", BS: "3", S: "3", T: "3", W: "1", I: "3", A: "1", Ld: "8" },
      xp: "4",
      price: "40",
      upkeep_price: "15",
      rating: "25",
      armour_save: "4",
      deeds: "Blessed the warband before the storm.",
      is_leader: false,
      trading_action: false,
      large: false,
      caster: "Priest",
      half_rate: false,
      blood_pacted: true,
      no_level_ups: true,
      available_skills: { C: true, Sh: false, A: true, St: false, Sp: false, Spc: false },
      items: hiredSword.items,
      skills: hiredSword.skills,
      spells: hiredSword.spells,
      specials: hiredSword.specials,
    });
  });

  it("never carries a leader or trading action, whatever the payload says", () => {
    const form = mapHiredSwordToForm({
      ...makeHiredSword(),
      is_leader: true,
      trading_action: true,
    } as never);

    expect(form.is_leader).toBe(false);
    expect(form.trading_action).toBe(false);
  });

  it("defaults upkeep and rating to 0", () => {
    const form = mapHiredSwordToForm(makeHiredSword({ upkeep_price: null, rating: null }));

    expect(form.upkeep_price).toBe("0");
    expect(form.rating).toBe("0");
  });
});

describe("mapHenchmenGroupToForm", () => {
  it("maps the group without caster, spells or skill access, keeping its members", () => {
    const group = makeVeteranHenchmenGroup();

    expect(mapHenchmenGroupToForm(group)).toEqual({
      id: 21,
      name: "Black Knives",
      unit_type: "Thugs",
      race_id: 1,
      race_name: "Human",
      race: group.race,
      stats: { M: "4", WS: "3", BS: "3", S: "3", T: "3", W: "1", I: "3", A: "1", Ld: "7" },
      xp: "4",
      max_size: "5",
      price: "25",
      armour_save: "6",
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

  it("validates hired swords exactly like heroes", () => {
    const form = mapHiredSwordToForm(makeHiredSword({ name: "", race_id: null }));

    expect(validateHiredSwordForm(form)).toEqual({
      fields: ["name", "race_id"],
      message: "Missing: Name, Race",
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
    const hiredSword = makeVeteranHiredSword();

    expect(buildStatPayload(mapHeroToForm(hero))).toEqual(profileOf(hero));
    expect(buildStatPayload(mapHiredSwordToForm(hiredSword))).toEqual(
      profileOf(hiredSword as never)
    );
    expect(buildHenchmenGroupStatPayload(mapHenchmenGroupToForm(group))).toEqual(profileOf(group));
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

describe("available skills", () => {
  it("turns the form's checkboxes into full type names, dropping the Spc flag", () => {
    expect(
      buildAvailableSkillsPayload({ C: true, Sh: false, A: true, Spc: true, Necromancy: true })
    ).toEqual(["Combat", "Academic", "Necromancy"]);
  });

  it("parses both the list format and the legacy dict back into checkboxes", () => {
    expect(parseAvailableSkills(["Combat", "Necromancy"])).toEqual({
      C: true,
      Sh: false,
      A: false,
      St: false,
      Sp: false,
      Necromancy: true,
      Spc: true,
    });
    expect(parseAvailableSkills({ Sh: true, Necromancy: true })).toEqual({
      C: false,
      Sh: true,
      A: false,
      St: false,
      Sp: false,
      Spc: false,
      Necromancy: true,
    });
    expect(parseAvailableSkills(null)).toEqual({
      C: false,
      Sh: false,
      A: false,
      St: false,
      Sp: false,
      Spc: false,
    });
  });
});

describe("XP savers (XP +/- on the cards)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-sends the hero's name, type, race, price and leader flag with the new XP (BUG-63, pinned)", async () => {
    const hero = makeVeteranHero();
    const onUpdated = vi.fn();
    api.updateWarbandHero.mockResolvedValue({ ...hero, xp: 8 });

    const resolved = await createHeroXpSaver(9, hero, onUpdated)(8);

    expect(api.updateWarbandHero).toHaveBeenCalledWith(9, 11, {
      name: "Aldric the Bold",
      unit_type: "Captain",
      race: 1,
      price: 60,
      xp: 8,
      is_leader: true,
    });
    expect(onUpdated).toHaveBeenCalledWith({ ...hero, xp: 8 });
    expect(resolved).toBe(8);
  });

  it("re-sends the hired sword's name, type, race, price and upkeep with the new XP", async () => {
    const hiredSword = makeVeteranHiredSword();
    api.updateWarbandHiredSword.mockResolvedValue({ ...hiredSword, xp: 5 });

    await createHiredSwordXpSaver(9, hiredSword)(5);

    expect(api.updateWarbandHiredSword).toHaveBeenCalledWith(9, 31, {
      name: "Brother Hal",
      unit_type: "Warrior Priest",
      race: 1,
      price: 40,
      upkeep_price: 15,
      xp: 5,
    });
  });

  it("re-sends the group's name, type, race and price with the new XP", async () => {
    const group = makeVeteranHenchmenGroup();
    api.updateWarbandHenchmenGroup.mockResolvedValue({ ...group, xp: 5 });

    await createHenchmenGroupXpSaver(9, group)(5);

    expect(api.updateWarbandHenchmenGroup).toHaveBeenCalledWith(9, 21, {
      name: "Black Knives",
      unit_type: "Thugs",
      race: 1,
      price: 25,
      xp: 5,
    });
  });

  it("falls back to the requested XP when the response has none", async () => {
    api.updateWarbandHero.mockResolvedValue({ ...makeHero(), xp: null });

    await expect(createHeroXpSaver(9, makeHero())(3)).resolves.toBe(3);
  });

  it("lets a failed save reject (the bar has no error handling)", async () => {
    api.updateWarbandHenchmenGroup.mockRejectedValue(new Error("Forbidden"));

    await expect(createHenchmenGroupXpSaver(9, makeHenchmenGroup())(1)).rejects.toThrow(
      "Forbidden"
    );
  });
});
