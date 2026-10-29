import { describe, expect, it } from "vitest";

import { toParticipantRosters } from "@/features/battles/api/battle-queries";
import type {
  BattlePostbattleSeriousInjuryRoll,
  BattlePostbattleState,
} from "@/features/battles/types/battle-types";
import { ME, battleRosters } from "@/test/battle-fixtures";

import { buildMissingGames, missingGamesOffer, withMissingGames } from "./missing-games";
import { buildUpkeepRows } from "./postbattle-summary";
import type { PostbattleRenderableRow } from "./postbattle-utils";

const roster = toParticipantRosters(battleRosters())[ME.id];

const roll = (label: string, misses?: { games: number; dice?: string }) =>
  ({
    roll_type: "d66",
    rolls: [4, 7],
    result_code: "47",
    result_label: label,
    dead_suggestion: false,
    effect: { kind: "manual", ...(misses ? { misses } : {}) },
  }) as BattlePostbattleSeriousInjuryRoll;

const row = (overrides: Partial<PostbattleRenderableRow> = {}) =>
  ({
    unitKey: "hero:3",
    unitName: "Rolf",
    unitKind: "hero",
    dead: false,
    seriousInjuryRolls: [],
    ...overrides,
  }) as PostbattleRenderableRow;

describe("missing games in postbattle", () => {
  it("offers the last roll's missing games for a living hero or hired sword, never a henchman", () => {
    const deepWound = [roll("Robbed"), roll("Deep Wound", { games: 2, dice: "D3" })];

    expect(missingGamesOffer(row({ seriousInjuryRolls: deepWound }))).toEqual({
      games: 2,
      dice: "D3",
      reason: "Deep Wound",
    });
    expect(
      missingGamesOffer(row({ seriousInjuryRolls: [roll("Captured", { games: 1 })] }))
    ).toEqual({ games: 1, dice: null, reason: "Captured" });
    // re-rolled away, dead, or a henchman: nothing to offer
    const rerolled = [roll("Captured", { games: 1 }), roll("Robbed")];
    expect(missingGamesOffer(row({ seriousInjuryRolls: rerolled }))).toBeNull();
    expect(missingGamesOffer(row({ seriousInjuryRolls: deepWound, dead: true }))).toBeNull();
    expect(
      missingGamesOffer(row({ seriousInjuryRolls: deepWound, unitKind: "henchman" }))
    ).toBeNull();
  });

  it("sets the unit's missing games in the draft and takes them off", () => {
    const draft = {
      unit_results: { "hero:3": { unit_name: "Rolf", serious_injury_rolls: [] } },
    } as unknown as BattlePostbattleState;

    const ticked = withMissingGames(draft, "hero:3", { games: 2, reason: "Deep Wound" });
    expect(ticked.unit_results["hero:3"].missing_games).toEqual({ games: 2, reason: "Deep Wound" });
    expect(withMissingGames(ticked, "hero:3", null).unit_results["hero:3"]).not.toHaveProperty(
      "missing_games"
    );
    expect(withMissingGames(draft, "hero:99", null)).toBe(draft);
  });

  it("lists each missing unit's game counted off, and each injury's new count instead of its countdown", () => {
    const missing = {
      ...roster,
      heroes: [
        { ...roster.heroes[0], missingGames: 3 },
        { ...roster.heroes[1], missingGames: 1 },
      ],
      hirelings: [{ ...roster.hirelings[0], missingGames: 1 }],
      henchmenGroups: roster.henchmenGroups.map((group) => ({ ...group, missingGames: 1 })),
    };
    const rows = [
      row({ unitKey: "hero:3", missingGames: { games: 2, reason: "Deep Wound" } }),
      row({ unitKey: "hireling:4", unitName: "Ogre Bodyguard", unitKind: "hireling", dead: true }),
    ];

    expect(buildMissingGames(rows, missing, () => true).map((line) => line.text)).toEqual([
      "Captain Wolf has 2 more games to miss after this battle.",
      "Youngbloods is back after this battle.",
      "Rolf will miss the next 2 games: Deep Wound.",
    ]);
    expect(buildMissingGames(rows, missing, (key) => key !== "hero:3")).toHaveLength(2);
  });

  it("owes no upkeep for a hired sword missing games", () => {
    const missing = { ...roster, hirelings: [{ ...roster.hirelings[0], missingGames: 1 }] };
    const draft = {
      upkeep: { pay_upkeep: true, entries: {} },
      unit_results: {},
    } as unknown as BattlePostbattleState;

    expect(buildUpkeepRows(draft, missing)).toEqual([]);
  });
});
