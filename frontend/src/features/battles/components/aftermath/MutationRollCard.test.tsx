import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ParticipantRoster } from "@/features/battles/components/prebattle/prebattle-types";
import type {
  BattlePostbattleMutationRoll,
  BattlePostbattleRules,
  BattlePostbattleState,
  BattleRandomMutation,
} from "@/features/battles/types/battle-types";
import { postbattleRules } from "@/test/battle-fixtures";
import { setupUser } from "@/test/user-event";

import { withMutationRoll } from "./aftermath-mutation";
import InjuriesTab from "./InjuriesTab";
import { HAS_IT } from "./MutationRollCard";

const MUTATION = { kind: "mutation" } as const;
const fangs: BattleRandomMutation = {
  roll: 34,
  name: "Fangs",
  special: "Fangs",
  special_type: "Mutation",
  text: "An extra bite attack.",
};
const maceTail: BattleRandomMutation = {
  roll: 44,
  name: "Mace Tail",
  special: "Spiked Tail",
  special_type: "Bounty of Arkhar",
  text: "A tail attack at Strength +1.",
};

const base = postbattleRules();
const rules: BattlePostbattleRules = {
  ...base,
  hero_death_roll: "d100",
  injury_tables: {
    d6: base.injury_tables.d6,
    d100: [{ low: 100, high: 100, label: "Mutation", effect: MUTATION }],
  },
  random_mutations: [fangs, maceTail],
};

const draftWith = (mutation?: BattlePostbattleMutationRoll) =>
  ({
    unit_results: {
      "hero:1": {
        unit_name: "Dieter Brandt",
        unit_type: "Champion",
        unit_kind: "hero",
        out_of_action: true,
        kill_count: 0,
        xp_earned: 0,
        dead: false,
        special_ids: [],
        serious_injury_rolls: [
          {
            roll_type: "d100",
            rolls: [100],
            result_code: "100",
            result_label: "Mutation",
            dead_suggestion: false,
            effect: MUTATION,
            ...(mutation ? { mutation } : {}),
          },
        ],
      },
    },
  }) as unknown as BattlePostbattleState;

const roster = (specials: string[]) =>
  ({
    heroes: [{ key: "hero:1", specials: specials.map((name, id) => ({ id, name })) }],
    hirelings: [],
    henchmenGroups: [],
  }) as unknown as ParticipantRoster;

function renderTab(draft: BattlePostbattleState, held: string[] = []) {
  const onChange = vi.fn();
  render(
    <InjuriesTab
      draft={draft}
      roster={roster(held)}
      rules={rules}
      suggestion={undefined}
      isMobile={false}
      onChange={onChange}
    />
  );
  return onChange;
}

const mutationOf = (next: BattlePostbattleState) =>
  next.unit_results["hero:1"].serious_injury_rolls[0].mutation;

describe("the D100 Mutation's follow-up", () => {
  it("rolls a D66 on the random mutation table, or takes the faces typed, tens then units", async () => {
    const onChange = renderTab(draftWith());
    const user = setupUser();
    expect(screen.getByRole("heading", { name: "Dieter Brandt's mutation" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Roll D66" }));
    expect(mutationOf(onChange.mock.calls[0][0])?.rolls).toHaveLength(2);

    await user.type(screen.getByRole("textbox", { name: "First D6 rolled" }), "4");
    await user.type(screen.getByRole("textbox", { name: "Second D6 rolled" }), "4");
    expect(mutationOf(onChange.mock.calls[onChange.mock.calls.length - 1][0])).toEqual({
      rolls: [4, 4],
      result_code: "44",
      name: "Mace Tail",
      special: "Spiked Tail",
      special_type: "Bounty of Arkhar",
    });
  });

  it("shows the result's name and the special's text", () => {
    renderTab(withMutationRoll(draftWith(), "hero:1", [3, 4], rules));
    expect(screen.getByText("Fangs")).toBeInTheDocument();
    expect(screen.getByText("An extra bite attack.")).toBeInTheDocument();
    expect(screen.queryByText(HAS_IT)).toBeNull();
  });

  it("warns with Roll again when he has it already, and never blocks", async () => {
    const onChange = renderTab(withMutationRoll(draftWith(), "hero:1", [4, 4], rules), [
      "spiked tail",
    ]);
    const user = setupUser();
    expect(screen.getByText(HAS_IT)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Roll again" }));
    expect(mutationOf(onChange.mock.calls[0][0])?.rolls).toHaveLength(2);
  });

  it("goes with Undo, and the Mutation's own roll stays", async () => {
    const onChange = renderTab(withMutationRoll(draftWith(), "hero:1", [3, 4], rules));
    const user = setupUser();
    const undos = screen.getAllByRole("button", { name: "Undo" });
    await user.click(undos[undos.length - 1]);
    const next = onChange.mock.calls[0][0] as BattlePostbattleState;
    expect(mutationOf(next)).toBeUndefined();
    expect(next.unit_results["hero:1"].serious_injury_rolls).toHaveLength(1);
  });
});
