import { describe, expect, it } from "vitest";

import type { BattleEvent, BattleParticipant } from "@/features/battles/types/battle-types";

import { battleFeed } from "./battle-feed";

const PARTICIPANTS = [
  {
    user: { id: 7, label: "Cap" },
    warband: { id: 3 },
    status: "in_battle",
  },
] as unknown as BattleParticipant[];

const event = (id: number, type: BattleEvent["type"], payload: Record<string, unknown> = {}) =>
  ({
    id,
    type,
    actor_user_id: 7,
    payload_json: payload,
    voided_at: null,
    created_at: "2026-11-18T10:00:00Z",
  }) as unknown as BattleEvent;

const feed = (events: BattleEvent[]) => battleFeed(events, PARTICIPANTS, {}, 7);

describe("battleFeed and the rounds", () => {
  it("gives a round one line, the asks and agreements none (William, 18 Nov 2026)", () => {
    const lines = feed([
      event(1, "battle_started"),
      event(2, "round_requested", { round: 2 }),
      event(3, "round_agreed", { round: 2 }),
      event(4, "round_started", { round: 2, forced: false }),
      event(5, "round_requested", { round: 3 }),
      event(6, "round_request_withdrawn", { round: 3 }),
      event(7, "round_requested", { round: 3 }),
      event(8, "round_started", { round: 3, forced: true }),
    ]);
    expect(lines.map((line) => `R${line.round} ${line.text}`)).toEqual([
      "R1 Battle started",
      "R2 Round 2 started",
      "R3 Round 3 started",
    ]);
  });

  it("keeps the round each later line fell in", () => {
    const lines = feed([
      event(1, "round_started", { round: 2, forced: false }),
      event(2, "participant_finished_battle"),
    ]);
    expect(lines[1]).toMatchObject({ round: 2, text: "Cap finished their battle" });
  });

  it("still logs everything else the battle does (William, 18 Nov 2026)", () => {
    const lines = feed([
      event(1, "battle_started"),
      event(2, "round_requested", { round: 2 }),
      event(3, "round_started", { round: 2, forced: false }),
      event(4, "unit_kill_recorded", {
        round: 2,
        killer: { name: "Ulrich" },
        victim: { type_name: "Darksoul" },
        how: "melee",
      }),
      event(5, "unit_ooa_set", { round: 2, unit: { warband_id: 3, unit_key: "hero:9" } }),
      event(6, "item_used", { unit_key: "hero:9", item_name: "Blessed Water" }),
      event(7, "neutral_group_added", { round: 2, name: "Vermin" }),
      event(8, "neutral_creature_added", {
        round: 2,
        group_name: "Vermin",
        creature_type: "Giant Rat",
        count: 3,
      }),
      event(9, "neutral_creature_added", { group_name: "Vermin", creature_type: "Rat Ogre" }),
      event(10, "participant_finished_battle"),
      event(11, "neutral_group_added", { round: 2 }),
    ]);
    expect(lines.map((line) => line.text)).toEqual([
      "Battle started",
      "Round 2 started",
      "Ulrich took a Darksoul out of action · melee",
      "A model is out of action",
      "A model used Blessed Water",
      "Vermin joined the fight",
      "Giant Rat ×3 joined Vermin",
      "Rat Ogre joined Vermin",
      "Cap finished their battle",
      "A creature group joined the fight",
    ]);
    expect(lines.filter((line) => line.kill)).toHaveLength(1);
  });
});
