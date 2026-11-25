/**
 * The card's Missing badge (William, 25 Nov 2026): a hero's games, and for a group how many of its
 * members miss games, since a henchman misses them on his own.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { makeHero, makeVeteranHenchmenGroup } from "@/test/warband-fixtures";

import UnitBadges, { hasBadges } from "./UnitBadges";
import type { RosterUnit } from "./unit-view";

const badges = (entry: RosterUnit) =>
  render(<UnitBadges entry={entry} campaign={null} canEdit onRide={vi.fn()} />);

describe("The card's Missing badge", () => {
  it("says a hero's games", () => {
    badges({ kind: "hero", unit: makeHero({ id: 5, missing_games: 2 }) });
    expect(screen.getByText("Missing · 2 games")).toBeInTheDocument();
  });

  it("counts a group's members who miss games, and is absent while every one fights", () => {
    const group = makeVeteranHenchmenGroup();
    expect(hasBadges({ kind: "henchmen_group", unit: group }, null)).toBe(false);
    group.henchmen[0] = { ...group.henchmen[0], missing_games: 1 };

    badges({ kind: "henchmen_group", unit: group });

    expect(screen.getByText("Missing · 1 member")).toBeInTheDocument();
    expect(hasBadges({ kind: "henchmen_group", unit: group }, null)).toBe(true);
  });
});
