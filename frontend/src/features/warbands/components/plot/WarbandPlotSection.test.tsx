/**
 * Campaign points on the warband page: the total the player types (sent as he leaves the box, and
 * never computed), the plot picked from the campaign's list with its own words on who may follow
 * it, and the track drawn from that plot's ladder. A viewer reads it and changes nothing.
 */
import { screen } from "@testing-library/react";
import { describe, beforeEach, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import WarbandPlotSection from "./WarbandPlotSection";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const PLOTS = [
  { id: 4, name: "Drowning the Witch", who_text: "Witch Hunters and Sisters of Sigmar." },
  { id: 5, name: "The Shards", who_text: "" },
];
const plot = { id: 4, name: "Drowning the Witch", rungs: [5, 10, 40] };

const show = (props: Partial<Parameters<typeof WarbandPlotSection>[0]> = {}) =>
  renderWithQueryClient(
    <WarbandPlotSection campaignId={7} warbandId={9} plot={plot} total={7} canEdit {...props} />
  );

describe("the warband's campaign points", () => {
  beforeEach(() => {
    fakeApi.reset();
    fakeApi.on("GET /campaigns/7/plots/", PLOTS);
    fakeApi.on("PATCH /warbands/9/", (body: unknown) => ({ id: 9, ...(body as object) }));
  });

  it("sends the total typed, and nothing when it hasn't changed", async () => {
    const user = setupUser();
    show();

    const box = screen.getByRole("spinbutton", { name: "Campaign points" });
    await user.type(box, "{Enter}"); // Enter leaves the box, which sends what changed
    expect(fakeApi.countOf("PATCH /warbands/9/")).toBe(0);

    await user.clear(box);
    await user.type(box, "12{Enter}");

    expect(fakeApi.bodyOf("PATCH /warbands/9/")).toEqual({ campaign_points: 12 });
    expect(fakeApi.countOf("PATCH /warbands/9/")).toBe(1);
  });

  it("draws the track from the plot's own ladder", () => {
    show({ total: 7 });

    expect(screen.getByRole("img")).toHaveAccessibleName(
      "7 of 40 campaign points; achievements at 5, 10 and 40"
    );
  });

  // William: "editable for free" — no cost, no confirmation, and nothing greys the choice
  it("changes the plot for nothing and reads out who may follow the one picked", async () => {
    const user = setupUser();
    show();

    expect(await screen.findByText("Witch Hunters and Sisters of Sigmar.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Plot: Drowning the Witch" }));
    await user.click(screen.getByRole("option", { name: /The Shards/ }));

    expect(fakeApi.bodyOf("PATCH /warbands/9/")).toEqual({ plot_id: 5 });
    expect(screen.queryByText("Witch Hunters and Sisters of Sigmar.")).toBeNull();
  });

  it("follows none again", async () => {
    const user = setupUser();
    show();

    await user.click(await screen.findByRole("button", { name: "No plot" }));

    expect(fakeApi.bodyOf("PATCH /warbands/9/")).toEqual({ plot_id: null });
  });

  it("is read only for a viewer, who still sees the plot and the track", () => {
    show({ canEdit: false });

    expect(screen.getByText("Drowning the Witch")).toBeVisible();
    expect(screen.getByRole("img")).toBeVisible();
    expect(screen.queryByRole("combobox", { name: "Plot" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Plot/ })).toBeNull();
    expect(screen.queryByRole("spinbutton", { name: "Campaign points" })).toBeNull();
  });
});
