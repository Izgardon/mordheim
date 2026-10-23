import { describe, expect, it } from "vitest";

import { toParticipantRosters } from "@/features/battles/api/battle-queries";
import type { Item } from "@/features/items/types/item-types";
import type { BattlePostbattleState } from "@/features/battles/types/battle-types";
import type { WarbandSheet } from "@/features/warbands/types/warband-sheet";
import { ME, battleRosters } from "@/test/battle-fixtures";

import { getItemAvailabilityCostLabel, resolveFindItemCost } from "./find-items";
import { heroDeathRollFor, seriousInjuryNotation } from "./postbattle-rules";
import { buildFinalizeSummary, buildUpkeepRows, hasLeft } from "./postbattle-summary";
import type { PostbattleRenderableGroup } from "./postbattle-utils";

const roster = toParticipantRosters(battleRosters())[ME.id];

const draft = {
  exploration: { dice_values: [], resource_id: null },
  finds: { gold_crowns: 12, items: [] },
  upkeep: { pay_upkeep: true, entries: { "hireling:4": { unit_name: "Ogre", cost: 15 } } },
  unit_results: {},
} as unknown as BattlePostbattleState;

describe("postbattle summary", () => {
  it("lists each hired sword's upkeep, with the draft's cost and the Dead tick", () => {
    expect(buildUpkeepRows(draft, roster)).toEqual([
      {
        unitKey: "hireling:4",
        unitName: "Ogre",
        unitType: "Ogre",
        cost: 15,
        costExpression: "15 gc",
        hasFixedCost: true,
        dead: false,
      },
    ]);
    expect(buildUpkeepRows(null, roster)).toEqual([]);
  });

  it("lists no upkeep for a hireling who stays for one battle, and takes the suggestion's formula as the reminder", () => {
    const [ogre] = roster.hirelings;
    const kinds = {
      ...roster,
      hirelings: [
        { ...ogre, upkeepPrice: 0, upkeepCostExpression: "" },
        { ...ogre, key: "hireling:5", displayName: "Bertha", stays: "one_battle" as const },
      ],
    };
    const withFormula = {
      ...draft,
      upkeep: {
        pay_upkeep: true,
        entries: {
          "hireling:4": { unit_name: "Ogre", cost: 0, cost_expression: "1 piece of wyrdstone" },
        },
      },
    } as BattlePostbattleState;

    expect(buildUpkeepRows(withFormula, kinds)).toEqual([
      expect.objectContaining({
        unitKey: "hireling:4",
        cost: 0,
        costExpression: "1 piece of wyrdstone",
        hasFixedCost: true,
      }),
    ]);
  });

  it("sums up deaths, XP, the kill lists, finds and the upkeep that is paid", () => {
    const groups = [
      {
        key: "heroes",
        rows: [
          {
            unitKey: "hero:1",
            unitName: "Wolf",
            dead: false,
            canGainXp: true,
            xpEarned: 3,
            killCount: 2,
            seriousInjuryRolls: [],
          },
          {
            unitKey: "hero:3",
            unitName: "Rolf",
            dead: true,
            canGainXp: true,
            xpEarned: 0,
            killCount: 0,
            seriousInjuryRolls: [],
          },
        ],
      },
    ] as unknown as PostbattleRenderableGroup[];

    const summary = buildFinalizeSummary({
      groups,
      draft,
      // The kill list is the number, not the row's stored count (BATL-NEW-06).
      victimsByUnitKey: { "hero:1": ["Player's Black Fang"], "hero:3": [] },
      statChangeRows: [],
      events: [],
      userId: ME.id,
      roster,
      sheet: undefined,
      campaign: null,
      resourceAmount: 2,
      resourceName: "Treasure",
      upkeepRows: buildUpkeepRows(draft, roster),
      upkeepTotal: 15,
    });

    expect(summary.deaths.map((row) => row.unitKey)).toEqual(["hero:3"]);
    expect(summary.xpAwards).toEqual([{ unitKey: "hero:1", unitName: "Wolf", xpEarned: 3 }]);
    expect(summary.kills).toEqual([
      { unitKey: "hero:1", unitName: "Wolf", victims: ["Player's Black Fang"] },
    ]);
    expect(summary).toMatchObject({ findsGoldCrowns: 12, payUpkeep: true, upkeepTotal: 15 });
    expect(summary.upkeepRows).toHaveLength(1);
  });

  it("lists the mounts that die, but not one a henchman who died took with him (step 5)", () => {
    const groups = [
      {
        key: "henchmen:Youngbloods",
        rows: [{ unitKey: "henchman:2", unitName: "A", dead: true, seriousInjuryRolls: [] }],
      },
    ] as unknown as PostbattleRenderableGroup[];
    const withMounts = {
      ...draft,
      mount_survival: {
        "hero:1": { roll: 2, dead: true },
        "hero:3": { roll: 5, dead: false },
        "henchman:2": { roll: 1, dead: true },
      },
    } as BattlePostbattleState;

    const summary = buildFinalizeSummary({
      groups,
      draft: withMounts,
      victimsByUnitKey: {},
      statChangeRows: [],
      events: [],
      userId: ME.id,
      roster,
      sheet: undefined,
      campaign: null,
      suggestion: {
        unit_results: {},
        exploration: { dice_count: 0 },
        upkeep: { entries: {} },
        mount_survival: {
          entries: {
            "hero:1": { unit_name: "Wolf", mount: "Warhorse", dies_on: 2 },
            "hero:3": { unit_name: "Rolf", mount: "Pony", dies_on: 2 },
            "henchman:2": { unit_name: "A", mount: "Horse", dies_on: 2 },
          },
        },
      },
      resourceAmount: 0,
      resourceName: null,
      upkeepRows: [],
      upkeepTotal: 0,
    });

    expect(summary.mountsLost).toEqual([
      { unitKey: "hero:1", unitName: "Wolf", mount: "Warhorse" },
    ]);
  });

  it("leaves out every result of a hireling who has left the warband, as finalise does (step 2 browser check)", () => {
    const frenzy = {
      result_label: "Frenzy",
      effect: { kind: "special", special: "Frenzy" },
      apply: true,
    };
    const groups = [
      {
        key: "heroes",
        rows: [
          { unitKey: "hero:1", unitName: "Wolf", dead: false, canGainXp: true, xpEarned: 2 },
          { unitKey: "hero:3", unitName: "Rolf", dead: true, canGainXp: true, xpEarned: 1 },
        ],
      },
      {
        key: "hirelings",
        rows: [
          {
            unitKey: "hireling:4",
            unitName: "Ogre",
            dead: false,
            canGainXp: true,
            xpEarned: 1,
            seriousInjuryRolls: [frenzy],
          },
          {
            unitKey: "hireling:5",
            unitName: "Bertha",
            dead: false,
            canGainXp: true,
            xpEarned: 1,
            seriousInjuryRolls: [frenzy],
          },
        ],
      },
    ].map((group) => ({
      ...group,
      rows: group.rows.map((row) => ({ seriousInjuryRolls: [], killCount: 0, ...row })),
    })) as unknown as PostbattleRenderableGroup[];

    const summary = buildFinalizeSummary({
      groups,
      draft,
      victimsByUnitKey: { "hireling:5": ["Player's Black Fang"] },
      statChangeRows: [
        { key: "hireling:5", unitKeys: ["hireling:5"], kept: true },
        { key: "hireling:4", unitKeys: ["hireling:4"], kept: true },
      ] as never,
      events: [],
      userId: ME.id,
      roster,
      sheet: undefined,
      campaign: null,
      resourceAmount: 0,
      resourceName: null,
      upkeepRows: [
        { unitKey: "hireling:5", unitName: "Bertha", cost: 10, dead: false },
        { unitKey: "hireling:4", unitName: "Ogre", cost: 15, dead: false },
      ] as never,
      upkeepTotal: 15,
      // Bertha (hireling 5) was dismissed from the Leaving section.
      leftUnitKeys: ["hireling:5"],
    });

    expect(summary.injuries.map((line) => line.text)).toEqual(["Ogre: Frenzy (Gains Frenzy)"]);
    expect(summary.xpAwards.map((award) => award.unitName)).toEqual(["Wolf", "Rolf", "Ogre"]);
    expect(summary.deaths.map((row) => row.unitKey)).toEqual(["hero:3"]);
    expect(summary.kills).toEqual([]);
    expect(summary.keptStatChanges.map((change) => change.key)).toEqual(["hireling:4"]);
    expect(summary.upkeepRows.map((row) => row.unitKey)).toEqual(["hireling:4"]);
  });

  it("counts a suggested leaver as gone once the warband's sheet no longer has him, and nobody before the sheet arrives", () => {
    const sheet = { hirelings: [{ id: 4 }] } as unknown as WarbandSheet;

    expect(hasLeft(5, sheet)).toBe(true);
    expect(hasLeft(4, sheet)).toBe(false);
    expect(hasLeft(5, undefined)).toBe(false);
    expect(hasLeft(null, sheet)).toBe(false);
  });

  it("values a find at its cheapest availability", () => {
    const item = { availabilities: [{ cost: 30 }, { cost: 15.7 }] } as unknown as Item;
    expect(resolveFindItemCost(item)).toBe(15);
    expect(getItemAvailabilityCostLabel(item)).toBe("30 gc / 15 gc");
    const noCost = { availabilities: [] } as unknown as Item;
    expect(resolveFindItemCost(noCost)).toBeNull();
    expect(getItemAvailabilityCostLabel(noCost)).toBe("No base cost");
  });

  it("rolls heroes on the campaign's table and everyone else on a D6", () => {
    expect(heroDeathRollFor(undefined)).toBe("d66");
    expect(seriousInjuryNotation("hero", "d66")).toBe("2d6");
    expect(seriousInjuryNotation("hero", "d100")).toBe("1d100");
    expect(seriousInjuryNotation("henchman", "d100")).toBe("1d6");
  });
});
