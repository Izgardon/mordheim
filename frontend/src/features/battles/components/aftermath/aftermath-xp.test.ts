import { describe, expect, it } from "vitest";

import type { BattlePostbattleState } from "@/features/battles/types/battle-types";
import type { WarbandSheet } from "@/features/warbands/types/warband-sheet";
import { campaignSummary } from "@/test/campaign-fixtures";

import { buildXpRows } from "./aftermath-xp";

const draft = {
  unit_results: {
    "hero:1": { unit_name: "Dieter", unit_kind: "hero", xp_earned: 2, advances: [] },
    "hireling:7": { unit_name: "Ogre", unit_kind: "hireling", xp_earned: 2, advances: [] },
  },
} as unknown as BattlePostbattleState;

const sheet = {
  heroes: [{ id: 1, xp: 4 }],
  henchmen_groups: [],
  hirelings: [{ id: 7, xp: 4 }],
} as unknown as WarbandSheet;

describe("buildXpRows", () => {
  it("reads a hired sword's level-ups on the campaign's hired sword table (William, 7 Nov 2026)", () => {
    const campaign = campaignSummary({
      hero_level_thresholds: [2, 4, 6],
      hired_sword_level_thresholds: [5, 10],
    });
    const rows = buildXpRows(draft, sheet, campaign, undefined);
    expect(rows.find((row) => row.key === "hero:1")?.thresholds).toEqual([2, 4, 6]);
    expect(rows.find((row) => row.key === "hireling:7")?.thresholds).toEqual([5, 10]);
  });
});
