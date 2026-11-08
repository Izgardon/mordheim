/**
 * Getting an item: a price's dice and a rare item's search take the dice rolled at the table, and
 * a rare item's search (layout D) is made once and lets it into the basket when found, or with No
 * search ticked.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { rollDie } from "@/lib/dice";
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
const searchers = [
  { id: 5, name: "Aldric", spent: false },
  { id: 6, name: "Bertolt", spent: true },
];

const show = (row: ItemAvailability, more: { firstKey?: string; bonus?: number } = {}) => {
  const onPick = vi.fn();
  const item = makeItem({ id: 201, name: "Hunting Arrows", availabilities: [row] });
  renderWithQueryClient(
    <AcquireForm
      warbandId={30}
      item={item}
      rows={[row]}
      startBonus={more.bonus ?? 1}
      recipients={[{ key: "stash", label: "Stash", target: { kind: "stash" }, count: 1 } as never]}
      firstKey={more.firstKey ?? null}
      searchers={searchers}
      isMobile={false}
      onPick={onPick}
    />
  );
  return onPick;
};
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const who = () => within(screen.getByRole("group", { name: "Who searches" }));
const rolls = (...faces: number[]) =>
  faces.forEach((face) => vi.mocked(rollDie).mockReturnValueOnce(face));

describe("AcquireForm", () => {
  beforeEach(() => {
    vi.mocked(rollDie).mockReset();
    fakeApi.reset();
    fakeApi.on(SEARCH, { hero_id: 5, warnings: [] });
  });

  it("takes a price's dice typed in, as the roll does", async () => {
    const user = setupUser();
    const onPick = show(price({ dice: 2, dice_multiplier: 5 }));
    await user.type(screen.getByLabelText("First D6 rolled"), "3");
    await user.keyboard("4");
    expect(screen.getByLabelText("Price each for Hunting Arrows")).toHaveValue(60);
    await user.click(button(/Stash/));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ price: 60, diceRoll: 7 }));
    expect(rollDie).not.toHaveBeenCalled();
  });

  it("searches with the 2D6 typed in, its bonus added, and saves it", async () => {
    const user = setupUser();
    show(price({ rarity: 9 }));
    expect(screen.getByText("Need 9+ on 2D6")).toBeInTheDocument();
    await user.click(who().getByRole("button", { name: "Aldric" }));
    await user.click(button("or enter your dice"));
    await user.keyboard("53");
    expect(fakeApi.bodyOf(SEARCH)).toEqual({
      item_id: 201,
      hero_id: 5,
      roll: 8,
      modifier: 1,
      rarity: "Rare 9",
      success: true,
    });
    expect(await screen.findByRole("status")).toHaveTextContent("5 3 +1 = 9 Found");
    expect(rollDie).not.toHaveBeenCalled();
  });

  it("rolls the search with no hero, and says when none was found", async () => {
    rolls(1, 2);
    const user = setupUser();
    show(price({ rarity: 9 }));
    await user.click(who().getByRole("button", { name: "No hero" }));
    await user.click(button("Roll to search"));
    expect(fakeApi.bodyOf(SEARCH)).toMatchObject({ hero_id: null, roll: 3, success: false });
    expect(await screen.findByRole("status")).toHaveTextContent("1 2 +1 = 4 Not found");
  });

  it("waits for someone to search", () => {
    show(price({ rarity: 9 }));
    expect(button("Roll to search")).toBeDisabled();
    expect(who().getByRole("button", { name: "Aldric" })).toHaveAttribute("aria-pressed", "false");
  });

  it("starts on the hero the store was opened for", () => {
    show(price({ rarity: 9 }), { firstKey: "heroes:6" });
    expect(who().getByRole("button", { name: /Bertolt/ })).toHaveAttribute("aria-pressed", "true");
    expect(button("Roll to search")).toBeEnabled();
  });

  it("searches once: the button locks as Searched and the other searchers grey out", async () => {
    rolls(6, 6);
    const user = setupUser();
    show(price({ rarity: 9 }));
    await user.click(who().getByRole("button", { name: "Aldric" }));
    await user.click(button("Roll to search"));

    expect(await screen.findByRole("button", { name: "Searched" })).toBeDisabled();
    expect(who().getByRole("button", { name: /Bertolt/ })).toBeDisabled();
    expect(who().getByRole("button", { name: "No hero" })).toBeDisabled();
    expect(who().getByRole("button", { name: "Aldric" })).toHaveAttribute("aria-pressed", "true");
    expect(button("Raise the bonus")).toBeDisabled();
    expect(fakeApi.countOf(SEARCH)).toBe(1);
  });

  it("starts the bonus on the variant's, and searches with the bonus as changed", async () => {
    rolls(3, 4);
    const user = setupUser();
    show(price({ rarity: 9 }), { firstKey: "heroes:5", bonus: 1 });
    const bonus = within(screen.getByRole("group", { name: "Search bonus" }));
    expect(bonus.getByText("+1")).toBeInTheDocument();
    await user.click(bonus.getByRole("button", { name: "Raise the bonus" }));
    expect(bonus.getByText("+2")).toBeInTheDocument();
    await user.click(button("Roll to search"));
    expect(fakeApi.bodyOf(SEARCH)).toMatchObject({ roll: 7, modifier: 2, success: true });
  });

  it("adds a rare item to the basket only once it was found", async () => {
    rolls(5, 4);
    const user = setupUser();
    const onPick = show(price({ rarity: 9 }), { firstKey: "heroes:5" });
    expect(button(/Stash/)).toBeDisabled();
    await user.click(button("Roll to search"));
    expect(await screen.findByRole("status")).toHaveTextContent("Found");
    await user.click(button(/Stash/));
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ availabilityId: 21, price: 25, free: false })
    );
  });

  it("adds one not found when No search is ticked", async () => {
    rolls(1, 1);
    const user = setupUser();
    const onPick = show(price({ rarity: 9 }), { firstKey: "heroes:5" });
    await user.click(button("Roll to search"));
    expect(await screen.findByRole("status")).toHaveTextContent("Not found");
    expect(button(/Stash/)).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "No search" }));
    await user.click(button(/Stash/));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ price: 25 }));
  });

  it("needs no search for a free one", async () => {
    const user = setupUser();
    const onPick = show(price({ rarity: 9 }), { firstKey: "heroes:5" });
    await user.click(screen.getByRole("checkbox", { name: "Free" }));
    expect(button("Roll to search")).toBeDisabled();
    await user.click(button(/Stash · free/));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ price: 0, free: true }));
    expect(fakeApi.countOf(SEARCH)).toBe(0);
  });

  it("keeps the search open when it couldn't be saved", async () => {
    fakeApi.fail(SEARCH);
    rolls(6, 6);
    const user = setupUser();
    show(price({ rarity: 9 }), { firstKey: "heroes:5" });
    await user.click(button("Roll to search"));
    expect(await screen.findByRole("button", { name: "Roll to search" })).toBeEnabled();
    expect(button(/Stash/)).toBeDisabled();
  });
});
