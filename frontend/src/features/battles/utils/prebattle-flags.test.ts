import { describe, expect, it } from "vitest";

import { ME, OPPONENT, battleState } from "@/test/battle-fixtures";

import { prebattleFlags } from "./prebattle-flags";

const flagsFor = (
  state: ReturnType<typeof battleState>,
  userId = ME.id,
  inFlight: Partial<Record<"isUpdatingReady" | "isSavingConfig" | "isStartingBattle", boolean>> = {}
) =>
  prebattleFlags({
    battleState: state,
    currentParticipant: state.participants.find((entry) => entry.user.id === userId) ?? null,
    userId,
    isOwnSelected: true,
    isUpdatingReady: false,
    isSavingConfig: false,
    isStartingBattle: false,
    ...inFlight,
  });

describe("prebattleFlags", () => {
  it("lets the creator start once everyone is ready, and edit only while not ready", () => {
    const allReady = flagsFor(
      battleState({ status: "prebattle", me: { status: "ready" }, opponent: { status: "ready" } })
    );
    expect(allReady).toMatchObject({
      allParticipantsReady: true,
      isBattleCreator: true,
      startDisabled: false,
      canEditOwnConfig: false,
      canCreatorCancelBattle: true,
    });

    const joined = flagsFor(battleState({ status: "prebattle" }));
    expect(joined).toMatchObject({
      startDisabled: true,
      canEditOwnConfig: true,
      readyDisabled: false,
    });
    expect(
      flagsFor(battleState({ status: "prebattle" }), ME.id, { isSavingConfig: true })
    ).toMatchObject({ canEditOwnConfig: false });
  });

  it("offers an invitee Accept and Decline, never the creator", () => {
    const state = battleState({
      status: "inviting",
      me: { status: "accepted" },
      opponent: { status: "invited" },
    });

    expect(flagsFor(state, OPPONENT.id)).toMatchObject({
      invitePending: true,
      canAcceptInvite: true,
      canDeclineInvite: true,
      readyDisabled: true,
    });
    expect(flagsFor(state, ME.id)).toMatchObject({
      waitingForOthers: true,
      canDeclineInvite: false,
      canCreatorCancelBattle: true,
    });
  });
});
