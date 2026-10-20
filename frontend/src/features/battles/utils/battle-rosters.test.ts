import { describe, expect, it } from "vitest";

import { toParticipantRosters } from "@/features/battles/api/battle-queries";
import {
  ME,
  OPPONENT,
  battleRosters,
  myParticipant,
  opponentParticipant,
} from "@/test/battle-fixtures";

import { allRostersSettled, isRosterLoading } from "./battle-rosters";

const participants = [myParticipant(), opponentParticipant()];
const rosters = toParticipantRosters(battleRosters());

describe("battle-rosters", () => {
  it("is settled once every roster has loaded or failed and none is loading", () => {
    expect(allRostersSettled(participants, rosters, {}, {})).toBe(true);
    expect(allRostersSettled(participants, { [ME.id]: rosters[ME.id] }, {}, {})).toBe(false);
    expect(
      allRostersSettled(participants, { [ME.id]: rosters[ME.id] }, {}, { [OPPONENT.id]: "Nope" })
    ).toBe(true);
    expect(allRostersSettled(participants, rosters, { [ME.id]: true }, {})).toBe(false);
  });

  it("is loading while a participant's roster loads and hasn't arrived", () => {
    expect(isRosterLoading(participants[0], {}, { [ME.id]: true })).toBe(true);
    expect(isRosterLoading(participants[0], rosters, { [ME.id]: true })).toBe(false);
    expect(isRosterLoading(null, {}, {})).toBe(false);
  });
});
