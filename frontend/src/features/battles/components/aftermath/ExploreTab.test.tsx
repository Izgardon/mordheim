import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LocalExplorationState } from "@/features/battles/components/postbattle/postbattle-utils";
import type { ExplorationState } from "@/features/battles/hooks/useExploration";
import type { BattlePostbattleRules } from "@/features/battles/types/battle-types";
import { rollDie } from "@/lib/dice";
import { setupUser } from "@/test/user-event";

import ExploreTab from "./ExploreTab";

vi.mock("@/lib/dice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dice")>()),
  rollDie: vi.fn(),
}));

const unrolled: LocalExplorationState = {
  diceCount: 3,
  diceValues: [null, null, null],
  selectedDice: [true, true, true],
  resourceId: 4,
  amountOverride: null,
  hasRolledAllDice: false,
};

/** A campaign's own chart, to prove the places shown are the server's and not a copy of our own. */
const rules = {
  exploration_table: [{ max_total: null, amount: 1 }],
  exploration_dice: { max: 10, max_chosen: 6 },
  exploration_multiples: [
    { count: 2, label: "Twice", places: ["Jetty", "b", "c", "d", "e", "f"] },
    { count: 3, label: "Thrice", places: ["a", "b", "Daemon Swamp", "d", "e", "f"] },
  ],
  hero_death_roll: "d66",
  injury_tables: {},
} as BattlePostbattleRules;

const rolled = (diceValues: number[], ruleset?: BattlePostbattleRules) => {
  render(
    <ExploreTab
      explore={
        {
          exploration: {
            ...unrolled,
            diceCount: diceValues.length,
            diceValues,
            selectedDice: diceValues.map(() => true),
            hasRolledAllDice: true,
          },
          amount: 1,
          rules: ruleset,
          limits: { max: 10, max_chosen: 6 },
          setExploration: vi.fn(),
          commitDiceCount: vi.fn(),
        } as unknown as ExplorationState
      }
      resources={[{ id: 4, name: "Wyrdstone", amount: 2 } as never]}
      why="2 heroes on their feet, +1 for winning"
      isMobile={false}
    />
  );
};

const show = () => {
  const setExploration = vi.fn();
  const explore = {
    exploration: unrolled,
    amount: 0,
    limits: { max: 10, max_chosen: 6 },
    setExploration,
    commitDiceCount: vi.fn(),
  } as unknown as ExplorationState;
  render(
    <ExploreTab
      explore={explore}
      resources={[{ id: 4, name: "Wyrdstone", amount: 2 } as never]}
      why="2 heroes on their feet, +1 for winning"
      isMobile={false}
    />
  );
  return setExploration;
};

describe("ExploreTab", () => {
  beforeEach(() => {
    vi.mocked(rollDie).mockReset();
  });

  it("has a box for each of the warband's dice and takes them typed in, as Roll does", async () => {
    const user = setupUser();
    const setExploration = show();
    expect(screen.getAllByRole("textbox")).toHaveLength(3);
    await user.type(screen.getByLabelText("First D6 rolled"), "6");
    await user.keyboard("6");
    expect(setExploration).not.toHaveBeenCalled();
    await user.keyboard("2");
    expect(setExploration).toHaveBeenCalledWith({
      ...unrolled,
      diceValues: [6, 6, 2],
      hasRolledAllDice: true,
    });
    expect(rollDie).not.toHaveBeenCalled();

    vi.mocked(rollDie).mockReturnValueOnce(6).mockReturnValueOnce(6).mockReturnValueOnce(2);
    await user.click(screen.getByRole("button", { name: "Roll 3D6" }));
    expect(setExploration.mock.calls[1]).toEqual(setExploration.mock.calls[0]);
  });

  it("names each multiple's place from the server's chart, never a list of its own", () => {
    rolled([3, 3, 3, 1, 1], rules);
    expect(screen.getByText("Daemon Swamp")).toBeInTheDocument();
    expect(screen.getByText("Thrice 3\u00b73\u00b73")).toBeInTheDocument();
    expect(screen.getByText("Jetty")).toBeInTheDocument();
    // the rulebook's own answers for these dice, which the page used to carry
    expect(screen.queryByText("Prisoners")).not.toBeInTheDocument();
    expect(screen.queryByText("Well")).not.toBeInTheDocument();
  });

  it("names no place when the server sent no chart", () => {
    rolled([3, 3, 3]);
    expect(screen.queryByText(/of a kind|Thrice/)).not.toBeInTheDocument();
  });
});
