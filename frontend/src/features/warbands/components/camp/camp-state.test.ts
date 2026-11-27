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

type Explored = { handedOver?: boolean; shards?: number; stored?: number; found?: number };

/** A camp whose heroes start on 3, 5 and 1 XP: crossing 4 (and 6) brings an advance. */
const camp = (
  unitResults: Record<string, ReturnType<typeof result>>,
  { handedOver = false, shards = 0, stored = 0, found = 0 }: Explored = {}
) =>
  ({
    draft: {
      unit_results: unitResults,
      mount_survival: {},
      finds: { gold_crowns: found, items: [] },
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
      explore: {
        amount: shards,
        resource: shards ? { id: 1, name: "Wyrdstone", amount: stored } : null,
      },
      locks: { explore: handedOver },
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

  it("names the special a Mutation gives beside it in the injuries", () => {
    const mutated = {
      ...result("Dieter Brandt", 0),
      serious_injury_rolls: [
        {
          roll_type: "d100",
          rolls: [100],
          result_label: "Mutation",
          mutation: { rolls: [4, 4], special: "Spiked Tail" },
        },
      ],
    } as unknown as ReturnType<typeof result>;
    const injuries = readySummary(camp({ "hero:1": mutated })).find(
      (line) => line.k === "Injuries"
    );
    expect(injuries?.v).toBe("Dieter Brandt: Mutation (Spiked Tail)");
  });

  it("adds the shards and finds still to come at Ready", () => {
    const lines = readySummary(camp({}, { shards: 3, stored: 7, found: 20 }));
    expect(lines.find((line) => line.k === "Shards")?.v).toBe("+3 Wyrdstone, now 10");
    expect(lines.find((line) => line.k === "Gold")?.v).toBe("100 → 120 gc");
  });

  it("counts the shards and finds the explore step handed over once", () => {
    // the warband already holds them: 7 shards became 10 and 100 gc became 120 when Next was pressed
    const lines = readySummary({
      ...camp({}, { handedOver: true, shards: 3, stored: 10, found: 20 }),
      gold: 120,
    } as OpenCamp);
    expect(lines.find((line) => line.k === "Shards")?.v).toBe("+3 Wyrdstone, now 10");
    expect(lines.find((line) => line.k === "Gold")?.v).toBe("120 → 120 gc");
  });
});
