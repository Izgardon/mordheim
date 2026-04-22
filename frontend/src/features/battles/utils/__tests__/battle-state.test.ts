import { describe, expect, it } from "vitest";

import type { BattleState } from "@/features/battles/types/battle-types";

import {
  getBattleStateLastEventId,
  mergeBattleState,
  shouldIgnoreBattleSocketEvent,
} from "../battle-state";

const baseState: BattleState = {
  battle: {
    id: 5,
    campaign_id: 1,
    created_by_user_id: 7,
    flow_type: "normal",
    status: "active",
    scenario: "Street Fight",
    scenario_link: null,
    winner_warband_ids_json: [],
    created_at: "",
    updated_at: "",
    started_at: null,
    ended_at: null,
    post_processed_at: null,
    channel: "battle",
  },
  participants: [],
  events: [
    {
      id: 1,
      battle_id: 5,
      type: "battle_started",
      actor_user_id: 7,
      payload_json: {},
      created_at: "",
    },
    {
      id: 2,
      battle_id: 5,
      type: "unit_kill_recorded",
      actor_user_id: 7,
      payload_json: {},
      created_at: "",
    },
  ],
};

describe("battle-state utils", () => {
  it("merges delta responses without dropping older events", () => {
    const merged = mergeBattleState(baseState, {
      ...baseState,
      events: [
        {
          id: 3,
          battle_id: 5,
          type: "item_used",
          actor_user_id: 9,
          payload_json: {},
          created_at: "",
        },
      ],
    });

    expect(merged.events.map((event) => event.id)).toEqual([1, 2, 3]);
    expect(getBattleStateLastEventId(merged)).toBe(3);
  });

  it("ignores self-originated socket events but not remote ones", () => {
    expect(
      shouldIgnoreBattleSocketEvent(
        {
          type: "battle_state_updated",
          payload: { actor_user_id: 7 },
        },
        7
      )
    ).toBe(true);

    expect(
      shouldIgnoreBattleSocketEvent(
        {
          type: "battle_state_updated",
          payload: { actor_user_id: 9 },
        },
        7
      )
    ).toBe(false);
  });
});
