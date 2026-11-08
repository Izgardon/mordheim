/**
 * A closed card lists everything a unit has, a labelled line per kind (William, 8 Nov 2026: "in
 * the simple cards, can we show all the items, skills, spells, boons/banes in lists like the
 * items are now"): only the lines with something in them, his XP on the first line's right, a
 * group's items being what each member carries.
 */
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithQueryClient } from "@/test/query-test-utils";
import {
  dagger,
  makeHero,
  makeSkill,
  makeSpecial,
  makeVeteranHenchmenGroup,
  sword,
} from "@/test/warband-fixtures";

import type { WarbandHireling } from "../../types/warband-types";
import UnitCard from "./UnitCard";
import type { RosterUnit } from "./unit-view";

const renderCard = (entry: RosterUnit, open = false) =>
  renderWithQueryClient(
    <UnitCard
      entry={entry}
      campaign={null}
      warbandId={9}
      open={open}
      canEdit={false}
      onToggle={vi.fn()}
      onLoadout={vi.fn()}
      onEdit={vi.fn()}
      onRide={vi.fn()}
    />
  );

/** Each line as its caption and its names, in order. */
const lines = () =>
  Array.from(screen.getByRole("article").querySelectorAll("p"), (line) => [
    line.firstElementChild?.textContent,
    line.lastChild?.textContent,
  ]);

const wizard = makeHero({
  id: 5,
  name: "Konrad Adler",
  xp: 2,
  items: [sword, dagger],
  skills: [makeSkill({ id: 1, name: "Strike to Injure" }), makeSkill({ id: 2, name: "Resilient" })],
  spells: [{ id: 3, name: "The Fires of U'Zhul" }],
  specials: [
    makeSpecial({ id: 4, name: "Hatred" }),
    makeSpecial({ id: 5, name: "Old Battle Wound" }),
  ],
});

describe("A closed card's lines", () => {
  it("list a hero's items, skills, spells and boons & banes, his XP on the first", () => {
    renderCard({ kind: "hero", unit: wizard });

    expect(lines()).toEqual([
      ["Items", "Sword, Dagger"],
      ["Skills", "Strike to Injure, Resilient"],
      ["Spells", "The Fires of U'Zhul"],
      ["Boons & Banes", "Hatred, Old Battle Wound"],
    ]);
    const first = screen.getByText("Items").closest("p")?.parentElement;
    expect(first).toHaveTextContent(/XP 2 \/ \d+$/);
    expect(screen.getAllByText(/^XP /)).toHaveLength(1);
  });

  it("leave out a kind he has none of", () => {
    renderCard({ kind: "hero", unit: { ...wizard, skills: [], spells: [] } });

    expect(lines().map(([label]) => label)).toEqual(["Items", "Boons & Banes"]);
  });

  // William, 8 Nov 2026: "can remove the loadout line on henchmen cards and dont need to write
  // 'Each carries' just say items"
  it("show a group's loadout as its items, without the loadout's cost", () => {
    renderCard({ kind: "henchmen_group", unit: makeVeteranHenchmenGroup() });

    expect(lines()).toEqual([
      ["Items", "Club, Club, Club, Dagger, Dagger, Dagger"],
      ["Skills", "Resilient"],
      ["Boons & Banes", "Animosity"],
    ]);
    expect(screen.queryByText(/Each carries/)).toBeNull();
    expect(screen.queryByText(/^Loadout /)).toBeNull();
    expect(screen.getByText("Items").closest("p")?.parentElement).toHaveTextContent(/XP 4 \/ 5$/);
  });

  it("list a hired sword's the same way", () => {
    const grukk = { ...wizard, id: 3, name: "Grukk", spells: [] } as WarbandHireling;
    renderCard({ kind: "hireling", unit: grukk });

    expect(lines().map(([label]) => label)).toEqual(["Items", "Skills", "Boons & Banes"]);
  });

  it("keep his XP when he has nothing to list", () => {
    renderCard({ kind: "hero", unit: makeHero({ xp: 1 }) });

    expect(lines()).toEqual([]);
    expect(screen.getByText(/^XP 1/)).toBeInTheDocument();
  });

  it("aren't on an open card", () => {
    renderCard({ kind: "hero", unit: wizard }, true);

    expect(screen.queryByText("Boons & Banes", { selector: "p > span" })).toBeNull();
  });
});
