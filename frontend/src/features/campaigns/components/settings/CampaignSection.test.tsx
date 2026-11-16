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

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET /settings/", { settings: [], presets: [] });
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
