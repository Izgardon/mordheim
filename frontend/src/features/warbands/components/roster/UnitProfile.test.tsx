/**
 * An open card shows a unit's notes beside his profile (William, 8 Nov 2026: "have them displayed
 * in detailed card view, inline with the stats line which should become half width"): each half
 * the card on the web, as tall as the profile, clipped with a chevron that shows them in full and
 * folds them again. Without notes the profile keeps the whole width; a closed card shows none.
 */
import { screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeHero, makeVeteranHenchmenGroup } from "@/test/warband-fixtures";

import type { WarbandHireling } from "../../types/warband-types";
import UnitCard from "./UnitCard";
import type { RosterUnit } from "./unit-view";

const LONG = "Carries the banner.\nOwes Grukk 5 gc.\nSwore an oath at the Temple of Sigmar.";

const renderCard = (entry: RosterUnit, open = true) => {
  const onToggle = vi.fn();
  renderWithQueryClient(
    <UnitCard
      entry={entry}
      campaign={null}
      warbandId={9}
      open={open}
      canEdit={false}
      onToggle={onToggle}
      onLoadout={vi.fn()}
      onEdit={vi.fn()}
      onRide={vi.fn()}
    />
  );
  return { onToggle };
};

/** jsdom has no layout: makes every element's text as tall as `scroll` within `client`. */
function textHeights(scroll: number, client: number) {
  const scrollHeight = vi.spyOn(HTMLElement.prototype, "scrollHeight", "get");
  const clientHeight = vi.spyOn(HTMLElement.prototype, "clientHeight", "get");
  scrollHeight.mockReturnValue(scroll);
  clientHeight.mockReturnValue(client);
}

const strip = () => screen.getByText("WS").closest("dl") as HTMLElement;

describe("An open card's notes", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each<[string, RosterUnit]>([
    ["a hero", { kind: "hero", unit: makeHero({ notes: "Owes Grukk 5 gc." }) }],
    [
      "a henchmen group",
      { kind: "henchmen_group", unit: makeVeteranHenchmenGroup({ notes: "Owes Grukk 5 gc." }) },
    ],
    [
      "a hired sword",
      {
        kind: "hireling",
        unit: { ...makeHero({ id: 3, notes: "Owes Grukk 5 gc." }) } as WarbandHireling,
      },
    ],
  ])("sit beside %s's profile, each half the card", (_label, entry) => {
    renderCard(entry);

    const notes = screen.getByRole("note", { name: "Notes" });
    expect(notes).toHaveTextContent("Owes Grukk 5 gc.");
    const row = notes.parentElement as HTMLElement;
    expect(row).toBe(strip().parentElement);
    expect(row).toHaveClass("grid", "min-[960px]:grid-cols-2");
    // the row is the profile's height: the notes don't stretch it
    expect(strip()).toHaveClass("self-start");
  });

  it("show no box, and the profile its whole width, without notes", () => {
    renderCard({ kind: "hero", unit: makeHero({ notes: "  " }) });

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(strip().parentElement).not.toHaveClass("grid");
  });

  it("aren't on a closed card", () => {
    renderCard({ kind: "hero", unit: makeHero({ notes: LONG }) }, false);

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("fit without a chevron when they're short", () => {
    textHeights(40, 40);
    renderCard({ kind: "hero", unit: makeHero({ notes: "Owes Grukk 5 gc." }) });

    const notes = screen.getByRole("note", { name: "Notes" });
    expect(within(notes).queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("Longer notes", () => {
  beforeEach(() => textHeights(120, 40));
  afterEach(() => vi.restoreAllMocks());

  it("are clipped, shown in full by a click and folded by another, the card staying open", async () => {
    const user = setupUser();
    const { onToggle } = renderCard({ kind: "hero", unit: makeHero({ notes: LONG }) });
    const notes = screen.getByRole("note", { name: "Notes" });
    const chevron = within(notes).getByRole("button", { name: "Notes" });

    expect(chevron).toHaveAttribute("aria-expanded", "false");
    expect(notes.querySelector("p")).toHaveClass("absolute", "overflow-hidden");

    await user.click(within(notes).getByText(/Swore an oath/));
    expect(chevron).toHaveAttribute("aria-expanded", "true");
    expect(notes.querySelector("p")).not.toHaveClass("absolute");

    await user.click(chevron);
    expect(chevron).toHaveAttribute("aria-expanded", "false");
    expect(onToggle).not.toHaveBeenCalled();
  });
});
