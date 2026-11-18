import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LocalExplorationState } from "@/features/battles/components/postbattle/postbattle-utils";
import type { ExplorationState } from "@/features/battles/hooks/useExploration";
import type { BattlePostbattleRules } from "@/features/battles/types/battle-types";
import type { ExplorationChart } from "@/features/exploration/types/exploration-types";
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

const rules = {
  exploration_table: [{ max_total: null, amount: 1 }],
  exploration_dice: { max: 10, max_chosen: 6 },
  hero_death_roll: "d66",
  injury_tables: {},
} as BattlePostbattleRules;

/** A chart that pays no shards: the dice total gives what its note says (Albion's supply sources). */
const noShards = { ...rules, exploration_table: [], exploration_income_note: "2-5 Camping Site." };

const place = (face: number, name: string, placeRules = "") => ({
  id: face,
  face,
  name,
  rules: placeRules,
});

/** A campaign's own chart, to prove the places shown are the server's and not a copy of our own. */
const chart = {
  multiples: [
    { count: 2, label: "Twice", places: [place(1, "Jetty", "D6 gc.")] },
    { count: 3, label: "Thrice", places: [place(3, "Daemon Swamp")] },
  ],
} as ExplorationChart;

const rolled = (
  diceValues: number[],
  ruleset?: BattlePostbattleRules,
  found?: ExplorationChart
) => {
  render(
    <ExploreTab
      chart={found}
      explore={
        {
          exploration: {
            ...unrolled,
            diceCount: diceValues.length,
            diceValues,
            selectedDice: diceValues.map(() => true),
            hasRolledAllDice: true,
          },
          rolled: true,
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
    rolled: false,
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

  it("names each multiple's place from the campaign's chart, never a list of its own", () => {
    rolled([3, 3, 3, 1, 1], rules, chart);
    expect(screen.getByText("Daemon Swamp")).toBeInTheDocument();
    expect(screen.getByText("Thrice 3\u00b73\u00b73")).toBeInTheDocument();
    expect(screen.getByText("Jetty")).toBeInTheDocument();
    // the rulebook's own answers for these dice, which the page used to carry
    expect(screen.queryByText("Prisoners")).not.toBeInTheDocument();
    expect(screen.queryByText("Well")).not.toBeInTheDocument();
  });

  it("shows what a found place does, in the chart's own words", () => {
    rolled([1, 1], rules, chart);
    expect(screen.getByText("D6 gc.")).toBeInTheDocument();
  });

  it("says nothing about a place nobody has written rules for", () => {
    rolled([3, 3, 3], rules, chart);
    const card = screen.getByText("Daemon Swamp").closest("article") as HTMLElement;
    expect(card.querySelector("p")).toBeNull();
  });

  it("names no place when the campaign's chart hasn't arrived", () => {
    rolled([3, 3, 3], rules);
    expect(screen.queryByText(/of a kind|Thrice/)).not.toBeInTheDocument();
  });

  it("shows a no-shards chart's note instead of a shard figure", () => {
    rolled([3, 3], noShards as BattlePostbattleRules, chart);
    expect(screen.getByText("2-5 Camping Site.")).toBeInTheDocument();
    expect(screen.queryByText(/shard/)).not.toBeInTheDocument();
  });
});
