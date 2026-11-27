/**
 * Settings → Plots: the plots the campaign plays with, picked from every plot it can see. A plot
 * whose setting isn't ticked is offered, pickable and warned about.
 */
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import PlotsSection from "./PlotsSection";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { warning: vi.fn(), error: vi.fn() }) }));

const campaign = campaignSummary({ enable_campaign_points: true });
const plot = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  summary: "",
  who_text: "Witch Hunters.",
  variant_of: "",
  no_alliance_with: [],
  campaign_id: null,
  setting_id: 1,
  in_play: true,
  scoring: [],
  achievements: [],
  ...extra,
});

const SHARDS = plot(1, "The Shards");
const WITCH = plot(2, "Drowning the Witch", { setting_id: 4, in_play: false });

/** The campaign's list as the server keeps it: a PUT replaces it, and the next GET reads it. */
let played: number[] = [];

const serve = () => {
  played = [SHARDS.id];
  fakeApi.on(`GET /plots/?campaign_id=${campaign.id}`, [SHARDS, WITCH]);
  fakeApi.on(`GET /campaigns/${campaign.id}/plots/`, () =>
    [SHARDS, WITCH].filter((row) => played.includes(row.id))
  );
  fakeApi.on(`PUT /campaigns/${campaign.id}/plots/`, (body: { plot_ids: number[] }) => {
    played = body.plot_ids;
    return [SHARDS, WITCH].filter((row) => played.includes(row.id));
  });
};

beforeEach(() => {
  fakeApi.reset();
  serve();
});

/** The plots are folded under how many are played: open them. */
const show = async () => {
  renderWithQueryClient(<PlotsSection campaign={campaign} />);
  await setupUser().click(screen.getByRole("button", { name: /^Plots/ }));
};

describe("Settings → Plots", () => {
  it("is folded under how many are played, warning of a played plot out of play", async () => {
    played = [SHARDS.id, WITCH.id];
    renderWithQueryClient(<PlotsSection campaign={campaign} />);

    const button = screen.getByRole("button", { name: /^Plots/ });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(button).toHaveTextContent("2 of 2 played"));
    expect(
      screen.getByText("1 played plot isn't in this campaign's settings.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "The Shards" })).not.toBeInTheDocument();
  });

  it("shows every plot the campaign can see, with the ones it plays with ticked", async () => {
    await show();

    const shards = await screen.findByRole("checkbox", { name: "The Shards" });
    await waitFor(() => expect(shards).toBeChecked());
    expect(screen.getByRole("checkbox", { name: "Drowning the Witch" })).not.toBeChecked();
  });

  it("picks a plot whose setting isn't ticked, and warns about it", async () => {
    const user = setupUser();
    await show();

    const witch = await screen.findByRole("checkbox", { name: "Drowning the Witch" });
    expect(witch).toBeEnabled();
    await user.click(witch);

    await waitFor(() =>
      expect(fakeApi.bodyOf(`PUT /campaigns/${campaign.id}/plots/`)).toEqual({
        plot_ids: [1, 2],
      })
    );
    expect(await screen.findByText(/isn't in this campaign/)).toBeInTheDocument();
  });

  it("unticks the last plot and sends an empty list", async () => {
    const user = setupUser();
    await show();

    await user.click(await screen.findByRole("checkbox", { name: "The Shards" }));

    await waitFor(() =>
      expect(fakeApi.bodyOf(`PUT /campaigns/${campaign.id}/plots/`)).toEqual({ plot_ids: [] })
    );
  });

  it("opens the editor to add the campaign's own plot", async () => {
    const user = setupUser();
    await show();

    await user.click(await screen.findByRole("button", { name: "Add a plot" }));

    expect(await screen.findByRole("textbox", { name: "Plot name" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Who may follow it" })).toBeInTheDocument();
  });
});
