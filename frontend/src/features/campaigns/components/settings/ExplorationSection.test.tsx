/**
 * Settings → Exploration: the chart the post-game explores by, picked with one PATCH. A chart
 * whose setting isn't ticked is listed and pickable, with the warning under it.
 */
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import ExplorationSection from "./ExplorationSection";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { warning: vi.fn(), error: vi.fn() }) }));

const campaign = campaignSummary({ exploration_chart_id: null });
const CHARTS = [
  {
    id: 7,
    name: "Exploration",
    summary: "",
    campaign_id: null,
    campaign_type_id: 1,
    in_play: true,
  },
  { id: 9, name: "Albion", summary: "", campaign_id: null, campaign_type_id: 4, in_play: false },
];

const serve = () => {
  fakeApi.on(`GET /exploration-charts/?campaign_id=${campaign.id}`, CHARTS);
  fakeApi.on(`GET /campaigns/${campaign.id}/exploration/`, {
    id: 7,
    name: "Exploration",
    summary: "",
  });
  fakeApi.on(`PATCH /campaigns/${campaign.id}/`, (body: { exploration_chart_id: number }) => ({
    ...campaign,
    exploration_chart_id: body.exploration_chart_id,
  }));
};

beforeEach(() => {
  fakeApi.reset();
  serve();
});

describe("Settings → Exploration", () => {
  it("shows the chart in use and picks another one", async () => {
    const user = setupUser();
    renderWithQueryClient(<ExplorationSection campaign={campaign} />);

    const picker = await screen.findByRole("combobox", { name: "Exploration chart" });
    await waitFor(() => expect(picker).toHaveValue("7"));
    await user.selectOptions(picker, "9");

    await waitFor(() =>
      expect(fakeApi.bodyOf(`PATCH /campaigns/${campaign.id}/`)).toEqual({
        exploration_chart_id: 9,
      })
    );
  });

  it("says which campaign set the chart, and warns once another is picked", async () => {
    fakeApi.on(`GET /campaigns/${campaign.id}/preset/`, {
      preset_id: 2,
      preset_name: "Mutiny in Marienburg",
      sets: [
        {
          field: "exploration_chart_id",
          label: "Exploration chart",
          value: 9,
          text: "Albion",
          departure: "Mutiny in Marienburg sets Exploration chart: Albion.",
        },
      ],
      departures: [
        {
          field: "exploration_chart_id",
          label: "Exploration chart",
          message: "Mutiny in Marienburg sets Exploration chart: Albion.",
        },
      ],
      rules: [],
      rule_count: 18,
    });
    renderWithQueryClient(<ExplorationSection campaign={campaign} />);

    expect(
      await screen.findByText("Mutiny in Marienburg sets Exploration chart: Albion.")
    ).toBeInTheDocument();
    expect(await screen.findByRole("combobox", { name: "Exploration chart" })).toBeEnabled();
  });

  it("offers a chart whose setting isn't ticked, and warns once it is picked", async () => {
    renderWithQueryClient(
      <ExplorationSection campaign={{ ...campaign, exploration_chart_id: 9 }} />
    );

    expect(await screen.findByRole("option", { name: /Albion/ })).toBeEnabled();
    expect(await screen.findByText(/isn't in this campaign/)).toBeInTheDocument();
  });
});
