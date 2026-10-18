import { describe, expect, it } from "vitest";

import type { BattleState } from "@/features/battles/types/battle-types";

import { getBattleStateLastEventId, mergeBattleState } from "./battle-cache";

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

describe("battle-cache", () => {
  it("marks an undone event voided from the undo event a write answers with (BUG-11)", () => {
    const merged = mergeBattleState(baseState, {
      ...baseState,
      events: [
        {
          id: 3,
          battle_id: 5,
          type: "unit_kill_voided",
          actor_user_id: 7,
          payload_json: { voided_event_id: 2, unit_key: "hero:1" },
          created_at: "2026-10-18T11:00:00Z",
        },
      ],
    });

    expect(merged.events.map((event) => [event.id, event.voided_at ?? null])).toEqual([
      [1, null],
      [2, "2026-10-18T11:00:00Z"],
      [3, null],
    ]);
  });

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
});
