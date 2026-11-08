/**
 * A roster card is trimmed in its kind's metal (William, 7 Nov 2026: "heroes gold HS silver hench
 * bronze"; mockup C): the stripe down its left edge, the gem before its name and its type line,
 * closed or open. A dramatis persona is a hired sword.
 */
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { renderWithQueryClient } from "@/test/query-test-utils";
import { makeHero, makeVeteranHenchmenGroup } from "@/test/warband-fixtures";

import type { WarbandHireling } from "../../types/warband-types";
import UnitCard from "./UnitCard";
import type { RosterUnit } from "./unit-view";

const hired = (fields: Partial<WarbandHireling>) =>
  ({ ...makeHero({ id: 3 }), ...fields }) as WarbandHireling;

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

const CASES: [string, RosterUnit, string, string, string][] = [
  [
    "a hero",
    { kind: "hero", unit: makeHero({ name: "Aldric Voss", unit_type: "Mercenary Captain" }) },
    "Aldric Voss",
    "Mercenary Captain",
    "gold",
  ],
  [
    "a henchmen group",
    { kind: "henchmen_group", unit: makeVeteranHenchmenGroup({ unit_type: "Warrior" }) },
    "Black Knives",
    "Warrior",
    "bronze",
  ],
  [
    "a hired sword",
    { kind: "hireling", unit: hired({ name: "Grukk", unit_type: "Ogre Bodyguard" }) },
    "Grukk",
    "Ogre Bodyguard",
    "silver",
  ],
  [
    "a dramatis persona",
    {
      kind: "hireling",
      unit: hired({ name: "Bertha", unit_type: "Bertha", kind: "dramatis_persona" }),
    },
    "Bertha",
    "Dramatis persona",
    "silver",
  ],
];

describe("A roster card's trim", () => {
  it.each(CASES)("is %s's metal", (_label, entry, name, typeLine, metal) => {
    renderCard(entry);
    const card = screen.getByRole("article");

    expect(card).toHaveClass("border-l-[3px]", `border-l-metal-${metal}`);
    expect(screen.getByText(name).querySelector("[aria-hidden=true]")).toHaveClass(
      "rotate-45",
      `bg-metal-${metal}`
    );
    expect(screen.getByText(typeLine)).toHaveClass(`text-metal-${metal}`);
    // only its own metal, on any part of the card
    expect(new Set(card.outerHTML.match(/metal-[a-z]+/g))).toEqual(new Set([`metal-${metal}`]));
  });

  it("stays on an open card", () => {
    const [, entry] = CASES[0];
    renderCard(entry, true);

    expect(screen.getByRole("article")).toHaveClass("col-span-full", "border-l-metal-gold");
  });
});
