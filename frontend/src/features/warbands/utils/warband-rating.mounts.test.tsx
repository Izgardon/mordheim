/**
 * The warband rating the page works out matches the server's with mounts (the bestiary rewrite,
 * step 4): each rider adds his first switched-on mount's rating bonus once; a henchmen group adds
 * one per living member at most (six horses on three members add three). Pets add nothing. The
 * rating dialog shows the mounts' share on its own line.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { calculateWarbandRating } from "./warband-utils";
import { unitMountBonus } from "./companions";
import WarbandRatingDialog from "../components/warband/WarbandRatingDialog";
import { makeItem, makeVeteranHenchmenGroup, makeVeteranHero } from "@/test/warband-fixtures";

import type { UnitMount } from "../types/companion-types";

const mount = (bonus: number): UnitMount => ({
  item_row_id: 1,
  item_id: 140,
  name: "Warhorse",
  movement: 8,
  rating_bonus: bonus,
  has_profile: true,
  stats: null,
});
const horseCopy = (rowId: number, companion: boolean) =>
  makeItem({
    id: 140,
    name: "Warhorse",
    type: "Animal",
    beast_kind: "mount",
    row_id: rowId,
    companion,
  });
const ravenCopy = makeItem({
  id: 141,
  name: "Raven",
  beast_kind: "pet",
  row_id: 9,
  companion: true,
});

/** Aldric: 5 + 7 XP, riding a warhorse (+5), with a raven (nothing). */
const rider = makeVeteranHero({ mount: mount(5), items: [horseCopy(1, true), ravenCopy] });
/** Three members at 5 + 4 XP; two of their three horses ridden. */
const outriders = makeVeteranHenchmenGroup({
  mount: mount(3),
  items: [horseCopy(2, true), horseCopy(3, true), horseCopy(4, false)],
});

describe("mounts in the warband rating", () => {
  it("adds a rider's mount once, and a group's ridden mounts up to its members", () => {
    expect(unitMountBonus(rider)).toBe(5);
    expect(unitMountBonus(outriders)).toBe(6);
    const overMounted = makeVeteranHenchmenGroup({
      mount: mount(3),
      henchmen: outriders.henchmen.slice(0, 2),
      items: [horseCopy(2, true), horseCopy(3, true), horseCopy(4, true)],
    });
    expect(unitMountBonus(overMounted)).toBe(6);
    expect(unitMountBonus(makeVeteranHero())).toBe(0);
  });

  it("puts the bonuses in the page's rating, as the server's summary counts them", () => {
    // Aldric 12 + 5; the group 3 x 9 + 6.
    expect(calculateWarbandRating([rider], [], [outriders])).toBe(17 + 33);
  });

  it("shows the mounts' share in the rating dialog", () => {
    render(
      <WarbandRatingDialog
        open
        onOpenChange={() => undefined}
        heroes={[rider]}
        hirelings={[]}
        henchmenGroups={[outriders]}
      />
    );

    expect(screen.getByText("Mounts:")).toBeInTheDocument();
    expect(screen.getByText("11")).toBeInTheDocument();
    expect(screen.getAllByText("50")).toHaveLength(2);
  });
});
