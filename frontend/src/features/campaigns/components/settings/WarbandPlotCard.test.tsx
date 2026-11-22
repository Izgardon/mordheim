/**
 * Settings → Your warband's Plot card: the one place the warband's plot is changed (William, 22 Nov
 * 2026: "It should only be changeable from warband settings page"), for nothing, with who may follow
 * the one picked read out underneath. An archived campaign shows the plot and changes nothing.
 */
import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Warband } from "@/features/warbands/types/warband-types";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import WarbandPlotCard from "./WarbandPlotCard";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const PLOTS = [
  { id: 4, name: "Drowning the Witch", who_text: "Witch Hunters and Sisters of Sigmar." },
  { id: 5, name: "The Shards", who_text: "" },
];
const warband: Warband = {
  id: 9,
  name: "The Black Eagles",
  warband_type: null,
  counts_as: [],
  campaign_id: 7,
  user_id: 1,
  plot_id: 4,
  created_at: "2026-11-01T00:00:00Z",
  updated_at: "2026-11-01T00:00:00Z",
};
const onSaved = vi.fn();
const show = (canEdit = true) =>
  renderWithQueryClient(<WarbandPlotCard warband={warband} canEdit={canEdit} onSaved={onSaved} />);

describe("the warband's plot in Settings", () => {
  beforeEach(() => {
    fakeApi.reset();
    onSaved.mockReset();
    fakeApi.on("GET /campaigns/7/plots/", PLOTS);
    fakeApi.on("PATCH /warbands/9/", (body: unknown) => ({ id: 9, ...(body as object) }));
  });

  // William: "editable for free" — no cost, no confirmation, and nothing greys the choice
  it("changes the plot for nothing and reads out who may follow the one picked", async () => {
    const user = setupUser();
    show();

    expect(await screen.findByText("Witch Hunters and Sisters of Sigmar.")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Plot: Drowning the Witch" }));
    await user.click(screen.getByRole("option", { name: /The Shards/ }));

    expect(fakeApi.bodyOf("PATCH /warbands/9/")).toEqual({ plot_id: 5 });
    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith({ plot_id: 5 }));
  });

  it("follows none again", async () => {
    const user = setupUser();
    show();

    await user.click(await screen.findByRole("button", { name: "No plot" }));

    expect(fakeApi.bodyOf("PATCH /warbands/9/")).toEqual({ plot_id: null });
  });

  it("shows the plot and changes nothing in an archived campaign", async () => {
    show(false);

    expect(await screen.findByText("Drowning the Witch")).toBeVisible();
    expect(screen.queryByRole("button", { name: /^Plot:/ })).toBeNull();
  });
});
