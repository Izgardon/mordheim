/**
 * The Campaign rules page (William, 7 Nov 2026: "campaign wide rules that are not house rules ...
 * admin only"; 19 Nov 2026: three lists, each row its own modal, related rules under umbrellas),
 * on the real routes over the fake API server: every member reads the campaign's rules, its battle
 * rules and its charts; the owner and admins add, edit, move and delete all three.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignFor } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

import type { CampaignChart, CampaignRule } from "../types/rule-types";

// The campaign's routes load on demand; importing them first lets each lazy() resolve at once.
import "@/features/campaigns/routes/CampaignLayout";
import "@/features/rules/routes/CampaignRules";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const PAGE = `/campaigns/${CAMPAIGN_ID}/campaign-rules`;
const RULES = `/campaigns/${CAMPAIGN_ID}/campaign-rules/`;
const CHARTS = `/campaigns/${CAMPAIGN_ID}/campaign-charts/`;

const rule = (
  overrides: Partial<CampaignRule> & Pick<CampaignRule, "id" | "title">
): CampaignRule => ({
  campaign_id: CAMPAIGN_ID,
  kind: "campaign",
  body: "",
  umbrella: "",
  order: 0,
  chart: null,
  ...overrides,
});

const comet = rule({ id: 3, title: "The Comet's Fall", body: "Each night a shard falls." });
const curfew = rule({
  id: 4,
  title: "Curfew",
  body: "No warband leaves after the bell.",
  order: 1,
});
const fog = rule({
  id: 5,
  kind: "battle",
  title: "Fog",
  body: 'Visibility is 12".',
  umbrella: "Weather",
  order: 2,
});
const hail = rule({
  id: 6,
  kind: "battle",
  title: "Hail",
  body: "Missiles are at -1.",
  umbrella: "Weather",
  order: 3,
});
const storm = rule({
  id: 8,
  kind: "battle",
  title: "Northern wind",
  body: "A storm rolls in.",
  order: 4,
  chart: {
    dice: "D6",
    description: "",
    note: "The powder stays wet.",
    rows: [{ id: 5, result: "1-3", name: "Squall", text: "Missiles are at -1." }],
  },
});
const monsters: CampaignChart = {
  id: 9,
  campaign_id: CAMPAIGN_ID,
  title: "Monster encounters",
  description: "Roll when a warrior enters the marsh.",
  dice: "2D6",
  note: "Add 1 at night.",
  umbrella: "",
  order: 0,
  rows: [
    { id: 1, result: "2", name: "Colossal Squig", text: "It charges the nearest warrior." },
    { id: 2, result: "3-4", name: "Cultists", text: "" },
  ],
};

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on(`GET ${RULES}`, [comet, curfew, fog, hail, storm]);
  fakeApi.on(`GET ${CHARTS}`, [monsters]);
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanupApps();
  vi.restoreAllMocks();
});

describe("The Campaign rules page", () => {
  it("splits the campaign's rules, its battle rules and its charts into three lists", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignFor("player"));
    renderApp(PAGE);

    for (const title of ["Campaign rules", "Battle rules", "Tables"]) {
      expect(await screen.findByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
    // the battle rules sharing an umbrella are one row, named by it
    expect(await screen.findByRole("button", { name: /^Weather/ })).toHaveTextContent("2 rules");
    expect(screen.queryByRole("button", { name: /^Fog/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Monster encounters/ })).toHaveTextContent(
      "2D6 · 2 results"
    );
  });

  it("opens a lone rule in its own modal, and an umbrella's rules together in one", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignFor("player"));
    const user = setupUser();
    renderApp(PAGE);

    await user.click(await screen.findByRole("button", { name: /^Curfew/ }));
    const one = await screen.findByRole("dialog", { name: "Curfew" });
    expect(within(one).getByText(curfew.body)).toBeInTheDocument();
    expect(within(one).queryByText(comet.body)).toBeNull();
    expect(within(one).queryByRole("button", { name: "Edit" })).toBeNull();

    await user.click(within(one).getByRole("button", { name: "Close" }));
    await user.click(await screen.findByRole("button", { name: /^Weather/ }));

    const both = await screen.findByRole("dialog", { name: "Weather" });
    expect(within(both).getByText(fog.body)).toBeInTheDocument();
    expect(within(both).getByText(hail.body)).toBeInTheDocument();
  });

  it("shows a rule's own table inside its modal, and not in the Charts list", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignFor("player"));
    const user = setupUser();
    renderApp(PAGE);

    await user.click(await screen.findByRole("button", { name: /^Northern wind/ }));

    const modal = await screen.findByRole("dialog", { name: "Northern wind" });
    expect(within(modal).getByText("A storm rolls in.")).toBeInTheDocument();
    expect(within(modal).getByRole("cell", { name: "Squall" })).toBeInTheDocument();
    expect(within(modal).getByText("The powder stays wet.")).toBeInTheDocument();
    // the Charts list holds the reference charts only
    await user.click(within(modal).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("button", { name: /^Northern wind.*results/ })).toBeNull();
  });

  it("finds a rule by a result on its own table", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignFor("player"));
    const user = setupUser();
    renderApp(PAGE);

    const search = await screen.findByLabelText(
      "Search the campaign rules, battle rules and tables"
    );
    await user.type(search, "squall");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Northern wind/ })).toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: /^Weather/ })).toBeNull();
  });

  it("shows a chart's results, its dice and its note in its modal", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignFor("player"));
    const user = setupUser();
    renderApp(PAGE);

    await user.click(await screen.findByRole("button", { name: /^Monster encounters/ }));

    const modal = await screen.findByRole("dialog", { name: "Monster encounters" });
    expect(within(modal).getByText(monsters.description)).toBeInTheDocument();
    expect(within(modal).getByRole("columnheader", { name: "2D6" })).toBeInTheDocument();
    expect(within(modal).getByRole("cell", { name: "Colossal Squig" })).toBeInTheDocument();
    expect(within(modal).getByText("Add 1 at night.")).toBeInTheDocument();
  });

  it("finds a chart by one of its results, and a battle rule by its umbrella", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignFor("player"));
    const user = setupUser();
    renderApp(PAGE);

    const search = await screen.findByLabelText(
      "Search the campaign rules, battle rules and tables"
    );
    await user.type(search, "squig");

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Monster encounters/ })).toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: /^Curfew/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Weather/ })).toBeNull();
  });

  it("lets an admin add a battle rule under an umbrella, which opens that umbrella", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignFor("admin"));
    fakeApi.on(`POST ${RULES}`, (body: Partial<CampaignRule>) =>
      rule({ id: 7, title: body.title ?? "", ...body, order: 4 })
    );
    const user = setupUser();
    renderApp(PAGE);

    await user.click(await screen.findByRole("button", { name: "Add battle rule" }));
    const form = screen.getByRole("form", { name: "Add a battle rule" });
    await user.type(within(form).getByLabelText("Title"), " Blizzard ");
    await user.type(within(form).getByLabelText("Umbrella"), "Weather");
    await user.type(within(form).getByLabelText("Rule"), "Nobody may run.");
    await user.click(within(form).getByRole("button", { name: "Add rule" }));

    expect(fakeApi.bodyOf(`POST ${RULES}`)).toEqual({
      title: "Blizzard",
      body: "Nobody may run.",
      umbrella: "Weather",
      kind: "battle",
    });
    const modal = await screen.findByRole("dialog", { name: "Weather" });
    expect(within(modal).getByText("Nobody may run.")).toBeInTheDocument();
  });

  it("lets an admin edit a rule and move it from inside its modal", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignFor("admin"));
    fakeApi.on(`PUT ${RULES}order/`, () => [
      { ...curfew, order: 0 },
      { ...comet, order: 1 },
      fog,
      hail,
      storm,
    ]);
    fakeApi.on(`PATCH ${RULES}4/`, (body: Partial<CampaignRule>) => ({ ...curfew, ...body }));
    const user = setupUser();
    renderApp(PAGE);

    await user.click(await screen.findByRole("button", { name: /^Curfew/ }));
    const modal = await screen.findByRole("dialog", { name: "Curfew" });
    await user.click(within(modal).getByRole("button", { name: "Move up" }));

    await waitFor(() =>
      expect(fakeApi.bodyOf(`PUT ${RULES}order/`)).toEqual({ ids: [4, 3, 5, 6, 8] })
    );

    await user.click(within(modal).getByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit the rule" });
    await user.clear(within(dialog).getByLabelText("Title"));
    await user.type(within(dialog).getByLabelText("Title"), "Curfew Bell");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    // the row it opened is its own, so the modal it is read in takes the new title with it
    expect(await screen.findByRole("dialog", { name: "Curfew Bell" })).toBeInTheDocument();
    expect(fakeApi.bodyOf(`PATCH ${RULES}4/`)).toEqual({
      title: "Curfew Bell",
      body: curfew.body,
      umbrella: "",
      chart: null, // it has none, and saying so leaves the rule without one
    });
  });

  it("lets an admin add a chart with its results", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignFor("admin"));
    fakeApi.on(`POST ${CHARTS}`, (body: Partial<CampaignChart>) => ({
      ...monsters,
      id: 11,
      ...body,
    }));
    const user = setupUser();
    renderApp(PAGE);

    await user.click(await screen.findByRole("button", { name: "Add table" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a table" });
    await user.type(within(dialog).getByLabelText("Title"), "Spring weather");
    await user.type(within(dialog).getByLabelText("Result 1 roll"), "1-2");
    await user.type(within(dialog).getByLabelText("Result 1 name"), "Clear");
    await user.click(within(dialog).getByRole("button", { name: "Add table" }));

    await waitFor(() =>
      expect(fakeApi.bodyOf(`POST ${CHARTS}`)).toEqual({
        title: "Spring weather",
        description: "",
        dice: "D6",
        note: "",
        umbrella: "",
        rows: [{ result: "1-2", name: "Clear", text: "" }],
      })
    );
  });

  it("is named for the published campaign it plays", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, { ...campaignFor("player"), preset_id: 3 });
    fakeApi.on("GET /campaign-presets/", [{ id: 3, slug: "khemri", name: "Khemri" }]);
    renderApp(PAGE);

    expect(await screen.findByRole("heading", { level: 1, name: "Khemri" })).toBeInTheDocument();
  });

  it("is under the Rules eyebrow and says when a list is empty", async () => {
    fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignFor("player"));
    fakeApi.on(`GET ${RULES}`, []);
    fakeApi.on(`GET ${CHARTS}`, []);
    renderApp(PAGE);

    // named for the published campaign it plays, Mordheim when none (William, 22 Nov 2026)
    const heading = await screen.findByRole("heading", { level: 1, name: "Mordheim" });
    expect(heading.previousElementSibling).toHaveTextContent(/^Rules$/);
    expect(await screen.findByText("No campaign rules yet.")).toBeInTheDocument();
    expect(screen.getByText("No battle rules yet.")).toBeInTheDocument();
    expect(screen.getByText("No tables yet.")).toBeInTheDocument();
  });
});
