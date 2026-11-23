/**
 * The campaign's Locations page (William, 23 Nov 2026), on the real routes over the fake API: a
 * row per location group, opening to its description, restrictions and locations, each opening to
 * its rules, hero range, own tables and the campaign tables it points to. Those with
 * `manage_locations` add, edit and remove groups and locations here; a player only reads.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignFor } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { hazards, makeGroup, makeLocation } from "@/test/location-fixtures";
import { setupUser } from "@/test/user-event";

// The campaign's routes load on demand; importing them first lets each lazy() resolve at once.
import "@/features/campaigns/routes/CampaignLayout";
import "@/features/campaigns/routes/Locations";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const PAGE = `/campaigns/${CAMPAIGN_ID}/locations`;
const GROUPS = `/campaigns/${CAMPAIGN_ID}/location-groups/`;
const LOCATIONS = `/campaigns/${CAMPAIGN_ID}/locations/`;

const openAs = (role: "owner" | "player", enable_locations = true) => {
  fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignFor(role, { enable_locations }));
  return renderApp(PAGE);
};

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on(`GET ${GROUPS}`, [makeGroup()]);
  fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/campaign-charts/`, [hazards]);
});

afterEach(() => {
  cleanupApps();
});

describe("The Locations page", () => {
  it("opens a group to its words and locations, and a location to its rules and tables", async () => {
    const user = setupUser();
    openAs("player");

    await user.click(await screen.findByRole("button", { name: /The Undercity/ }));
    expect(screen.getByText("Tunnels under the Pit.")).toBeInTheDocument();
    expect(screen.getByText("Skaven warbands only.")).toBeInTheDocument();
    const row = screen.getByRole("button", { name: /Altar of the Horned Rat/ });
    expect(row).toHaveTextContent("1 hero · Trading action");

    await user.click(row);
    expect(screen.getByText("Pay 10 gc and roll a D6.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Altar of the Horned Rat" })).toBeInTheDocument();
    expect(screen.getByText("Unworthy!")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^(Edit|Remove|Add)/ })).toBeNull();

    await user.click(
      within(screen.getByRole("group", { name: "Charts" })).getByRole("button", {
        name: "Forest Hazards",
      })
    );
    expect(await screen.findByText("Stuck for a turn.")).toBeInTheDocument();
  });

  it("lets one who manages locations add a group", async () => {
    const user = setupUser();
    fakeApi.on(`POST ${GROUPS}`, (body: object) => ({
      ...makeGroup(),
      ...body,
      id: 9,
      locations: [],
    }));
    openAs("owner");

    await user.click(await screen.findByRole("button", { name: "Add group" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a group" });
    await user.type(within(dialog).getByLabelText("Name"), "Marketplace");
    await user.click(within(dialog).getByRole("button", { name: "Add group" }));

    expect(await screen.findByRole("button", { name: /Marketplace/ })).toBeInTheDocument();
    expect(fakeApi.bodyOf(`POST ${GROUPS}`)).toEqual({
      name: "Marketplace",
      description: "",
      restrictions: "",
    });
  });

  it("adds a location written whole, with a table and a link", async () => {
    const user = setupUser();
    fakeApi.on(`POST ${LOCATIONS}`, (body: object) => ({ ...makeLocation(), ...body, id: 12 }));
    openAs("owner");

    await user.click(await screen.findByRole("button", { name: /The Undercity/ }));
    await user.click(screen.getByRole("button", { name: "Add location" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a location" });
    await user.type(within(dialog).getByLabelText("Name"), "Rat Market");
    await user.selectOptions(within(dialog).getByLabelText("Most heroes"), "all");
    await user.click(within(dialog).getByRole("switch", { name: "Takes the trading action" }));
    await user.click(within(dialog).getByRole("button", { name: "Forest Hazards" }));
    await user.click(within(dialog).getByRole("button", { name: "Add a chart" }));
    await user.type(within(dialog).getByLabelText("Title"), "Haggling");
    await user.type(within(dialog).getByLabelText("Result 1 roll"), "1-3");
    await user.type(within(dialog).getByLabelText("Result 1 effect"), "Pay double.");
    await user.click(within(dialog).getByRole("button", { name: "Add location" }));

    expect(await screen.findByRole("button", { name: /Rat Market/ })).toBeInTheDocument();
    expect(fakeApi.bodyOf(`POST ${LOCATIONS}`)).toMatchObject({
      group_id: 2,
      name: "Rat Market",
      min_heroes: 1,
      max_heroes: "all",
      takes_trading_action: true,
      chart_ids: [hazards.id],
      tables: [
        { title: "Haggling", dice: "D6", rows: [{ result: "1-3", name: "", text: "Pay double." }] },
      ],
    });
  });

  it("asks before closing a location's form with changes unsaved", async () => {
    const user = setupUser();
    openAs("owner");

    await user.click(await screen.findByRole("button", { name: /The Undercity/ }));
    await user.click(screen.getByRole("button", { name: /Altar of the Horned Rat/ }));
    await user.click(screen.getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit the location" });
    await user.type(within(dialog).getByLabelText("Rules"), " Twice.");
    await user.keyboard("{Escape}");

    const confirm = await screen.findByRole("dialog", { name: "Discard changes?" });
    await user.click(within(confirm).getByRole("button", { name: "Discard" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Edit the location" })).toBeNull()
    );
    expect(fakeApi.calls()).not.toContain(`PATCH ${LOCATIONS}4/`);
  });

  it("removes a group and its locations after a confirm", async () => {
    const user = setupUser();
    fakeApi.on(`DELETE ${GROUPS}2/`, null);
    openAs("owner");

    await user.click(await screen.findByRole("button", { name: /The Undercity/ }));
    await user.click(screen.getByRole("button", { name: "Remove group" }));
    const confirm = await screen.findByRole("dialog", { name: "Remove the group" });
    expect(confirm).toHaveTextContent("Remove The Undercity and its locations?");
    await user.click(within(confirm).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: /The Undercity/ })).toBeNull());
    expect(fakeApi.calls()).toContain(`DELETE ${GROUPS}2/`);
  });

  it("opens searched for the location a link names (Search everything's ?place=)", async () => {
    const pit = makeLocation({
      id: 5,
      name: "The Pit",
      rules: "Wyrdstone in the ash.",
      tables: [],
    });
    fakeApi.on(`GET ${GROUPS}`, [makeGroup({ description: "", locations: [makeLocation(), pit] })]);
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignFor("player", { enable_locations: true }));
    renderApp(`${PAGE}?place=${encodeURIComponent("The Pit")}`);

    expect(await screen.findByText("Wyrdstone in the ash.")).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search locations" })).toHaveValue("The Pit");
    expect(screen.queryByText("Altar of the Horned Rat")).toBeNull();
  });

  it("says so while Locations are switched off", async () => {
    openAs("owner", false);

    expect(
      await screen.findByText("Trade locations are switched off for this campaign.")
    ).toBeInTheDocument();
    expect(fakeApi.calls()).not.toContain(`GET ${GROUPS}`);
  });
});
