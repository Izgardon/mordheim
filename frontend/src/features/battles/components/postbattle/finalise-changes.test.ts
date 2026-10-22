import { describe, expect, it } from "vitest";

import { toParticipantRosters } from "@/features/battles/api/battle-queries";
import type { WarbandSheet } from "@/features/warbands/types/warband-sheet";
import { ME, OPPONENT, battleEvent, battleRosters } from "@/test/battle-fixtures";

import {
  buildGold,
  buildInjuries,
  buildItemsLost,
  buildItemsUsed,
  buildLevelUps,
} from "./finalise-changes";
import type { PostbattleRenderableRow } from "./postbattle-utils";

const roster = toParticipantRosters(battleRosters())[ME.id];
const sheet = {
  warband: { id: ME.warband.id, name: ME.warband.name, gold: 50 },
  summary: {},
  heroes: [{ id: 1, xp: 7, half_rate: true }],
  hirelings: [{ id: 4, xp: 1, half_rate: false, no_level_ups: true }],
  henchmen_groups: [
    { id: 11, name: "Youngbloods", xp: 4, half_rate: false, henchmen: [{ id: 2 }] },
  ],
} as unknown as WarbandSheet;

const row = (overrides: Partial<PostbattleRenderableRow>) =>
  ({ dead: false, seriousInjuryRolls: [], groupName: "", ...overrides }) as PostbattleRenderableRow;

describe("finalise changes", () => {
  it("counts level-ups on the campaign's thresholds: half rate halves, no-level-up units never level", () => {
    const awards = [
      {
        unitKey: "hero:1",
        unitName: "Wolf",
        unitKind: "hero" as const,
        groupName: "",
        xpEarned: 3,
      },
      {
        unitKey: "hired_sword:4",
        unitName: "Ogre",
        unitKind: "hired_sword" as const,
        groupName: "",
        xpEarned: 5,
      },
      {
        unitKey: "henchman:2",
        unitName: "Lad",
        unitKind: "henchman" as const,
        groupName: "Youngbloods",
        xpEarned: 1,
      },
    ];
    // Wolf gains 1.5 (7 → 8.5): one threshold (8) on the campaign's table [8, 12]; the group
    // reaches 5 on [5, 9]; the Ogre gains no level-ups.
    expect(
      buildLevelUps(awards, sheet, {
        hero_level_thresholds: [8, 12],
        henchmen_level_thresholds: [5, 9],
      })
    ).toEqual([
      { key: "hero:1", unitName: "Wolf", levelUps: 1, xpFrom: 7, xpTo: 8.5 },
      { key: "group:11", unitName: "Youngbloods", levelUps: 1, xpFrom: 4, xpTo: 5 },
    ]);
    expect(buildLevelUps(awards, undefined, null)).toEqual([]);
  });

  it("takes the server's level-ups where the XP is the suggested one, else counts them (BATL-NEW-10)", () => {
    const awards = [
      {
        unitKey: "hero:1",
        unitName: "Wolf",
        unitKind: "hero" as const,
        groupName: "",
        xpEarned: 3,
      },
      {
        unitKey: "henchman:2",
        unitName: "Lad",
        unitKind: "henchman" as const,
        groupName: "Youngbloods",
        xpEarned: 2,
      },
    ];
    const server = {
      // Wolf's XP was changed by hand: the sheet and thresholds count it.
      "hero:1": { xp_earned: 1, level_ups: 0 },
      "henchman:2": { xp_earned: 2, level_ups: 2 },
    };
    expect(buildLevelUps(awards, sheet, { hero_level_thresholds: [8, 12] }, server)).toEqual([
      { key: "hero:1", unitName: "Wolf", levelUps: 1, xpFrom: 7, xpTo: 8.5 },
      { key: "group:Youngbloods", unitName: "Youngbloods", levelUps: 2 },
    ]);
  });

  it("lists the player's own item uses that still count", () => {
    const use = (id: number, actor: number, voided = false) => ({
      ...battleEvent(id, "item_used", actor, { unit_key: "hero:1", item_name: "Rope" }),
      voided_at: voided ? "2026-10-18T10:06:00Z" : null,
    });
    expect(
      buildItemsUsed([use(1, ME.id), use(2, ME.id, true), use(3, OPPONENT.id)], ME.id, roster)
    ).toEqual([{ key: "1", unitName: "Captain Wolf", itemName: "Rope" }]);
  });

  it("applies a ticked injury, flags a complex one, and leaves out unticked or harmless ones", () => {
    const roll = (label: string, effect: object, apply?: boolean) => ({
      roll_type: "d66" as const,
      rolls: [1, 1],
      result_code: "11",
      result_label: label,
      dead_suggestion: false,
      apply,
      effect: effect as never,
    });
    const rows = [
      row({
        unitKey: "hero:1",
        unitName: "Wolf",
        seriousInjuryRolls: [roll("Chest Wound", { kind: "stat", stat: "toughness", change: -1 })],
      }),
      row({
        unitKey: "hero:3",
        unitName: "Rolf",
        seriousInjuryRolls: [roll("Robbed", { kind: "manual" })],
      }),
      row({
        unitKey: "hero:5",
        unitName: "Hans",
        seriousInjuryRolls: [
          roll("Old Battle Wound", { kind: "special", special: "Old Battle Wound" }, false),
        ],
      }),
      row({
        unitKey: "hero:6",
        unitName: "Otto",
        seriousInjuryRolls: [roll("Full Recovery", { kind: "none" })],
      }),
    ];
    expect(buildInjuries(rows)).toEqual([
      { unitKey: "hero:1", text: "Wolf: Chest Wound (-1 Toughness)", byHand: false },
      { unitKey: "hero:3", text: "Rolf: Robbed", byHand: true },
    ]);
  });

  it("lists what each dead unit carried, from the start roster", () => {
    const deadRoster = toParticipantRosters(battleRosters())[ME.id];
    deadRoster.hiredSwords[0].items = [{ id: 9, name: "Great Axe", count: 1, singleUse: false }];
    expect(
      buildItemsLost(
        [
          row({ unitKey: "hired_sword:4", unitName: "Ogre", unitKind: "hired_sword", dead: true }),
          row({ unitKey: "hero:1", unitName: "Wolf", unitKind: "hero", dead: true }),
        ],
        deadRoster
      )
    ).toEqual([
      { unitKey: "hired_sword:4", unitName: "Ogre", henchman: false, items: ["Great Axe"] },
    ]);
  });

  it("works out the gold after finds and paid upkeep, and nothing without the sheet", () => {
    expect(buildGold({ sheet, findsGoldCrowns: 20, upkeepPaid: 80 })).toEqual({
      current: 50,
      findsGoldCrowns: 20,
      upkeepPaid: 80,
      after: -10,
    });
    expect(buildGold({ sheet: undefined, findsGoldCrowns: 0, upkeepPaid: 0 })).toBeNull();
  });
});
