import { describe, expect, it } from "vitest";

import type { BattleState, BattleViewer } from "@/features/battles/types/battle-types";
import { battleState } from "@/test/battle-fixtures";

import { openBattleTitle, yourOpenBattles } from "./open-battles";

const open = (id: number, viewer: BattleViewer, battle: Partial<BattleState["battle"]> = {}) => {
  const state = battleState({ id, number: id, ...battle });
  state.viewer = viewer;
  return state;
};
const fighting = (id: number) =>
  open(id, { participant_status: "in_battle", unfinished: true, page: "active" });
const postgame = (id: number) =>
  open(id, { participant_status: "finished_battle", unfinished: true, page: "postbattle" });
const prebattle = (id: number) =>
  open(id, { participant_status: "accepted", unfinished: true, page: "prebattle" });
const invited = (id: number) =>
  open(id, { participant_status: "invited", unfinished: true, page: "prebattle" });
const done = (id: number) =>
  open(id, { participant_status: "confirmed_postbattle", unfinished: false, page: null });

describe("yourOpenBattles", () => {
  it("puts the one that needs you most first: the fight, post-game, pre-battle, an invitation", () => {
    // the list comes newest first
    const battles = [invited(45), prebattle(44), done(43), postgame(42), fighting(41)];

    expect(yourOpenBattles(battles).map((entry) => [entry.state.battle.id, entry.phase])).toEqual([
      [41, "fight"],
      [42, "postgame"],
      [44, "prebattle"],
      [45, "invitation"],
    ]);
  });

  it("keeps the list's order (newest first) within a phase", () => {
    expect(
      yourOpenBattles([invited(9), invited(8), prebattle(7)]).map((entry) => entry.state.battle.id)
    ).toEqual([7, 9, 8]);
  });

  it("goes to the page where you carry on, the invitation's included", () => {
    const [fight, post, invite] = yourOpenBattles([fighting(41), postgame(42), invited(45)]);

    expect(fight.href).toBe("/campaigns/1/battles/41/active");
    expect(post.href).toBe("/campaigns/1/battles/42/postbattle");
    expect(invite.href).toBe("/campaigns/1/battles/45/prebattle");
  });

  it("leaves out a battle done for you, one with no viewer (an older server) and the excluded one", () => {
    expect(yourOpenBattles([done(43), battleState({ id: 3 })])).toEqual([]);
    expect(
      yourOpenBattles([fighting(41), postgame(42)], 41).map((entry) => entry.state.battle.id)
    ).toEqual([42]);
  });
});

describe("openBattleTitle", () => {
  it("names the scenario and the battle number, else the battle's id", () => {
    expect(openBattleTitle({ id: 40, scenario: "Street Fight", number: 6 })).toBe(
      "Street Fight, Battle 6"
    );
    expect(openBattleTitle({ id: 40, scenario: "  ", number: 6 })).toBe("Battle 6");
    expect(openBattleTitle({ id: 40, scenario: "Street Fight", number: null })).toBe(
      "Street Fight"
    );
    expect(openBattleTitle({ id: 40, scenario: "", number: null })).toBe("Battle #40");
  });
});
