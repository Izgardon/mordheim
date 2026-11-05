/** The store's rolls take the dice rolled at the table: a price's dice and a rare item's search. */
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { rollDice, rollDie } from "@/lib/dice";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeItem } from "@/test/warband-fixtures";

import type { ItemAvailability } from "../types/item-types";
import AcquireForm from "./AcquireForm";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/dice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dice")>()),
  rollDie: vi.fn(),
  rollDice: vi.fn(),
}));

const SEARCH = "POST /warbands/30/rarity-rolls/";
const price = (change: Partial<ItemAvailability>): ItemAvailability => ({
  id: 21,
  label: "",
  cost: 25,
  dice: null,
  dice_multiplier: null,
  cost_note: "",
  rarity: null,
  for_everyone: true,
  warbands: [],
  note: "",
  ...change,
});

const show = (row: ItemAvailability) => {
  const onPick = vi.fn();
  const item = makeItem({ id: 201, name: "Hunting Arrows", availabilities: [row] });
  renderWithQueryClient(
    <AcquireForm
      warbandId={30}
      item={item}
      rows={[row]}
      startBonus={1}
      recipients={[{ key: "stash", label: "Stash", target: { kind: "stash" }, count: 1 } as never]}
      firstKey={null}
      searchers={[{ id: 5, name: "Aldric", spent: false }]}
      isMobile={false}
      onPick={onPick}
    />
  );
  return onPick;
};

describe("AcquireForm", () => {
  beforeEach(() => {
    vi.mocked(rollDie).mockReset();
    vi.mocked(rollDice).mockReset();
    fakeApi.reset();
    fakeApi.on(SEARCH, { hero_id: 5, warnings: [] });
  });

  it("takes a price's dice typed in, as the roll does", async () => {
    const user = setupUser();
    const onPick = show(price({ dice: 2, dice_multiplier: 5 }));
    await user.type(screen.getByLabelText("First D6 rolled"), "3");
    await user.keyboard("4");
    expect(screen.getByLabelText("Price each for Hunting Arrows")).toHaveValue(60);
    await user.click(screen.getByRole("button", { name: /Stash/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ price: 60, diceRoll: 7 }));
    expect(rollDie).not.toHaveBeenCalled();
  });

  it("searches with the 2D6 typed in, its bonus added, and empties the boxes for the next", async () => {
    const user = setupUser();
    show(price({ rarity: 9 }));
    await user.type(screen.getByLabelText("First D6 rolled"), "5");
    expect(screen.getByRole("button", { name: "Aldric" })).toBeDisabled();
    await user.keyboard("3");
    await user.click(screen.getByRole("button", { name: "Aldric" }));
    expect(fakeApi.bodyOf(SEARCH)).toEqual({
      item_id: 201,
      hero_id: 5,
      roll: 8,
      modifier: 1,
      rarity: "Rare 9",
      success: true,
    });
    expect(await screen.findByText("Aldric rolled 5 + 3, +1 bonus = 9. Found one.")).toBeVisible();
    expect(screen.getByLabelText("First D6 rolled")).toHaveValue("");
    expect(rollDice).not.toHaveBeenCalled();
  });

  it("rolls the search when nothing is typed", async () => {
    vi.mocked(rollDice).mockReturnValueOnce([1, 2]);
    const user = setupUser();
    show(price({ rarity: 9 }));
    await user.click(screen.getByRole("button", { name: "No hero" }));
    expect(fakeApi.bodyOf(SEARCH)).toMatchObject({ hero_id: null, roll: 3, success: false });
  });
});
