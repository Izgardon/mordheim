import { describe, expect, it, vi } from "vitest";

import type { BattleParticipant, BattleSummary } from "@/features/battles/types/battle-types";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";

import { buildPostbattleDraft, rollD6Death, rollHeroDeath } from "./postbattle-utils";

const battle: BattleSummary = {
  id: 1,
  campaign_id: 1,
  created_by_user_id: 1,
  title: "Skirmish",
  status: "postbattle",
  scenario: "Street Fight",
  winner_warband_id: 10,
  winner_warband_ids_json: [10],
  settings_json: {},
  created_at: "",
  updated_at: "",
  started_at: "",
  ended_at: null,
  post_processed_at: null,
  channel: "battle",
};

const participant: BattleParticipant = {
  id: 1,
  battle_id: 1,
  status: "finished_battle",
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
  selected_unit_keys_json: ["hero:1", "henchman:11", "henchman:12"],
  stat_overrides_json: {},
  unit_information_json: {
    "hero:1": { stats_override: {}, stats_reason: "", out_of_action: false, kill_count: 2 },
    "henchman:11": { stats_override: {}, stats_reason: "", out_of_action: false, kill_count: 1 },
    "henchman:12": { stats_override: {}, stats_reason: "", out_of_action: true, kill_count: 0 },
  },
  custom_units_json: [],
  postbattle_json: {},
  declared_rating: null,
  user: { id: 1, label: "Owner" },
  warband: { id: 10, name: "Iron Vultures" },
};

const roster: ParticipantRoster = {
  heroes: [
    {
      key: "hero:1",
      id: 1,
      kind: "hero",
      displayName: "Captain Wolf",
      unitType: "Captain",
      stats: {
        movement: 4,
        weapon_skill: 4,
        ballistic_skill: 4,
        strength: 4,
        toughness: 3,
        wounds: 2,
        initiative: 4,
        attacks: 1,
        leadership: 8,
        armour_save: null,
      },
    },
  ],
  hiredSwords: [],
  henchmenGroups: [
    {
      id: 5,
      name: "Youngbloods",
      unitType: "Henchmen",
      members: [
        {
          key: "henchman:11",
          id: 11,
          kind: "henchman",
          displayName: "Blade 1",
          unitType: "Youngblood",
          stats: {
            movement: 4,
            weapon_skill: 2,
            ballistic_skill: 2,
            strength: 3,
            toughness: 3,
            wounds: 1,
            initiative: 3,
            attacks: 1,
            leadership: 6,
            armour_save: null,
          },
        },
        {
          key: "henchman:12",
          id: 12,
          kind: "henchman",
          displayName: "Blade 2",
          unitType: "Youngblood",
          stats: {
            movement: 4,
            weapon_skill: 2,
            ballistic_skill: 2,
            strength: 3,
            toughness: 3,
            wounds: 1,
            initiative: 3,
            attacks: 1,
            leadership: 6,
            armour_save: null,
          },
        },
      ],
    },
  ],
};

describe("postbattle-utils", () => {
  it("builds defaults for dice, hero xp, and shared henchmen xp", () => {
    const draft = buildPostbattleDraft(battle, participant, roster, [{ id: 7, name: "Shards", amount: 0 }]);

    expect(draft.exploration.dice).toHaveLength(2);
    expect(draft.exploration.resource_id).toBe(7);
    expect(draft.unit_results["hero:1"].xp_earned).toBe(3);
    expect(draft.unit_results["henchman:11"].xp_earned).toBe(2);
    expect(draft.unit_results["henchman:12"].xp_earned).toBe(2);
  });

  it("rolls d6 and d66 death guides deterministically", () => {
    const randomSpy = vi.spyOn(Math, "random");
    randomSpy.mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(0);

    const d6 = rollD6Death();
    expect(d6.result_label).toBe("Dead");

    const hero = rollHeroDeath();
    expect(hero.result_code).toBe("11");
    expect(hero.dead_suggestion).toBe(true);

    randomSpy.mockRestore();
  });
});
