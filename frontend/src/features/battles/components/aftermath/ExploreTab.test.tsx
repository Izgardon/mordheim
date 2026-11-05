import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LocalExplorationState } from "@/features/battles/components/postbattle/postbattle-utils";
import type { ExplorationState } from "@/features/battles/hooks/useExploration";
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
});
