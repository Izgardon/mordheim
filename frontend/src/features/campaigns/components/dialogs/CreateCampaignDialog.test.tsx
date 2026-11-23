/**
 * Starting a campaign: the published campaign at the top (Mordheim to begin with). Picking one
 * shows what it sets, its pages greyed and still clickable, and its settings ticked on top of the
 * grade preset's; departing from one of its pages warns and is allowed.
 */
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import CreateCampaignDialog from "./CreateCampaignDialog";
import type { CampaignCreatePayload } from "../../types/campaign-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

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
  },
  {
    id: 2,
    slug: "mutiny-in-marienburg",
    name: "Mutiny in Marienburg",
    sort_order: 12,
    setting_ids: [9],
    setting_names: ["Mutiny in Marienburg"],
    sets: [
      {
        field: "enable_locations",
        label: "Trade locations",
        value: true,
        text: "on",
        departure: "Mutiny in Marienburg sets Trade locations: on.",
      },
    ],
    rule_count: 18,
  },
];
const SETTINGS = {
  settings: [
    {
      id: 1,
      slug: "mordheim",
      name: "Mordheim 1a",
      grade: "1a",
      grade_label: "Official",
      sort_order: 1,
      always_on: true,
      warband_types: 13,
    },
  ],
  presets: [{ grade: "1c", label: "Up to 1c", description: "Experimental", setting_ids: [1] }],
};

async function openDialog(onCreate: (payload: CampaignCreatePayload) => Promise<void>) {
  const user = setupUser();
  renderWithQueryClient(<CreateCampaignDialog onCreate={onCreate} />);
  await user.click(screen.getByRole("button", { name: "Create a campaign" }));
  await user.type(await screen.findByLabelText("Campaign name"), "Ashes");
  return user;
}

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET /campaign-presets/", PRESETS);
  fakeApi.on("GET /settings/", SETTINGS);
});

describe("the campaign you are playing", () => {
  it("starts on Mordheim and sends it with nothing else dictated", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const user = await openDialog(onCreate);

    const picker = await screen.findByRole("combobox", { name: "Campaign" });
    await waitFor(() => expect(picker).toHaveValue("1"));
    await user.click(screen.getByRole("button", { name: "Start campaign" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onCreate.mock.calls[0][0]).toMatchObject({
      name: "Ashes",
      preset_id: 1,
      preset: "1c",
      enable_locations: false,
    });
  });

  it("takes the picked campaign's pages and settings, and lets the player depart with a warning", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    const user = await openDialog(onCreate);

    await user.selectOptions(await screen.findByRole("combobox", { name: "Campaign" }), "2");
    expect(screen.getByText(/It sets Trade locations on\./)).toBeInTheDocument();
    const locations = screen.getByRole("button", { name: "Trade locations" });
    expect(locations).toHaveAttribute("aria-pressed", "true");

    await user.click(locations); // greyed, still clickable: departing warns, it never blocks
    expect(
      await screen.findByText("Mutiny in Marienburg sets Trade locations: on.")
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start campaign" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalled());
    expect(onCreate.mock.calls[0][0]).toMatchObject({
      preset_id: 2,
      enable_locations: false,
      setting_ids: [1, 9],
    });
  });
});
