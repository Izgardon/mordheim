import { describe, expect, it } from "vitest";

import { battleState } from "@/test/battle-fixtures";

import { findUnfinishedBattle } from "./UnfinishedBattleBanner";

const withViewer = (id: number, unfinished: boolean, page: "active" | "postbattle" | null) => {
  const state = battleState({ id, status: "active" });
  state.viewer = { participant_status: "in_battle", unfinished, page };
  return state;
};

describe("findUnfinishedBattle", () => {
  it("picks the first battle the reader still has something to do in, other than this one", () => {
    const battles = [
      withViewer(41, false, null),
      withViewer(40, true, "active"),
      withViewer(39, true, "postbattle"),
    ];
    expect(findUnfinishedBattle(battles)?.battle.id).toBe(40);
    expect(findUnfinishedBattle(battles, 40)?.battle.id).toBe(39);
    expect(findUnfinishedBattle([withViewer(41, false, null)])).toBeNull();
    // A list from an older server has no viewer.
    expect(findUnfinishedBattle([battleState({ id: 3 })])).toBeNull();
  });
});
