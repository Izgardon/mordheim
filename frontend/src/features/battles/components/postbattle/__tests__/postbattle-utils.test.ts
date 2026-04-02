import { describe, expect, it, vi } from "vitest";

import type { BattleEvent, BattleParticipant, BattleSummary } from "@/features/battles/types/battle-types";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";

import {
  buildLocalExplorationState,
  buildPostbattleDraft,
  buildRenderableGroups,
  getPostbattleUpkeepTotal,
  getExplorationResourceAmount,
  getSelectedExplorationDiceValues,
  rollAllLocalExplorationDice,
  rollD6SeriousInjury,
  rollHeroSeriousInjury,
  setPostbattlePayUpkeep,
  setLocalExplorationDiceCount,
  setLocalExplorationDieSelected,
  toPostbattleExplorationPayload,
  updatePostbattleUpkeepEntry,
} from "../postbattle-utils";

const battle: BattleSummary = {
  id: 1,
  campaign_id: 1,
  created_by_user_id: 1,
  flow_type: "normal",
  status: "postbattle",
  scenario: "Street Fight",
  winner_warband_ids_json: [10],
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
  unit_information_json: {
    "hero:1": { stats_override: {}, out_of_action: false, kill_count: 2 },
    "henchman:11": { stats_override: {}, out_of_action: false, kill_count: 1 },
    "henchman:12": { stats_override: {}, out_of_action: true, kill_count: 0 },
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
  hiredSwords: [
    {
      key: "hired_sword:21",
      id: 21,
      kind: "hired_sword",
      displayName: "Johann",
      unitType: "Pit Fighter",
      upkeepPrice: 15,
      upkeepCostExpression: "",
      stats: {
        movement: 4,
        weapon_skill: 4,
        ballistic_skill: 2,
        strength: 4,
        toughness: 3,
        wounds: 1,
        initiative: 3,
        attacks: 1,
        leadership: 7,
        armour_save: null,
      },
    },
    {
      key: "hired_sword:22",
      id: 22,
      kind: "hired_sword",
      displayName: "Shade",
      unitType: "Mystic",
      upkeepPrice: null,
      upkeepCostExpression: "1 shard",
      stats: {
        movement: 4,
        weapon_skill: 3,
        ballistic_skill: 3,
        strength: 3,
        toughness: 3,
        wounds: 1,
        initiative: 4,
        attacks: 1,
        leadership: 7,
        armour_save: null,
      },
    },
  ],
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

const events: BattleEvent[] = [
  {
    id: 1,
    battle_id: 1,
    type: "unit_kill_recorded",
    actor_user_id: 1,
    payload_json: {
      killer: {
        unit_key: "hero:1",
        warband_id: 10,
      },
      earned_xp: true,
    },
    created_at: "",
  },
  {
    id: 2,
    battle_id: 1,
    type: "unit_kill_recorded",
    actor_user_id: 1,
    payload_json: {
      killer: {
        unit_key: "hero:1",
        warband_id: 10,
      },
      earned_xp: false,
    },
    created_at: "",
  },
  {
    id: 3,
    battle_id: 1,
    type: "unit_kill_recorded",
    actor_user_id: 1,
    payload_json: {
      killer: {
        unit_key: "henchman:11",
        warband_id: 10,
      },
      earned_xp: true,
    },
    created_at: "",
  },
];

describe("postbattle-utils", () => {
  it("builds defaults for dice and gives every unit 1 XP plus only XP-granting kills", () => {
    const draft = buildPostbattleDraft(battle, participant, roster, [{ id: 7, name: "Shards", amount: 0 }], events);

    expect(draft.exploration.dice_values).toEqual([]);
    expect(draft.exploration.resource_id).toBe(7);
    expect(draft.upkeep.pay_upkeep).toBe(true);
    expect(draft.upkeep.entries["hired_sword:21"]).toEqual({
      unit_name: "Johann",
      cost: 15,
    });
    expect(draft.upkeep.entries["hired_sword:22"]).toEqual({
      unit_name: "Shade",
      cost: null,
    });
    expect(draft.unit_results["hero:1"].xp_earned).toBe(2);
    expect(draft.unit_results["henchman:11"].xp_earned).toBe(2);
    expect(draft.unit_results["henchman:12"].xp_earned).toBe(2);
  });

  it("never lets saved postbattle kill counts drop below active battle kill counts", () => {
    const draft = buildPostbattleDraft(
      battle,
      {
        ...participant,
        postbattle_json: {
          exploration: {
            dice_values: [],
            resource_id: null,
          },
          upkeep: {
            pay_upkeep: true,
            entries: {
              "hired_sword:21": {
                unit_name: "Johann",
                cost: 7,
              },
            },
          },
          unit_results: {
            "hero:1": {
              unit_name: "Captain Wolf",
              unit_kind: "hero",
              unit_type: "Captain",
              group_name: "",
              out_of_action: false,
              kill_count: 1,
              xp_earned: 4,
              dead: false,
              special_ids: [],
              serious_injury_rolls: [],
            },
          },
        },
      },
      roster,
      [],
      events
    );

    expect(draft.unit_results["hero:1"].kill_count).toBe(2);
    expect(draft.unit_results["hero:1"].xp_earned).toBe(4);
    expect(draft.upkeep.entries["hired_sword:21"]?.cost).toBe(7);
  });

  it("preserves roster order when building renderable groups", () => {
    const orderedRoster: ParticipantRoster = {
      ...roster,
      heroes: [
        {
          ...roster.heroes[0],
          key: "hero:2",
          id: 2,
          displayName: "Zulu Hero",
        },
        {
          ...roster.heroes[0],
          key: "hero:1",
          id: 1,
          displayName: "Alpha Hero",
        },
      ],
      hiredSwords: [
        {
          ...roster.heroes[0],
          key: "hired_sword:2",
          id: 102,
          kind: "hired_sword",
          displayName: "Zulu Sword",
          unitType: "Hired Sword",
        },
        {
          ...roster.heroes[0],
          key: "hired_sword:1",
          id: 101,
          kind: "hired_sword",
          displayName: "Alpha Sword",
          unitType: "Hired Sword",
        },
      ],
      henchmenGroups: [
        {
          ...roster.henchmenGroups[0],
          members: [
            {
              ...roster.henchmenGroups[0].members[0],
              key: "henchman:12",
              id: 12,
              displayName: "Blade 2",
            },
            {
              ...roster.henchmenGroups[0].members[0],
              key: "henchman:11",
              id: 11,
              displayName: "Blade 1",
            },
          ],
        },
      ],
    };
    const orderedParticipant: BattleParticipant = {
      ...participant,
      selected_unit_keys_json: ["hero:2", "hero:1", "hired_sword:2", "hired_sword:1", "henchman:12", "henchman:11"],
      unit_information_json: {
        "hero:2": { stats_override: {}, out_of_action: false, kill_count: 0 },
        "hero:1": { stats_override: {}, out_of_action: false, kill_count: 0 },
        "hired_sword:2": { stats_override: {}, out_of_action: false, kill_count: 0 },
        "hired_sword:1": { stats_override: {}, out_of_action: false, kill_count: 0 },
        "henchman:12": { stats_override: {}, out_of_action: false, kill_count: 0 },
        "henchman:11": { stats_override: {}, out_of_action: false, kill_count: 0 },
      },
    };

    const draft = buildPostbattleDraft(battle, orderedParticipant, orderedRoster, [], []);
    const groups = buildRenderableGroups(draft);

    expect(groups.find((group) => group.unitKind === "hero")?.rows.map((row) => row.unitName)).toEqual([
      "Zulu Hero",
      "Alpha Hero",
    ]);
    expect(groups.find((group) => group.unitKind === "hired_sword")?.rows.map((row) => row.unitName)).toEqual([
      "Zulu Sword",
      "Alpha Sword",
    ]);
    expect(groups.find((group) => group.unitKind === "henchman")?.rows.map((row) => row.unitName)).toEqual([
      "Blade 2",
      "Blade 1",
    ]);
  });

  it("builds local exploration defaults and preserves values when count changes", () => {
    const state = buildLocalExplorationState(participant, roster, battle, [{ id: 7, name: "Shards", amount: 0 }]);
    expect(state.diceCount).toBe(2);
    expect(state.diceValues).toEqual([null, null]);
    expect(state.selectedDice).toEqual([true, true]);
    expect(state.resourceId).toBe(7);

    const expanded = setLocalExplorationDiceCount(
      {
        ...state,
        diceValues: [4, 6],
      },
      4
    );
    expect(expanded.diceValues).toEqual([4, 6, null, null]);
    expect(expanded.selectedDice).toEqual([true, true, true, true]);

    const trimmed = setLocalExplorationDiceCount(expanded, 1);
    expect(trimmed.diceValues).toEqual([4]);
    expect(trimmed.selectedDice).toEqual([true]);
  });

  it("updates upkeep totals, excludes dead hired swords, and respects the pay toggle", () => {
    const draft = buildPostbattleDraft(battle, participant, roster, [], []);

    expect(getPostbattleUpkeepTotal(draft)).toBe(15);

    const updated = updatePostbattleUpkeepEntry(draft, "hired_sword:21", 20);
    expect(getPostbattleUpkeepTotal(updated)).toBe(20);

    const withDeadHiredSword = {
      ...updated,
      unit_results: {
        ...updated.unit_results,
        "hired_sword:21": {
          unit_name: "Johann",
          unit_kind: "hired_sword" as const,
          unit_type: "Pit Fighter",
          group_name: "",
          out_of_action: true,
          kill_count: 0,
          xp_earned: 1,
          dead: true,
          special_ids: [],
          serious_injury_rolls: [],
        },
      },
    };
    expect(getPostbattleUpkeepTotal(withDeadHiredSword)).toBe(0);

    const unpaid = setPostbattlePayUpkeep(updated, false);
    expect(unpaid.upkeep.pay_upkeep).toBe(false);
    expect(getPostbattleUpkeepTotal(unpaid)).toBe(20);
  });

  it("rolls all local exploration dice and maps totals to resource table values", () => {
    const randomSpy = vi.spyOn(Math, "random");
    randomSpy.mockReturnValueOnce(0).mockReturnValueOnce(0.5);

    const rolled = rollAllLocalExplorationDice({
      diceCount: 2,
      diceValues: [null, null],
      selectedDice: [true, true],
      resourceId: 7,
      hasRolledAllDice: false,
    });
    expect(rolled.hasRolledAllDice).toBe(true);
    expect(rolled.diceValues).toEqual([1, 4]);
    expect(getExplorationResourceAmount([1, 4, null])).toBe(1);
    expect(getExplorationResourceAmount([6, 6, 6, 6, 6, 6])).toBe(7);

    randomSpy.mockRestore();
  });

  it("only includes checked exploration dice in the final payload and reward", () => {
    const state = {
      diceCount: 7,
      diceValues: [6, 6, 6, 6, 6, 1, 1] as Array<number | null>,
      selectedDice: [true, true, true, true, true, true, false],
      resourceId: 7,
      hasRolledAllDice: true,
    };
    expect(getSelectedExplorationDiceValues(state)).toEqual([6, 6, 6, 6, 6, 1]);
    expect(getExplorationResourceAmount(getSelectedExplorationDiceValues(state))).toBe(6);
    expect(toPostbattleExplorationPayload(state)).toEqual({
      dice_values: [6, 6, 6, 6, 6, 1],
      resource_id: 7,
    });

    const unchecked = setLocalExplorationDieSelected(state, 0, false);
    const checked = setLocalExplorationDieSelected(unchecked, 6, true);
    expect(checked.selectedDice).toEqual([false, true, true, true, true, true, true]);
  });

  it("rolls d6 and d66 serious injury guides deterministically", () => {
    const randomSpy = vi.spyOn(Math, "random");
    randomSpy.mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValueOnce(0);

    const d6 = rollD6SeriousInjury();
    expect(d6.result_label).toBe("Dead");

    const hero = rollHeroSeriousInjury();
    expect(hero.result_code).toBe("11");
    expect(hero.dead_suggestion).toBe(true);

    randomSpy.mockRestore();
  });
});
