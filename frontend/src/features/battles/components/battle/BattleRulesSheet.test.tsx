/**
 * Rules in battle (William, 24 Nov 2026: "i only want 5 pills in this order: Battle rules, Warband
 * rules Charts, House rules, Rules. It should be a scrolling bar with those 5 pills. Clicking one
 * opens its rules in a dropdown expand system just as they are displayed on their rules pages (same
 * grouping)"), and the scenario as a button opening its details.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import BattleRulesSheet from "./BattleRulesSheet";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => true }));

const rule = (id: number, title: string, umbrella = "", body = `${title} text.`) => ({
  id,
  campaign_id: 3,
  kind: "battle" as const,
  title,
  body,
  umbrella,
  order: id,
  chart: null,
});

const chart = (id: number, title: string, umbrella = "") => ({
  id,
  campaign_id: 3,
  title,
  description: "",
  dice: "D6",
  note: "",
  umbrella,
  order: id,
  rows: [{ id: id * 10, result: "1-6", name: `${title} result`, text: "" }],
});

function answer() {
  fakeApi.on("GET /campaigns/3/campaign-rules/", [
    rule(1, "Rain", "Weather"),
    rule(2, "Fog", "Weather"),
    rule(3, "Loose rubble"),
    { ...rule(4, "Plot points"), kind: "campaign" },
  ]);
  fakeApi.on("GET /campaigns/3/campaign-charts/", [
    chart(7, "Seaside Situations"),
    chart(8, "High tide", "Tides"),
    chart(9, "Low tide", "Tides"),
  ]);
  fakeApi.on("GET /campaigns/3/rules/", [
    {
      id: 11,
      campaign_id: 3,
      title: "Black Powder Improvements",
      description: "Misfire on a 1.",
      effect_key: null,
      created_at: "",
      updated_at: "",
    },
  ]);
  fakeApi.on("GET /warbands/1/rules/", [{ id: 5, title: "Hard Head", description: "Maces." }]);
}

const open = (link: string | null = null) =>
  renderWithQueryClient(
    <BattleRulesSheet
      open
      onOpenChange={vi.fn()}
      campaignId={3}
      scenario={{ name: "Skirmish", link }}
      warbands={[{ id: 1, name: "Grudgebearers" }]}
    />
  );

const rowNames = () =>
  screen
    .getAllByRole("button", { expanded: false })
    .map((button) => button.querySelector("span > span")?.textContent);

describe("BattleRulesSheet", () => {
  beforeEach(() => {
    fakeApi.reset();
    answer();
  });

  it("offers exactly five pills, in William's order, on one scrolling row", () => {
    open();

    const pills = screen.getByRole("group", { name: "Rules section" });
    expect(
      within(pills)
        .getAllByRole("button")
        .map((pill) => pill.textContent)
    ).toEqual(["Battle rules", "Warband rules", "Charts", "House rules", "Rules"]);
    // it scrolls sideways, and never shrinks in the sheet's column when the list below is long
    // scroll-row: a small gap between the pills and the scrollbar (William, 25 Nov 2026)
    expect(pills).toHaveClass("scroll-row", "shrink-0");
    // the list below keeps one height on a phone, whichever pill is picked
    expect(screen.getByTestId("rules-section")).toHaveClass("max-[960px]:min-h-[55dvh]");
    expect(pills).not.toHaveClass("flex-wrap");
    expect(within(pills).getByRole("button", { name: "Battle rules" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("groups the battle rules by umbrella, as the Campaign rules page does, opening in place", async () => {
    const user = setupUser();
    open();

    const weather = await screen.findByRole("button", { name: /Weather/ });
    expect(rowNames()).toEqual(["Weather", "Loose rubble"]);
    expect(weather).toHaveTextContent("2 rules");

    await user.click(weather);
    expect(weather).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("heading", { name: "Rain" })).toBeInTheDocument();
    expect(screen.getByText("Fog text.")).toBeInTheDocument();
    expect(screen.queryByText("Plot points")).toBeNull();
  });

  it("shows the charts by umbrella, the house rules and the warbands' rules as rows", async () => {
    const user = setupUser();
    open();

    await user.click(screen.getByRole("button", { name: "Charts" }));
    await screen.findByRole("button", { name: /Seaside Situations/ });
    expect(rowNames()).toEqual(["Seaside Situations", "Tides"]);
    await user.click(screen.getByRole("button", { name: /Tides/ }));
    expect(screen.getByRole("heading", { name: "Low tide" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "House rules" }));
    await user.click(await screen.findByRole("button", { name: /Black Powder Improvements/ }));
    expect(screen.getByText("Misfire on a 1.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Warband rules" }));
    await user.click(await screen.findByRole("button", { name: /Grudgebearers/ }));
    expect(screen.getByRole("article", { name: "Hard Head" })).toHaveTextContent("Maces.");
  });

  it("lists the rulebook as the Rules page does, its sections no longer pills of their own", async () => {
    const user = setupUser();
    open();

    await user.click(screen.getByRole("button", { name: "Rules" }));

    const pills = screen.getByRole("group", { name: "Rules section" });
    expect(within(pills).queryByRole("button", { name: "Shooting" })).toBeNull();
    const shooting = screen
      .getAllByRole("button", { expanded: false })
      .filter((row) => row.textContent?.includes("Shooting"));
    expect(shooting.length).toBeGreaterThan(1);
    await user.click(shooting[0]);
    expect(shooting[0]).toHaveAttribute("aria-expanded", "true");
  });

  it("opens the scenario's details from its button, with its link", async () => {
    const user = setupUser();
    open("https://example.com/skirmish");

    await user.click(screen.getByRole("button", { name: /Scenario: Skirmish/ }));

    const details = await screen.findByRole("dialog", { name: "Skirmish" });
    expect(within(details).getByRole("link", { name: /Read the scenario/ })).toHaveAttribute(
      "href",
      "https://example.com/skirmish"
    );
    expect(screen.queryByRole("group", { name: "Rules section" })).toBeNull();
  });
});
