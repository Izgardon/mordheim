import { describe, expect, it } from "vitest";

import { ME, OPPONENT, battleEvent, battleState } from "@/test/battle-fixtures";

import { battleOverMessage } from "./battle-over";

describe("battleOverMessage", () => {
  it("says the battle ended, and how when postbattle was closed or ran out of time", () => {
    expect(battleOverMessage(battleState({ status: "ended" }), ME.id)).toBe(
      "Street Fight has ended."
    );
    const closed = battleState({
      status: "ended",
      events: [battleEvent(9, "battle_ended", OPPONENT.id, { mode: "closed" })],
    });
    expect(battleOverMessage(closed, ME.id)).toBe("Postbattle was closed: Street Fight has ended.");
    const expired = battleState({
      status: "ended",
      scenario: "",
      events: [battleEvent(9, "battle_ended", null, { mode: "expired" })],
    });
    expect(battleOverMessage(expired, ME.id)).toBe(
      "Postbattle ran out of time: Battle #5 has ended."
    );
  });

  it("names who cancelled it, or why", () => {
    const by = (userId: number) =>
      battleState({
        status: "canceled",
        events: [battleEvent(9, "battle_canceled", userId, { canceled_by_user_id: userId })],
      });
    expect(battleOverMessage(by(OPPONENT.id), ME.id)).toBe("Player cancelled Street Fight.");
    expect(battleOverMessage(by(ME.id), ME.id)).toBe("You cancelled Street Fight.");
    const declined = battleState({
      status: "canceled",
      events: [battleEvent(9, "battle_canceled", OPPONENT.id, { mode: "declined" })],
    });
    expect(battleOverMessage(declined, ME.id)).toBe(
      "Street Fight was cancelled: fewer than two players are left."
    );
    expect(battleOverMessage(battleState({ status: "active" }), ME.id)).toBeNull();
  });
});
