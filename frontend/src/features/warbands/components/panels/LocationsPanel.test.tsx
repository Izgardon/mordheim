/**
 * The warband page's Locations panel reads the tree and never edits it (William, 7 Nov 2026), and
 * sends your heroes with Visit (William, 23 Nov 2026): the first hero whose trading action is
 * unspent is picked at first, a pick outside the location's range warns and still goes.
 */
import { MemoryRouter } from "react-router-dom";
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { campaignFor } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { hazards, makeGroup } from "@/test/location-fixtures";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { setupUser } from "@/test/user-event";
import { makeHero } from "@/test/warband-fixtures";

import LocationsPanel from "./LocationsPanel";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const heroes = [
  makeHero({ id: 1, name: "Aldric", trading_action: false }),
  makeHero({ id: 2, name: "Bruno", trading_action: true }),
];

function renderPanel(canEdit: boolean) {
  fakeApi.on("GET /campaigns/1/", campaignFor("owner", { enable_locations: true }));
  fakeApi.on("GET /campaigns/1/location-groups/", [makeGroup()]);
  fakeApi.on("GET /campaigns/1/campaign-charts/", [hazards]);
  return renderWithQueryClient(
    <MemoryRouter>
      <LocationsPanel
        campaignId={1}
        warbandId={canEdit ? 9 : 0}
        heroes={heroes}
        canEdit={canEdit}
        open
        onOpenChange={() => undefined}
      />
    </MemoryRouter>
  );
}

const openAltar = async (user: ReturnType<typeof setupUser>) => {
  await user.click(await screen.findByRole("button", { name: /The Undercity/ }));
  await user.click(screen.getByRole("button", { name: /Altar of the Horned Rat/ }));
};

beforeEach(() => {
  fakeApi.reset();
});

describe("LocationsPanel", () => {
  it("never edits, and Go to page opens the Locations page", async () => {
    const user = setupUser();
    renderPanel(false);

    await openAltar(user);
    expect(screen.getByRole("link", { name: "Go to page" })).toHaveAttribute(
      "href",
      "/campaigns/1/locations"
    );
    expect(screen.queryByRole("button", { name: /^(Edit|Remove|Add)/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Visit" })).toBeNull();
  });

  it("picks the first hero with his trading action and sends him", async () => {
    const user = setupUser();
    fakeApi.on("POST /warbands/9/location-visits/", {
      heroes: [{ id: 2, trading_action: false }],
      message: "Bruno visited Altar of the Horned Rat.",
      warnings: [],
    });
    renderPanel(true);

    await openAltar(user);
    const picker = screen.getByRole("group", { name: "Heroes who go" });
    expect(within(picker).getByRole("button", { name: /Bruno/ })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(within(picker).getByRole("button", { name: /Aldric/ })).toHaveTextContent("spent");
    await user.click(screen.getByRole("button", { name: "Visit" }));

    await waitFor(() =>
      expect(fakeApi.bodyOf("POST /warbands/9/location-visits/")).toEqual({
        location_id: 4,
        hero_ids: [2],
      })
    );
  });

  it("warns when the pick is outside the location's range, and still sends them", async () => {
    const user = setupUser();
    fakeApi.on("POST /warbands/9/location-visits/", { heroes: [], message: "", warnings: [] });
    renderPanel(true);

    await openAltar(user);
    await user.click(
      within(screen.getByRole("group", { name: "Heroes who go" })).getByRole("button", {
        name: /Aldric/,
      })
    );
    expect(screen.getByText("Altar of the Horned Rat is for 1 hero.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Visit" }));

    await waitFor(() =>
      expect(fakeApi.bodyOf("POST /warbands/9/location-visits/")).toEqual({
        location_id: 4,
        hero_ids: [1, 2],
      })
    );
  });
});
