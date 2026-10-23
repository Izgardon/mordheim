import { describe, expect, it } from "vitest";

import { toParticipantRosters } from "@/features/battles/api/battle-queries";
import type { Item } from "@/features/items/types/item-types";
import type { BattlePostbattleState } from "@/features/battles/types/battle-types";
import { ME, battleRosters } from "@/test/battle-fixtures";

import { getItemAvailabilityCostLabel, resolveFindItemCost } from "./find-items";
import { heroDeathRollFor, seriousInjuryNotation } from "./postbattle-rules";
import { buildFinalizeSummary, buildUpkeepRows } from "./postbattle-summary";
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
