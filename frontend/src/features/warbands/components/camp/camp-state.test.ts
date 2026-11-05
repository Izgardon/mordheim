import { describe, expect, it } from "vitest";

import { readySummary } from "./camp-state";
import type { OpenCamp } from "./camp-types";

const result = (name: string, xp: number, advances: { id: string; label: string }[] = []) => ({
  unit_name: name,
  unit_type: "Champion",
  unit_kind: "hero",
  out_of_action: false,
  kill_count: 0,
  xp_earned: xp,
  dead: false,
  special_ids: [],
  serious_injury_rolls: [],
  advances: advances.map((advance) => ({ ...advance, at: 4, rolls: [3, 4] })),
});

/** A camp whose heroes start on 3, 5 and 1 XP: crossing 4 (and 6) brings an advance. */
const camp = (unitResults: Record<string, ReturnType<typeof result>>) =>
  ({
    draft: {
      unit_results: unitResults,
      mount_survival: {},
      finds: { gold_crowns: 0, items: [] },
      upkeep: { entries: {} },
    },
    postgame: {
      sheet: {
        heroes: [
          { id: 1, xp: 3, half_rate: false },
          { id: 2, xp: 3, half_rate: false },
          { id: 3, xp: 3, half_rate: false },
        ],
        henchmen_groups: [],
        hirelings: [],
      },
      explore: { amount: 0, resource: null },
    },
    campaign: null,
    battleState: { suggested_postbattle: undefined },
    gold: 100,
    hirelings: [],
  }) as unknown as OpenCamp;

const advancesLine = (open: OpenCamp) =>
  readySummary(open).find((line) => line.k === "Advances")?.v;

describe("readySummary", () => {
  it("lists the units with an advance waiting beside those rolled", () => {
    expect(
      advancesLine(
        camp({
          "hero:1": result("Dieter Brandt", 2),
          "hero:2": result("Felix Hartmann", 4),
          "hero:3": result("Ott the Red", 1, [{ id: "WS", label: "+1 Weapon Skill" }]),
        })
      )
    ).toBe(
      "Ott the Red: +1 Weapon Skill · Dieter Brandt: advance waiting · Felix Hartmann: 2 advances waiting"
    );
  });

  it("says None when nobody reached an advance", () => {
    expect(advancesLine(camp({ "hero:1": result("Dieter Brandt", 0) }))).toBe("None");
  });
});
