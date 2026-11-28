import { screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { NO_LOCKS } from "@/features/battles/components/aftermath/aftermath-locks";
import { renderWithQueryClient } from "@/test/query-test-utils";

import PostgameBar from "./PostgameBar";
import type { OpenCamp } from "./camp-types";

/** A post-game with nothing left to do on any Aftermath step: no units, no dice. */
const camp = (applied: ("injuries" | "xp" | "explore")[]) =>
  ({
    draft: { unit_results: {}, upkeep: { entries: {} }, camp: {} },
    postgame: {
      sheet: { heroes: [], henchmen_groups: [], hirelings: [] },
      explore: { exploration: { diceValues: [] } },
      locks: {
        ...NO_LOCKS,
        applied,
        injuries: applied.includes("injuries"),
        xp: applied.includes("xp"),
        explore: applied.includes("explore"),
      },
    },
    battleState: { suggested_postbattle: undefined },
    campaign: null,
    hirelings: [],
    title: "Powder Bridge, Battle 1",
    subtitle: "Lost against Blood eaters",
    aftermathPath: "/campaigns/1/battles/2/postbattle",
    bought: false,
    focus: null,
    setCamp: () => undefined,
  }) as unknown as OpenCamp;

const show = (open: OpenCamp) =>
  renderWithQueryClient(
    <MemoryRouter>
      <PostgameBar camp={open} />
    </MemoryRouter>
  );

const ticked = () =>
  within(screen.getByRole("navigation", { name: "Post-game steps" }))
    .getAllByRole("link")
    .filter((link) => within(link).queryByLabelText("Done"))
    .map((link) => link.textContent);

describe("PostgameBar", () => {
  it("ticks no Aftermath step the player hasn't pressed Next on, even with nothing left on it", () => {
    show(camp([]));
    expect(ticked()).toEqual([]);
  });

  it("ticks each step pressed Next on, and keeps it", () => {
    show(camp(["injuries", "xp"]));
    expect(ticked()).toEqual(["Injuries", "Experience"]);
  });

  it("holds the battle, its result and To the aftermath in the one bar", () => {
    show(camp([]));
    const bar = screen.getByRole("region", { name: "After the battle" });
    expect(within(bar).getByText("Powder Bridge, Battle 1")).toBeInTheDocument();
    expect(within(bar).getByText("Lost against Blood eaters")).toBeInTheDocument();
    expect(within(bar).getByRole("link", { name: "To the aftermath" })).toHaveAttribute(
      "href",
      "/campaigns/1/battles/2/postbattle"
    );
  });
});
