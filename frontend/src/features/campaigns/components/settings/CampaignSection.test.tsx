/**
 * Settings → Campaign: campaign points, labelled "Plots and CP" (William, 16 Nov 2026),
 * and Blood pacts are switches beside Encampments and Locations, off at first, saved as they flip;
 * and archiving the campaign is the last card on the page (William, 18 Nov 2026), the only one an
 * archived campaign keeps.
 */
import { MemoryRouter } from "react-router-dom";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { campaignFor, campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import type { CampaignSummary } from "../../types/campaign-types";

import CampaignSection from "./CampaignSection";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const campaign = campaignSummary({ enable_campaign_points: false });

/** The section needs a router: the archive card's Delete for good leaves the campaign. */
const show = (shown: CampaignSummary) =>
  renderWithQueryClient(
    <MemoryRouter>
      <CampaignSection campaign={shown} />
    </MemoryRouter>
  );

const PRESET_STATE = {
  preset_id: 2,
  preset_name: "Mutiny in Marienburg",
  sets: [
    {
      field: "enable_locations",
      label: "Trade locations",
      value: true,
      text: "on",
      departure: "Mutiny in Marienburg sets Trade locations: on.",
    },
  ],
  departures: [] as { field: string; label: string; message: string }[],
  rules: [] as string[],
  rule_count: 18,
};

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET /settings/", { settings: [], presets: [] });
  fakeApi.on("GET /campaign-presets/", []);
});

describe("Plots and CP", () => {
  it("is off at first and switches on for every warband", async () => {
    const user = setupUser();
    fakeApi.on(`PATCH /campaigns/${campaign.id}/`, (body: object) => ({ ...campaign, ...body }));
    show(campaign);

    const toggle = screen.getByRole("switch", { name: "Plots and CP" });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);

    await waitFor(() =>
      expect(fakeApi.bodyOf(`PATCH /campaigns/${campaign.id}/`)).toEqual({
        enable_campaign_points: true,
      })
    );
  });
});

describe("Blood pacts", () => {
  it("is off at first and switches on for the whole campaign", async () => {
    const user = setupUser();
    fakeApi.on(`PATCH /campaigns/${campaign.id}/`, (body: object) => ({ ...campaign, ...body }));
    show(campaign);

    const toggle = screen.getByRole("switch", { name: "Blood pacts" });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);

    await waitFor(() =>
      expect(fakeApi.bodyOf(`PATCH /campaigns/${campaign.id}/`)).toEqual({
        enable_blood_pacts: true,
      })
    );
  });
});

describe("a setting the campaign's preset sets", () => {
  it("says which campaign set it and still flips, with the warning once departed from", async () => {
    const user = setupUser();
    fakeApi.on(`GET /campaigns/${campaign.id}/preset/`, PRESET_STATE);
    fakeApi.on(`PATCH /campaigns/${campaign.id}/`, (body: object) => ({ ...campaign, ...body }));
    show({ ...campaign, preset_id: 2 });

    expect(await screen.findByText("Set by Mutiny in Marienburg")).toBeInTheDocument();
    const toggle = screen.getByRole("switch", { name: "Trade locations" });
    await user.click(toggle); // greyed, still clickable

    await waitFor(() =>
      expect(fakeApi.bodyOf(`PATCH /campaigns/${campaign.id}/`)).toEqual({
        enable_locations: true,
      })
    );
  });

  it("warns, in the server's words, once the campaign no longer holds the preset's value", async () => {
    fakeApi.on(`GET /campaigns/${campaign.id}/preset/`, {
      ...PRESET_STATE,
      departures: [
        {
          field: "enable_locations",
          label: "Trade locations",
          message: "Mutiny in Marienburg sets Trade locations: on.",
        },
      ],
    });
    show({ ...campaign, preset_id: 2 });

    expect(
      await screen.findByText("Mutiny in Marienburg sets Trade locations: on.")
    ).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Trade locations" })).toBeEnabled();
  });
});

describe("Archive campaign", () => {
  const cards = () => screen.getAllByRole("region").map((card) => card.getAttribute("aria-label"));

  it("is the last card on the page for the owner, with Leave's full-width card shape", () => {
    show(campaign);

    expect(cards().slice(-1)).toEqual(["Archive campaign"]);
    const card = screen.getByRole("region", { name: "Archive campaign" });
    const row = within(card).getByRole("heading", { name: "Archive campaign" }).parentElement;
    expect(row).toContainElement(within(card).getByRole("button", { name: "Archive campaign" }));
    expect(row).not.toContainElement(screen.getByText("To delete it for good, archive it first."));
  });

  it("is all an archived campaign shows the owner: restoring it, or deleting it for good", () => {
    show(campaignSummary({ archived_at: "2026-11-01T18:00:00Z" }));

    expect(cards()).toEqual(["Archived campaign"]);
    expect(screen.getByRole("button", { name: "Restore campaign" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete for good" })).toBeInTheDocument();
  });

  it("is nothing a player sees", () => {
    show(campaignFor("player"));

    expect(screen.queryAllByRole("region")).toEqual([]);
  });
});
