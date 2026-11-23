/**
 * Settings → Campaign preset: which published campaign this one plays. Changing it says what it
 * will set, and what it will swap, before it saves -- and the change itself does the swap, so
 * there is no button underneath to press afterwards (William, 20 Nov 2026).
 */
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import CampaignPresetCard from "./CampaignPresetCard";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { warning: vi.fn(), error: vi.fn() }) }));

const campaign = campaignSummary({ preset_id: null });
const PATCH = `PATCH /campaigns/${campaign.id}/`;
const SETS = [
  {
    field: "enable_locations",
    label: "Trade locations",
    value: true,
    text: "on",
    departure: "Mutiny in Marienburg sets Trade locations: on.",
  },
  {
    field: "max_heroes",
    label: "Most heroes",
    value: 6,
    text: "6",
    departure: "Mutiny in Marienburg sets Most heroes: 6.",
  },
];
const PRESETS = [
  {
    id: 1,
    slug: "mordheim",
    name: "Mordheim",
    sort_order: 1,
    setting_ids: [],
    setting_names: [],
    sets: [],
    rule_count: 0,
    chart_count: 0,
  },
  {
    id: 2,
    slug: "mutiny-in-marienburg",
    name: "Mutiny in Marienburg",
    sort_order: 12,
    setting_ids: [9],
    setting_names: ["Mutiny in Marienburg"],
    sets: SETS,
    rule_count: 18,
    chart_count: 4,
  },
];

const state = (overrides: object = {}) => ({
  preset_id: null,
  preset_name: "",
  sets: [],
  departures: [],
  rule_count: 0,
  chart_count: 0,
  ...overrides,
});

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET /campaign-presets/", PRESETS);
  fakeApi.on(`GET /campaigns/${campaign.id}/preset/`, state());
  fakeApi.on(PATCH, (body: object) => ({ ...campaign, ...body }));
});

describe("the campaign preset", () => {
  it("lists the published campaigns and says what a change will set before saving it", async () => {
    const user = setupUser();
    renderWithQueryClient(<CampaignPresetCard campaign={campaign} />);

    const picker = await screen.findByRole("combobox", { name: "Published campaign" });
    expect(await screen.findByRole("option", { name: "Mordheim" })).toBeInTheDocument();
    await user.selectOptions(picker, "2");

    expect(await screen.findByText("Play Mutiny in Marienburg?")).toBeInTheDocument();
    expect(screen.getByText("It sets Trade locations on · Most heroes 6.")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Its 18 rules and 4 charts are copied in, and the ones the campaign still holds/
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/Anything you wrote or edited stays/)).toBeInTheDocument();
    expect(fakeApi.bodyOf(PATCH)).toBeUndefined();

    await user.click(screen.getByRole("button", { name: "Change the campaign" }));
    await waitFor(() => expect(fakeApi.bodyOf(PATCH)).toEqual({ preset_id: 2 }));
  });

  it("has no button to add or swap the rules: the change did it", async () => {
    fakeApi.on(
      `GET /campaigns/${campaign.id}/preset/`,
      state({
        preset_id: 2,
        preset_name: "Mutiny in Marienburg",
        sets: SETS,
        rule_count: 18,
        chart_count: 4,
      })
    );
    renderWithQueryClient(<CampaignPresetCard campaign={{ ...campaign, preset_id: 2 }} />);

    expect(await screen.findByText("Trade locations on · Most heroes 6")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Swap rules|Add its/ })).not.toBeInTheDocument();
  });
});
