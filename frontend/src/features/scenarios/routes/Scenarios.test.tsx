/**
 * The campaign's Scenarios page (William, 24 Nov 2026), on the real routes over the fake API: its
 * list with who each is for, its source and its weight, a row opening to its opening lines and
 * sections; a manager edits a weight in place, adds from the catalogue, writes a new one and
 * removes one, while a player only reads.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignFor } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { HUNT, POOL, makeRow, makeScenario } from "@/test/scenario-fixtures";
import { pickOption } from "@/test/select";
import { setupUser } from "@/test/user-event";

import "@/features/campaigns/routes/CampaignLayout";
import "@/features/scenarios/routes/Scenarios";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const PAGE = `/campaigns/${CAMPAIGN_ID}/scenarios`;
const LIST = `/campaigns/${CAMPAIGN_ID}/scenarios/`;

const openAs = (role: "owner" | "player") => {
  fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignFor(role));
  return renderApp(PAGE);
};

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on(`GET ${LIST}`, [POOL, HUNT]);
});

afterEach(() => {
  cleanupApps();
});

describe("The Scenarios page", () => {
  it("lists each with who it is for, its source and weight, and opens one to its sections", async () => {
    const user = setupUser();
    openAs("player");

    const hunt = await screen.findByRole("button", { name: /Wyrdstone Hunt/ });
    expect(within(hunt).getByRole("img", { name: "1v1" })).toBeInTheDocument();
    expect(hunt).toHaveTextContent("Mordheim Rulebook · 3");
    const pool = screen.getByRole("button", { name: /The Pool/ });
    expect(within(pool).getByRole("img", { name: "Multiplayer" })).toBeInTheDocument();
    expect(screen.getByLabelText("Weight of Wyrdstone Hunt")).toHaveTextContent("4×");
    expect(screen.queryByRole("spinbutton")).toBeNull(); // a player reads the weights
    expect(screen.queryByRole("button", { name: /^(Add scenario|Add new|Remove)$/ })).toBeNull();

    await user.click(hunt);
    expect(
      screen.getByText("Scattered in the ruins of Mordheim are shards of wyrdstone.")
    ).toBeInTheDocument();
    const rules = screen.getByRole("region", { name: "Special rules" });
    expect(within(rules).getByText("Place D3+1 counters.")).toBeInTheDocument();
    expect(within(rules).getByRole("cell", { name: "One shard" })).toBeInTheDocument();
  });

  it("searches and filters by players", async () => {
    const user = setupUser();
    openAs("player");
    await screen.findByRole("button", { name: /The Pool/ });

    // William, 26 Nov 2026: the Players filter a dropdown
    const players = screen.getByRole("combobox", { name: "Players" });
    await pickOption(user, players, /^Multiplayer/);
    expect(screen.queryByRole("button", { name: /Wyrdstone Hunt/ })).toBeNull();
    await pickOption(user, players, /^1v1 and multiplayer/);
    await user.type(screen.getByRole("searchbox", { name: "Search scenarios" }), "wealth");
    expect(screen.queryByRole("button", { name: /The Pool/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Wyrdstone Hunt/ })).toBeInTheDocument();
  });

  it("lets a manager weight a row in place", async () => {
    const user = setupUser();
    fakeApi.on(`PATCH ${LIST}11/`, (body: { weight: number }) => ({
      ...HUNT,
      weight: body.weight,
    }));
    openAs("owner");

    const box = await screen.findByRole("spinbutton", { name: "Weight of Wyrdstone Hunt" });
    await user.clear(box);
    await user.type(box, "1.5{Enter}");

    await waitFor(() => expect(fakeApi.bodyOf(`PATCH ${LIST}11/`)).toEqual({ weight: 1.5 }));
    expect(box).toHaveValue(1.5);
    await user.clear(box);
    await user.type(box, "-2{Enter}");
    expect(screen.getByText("A weight is 0 or more.")).toBeInTheDocument();
    expect(fakeApi.countOf(`PATCH ${LIST}11/`)).toBe(1);
  });

  it("adds a scenario from the catalogue at 1×, leaving out what the list holds", async () => {
    const user = setupUser();
    const raid = makeScenario({ id: 40, name: "Raid", source: "Archive Pestilen", number: "" });
    fakeApi.on(`GET /scenarios/?campaign_id=${CAMPAIGN_ID}`, [HUNT.scenario, raid]);
    fakeApi.on(`POST ${LIST}`, makeRow(20, 1, raid));
    openAs("owner");

    await user.click(await screen.findByRole("button", { name: "Add scenario" }));
    const dialog = await screen.findByRole("dialog", { name: "Add scenario" });
    const listbox = within(dialog).getByRole("listbox");
    expect(await within(listbox).findByText("Raid")).toBeInTheDocument();
    expect(within(listbox).queryByText("Wyrdstone Hunt")).toBeNull();
    await user.click(within(listbox).getByText("Raid"));

    expect(fakeApi.bodyOf(`POST ${LIST}`)).toEqual({ scenario_id: 40 });
    expect(await screen.findByRole("button", { name: /Raid/, expanded: true })).toBeInTheDocument();
  });

  it("writes a new scenario with the standard headings and lists it", async () => {
    const user = setupUser();
    const made = makeScenario({ id: 50, name: "Bridge", campaign_id: CAMPAIGN_ID, sections: [] });
    fakeApi.on("POST /scenarios/", made);
    fakeApi.on(`POST ${LIST}`, makeRow(21, 1, made));
    openAs("owner");

    await user.click(await screen.findByRole("button", { name: "Add new" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a scenario" });
    await user.type(within(dialog).getByLabelText("Name"), "Bridge");
    await user.selectOptions(within(dialog).getByLabelText("Players"), "multiplayer");
    await user.click(within(dialog).getByRole("button", { name: "Terrain" }));
    await user.type(within(dialog).getByRole("textbox", { name: "Terrain text" }), "A river.");
    expect(within(dialog).queryByRole("button", { name: "Terrain" })).toBeNull(); // used once
    await user.click(within(dialog).getByRole("button", { name: "Add scenario" }));

    await waitFor(() => expect(fakeApi.bodyOf(`POST ${LIST}`)).toEqual({ scenario_id: 50 }));
    expect(fakeApi.bodyOf("POST /scenarios/")).toEqual({
      campaign_id: CAMPAIGN_ID,
      name: "Bridge",
      players: "multiplayer",
      source: "",
      summary: "",
      intro: "",
      sections: [{ title: "Terrain", text: "A river." }],
    });
  });

  it("asks before a manager removes one", async () => {
    const user = setupUser();
    fakeApi.on(`DELETE ${LIST}12/`, null);
    openAs("owner");

    await user.click(await screen.findByRole("button", { name: /The Pool/ }));
    await user.click(screen.getByRole("button", { name: "Remove" }));
    const confirm = await screen.findByRole("dialog", { name: "Remove The Pool?" });
    await user.click(within(confirm).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: /The Pool/ })).toBeNull());
    expect(fakeApi.countOf(`DELETE ${LIST}12/`)).toBe(1);
  });
});
