/**
 * The campaign's Locations page (William, 7 Nov 2026: "shouldn't be able to edit locations in the
 * location sidebar within warband"), on the real routes over the fake API server: those with
 * `manage_locations` add, edit and remove locations here (Remove after a confirm); a player reads
 * them; while Locations are switched off the page says so.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignLocation } from "@/features/campaigns/types/campaign-types";
import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignFor } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
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
const LOCATIONS = `/campaigns/${CAMPAIGN_ID}/locations/`;
const docks: CampaignLocation = {
  id: 4,
  campaign_id: CAMPAIGN_ID,
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
  fakeApi.on(`GET ${LOCATIONS}`, [docks]);
});

afterEach(() => {
  cleanupApps();
});

describe("The Locations page", () => {
  it("lets one who manages locations add one", async () => {
    const user = setupUser();
    fakeApi.on(`POST ${LOCATIONS}`, (body: object) => ({ ...docks, ...body, id: 9 }));
    openAs("owner");

    await user.click(await screen.findByRole("button", { name: "Add location" }));
    const form = screen.getByRole("form", { name: "Add a location" });
    await user.type(within(form).getByLabelText("Name"), "The Pit");
    await user.type(within(form).getByLabelText("Area"), "River");
    await user.click(within(form).getByRole("button", { name: "Add location" }));

    expect(await screen.findByText("The Pit")).toBeInTheDocument();
    expect(fakeApi.bodyOf(`POST ${LOCATIONS}`)).toMatchObject({ name: "The Pit", area: "River" });
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("edits and removes a location, the removal after a confirm", async () => {
    const user = setupUser();
    fakeApi.on(`PATCH ${LOCATIONS}4/`, (body: object) => ({ ...docks, ...body }));
    fakeApi.on(`DELETE ${LOCATIONS}4/`, null);
    openAs("owner");

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
    expect(fakeApi.calls()).toContain(`DELETE ${LOCATIONS}4/`);
  });

  it("shows a player without manage_locations the list only", async () => {
    openAs("player");

    expect(await screen.findByText("The Docks")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add location" })).toBeNull();
    expect(screen.queryByRole("button", { name: /^(Edit|Remove) / })).toBeNull();
  });

  it("has no roll on a location with D6 results (William: remove the roll boxes)", async () => {
    fakeApi.on(`GET ${LOCATIONS}`, [{ ...docks, d6_1: "Nothing but rats.", d6_6: "Treasure." }]);
    openAs("owner");

    expect(await screen.findByText("The Docks")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Roll/ })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText("D6 roll")).toBeNull();
  });

  // William, 7 Nov 2026: "yes if it is a d6 location"
  it("lists a D6 location's results under its text, and nothing for one without", async () => {
    const pit = { ...docks, id: 5, name: "The Pit", d6_1: "Nothing but rats.", d6_6: "Treasure." };
    fakeApi.on(`GET ${LOCATIONS}`, [docks, pit]);
    openAs("player");

    const table = await screen.findByRole("table", { name: "The Pit: D6 results" });
    const rows = within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.textContent);
    expect(rows).toEqual([
      "1Nothing but rats.",
      "2Nothing listed",
      "3Nothing listed",
      "4Nothing listed",
      "5Nothing listed",
      "6Treasure.",
    ]);
    expect(screen.queryByRole("table", { name: "The Docks: D6 results" })).toBeNull();
    expect(screen.getAllByRole("table")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /^Roll/ })).toBeNull();
  });

  it("says so while Locations are switched off", async () => {
    openAs("owner", false);

    expect(
      await screen.findByText("Locations are switched off for this campaign.")
    ).toBeInTheDocument();
    expect(fakeApi.calls()).not.toContain(`GET ${LOCATIONS}`);
  });
});
