import { describe, expect, it } from "vitest";

import { heroKind, henchmenKind, hirelingKind } from "./unit-kinds";
import { buildMissingPayload, gamesText, isMissing, mapMissingToForm } from "./missing-games";
import { makeHenchmenGroup, makeHero, makeHireling } from "@/test/warband-fixtures";

describe("missing games in edit mode", () => {
  it("maps a saved unit's count and reason to its form, 0 and blank when it fights", () => {
    expect(mapMissingToForm({ missing_games: 2, missing_reason: "Deep wound" })).toEqual({
      missing_games: "2",
      missing_reason: "Deep wound",
    });
    expect(mapMissingToForm({})).toEqual({ missing_games: "0", missing_reason: "" });
  });

  it("sends a saved unit's count and trimmed reason, blank as 0 (back), and nothing for a recruit", () => {
    const form = { missing_games: " 3 ", missing_reason: " Captured " };

    expect(buildMissingPayload(form, false)).toEqual({
      missing_games: 3,
      missing_reason: "Captured",
    });
    expect(buildMissingPayload({ missing_games: "", missing_reason: "x" }, false)).toEqual({
      missing_games: 0,
      missing_reason: "x",
    });
    expect(buildMissingPayload(form, true)).toEqual({});
    expect(buildMissingPayload({}, false)).toEqual({});
  });

  it("sends a count that isn't a whole number as typed, so the server's message lands on the card", () => {
    expect(buildMissingPayload({ missing_games: "two" }, false).missing_games).toBe("two");
    expect(buildMissingPayload({ missing_games: "1.5" }, false).missing_games).toBe("1.5");
  });

  it("round-trips through every kind's form: saved units send it, queued recruits don't", () => {
    const units = [
      [heroKind, makeHero({ missing_games: 2, missing_reason: "Deep wound" })],
      [hirelingKind, makeHireling({ missing_games: 1, missing_reason: "Captured" })],
      [henchmenKind, makeHenchmenGroup({ missing_games: 3, missing_reason: "Lost" })],
    ] as const;

    for (const [kind, unit] of units) {
      const form = (kind.mapToForm as (unit: unknown) => Record<string, unknown>)(unit);
      const build = kind.buildPayload as (
        form: unknown,
        options: { isSessionCreated: boolean }
      ) => Record<string, unknown>;
      expect(build(form, { isSessionCreated: false })).toEqual(
        expect.objectContaining({
          missing_games: unit.missing_games,
          missing_reason: unit.missing_reason,
        })
      );
      expect(build({ ...form, id: undefined }, { isSessionCreated: true })).not.toHaveProperty(
        "missing_games"
      );
    }
  });

  it("says how many games, and who is missing", () => {
    expect(gamesText(1)).toBe("1 game");
    expect(gamesText(3)).toBe("3 games");
    expect(isMissing(makeHero({ missing_games: 1 }))).toBe(true);
    expect(isMissing(makeHero({ missing_games: 0 }))).toBe(false);
    expect(isMissing(makeHero())).toBe(false);
  });
});
