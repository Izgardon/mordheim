import { describe, expect, it } from "vitest";

import { toParticipantRosters } from "@/features/battles/api/battle-queries";
import {
  ME,
  OPPONENT,
  battleEvent,
  battleRosters,
  myParticipant,
  opponentParticipant,
} from "@/test/battle-fixtures";

import { killVictimName } from "./kill-victims";

const participants = [myParticipant(), opponentParticipant()];
const rosters = toParticipantRosters(battleRosters());
const killOf = (victim: Record<string, unknown>) =>
  battleEvent(1, "unit_kill_recorded", ME.id, { killer: { unit_key: "hero:1" }, victim });

describe("killVictimName", () => {
  it("names another player's unit with its owner", () => {
    const event = killOf({ unit_key: "hero:2", warband_id: OPPONENT.warband.id, name: "Fang" });
    expect(killVictimName(event, participants, rosters)).toBe("Player's Fang");
  });

  it("takes an unnamed unit's name from its owner's roster", () => {
    const event = killOf({ unit_key: "hero:2", warband_id: OPPONENT.warband.id, name: null });
    expect(killVictimName(event, participants, rosters)).toBe("Player's Black Fang");
  });

  it("shows a typed name as it was typed, and says so when there is none", () => {
    expect(
      killVictimName(killOf({ unit_key: null, name: "Giant Rat" }), participants, rosters)
    ).toBe("Giant Rat");
    expect(killVictimName(killOf({}), participants, rosters)).toBe("an unnamed enemy");
  });
});
