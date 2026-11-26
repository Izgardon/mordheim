import { describe, expect, it } from "vitest";

import type { HenchmenGroup, UnitKill } from "../../types/warband-types";
import { campaignSummary } from "@/test/campaign-fixtures";
import { makeHero } from "@/test/warband-fixtures";

import {
  boxRows,
  formatXp,
  killLine,
  memberName,
  statValues,
  unitTypeLine,
  xpTable,
  type RosterUnit,
} from "./unit-view";

const kill = (fields: Partial<UnitKill> = {}): UnitKill => ({
  id: 1,
  victim: "Magister Halvard",
  victim_kind: "hero",
  victim_warband: "Grey Order",
  battle_id: 4,
  scenario: "Street Fight",
  date: "2026-03-24T20:00:00+00:00",
  round: 2,
  phase: "fight",
  how: "melee",
  by: null,
  ...fields,
});

// William, 22 Nov 2026: "The actual kills text in the popout should just read the name followed by
// 'in melee' or with ranged or with magic etc for all units"
describe("killLine", () => {
  it("names the victim and how they fell", () => {
    expect(killLine(kill())).toBe("Magister Halvard in melee");
    expect(killLine(kill({ how: "shooting" }))).toBe("Magister Halvard with ranged");
    expect(killLine(kill({ how: "magic" }))).toBe("Magister Halvard with magic");
    expect(killLine(kill({ how: "other" }))).toBe("Magister Halvard by other means");
  });

  it("is the victim alone when the battle logged no how", () => {
    expect(killLine(kill({ by: "Kurt", how: null }))).toBe("Magister Halvard");
  });
});

describe("unitTypeLine", () => {
  const hireling = (fields: Record<string, unknown>) =>
    ({ kind: "hireling", unit: { id: 3, ...fields } }) as unknown as RosterUnit;

  it("shows the type, unless it is the name already", () => {
    expect(unitTypeLine(hireling({ name: "Grukk", unit_type: "Ogre Bodyguard" }))).toBe(
      "Ogre Bodyguard"
    );
    // a dramatis persona hired as himself printed his name twice (After the passes)
    const persona = { name: "Bertha Bestraufrung", unit_type: "Bertha Bestraufrung" };
    expect(unitTypeLine(hireling({ ...persona, kind: "dramatis_persona" }))).toBe(
      "Dramatis persona"
    );
    expect(unitTypeLine(hireling({ name: "", unit_type: "Ogre Bodyguard" }))).toBe("Hired sword");
    expect(unitTypeLine(hireling({ name: "", unit_type: "" }))).toBe("");
  });
});

describe("memberName", () => {
  it("calls a member without a name by his group's type and number, as the battle does", () => {
    const group = {
      unit_type: "Wardogs",
      henchmen: [
        { id: 4, name: "", dead: false },
        { id: 5, name: "", dead: true },
        { id: 6, name: " ", dead: false },
        { id: 7, name: "Fang", dead: false },
      ],
    } as unknown as HenchmenGroup;

    expect(group.henchmen.map((member) => memberName(group, member))).toEqual([
      "Wardogs 1",
      "Wardogs",
      "Wardogs 2",
      "Fang",
    ]);
  });
});

describe("formatXp", () => {
  it("shows a half-rate unit's half point as ½", () => {
    expect(formatXp(12.5)).toBe("12½");
    expect(formatXp(0.5)).toBe("½");
    expect(formatXp(14)).toBe("14");
    expect(formatXp(0)).toBe("0");
  });
});

describe("statValues", () => {
  it("shows a written stat as its number then its text, and a dash as a dash", () => {
    const hero = makeHero({
      attacks: 2,
      weapon_skill: null,
      strength: 3,
      toughness: 4,
      written_stats: { attacks: "(2)", weapon_skill: "-", toughness: "*" },
    });
    const { values } = statValues({ kind: "hero", unit: hero });
    expect([values.A, values.WS, values.S, values.T]).toEqual(["2(2)", "-", 3, "4*"]);
  });

  it("shows the mount's Move, picked out, and the save the unit holds", () => {
    const hero = makeHero({
      movement: 4,
      armour_save: 5,
      mount: { name: "Warhorse" },
      effective_stats: { movement: 8 },
    } as never);

    const { values, highlighted } = statValues({ kind: "hero", unit: hero });

    expect([values.M, values.Sv, highlighted]).toEqual([8, "5+", ["M"]]); // mounting wrote the 5+
  });

  it("shows a dash for no save and picks nothing out on foot", () => {
    const { values, highlighted } = statValues({
      kind: "hero",
      unit: makeHero({ movement: 4, armour_save: null }),
    });

    expect([values.M, values.Sv, highlighted]).toEqual([4, "–", []]);
  });
});

describe("boxRows", () => {
  it("keeps his injuries in his one Specials list, in their order", () => {
    const hero = makeHero({
      specials: [
        { id: 1, name: "Hatred", type: "Psychology", kind: "boon", category: "aura" },
        { id: 2, name: "Old Battle Wound", type: "Injury", kind: "bane", category: "injury" },
        { id: 3, name: "Large", type: "Trait", kind: "trait", category: "body" },
      ],
    });
    const rows = boxRows({ kind: "hero", unit: hero });
    expect(rows.specials.map((special) => special.name)).toEqual([
      "Hatred",
      "Old Battle Wound",
      "Large",
    ]);
    expect(Object.keys(rows)).toEqual(["items", "skills", "specials", "spells"]);
  });
});

describe("xpTable", () => {
  it("falls back to the henchmen table for henchmen groups and hired swords", () => {
    // William, 12 Nov 2026: "hired swords level up like henchmen so get the same levels and gaps
    // as them by default" (they still roll on the hero advance table)
    expect(xpTable("hireling", null)).toEqual([2, 5, 9, 14]);
    expect(xpTable("henchmen_group", null)).toEqual([2, 5, 9, 14]);
    expect(xpTable("hero", null).slice(0, 3)).toEqual([2, 4, 6]);
  });

  it("reads each kind's own campaign table", () => {
    const campaign = campaignSummary({
      hero_level_thresholds: [3, 7],
      henchmen_level_thresholds: [1, 3],
      hired_sword_level_thresholds: [4, 8],
    });
    expect(xpTable("hireling", campaign)).toEqual([4, 8]);
    expect(xpTable("henchmen_group", campaign)).toEqual([1, 3]);
    expect(xpTable("hero", campaign)).toEqual([3, 7]);
  });
});
