import { describe, expect, it } from "vitest";

import type {
  BattlePostbattleState,
  BattlePostbattleSuggestion,
  BattleParticipant,
} from "@/features/battles/types/battle-types";
import { postbattleRules } from "@/test/battle-fixtures";
import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";

import { explorationAmount } from "./postbattle-rules";
import {
  buildLocalExplorationState,
  settledExplorationPayload,
  buildPostbattleDraft,
  buildRenderableGroups,
  getPostbattleUpkeepTotal,
  getSelectedExplorationDiceValues,
  setPostbattlePayUpkeep,
  setLocalExplorationDiceCount,
  setLocalExplorationDieSelected,
  toPostbattleExplorationPayload,
  updatePostbattleUpkeepEntry,
} from "./postbattle-utils";

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
  battle_notes: "",
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
  hirelings: [
    {
      key: "hireling:21",
      id: 21,
      kind: "hireling",
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
      key: "hireling:22",
      id: 22,
      kind: "hireling",
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

/** The server's `suggested_postbattle` for this fixture (IMP-52). */
const suggestion: BattlePostbattleSuggestion = {
  unit_results: {
    "hero:1": { xp_earned: 2 },
    "hireling:21": { xp_earned: 1 },
    "henchman:11": { xp_earned: 2 },
    "henchman:12": { xp_earned: 2 },
  },
  exploration: { dice_count: 2 },
  upkeep: {
    entries: {
      "hireling:21": { unit_name: "Johann", cost: 15 },
      "hireling:22": { unit_name: "Shade", cost: null },
    },
  },
};

describe("postbattle-utils", () => {
  it("fills the draft from the server's suggestion: XP per unit and upkeep (IMP-52)", () => {
    const draft = buildPostbattleDraft(
      participant,
      roster,
      [{ id: 7, warband_id: 10, name: "Shards", amount: 0 }],
      suggestion
    );

    expect(draft.exploration.dice_values).toEqual([]);
    expect(draft.exploration.resource_id).toBe(7);
    expect(draft.finds).toEqual({
      gold_crowns: 0,
      items: [],
    });
    expect(draft.upkeep.pay_upkeep).toBe(true);
    expect(draft.upkeep.entries["hireling:21"]).toEqual({
      unit_name: "Johann",
      cost: 15,
    });
    expect(draft.upkeep.entries["hireling:22"]).toEqual({
      unit_name: "Shade",
      cost: null,
    });
    expect(draft.unit_results["hero:1"].xp_earned).toBe(2);
    expect(draft.unit_results["henchman:11"].xp_earned).toBe(2);
    expect(draft.unit_results["henchman:12"].xp_earned).toBe(2);

    // Without the suggestion (an older server) XP starts at 0 and upkeep is unknown.
    const unsuggested = buildPostbattleDraft(participant, roster, [], undefined);
    expect(unsuggested.unit_results["hero:1"].xp_earned).toBe(0);
    expect(unsuggested.upkeep.entries["hireling:21"]).toEqual({
      unit_name: "Johann",
      cost: null,
    });
  });

  it("never lets saved postbattle kill counts drop below active battle kill counts", () => {
    const draft = buildPostbattleDraft(
      {
        ...participant,
        postbattle_json: {
          exploration: {
            dice_values: [],
            resource_id: null,
          },
          finds: {
            gold_crowns: 12,
            items: [
              {
                item_id: 99,
                name: "Lucky Charm",
                type: "Miscellaneous",
                cost: 15,
              },
            ],
          },
          upkeep: {
            pay_upkeep: true,
            entries: {
              "hireling:21": {
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
      suggestion
    );

    expect(draft.unit_results["hero:1"].kill_count).toBe(2);
    expect(draft.unit_results["hero:1"].xp_earned).toBe(4);
    expect(draft.finds).toEqual({
      gold_crowns: 12,
      items: [
        {
          item_id: 99,
          name: "Lucky Charm",
          type: "Miscellaneous",
          cost: 15,
        },
      ],
    });
    expect(draft.upkeep.entries["hireling:21"]?.cost).toBe(7);
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
      hirelings: [
        {
          ...roster.heroes[0],
          key: "hireling:2",
          id: 102,
          kind: "hireling",
          displayName: "Zulu Sword",
          unitType: "Hired Sword",
        },
        {
          ...roster.heroes[0],
          key: "hireling:1",
          id: 101,
          kind: "hireling",
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
      selected_unit_keys_json: [
        "hero:2",
        "hero:1",
        "hireling:2",
        "hireling:1",
        "henchman:12",
        "henchman:11",
      ],
      unit_information_json: {
        "hero:2": { stats_override: {}, out_of_action: false, kill_count: 0 },
        "hero:1": { stats_override: {}, out_of_action: false, kill_count: 0 },
        "hireling:2": { stats_override: {}, out_of_action: false, kill_count: 0 },
        "hireling:1": { stats_override: {}, out_of_action: false, kill_count: 0 },
        "henchman:12": { stats_override: {}, out_of_action: false, kill_count: 0 },
        "henchman:11": { stats_override: {}, out_of_action: false, kill_count: 0 },
      },
    };

    const draft = buildPostbattleDraft(orderedParticipant, orderedRoster, [], undefined);
    const groups = buildRenderableGroups(draft, orderedRoster);

    expect(
      groups.find((group) => group.unitKind === "hero")?.rows.map((row) => row.unitName)
    ).toEqual(["Zulu Hero", "Alpha Hero"]);
    expect(
      groups.find((group) => group.unitKind === "hireling")?.rows.map((row) => row.unitName)
    ).toEqual(["Zulu Sword", "Alpha Sword"]);
    expect(
      groups.find((group) => group.unitKind === "henchman")?.rows.map((row) => row.unitName)
    ).toEqual(["Blade 2", "Blade 1"]);
  });

  it("hides XP for units flagged with no level ups, which the server suggests 0 for", () => {
    const noLevelRoster: ParticipantRoster = {
      ...roster,
      hirelings: roster.hirelings.map((entry) =>
        entry.key === "hireling:21" ? { ...entry, noLevelUps: true } : entry
      ),
      henchmenGroups: roster.henchmenGroups.map((group) => ({
        ...group,
        members: group.members.map((member) => ({ ...member, noLevelUps: true })),
      })),
    };
    const noLevelParticipant: BattleParticipant = {
      ...participant,
      selected_unit_keys_json: ["hero:1", "hireling:21", "henchman:11", "henchman:12"],
      unit_information_json: {
        ...participant.unit_information_json,
        "hireling:21": { stats_override: {}, out_of_action: false, kill_count: 0 },
      },
    };

    const draft = buildPostbattleDraft(noLevelParticipant, noLevelRoster, [], {
      ...suggestion,
      unit_results: {
        ...suggestion.unit_results,
        "hireling:21": { xp_earned: 0 },
        "henchman:11": { xp_earned: 0 },
        "henchman:12": { xp_earned: 0 },
      },
    });
    const groups = buildRenderableGroups(draft, noLevelRoster);

    expect(draft.unit_results["hireling:21"].xp_earned).toBe(0);
    expect(draft.unit_results["henchman:11"].xp_earned).toBe(0);
    expect(draft.unit_results["henchman:12"].xp_earned).toBe(0);
    expect(groups.find((group) => group.unitKind === "hireling")?.rows[0]?.canGainXp).toBe(false);
    expect(
      groups.find((group) => group.unitKind === "henchman")?.rows.every((row) => !row.canGainXp)
    ).toBe(true);
  });

  describe("hirelings by kind (the bestiary rewrite's step 2)", () => {
    /** Johann a hired sword on the henchman table; Shade a one-battle dramatis persona on the hero table. */
    const kindsRoster: ParticipantRoster = {
      ...roster,
      hirelings: [
        { ...roster.hirelings[0], hirelingKind: "hired_sword", injuryTable: "henchman" },
        {
          ...roster.hirelings[1],
          hirelingKind: "dramatis_persona",
          injuryTable: "hero",
          stays: "one_battle",
          paymentNote: "a favour",
        },
      ],
    };
    const kindsParticipant: BattleParticipant = {
      ...participant,
      selected_unit_keys_json: ["hero:1", "hireling:21", "hireling:22"],
      unit_information_json: {
        "hero:1": { stats_override: {}, out_of_action: true, kill_count: 0 },
        "hireling:21": { stats_override: {}, out_of_action: true, kill_count: 0 },
        "hireling:22": { stats_override: {}, out_of_action: true, kill_count: 0 },
      },
    };
    const kindsSuggestion: BattlePostbattleSuggestion = {
      unit_results: {
        "hero:1": { xp_earned: 1 },
        "hireling:21": { xp_earned: 1 },
        "hireling:22": { xp_earned: 0, reasons: [{ label: "dramatis persona", xp: 0 }] },
      },
      exploration: { dice_count: 0 },
      upkeep: {
        entries: {
          "hireling:21": { unit_name: "Johann", cost: 0, cost_expression: "1 piece of wyrdstone" },
        },
      },
      dismiss: { entries: { "hireling:22": { unit_name: "Shade", reason: "stays_one_battle" } } },
    };
    const rows = () => {
      const draft = buildPostbattleDraft(kindsParticipant, kindsRoster, [], kindsSuggestion);
      return buildRenderableGroups(draft, kindsRoster).flatMap((group) => group.rows);
    };
    const row = (unitKey: string) => rows().find((entry) => entry.unitKey === unitKey)!;

    it("rolls each hireling on the table its battle roster names: the hero table for a dramatis persona, a D6 otherwise", () => {
      expect(row("hero:1").injuryTable).toBe("hero");
      expect(row("hireling:21").injuryTable).toBe("henchman");
      expect(row("hireling:22").injuryTable).toBe("hero");
      // A roster from before the rewrite names no table: the D6.
      const old = buildRenderableGroups(
        buildPostbattleDraft(kindsParticipant, roster, [], kindsSuggestion),
        roster
      ).flatMap((group) => group.rows);
      expect(old.find((entry) => entry.unitKey === "hireling:22")?.injuryTable).toBe("henchman");
    });

    it("gives a dramatis persona no XP, by kind, even without no level-ups", () => {
      expect(row("hireling:21").canGainXp).toBe(true);
      expect(row("hireling:22").canGainXp).toBe(false);
      expect(row("hireling:22").xpEarned).toBe(0);
    });

    it("drafts no upkeep for a hireling who stays for one battle, and keeps the suggestion's formula", () => {
      const draft = buildPostbattleDraft(kindsParticipant, kindsRoster, [], kindsSuggestion);

      expect(Object.keys(draft.upkeep.entries)).toEqual(["hireling:21"]);
      expect(draft.upkeep.entries["hireling:21"]).toEqual({
        unit_name: "Johann",
        cost: 0,
        cost_expression: "1 piece of wyrdstone",
      });
    });
  });

  it("restores a roll saved with the draft, and calls it settled only once every die is set (BUG-71)", () => {
    const saved = buildLocalExplorationState(
      {
        ...participant,
        postbattle_json: {
          ...(participant.postbattle_json as BattlePostbattleState),
          exploration: { dice_values: [5, 2, 6], resource_id: 8, amount_override: 4 },
        },
      },
      [{ id: 7, warband_id: 10, name: "Shards", amount: 0 }],
      suggestion.exploration
    );
    expect(saved).toMatchObject({
      diceCount: 3,
      diceValues: [5, 2, 6],
      resourceId: 8,
      amountOverride: 4,
      hasRolledAllDice: true,
    });
    expect(settledExplorationPayload(saved)).toEqual({
      dice_values: [5, 2, 6],
      resource_id: 8,
      amount_override: 4,
    });
    expect(settledExplorationPayload({ ...saved, diceValues: [5, null, 6] })).toBeNull();
  });

  it("builds local exploration defaults and preserves values when count changes", () => {
    const state = buildLocalExplorationState(
      participant,
      [{ id: 7, warband_id: 10, name: "Shards", amount: 0 }],
      suggestion.exploration
    );
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
    const draft = buildPostbattleDraft(participant, roster, [], suggestion);

    expect(getPostbattleUpkeepTotal(draft)).toBe(15);

    const updated = updatePostbattleUpkeepEntry(draft, "hireling:21", 20);
    expect(getPostbattleUpkeepTotal(updated)).toBe(20);

    const withDeadHireling = {
      ...updated,
      unit_results: {
        ...updated.unit_results,
        "hireling:21": {
          unit_name: "Johann",
          unit_kind: "hireling" as const,
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
    expect(getPostbattleUpkeepTotal(withDeadHireling)).toBe(0);

    const unpaid = setPostbattlePayUpkeep(updated, false);
    expect(unpaid.upkeep.pay_upkeep).toBe(false);
    expect(getPostbattleUpkeepTotal(unpaid)).toBe(20);
  });

  it("maps exploration totals to the server's table", () => {
    expect(explorationAmount(postbattleRules(), [1, 4, null])).toBe(1);
    expect(explorationAmount(postbattleRules(), [6, 6, 6, 6, 6, 6])).toBe(7);
  });

  it("only includes checked exploration dice in the final payload and reward", () => {
    const state = {
      diceCount: 7,
      diceValues: [6, 6, 6, 6, 6, 1, 1] as Array<number | null>,
      selectedDice: [true, true, true, true, true, true, false],
      resourceId: 7,
      amountOverride: null,
      hasRolledAllDice: true,
    };
    expect(getSelectedExplorationDiceValues(state)).toEqual([6, 6, 6, 6, 6, 1]);
    expect(explorationAmount(postbattleRules(), getSelectedExplorationDiceValues(state))).toBe(6);
    expect(toPostbattleExplorationPayload(state)).toEqual({
      dice_values: [6, 6, 6, 6, 6, 1],
      resource_id: 7,
    });

    const unchecked = setLocalExplorationDieSelected(state, 0, false);
    const checked = setLocalExplorationDieSelected(unchecked, 6, true);
    expect(checked.selectedDice).toEqual([false, true, true, true, true, true, true]);
  });
});
