/**
 * The header's four totals each open a window (William, 22 Nov 2026): the rating unit by unit,
 * the last trades with the way to the Treasury, every unit by kind with its level, and the last
 * battles, each linking to its record. A workshop's warband shows its cost and a plain rating,
 * with no breakdown (it plays no battles).
 */
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { RatingRow, Warband, WarbandTrade } from "../../types/warband-types";
import WarbandStats from "./WarbandStats";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const row = (fields: Partial<RatingRow> & Pick<RatingRow, "id" | "name">): RatingRow => ({
  kind: "hero",
  unit_type: "",
  models: 1,
  per_model: 5,
  xp: 0,
  mounts: 0,
  total: 5,
  missing: false,
  level: 0,
  ...fields,
});

const warband = {
  id: 9,
  name: "Monks",
  campaign_id: 7,
  wins: 3,
  losses: 1,
  rating: 51.5,
  gold: 120,
  unit_count: 4,
  max_units: 15,
  rating_breakdown: [
    row({ id: 1, name: "Aldric", unit_type: "Captain", xp: 12.5, total: 17.5, level: 6 }),
    row({ id: 2, name: "Away", missing: true, total: 0 }),
    row({
      id: 3,
      kind: "henchmen_group",
      name: "Swords",
      models: 2,
      xp: 2,
      mounts: 10,
      total: 24,
      level: 1,
    }),
    row({ id: 4, kind: "hired_sword", name: "Ranger", per_model: 6, xp: 4, total: 10, level: 2 }),
  ],
} as unknown as Warband;

const trade = (id: number, description: string, price: number): WarbandTrade => ({
  id,
  warband_id: 9,
  parent_id: null,
  action: "Buy",
  description,
  price,
  notes: "",
  children: [],
  created_at: "2026-11-05T10:00:00Z",
  updated_at: "2026-11-05T10:00:00Z",
});

type Workshop = { cost: number; budget: number } | null;

function renderStats(onTreasury = vi.fn(), workshop: Workshop = null) {
  renderWithQueryClient(
    <MemoryRouter>
      <WarbandStatsHost onTreasury={onTreasury} workshop={workshop} />
    </MemoryRouter>
  );
  return { user: setupUser(), onTreasury };
}

function WarbandStatsHost({
  onTreasury,
  workshop,
}: {
  onTreasury: () => void;
  workshop: Workshop;
}) {
  const [open, setOpen] = useState(false);
  return (
    <WarbandStats
      workshop={workshop}
      campaignId={7}
      warband={warband}
      heroes={[]}
      hirelings={[]}
      henchmenGroups={[]}
      breakdownOpen={open}
      setBreakdownOpen={setOpen}
      onTreasury={onTreasury}
    />
  );
}

describe("The header's windows", () => {
  beforeEach(() => fakeApi.reset());

  it("opens the rating unit by unit, adding up to its total", async () => {
    const { user } = renderStats();
    await user.click(screen.getByRole("button", { name: /^Rating 51.5/ }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("5 + 12½ XP")).toBeInTheDocument();
    expect(within(dialog).getByText("2 × (5 + 2 XP) + 10 mounts")).toBeInTheDocument();
    expect(within(dialog).getByText("Missing games: not counted")).toBeInTheDocument();
    expect(within(dialog).getByText("51.5")).toBeInTheDocument();
  });

  it("lists every unit by kind with its level", async () => {
    const { user } = renderStats();
    await user.click(screen.getByRole("button", { name: /^Units 4 of 15/ }));

    const heroes = screen.getByRole("region", { name: "Heroes" });
    expect(within(heroes).getByText("Aldric")).toBeInTheDocument();
    expect(within(heroes).getByText("Captain")).toBeInTheDocument();
    expect(within(heroes).getByText("Level 6")).toBeInTheDocument();
    const henchmen = screen.getByRole("region", { name: "Henchmen" });
    expect(within(henchmen).getByText("2 models · Level 1")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Hired swords" })).toHaveTextContent("Ranger");
  });

  it("shows the last ten trades and opens the Treasury", async () => {
    fakeApi.on("GET /warbands/9/trades/?limit=25", {
      results: Array.from({ length: 12 }, (_, index) => trade(index + 1, `Thing ${index + 1}`, -5)),
      next_cursor: null,
    });
    const { user, onTreasury } = renderStats();
    await user.click(screen.getByRole("button", { name: /^Gold 120 gc/ }));

    const trades = await screen.findByRole("list", { name: "Last trades" });
    expect(within(trades).getAllByRole("listitem")).toHaveLength(10);
    await user.click(screen.getByRole("button", { name: "Open the Treasury" }));
    expect(onTreasury).toHaveBeenCalled();
  });

  it("lists the last battles with their numbers, opponents and results, each a link", async () => {
    fakeApi.on("GET /warbands/9/record/", [
      {
        id: 31,
        number: 4,
        scenario: "Street Fight",
        date: "2026-11-05T10:00:00Z",
        result: "won",
        opponents: [
          { id: 2, name: "Rats", won: false },
          { id: 3, name: "Beasts", won: false },
        ],
      },
      {
        id: 30,
        number: 3,
        scenario: "",
        date: "2026-11-01T10:00:00Z",
        result: "no_winner",
        opponents: [{ id: 2, name: "Rats", won: false }],
      },
    ]);
    const { user } = renderStats();
    await user.click(screen.getByRole("button", { name: /^Record 3–1/ }));

    const battles = await screen.findByRole("list", { name: "Last battles" });
    const [first, second] = within(battles).getAllByRole("link");
    expect(first).toHaveTextContent("Battle 4 · Street Fight");
    expect(first).toHaveTextContent("Against Rats and Beasts");
    expect(first).toHaveTextContent("Won");
    expect(first).toHaveAttribute("href", "/campaigns/7/battles?battle=31");
    expect(second).toHaveTextContent("No winner");
  });

  it("shows a workshop warband's rating plain, with no breakdown to open", () => {
    renderStats(vi.fn(), { cost: 455, budget: 500 });

    expect(screen.getByText("/ 500 gc")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Rating/ })).toBeNull();
    expect(screen.getByText("51.5")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Gold/ })).toBeNull();
  });

  // William, 26 Nov 2026: Rating's and Units' values the size of Cost's, its "500" smaller still
  it("gives every value the one size, the tightest's, with the budget in the smaller part", () => {
    const tight = (element: HTMLElement) => element.textContent?.startsWith("455") ?? false;
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(60);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function (
      this: HTMLElement
    ) {
      return tight(this) ? 120 : 30;
    });
    renderStats(vi.fn(), { cost: 455, budget: 500 });

    const cost = screen.getByText("/ 500 gc").parentElement as HTMLElement;
    expect(cost).toHaveTextContent(/^455 \/ 500 gc$/);
    expect(cost.style.fontSize).toBe("13px");
    expect(screen.getByText("51.5").style.fontSize).toBe("13px");
    expect(screen.getByText("of 15").parentElement?.style.fontSize).toBe("13px");
    expect(screen.getByText("/ 500 gc")).toHaveClass("text-[0.5em]");
    vi.restoreAllMocks();
  });
});
