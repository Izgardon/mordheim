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

const setDie = vi.fn();
const readAndRoll = vi.fn();

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
          setDie,
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
      onReadAndRoll={readAndRoll}
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
      onReadAndRoll={readAndRoll}
    />
  );
  return setExploration;
};

describe("ExploreTab", () => {
  beforeEach(() => {
    vi.mocked(rollDie).mockReset();
    setDie.mockReset();
  });

  // William's unanswered bullet: "exploration dice editable and individually re-rollable". Once
  // rolled, each die was a plain span and the whole roll was fixed.
  it("takes a rolled die typed over, leaving the rest of the roll as it was thrown", async () => {
    const user = setupUser();
    rolled([3, 3, 3], rules, chart);

    await user.type(screen.getByLabelText("Die 2"), "5");

    expect(setDie).toHaveBeenCalledWith(1, 5);
    expect(rollDie).not.toHaveBeenCalled();
  });

  it("throws one die again on its own", async () => {
    const user = setupUser();
    vi.mocked(rollDie).mockReturnValueOnce(4);
    rolled([3, 3, 3], rules, chart);

    await user.click(screen.getByRole("button", { name: "Roll die 3 again" }));

    expect(setDie).toHaveBeenCalledWith(2, 4);
  });

  it("keeps a die's face when what is typed is no face of a D6", async () => {
    const user = setupUser();
    rolled([3, 3, 3], rules, chart);

    await user.type(screen.getByLabelText("Die 1"), "9");

    expect(setDie).toHaveBeenCalledWith(0, 3);
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

  it("opens a place's text and the roller from Read and roll, never another page", async () => {
    const user = setupUser();
    rolled([1, 1], rules, chart);
    const card = screen.getByText("Jetty").closest("article") as HTMLElement;
    expect(card.querySelector("a")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Read and roll" }));
    expect(readAndRoll).toHaveBeenCalledWith(
      expect.objectContaining({ kicker: "Twice 1\u00b71", place: chart.multiples[0].places[0] })
    );
  });

  it("offers no Read and roll for a place with nothing to read", () => {
    rolled([3, 3, 3], rules, chart);
    expect(screen.queryByRole("button", { name: "Read and roll" })).toBeNull();
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
