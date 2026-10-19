import { describe, expect, it } from "vitest";

import type { BattlePostbattleState } from "@/features/battles/types/battle-types";

import type { PostbattleRenderableGroup } from "./postbattle-utils";
import { buildStatChangeRows, statChanges } from "./stat-changes";

const base = { weapon_skill: 3, toughness: 3, armour_save: null };
const groups = [
  {
    key: "heroes",
    label: "Heroes",
    unitKind: "hero",
    rows: [{ unitKey: "hero:1", unitName: "Wolf" }],
  },
  {
    key: "henchmen:Lads",
    label: "Lads",
    unitKind: "henchman",
    rows: [
      { unitKey: "henchman:1", unitName: "Lad A" },
      { unitKey: "henchman:2", unitName: "Lad B" },
    ],
  },
] as unknown as PostbattleRenderableGroup[];

describe("stat changes", () => {
  it("names each changed stat with its profile value", () => {
    expect(statChanges(base, { weapon_skill: 4, toughness: 3, armour_save: 5 })).toEqual([
      "WS 3 → 4",
      "AS - → 5",
    ]);
  });

  it("lists a henchmen group once, kept when any member's tick is on", () => {
    const rows = buildStatChangeRows({
      groups,
      draft: {
        unit_results: { "henchman:1": { keep_stats: true } },
      } as unknown as BattlePostbattleState,
      baseStatsByUnitKey: { "hero:1": base, "henchman:1": base, "henchman:2": base } as never,
      unitInformation: {
        "henchman:2": { stats_override: { toughness: 4 }, out_of_action: false, kill_count: 0 },
      },
    });
    expect(rows).toEqual([
      {
        key: "henchman:1",
        unitName: "Lads",
        unitKeys: ["henchman:1", "henchman:2"],
        changes: ["T 3 → 4"],
        kept: true,
      },
    ]);
  });
});
