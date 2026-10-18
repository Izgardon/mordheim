import { describe, expect, it } from "vitest";

import type { BattleState } from "@/features/battles/types/battle-types";

import { battleState, myParticipant, opponentParticipant } from "@/test/battle-fixtures";

import {
  getBattleStateLastEventId,
  mergeBattleState,
  patchParticipants,
  stateVersion,
} from "./battle-cache";

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

  it("drops an older answer's battle and participants but keeps its events (BUG-44)", () => {
    const newer = battleState({
      state_version: 6,
      me: { unit_information_json: { "hero:1": { kill_count: 1 } } },
      events: baseState.events,
    });
    const slowRead = battleState({
      state_version: 5,
      status: "postbattle",
      events: [{ ...baseState.events[0], id: 4, type: "unit_ooa_set" }],
    });

    const merged = mergeBattleState(newer, slowRead);

    expect(merged.battle).toBe(newer.battle);
    expect(merged.participants).toBe(newer.participants);
    expect(merged.events.map((event) => event.id)).toEqual([1, 2, 4]);
    expect(stateVersion(merged)).toBe(6);
  });

  it("takes an answer of the same or a newer version, and any answer without versions", () => {
    const cached = battleState({ state_version: 6 });
    const same = battleState({ state_version: 6, status: "postbattle" });
    const newer = battleState({ state_version: 7, status: "ended" });

    expect(mergeBattleState(cached, same).battle.status).toBe("postbattle");
    expect(mergeBattleState(cached, newer).battle.status).toBe("ended");
    expect(mergeBattleState(baseState, battleState({ status: "ended" })).battle.status).toBe(
      "ended"
    );
    expect(stateVersion(baseState)).toBeNull();
  });

  it("patches changed participants by id and adds new ones", () => {
    const changed = opponentParticipant({ status: "ready" });
    const newcomer = { ...opponentParticipant(), id: 23 };

    const patched = patchParticipants(
      [myParticipant(), opponentParticipant()],
      [changed, newcomer]
    );

    expect(patched.map((entry) => [entry.id, entry.status])).toEqual([
      [21, "in_battle"],
      [22, "ready"],
      [23, "in_battle"],
    ]);
  });
});
