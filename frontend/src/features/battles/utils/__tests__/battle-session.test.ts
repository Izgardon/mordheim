import { describe, expect, it } from "vitest";

import type { BattleState } from "@/features/battles/types/battle-types";

import {
  getBattleRouteForStatus,
  getResumableBattleForUser,
  toCurrentBattleSession,
} from "../battle-session";

function createBattleState({
  battleId,
  status,
  participantStatus,
  userId = 7,
}: {
  battleId: number;
  status: BattleState["battle"]["status"];
  participantStatus: BattleState["participants"][number]["status"];
  userId?: number;
}): BattleState {
  return {
    battle: {
      id: battleId,
      campaign_id: 12,
      created_by_user_id: 3,
      flow_type: "normal",
      status,
      scenario: "Skirmish",
      scenario_link: null,
      winner_warband_ids_json: [],
      created_at: "",
      updated_at: "",
      started_at: null,
      ended_at: null,
      post_processed_at: null,
      channel: "battle",
    },
    participants: [
      {
        id: 99,
        battle_id: battleId,
        status: participantStatus,
        connection_state: "online",
        last_event_id: 0,
        invited_by_user_id: null,
        invited_at: null,
        responded_at: null,
        joined_at: null,
        ready_at: null,
        canceled_at: null,
        battle_joined_at: null,
        finished_at: null,
        confirmed_at: null,
        last_seen_at: null,
        selected_unit_keys_json: [],
        unit_information_json: {},
        custom_units_json: [],
        postbattle_json: {},
        declared_rating: null,
        battle_notes: "",
        user: {
          id: userId,
          label: `User ${userId}`,
        },
        warband: {
          id: 44,
          name: "Iron Wolves",
        },
      },
    ],
    events: [],
  };
}

describe("battle-session", () => {
  it("maps battle statuses to the correct route segment", () => {
    expect(getBattleRouteForStatus("inviting")).toBe("prebattle");
    expect(getBattleRouteForStatus("prebattle")).toBe("prebattle");
    expect(getBattleRouteForStatus("active")).toBe("active");
    expect(getBattleRouteForStatus("postbattle")).toBe("postbattle");
  });

  it("returns the first resumable battle for the current user", () => {
    const battle = getResumableBattleForUser(
      [
        createBattleState({
          battleId: 1,
          status: "ended",
          participantStatus: "finished_battle",
        }),
        createBattleState({
          battleId: 2,
          status: "prebattle",
          participantStatus: "joined_prebattle",
        }),
      ],
      7
    );

    expect(battle?.battle.id).toBe(2);
  });

  it("ignores canceled or completed participation", () => {
    expect(
      getResumableBattleForUser(
        [
          createBattleState({
            battleId: 2,
            status: "postbattle",
            participantStatus: "confirmed_postbattle",
          }),
          createBattleState({
            battleId: 3,
            status: "prebattle",
            participantStatus: "canceled_prebattle",
          }),
        ],
        7
      )
    ).toBeNull();
  });

  it("converts a battle state into store session data", () => {
    expect(
      toCurrentBattleSession(
        createBattleState({
          battleId: 5,
          status: "active",
          participantStatus: "in_battle",
        })
      )
    ).toEqual({
      battleId: 5,
      campaignId: 12,
      status: "active",
    });
  });
});
