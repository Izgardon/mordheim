/**
 * The warband page's Locations panel only reads the locations (William, 7 Nov 2026: "shouldn't be
 * able to edit locations in the location sidebar within warband"): no Add, Edit or Remove for
 * anyone, and Go to page for everyone opens the campaign's Locations page. A location with D6
 * results has one Roll D6 button and no roll boxes (William: "in the side draw just have a Roll d6
 * button, dont need the d6 roll pill there").
 */
import { MemoryRouter } from "react-router-dom";
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignLocation } from "@/features/campaigns/types/campaign-types";
import { campaignFor } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";

import LocationsPanel from "./LocationsPanel";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/dice", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/dice")>()),
  rollDie: () => 4,
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
const pit: CampaignLocation = {
  ...docks,
  id: 5,
  name: "The Pit",
  d6_4: "A shard of wyrdstone in the mud.",
};

function renderPanel(role: "owner" | "player") {
  fakeApi.on("GET /campaigns/1/", campaignFor(role, { enable_locations: true }));
  fakeApi.on("GET /campaigns/1/locations/", [docks, pit]);
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
  it("never edits a location, and Go to page opens the Locations page", async () => {
    renderPanel("owner");

    expect(await screen.findByText("The Docks")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to page" })).toHaveAttribute(
      "href",
      "/campaigns/1/locations"
    );
    noEditing();
  });

  it("shows a player without manage_locations the list and Go to page", async () => {
    renderPanel("player");

    expect(await screen.findByText("The Docks")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to page" })).toBeInTheDocument();
    noEditing();
  });

  it("rolls with one Roll D6 button on a location with results, with no roll boxes", async () => {
    const user = setupUser();
    renderPanel("player");

    const card = (await screen.findByText("The Pit")).closest("li") as HTMLElement;
    const docksCard = screen.getByText("The Docks").closest("li") as HTMLElement;
    expect(within(docksCard).queryByRole("button", { name: "Roll D6" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();

    await user.click(within(card).getByRole("button", { name: "Roll D6" }));

    expect(within(card).getByText("A shard of wyrdstone in the mud.")).toBeInTheDocument();
  });
});
