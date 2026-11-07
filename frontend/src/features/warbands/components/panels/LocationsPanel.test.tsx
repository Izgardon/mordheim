/**
 * The warband page's Locations panel only reads the locations (William, 7 Nov 2026: "shouldn't be
 * able to edit locations in the location sidebar within warband"): no Add, Edit or Remove for
 * anyone; with `manage_locations`, Edit locations goes to the campaign's Locations page.
 */
import { MemoryRouter } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignLocation } from "@/features/campaigns/types/campaign-types";
import { campaignFor } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";

import LocationsPanel from "./LocationsPanel";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const docks: CampaignLocation = {
  id: 4,
  campaign_id: 1,
  name: "The Docks",
  area: "River",
  content: "Rotting piers.",
  d6_1: "",
  d6_2: "",
  d6_3: "",
  d6_4: "",
  d6_5: "",
  d6_6: "",
};

function renderPanel(role: "owner" | "player") {
  fakeApi.on("GET /campaigns/1/", campaignFor(role, { enable_locations: true }));
  fakeApi.on("GET /campaigns/1/locations/", [docks]);
  return renderWithQueryClient(
    <MemoryRouter>
      <LocationsPanel
        campaignId={1}
        warbandId={0}
        heroes={[]}
        canEdit={false}
        open
        onOpenChange={() => undefined}
      />
    </MemoryRouter>
  );
}

const noEditing = () => {
  expect(screen.queryByRole("button", { name: "Add location" })).toBeNull();
  expect(screen.queryByRole("button", { name: /^(Edit|Remove) / })).toBeNull();
};

beforeEach(() => {
  fakeApi.reset();
});

describe("LocationsPanel", () => {
  it("never edits a location; one who manages them is sent to the Locations page", async () => {
    renderPanel("owner");

    expect(await screen.findByText("The Docks")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Edit locations" })).toHaveAttribute(
      "href",
      "/campaigns/1/locations"
    );
    noEditing();
  });

  it("shows a player without manage_locations the list only", async () => {
    renderPanel("player");

    expect(await screen.findByText("The Docks")).toBeInTheDocument();
    await waitFor(() => expect(fakeApi.calls()).toContain("GET /campaigns/1/"));
    expect(screen.queryByRole("link", { name: "Edit locations" })).toBeNull();
    noEditing();
  });
});
