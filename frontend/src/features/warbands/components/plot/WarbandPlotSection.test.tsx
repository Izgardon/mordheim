/**
 * Campaign points on the warband page (William, 20 Nov 2026): collapsed, the section is the plot's
 * name, the total shown as a resource's amount with − and + (William, 22 Nov 2026) and the arrow that
 * opens the rest — no plot to edit, nothing about it. Open, it shows Plot details and the track from
 * that plot's ladder; the plot itself is picked in warband Settings only (William, 22 Nov 2026). A
 * viewer reads it and changes nothing.
 */
import { screen, within } from "@testing-library/react";
import { describe, beforeEach, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import WarbandPlotSection from "./WarbandPlotSection";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const PLOTS = [
  { id: 4, name: "Drowning the Witch", who_text: "Witch Hunters and Sisters of Sigmar." },
  { id: 5, name: "The Shards", who_text: "" },
];
const plot = {
  id: 4,
  name: "Drowning the Witch",
  rungs: [5, 10, 40],
  summary: "Hunt the witch down.",
  scoring: [
    { shown: "+1", text: "Playing a scenario." },
    { shown: "-1", text: "A lawman killed by the warband." },
  ],
  achievements: [
    { points: 5, name: "Rung 5", text: "What 5 gives." },
    { points: 10, name: "Rung 10", text: "What 10 gives." },
    { points: 40, name: "Rung 40", text: "What 40 gives." },
  ],
};

const show = (props: Partial<Parameters<typeof WarbandPlotSection>[0]> = {}) =>
  renderWithQueryClient(
    <WarbandPlotSection campaignId={7} warbandId={9} plot={plot} total={7} canEdit {...props} />
  );
const open = async (user: ReturnType<typeof setupUser>) =>
  user.click(screen.getByRole("button", { name: "Show the plot" }));

describe("the warband's campaign points", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /campaigns/7/plots/", PLOTS);
    fakeApi.on("PATCH /warbands/9/", (body: unknown) => ({ id: 9, ...(body as object) }));
  });

  it("is the plot's name, the total and the arrow until it is opened", () => {
    show();

    const section = screen.getByRole("region", { name: "Campaign points" });
    expect(within(section).getByText("Drowning the Witch")).toBeVisible();
    expect(within(section).getByText("7")).toBeVisible();
    expect(within(section).queryByRole("spinbutton")).toBeNull(); // a number, as a resource shows
    expect(within(section).queryByRole("button", { name: "Plot details" })).toBeNull();
    expect(within(section).queryByRole("img")).toBeNull();
    expect(within(section).queryByRole("button", { name: /^Plot:/ })).toBeNull();
  });

  it("adds and takes away one with − and +", async () => {
    const user = setupUser();
    show();

    await user.click(screen.getByRole("button", { name: "One campaign point more" }));
    expect(fakeApi.bodyOf("PATCH /warbands/9/")).toEqual({ campaign_points: 8 });

    await user.click(screen.getByRole("button", { name: "One campaign point less" }));
    expect(fakeApi.bodyOf("PATCH /warbands/9/")).toEqual({ campaign_points: 6 });
  });

  it("never sends a total below none", async () => {
    const user = setupUser();
    show({ total: 0 });

    await user.click(screen.getByRole("button", { name: "One campaign point less" }));

    expect(fakeApi.countOf("PATCH /warbands/9/")).toBe(0);
  });

  it("draws the track from the plot's own ladder once opened", async () => {
    const user = setupUser();
    show({ total: 7 });

    await open(user);

    expect(screen.getByRole("img")).toHaveAccessibleName(
      "7 of 40 campaign points; achievements at 5, 10 and 40"
    );
  });

  // William, 22 Nov 2026: "I want the dropdown allowing plot changing gone from here [and the text
  // underneath). It should only be changeable from warband settings page"
  it("offers no plot to pick, nor who may follow it, once opened", async () => {
    const user = setupUser();
    show();
    await open(user);

    expect(screen.getByRole("button", { name: "Plot details" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Plot:/ })).toBeNull();
    expect(screen.queryByText("Witch Hunters and Sisters of Sigmar.")).toBeNull();
  });

  it("opens the plot's plan in Plot details, read only, the rungs reached marked", async () => {
    const user = setupUser();
    show({ total: 7 });
    await open(user);

    await user.click(screen.getByRole("button", { name: "Plot details" }));

    const modal = screen.getByRole("dialog", { name: "Drowning the Witch" });
    expect(within(modal).getByText("Hunt the witch down.")).toBeVisible();
    expect(within(modal).getByText("Playing a scenario.")).toBeVisible();
    expect(within(modal).getByText("+1")).toBeVisible();
    expect(within(modal).getByText("What 40 gives.")).toBeVisible(); // the whole ladder from the start
    expect(within(modal).getByText("5 CP").className).toMatch(/accent-hi/);
    expect(within(modal).getByText("10 CP").className).not.toMatch(/accent-hi/);
    expect(within(modal).queryByRole("textbox")).toBeNull();
  });

  it("is read only for a viewer, who still reaches the plot and the track", async () => {
    const user = setupUser();
    show({ canEdit: false });

    expect(screen.getByText("Drowning the Witch")).toBeVisible();
    expect(screen.getByText("7")).toBeVisible();
    expect(screen.queryByRole("button", { name: "One campaign point more" })).toBeNull();
    await open(user);

    expect(screen.getByRole("img")).toBeVisible();
    expect(screen.getByRole("button", { name: "Plot details" })).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Plot:/ })).toBeNull();
  });
});
