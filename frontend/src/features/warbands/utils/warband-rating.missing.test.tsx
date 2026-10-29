/**
 * Units missing games are left out of the warband rating, as the server's summary leaves them out
 * (they still count towards the warband's size and the caps). The rating dialog names them.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { calculateWarbandRating } from "./warband-utils";
import WarbandRatingDialog from "../components/warband/WarbandRatingDialog";
import {
  makeVeteranHenchmenGroup,
  makeVeteranHero,
  makeVeteranHireling,
} from "@/test/warband-fixtures";

/** Aldric: 5 + 7 XP. */
const leader = makeVeteranHero();
const wounded = makeVeteranHero({ id: 12, name: "Pieter Kalb", missing_games: 2 });
const lost = makeVeteranHenchmenGroup({ id: 30, name: "Swords", missing_games: 1 });
const ogre = makeVeteranHireling({ name: "Grukk", missing_games: 3 });

describe("missing units in the warband rating", () => {
  it("leaves units missing games out of the page's rating", () => {
    expect(calculateWarbandRating([leader, wounded], [ogre], [lost])).toBe(
      calculateWarbandRating([leader], [], [])
    );
    expect(calculateWarbandRating([wounded], [], [], 40)).toBe(0); // all out: 0, not the fallback
  });

  it("leaves them out of the dialog's lines and names them", () => {
    render(
      <WarbandRatingDialog
        open
        onOpenChange={() => undefined}
        heroes={[leader, wounded]}
        hirelings={[ogre]}
        henchmenGroups={[lost]}
      />
    );

    expect(
      screen.getByText((_, element) => element?.textContent === "Heroes: 1 - 7 XP")
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Henchmen:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Hired Swords:/)).not.toBeInTheDocument();
    expect(screen.getAllByText("12")).toHaveLength(3); // the heroes' line, the top and the total
    expect(screen.getByText(/^Missing games \(left out\):/)).toHaveTextContent(
      "Missing games (left out): Pieter Kalb, Grukk, Swords"
    );
  });
});
