/**
 * Settings → Campaign (William, 27 Nov 2026: "too long and awkward and poorly sectioned"): the
 * name first, then the preset, the content, the rules and the danger zone, the long parts folded.
 * Campaign points, labelled "Plots and CP" (William, 16 Nov 2026), and Blood pacts are switches
 * beside Encampments and Locations under Features, off at first, saved as they flip; and archiving
 * the campaign is the last card on the page (William, 18 Nov 2026), the only one an archived
 * campaign keeps.
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

/** The switches are folded under Features: open it. */
const openFeatures = async (user: ReturnType<typeof setupUser>) =>
  user.click(screen.getByRole("button", { name: /^Features/ }));

describe("the sections", () => {
  const cards = () => screen.getAllByRole("region").map((card) => card.getAttribute("aria-label"));

  it("puts the name first, then the preset, the content, the rules and the danger zone", () => {
    show(campaign);

    expect(cards()).toEqual(["Campaign", "Preset", "Content", "Rules", "Danger zone"]);
    expect(
      within(screen.getByRole("region", { name: "Campaign" })).getByRole("textbox", {
        name: "Campaign name",
      })
    ).toBeInTheDocument();
  });

  it("folds the switches away under what is on, and opens them", async () => {
    const user = setupUser();
    show({ ...campaign, enable_locations: true, enable_blood_pacts: true });

    const features = screen.getByRole("button", { name: /^Features/ });
    expect(features).toHaveAttribute("aria-expanded", "false");
    expect(features).toHaveTextContent("Trade locations and Blood pacts on");
    expect(screen.queryByRole("switch", { name: "Blood pacts" })).not.toBeInTheDocument();

    await user.click(features);
    expect(features).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "Features" })).toContainElement(
      screen.getByRole("switch", { name: "Blood pacts" })
    );
  });
});

describe("Plots and CP", () => {
  it("is off at first and switches on for every warband", async () => {
    const user = setupUser();
    fakeApi.on(`PATCH /campaigns/${campaign.id}/`, (body: object) => ({ ...campaign, ...body }));
    show(campaign);
    await openFeatures(user);

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
    await openFeatures(user);

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
    await openFeatures(user);

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
    const user = setupUser();
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

    // read once while the switches are folded away, and once under the switch when open
    const rules = within(screen.getByRole("region", { name: "Rules" }));
    const shown = async () =>
      (await rules.findAllByText("Mutiny in Marienburg sets Trade locations: on.")).filter(
        (line) => !line.closest("[hidden]")
      );
    expect(await shown()).toHaveLength(1);
    await openFeatures(user);
    expect(screen.getByRole("switch", { name: "Trade locations" })).toBeEnabled();
    expect(await shown()).toHaveLength(1);
  });
});

describe("Archive campaign", () => {
  const cards = () => screen.getAllByRole("region").map((card) => card.getAttribute("aria-label"));

  it("is the danger zone, the last card on the page for the owner, with Leave's card shape", () => {
    show(campaign);

    expect(cards().slice(-1)).toEqual(["Danger zone"]);
    const card = screen.getByRole("region", { name: "Danger zone" });
    const row = within(card).getByRole("heading", { name: "Danger zone" }).parentElement;
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
