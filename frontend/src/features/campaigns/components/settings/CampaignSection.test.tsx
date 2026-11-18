/**
 * Settings → Campaign: campaign points, labelled "Plots (campaign points)" (William, 16 Nov 2026),
 * and Blood pacts are switches beside Encampments and Locations, off at first, saved as they flip.
 */
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import CampaignSection from "./CampaignSection";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const campaign = campaignSummary({ enable_campaign_points: false });

const PRESET_STATE = {
  preset_id: 2,
  preset_name: "Mutiny in Marienburg",
  sets: [
    {
      field: "enable_locations",
      label: "Locations",
      value: true,
      text: "on",
      departure: "Mutiny in Marienburg sets Locations: on.",
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

describe("Plots (campaign points)", () => {
  it("is off at first and switches on for every warband", async () => {
    const user = setupUser();
    fakeApi.on(`PATCH /campaigns/${campaign.id}/`, (body: object) => ({ ...campaign, ...body }));
    renderWithQueryClient(<CampaignSection campaign={campaign} />);

    const toggle = screen.getByRole("switch", { name: "Plots (campaign points)" });
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
    renderWithQueryClient(<CampaignSection campaign={campaign} />);

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
    renderWithQueryClient(<CampaignSection campaign={{ ...campaign, preset_id: 2 }} />);

    expect(await screen.findByText("Set by Mutiny in Marienburg")).toBeInTheDocument();
    const toggle = screen.getByRole("switch", { name: "Locations" });
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
          label: "Locations",
          message: "Mutiny in Marienburg sets Locations: on.",
        },
      ],
    });
    renderWithQueryClient(<CampaignSection campaign={{ ...campaign, preset_id: 2 }} />);

    expect(await screen.findByText("Mutiny in Marienburg sets Locations: on.")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Locations" })).toBeEnabled();
  });
});
