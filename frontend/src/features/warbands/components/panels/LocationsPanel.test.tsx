/**
 * Locations are managed from the Locations panel (William, 1 Nov 2026), no longer in settings:
 * with `manage_locations`, Add location, and Edit and Remove on each (Remove after a confirm);
 * without it, the list only.
 */
import { screen, waitFor, within } from "@testing-library/react";
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
    <LocationsPanel
      campaignId={1}
      warbandId={0}
      heroes={[]}
      canEdit={false}
      open
      onOpenChange={() => undefined}
    />
  );
}

beforeEach(() => {
  fakeApi.reset();
});

describe("LocationsPanel", () => {
  it("lets a player with manage_locations add a location from the panel", async () => {
    const user = setupUser();
    fakeApi.on("POST /campaigns/1/locations/", (body: object) => ({
      ...docks,
      ...body,
      id: 9,
    }));
    renderPanel("owner");

    await user.click(await screen.findByRole("button", { name: "Add location" }));
    const form = screen.getByRole("form", { name: "Add a location" });
    await user.type(within(form).getByLabelText("Name"), "The Pit");
    await user.type(within(form).getByLabelText("Area"), "River");
    await user.click(within(form).getByRole("button", { name: "Add location" }));

    expect(await screen.findByText("The Pit")).toBeInTheDocument();
    expect(fakeApi.bodyOf("POST /campaigns/1/locations/")).toMatchObject({
      name: "The Pit",
      area: "River",
    });
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("edits and removes a location, the removal after a confirm", async () => {
    const user = setupUser();
    fakeApi.on("PATCH /campaigns/1/locations/4/", (body: object) => ({ ...docks, ...body }));
    fakeApi.on("DELETE /campaigns/1/locations/4/", null);
    renderPanel("owner");

    await user.click(await screen.findByRole("button", { name: "Edit The Docks" }));
    const form = screen.getByRole("form", { name: "Edit The Docks" });
    await user.clear(within(form).getByLabelText("Name"));
    await user.type(within(form).getByLabelText("Name"), "The Old Docks");
    await user.click(within(form).getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("The Old Docks")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Remove The Old Docks" }));
    const confirm = await screen.findByRole("dialog", { name: "Remove the location" });
    expect(confirm).toHaveTextContent("It leaves the Locations panel for everyone");
    await user.click(within(confirm).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(screen.queryByText("The Old Docks")).toBeNull());
    expect(fakeApi.calls()).toContain("DELETE /campaigns/1/locations/4/");
  });

  it("shows a player without manage_locations the list only", async () => {
    renderPanel("player");

    expect(await screen.findByText("The Docks")).toBeInTheDocument();
    await waitFor(() => expect(fakeApi.calls()).toContain("GET /campaigns/1/"));
    expect(screen.queryByRole("button", { name: "Add location" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^(Edit|Remove) / })).toBeNull();
  });
});
