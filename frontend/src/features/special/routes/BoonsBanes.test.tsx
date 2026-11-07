/**
 * The Boons & Banes page (William, 5 Nov 2026: "having a page could be helpful"), on the real
 * routes over the fake API server: the general rules and the warbands' in play, each with its
 * icon, type, price and setting, searched and filtered by category; a row opens to its rules;
 * `?open=` lands on one, scrolled into view.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Special } from "@/features/special/types/special-types";
import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

// The campaign's routes load on demand; importing them first lets each lazy() resolve at once.
import "@/features/campaigns/routes/CampaignLayout";
import "@/features/special/routes/BoonsBanes";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const PAGE = `/campaigns/${CAMPAIGN_ID}/boons-banes`;

const special = (overrides: Partial<Special> & Pick<Special, "id" | "name">): Special => ({
  campaign_id: null,
  setting_id: null,
  type: "Trait",
  kind: "trait",
  category: "aura",
  owner_kind: "general",
  description: "",
  cost: null,
  in_play: true,
  ...overrides,
});
const wound = special({
  id: 1,
  name: "Old Battle Wound",
  type: "Injury",
  kind: "bane",
  category: "injury",
  description: "Roll a D6 before each battle.",
});
const tail = special({
  id: 2,
  name: "Spiked Tail",
  type: "Mutation",
  kind: "boon",
  category: "mutation",
  cost: 35,
  description: "An extra attack with the tail.",
});
const crazed = special({
  id: 3,
  name: "Crazed",
  type: "Warband - Cult of the Possessed",
  owner_kind: "warband",
  description: "Never takes Leadership tests.",
});
const fear = special({ id: 4, name: "Fear", type: "Psychology", description: "Causes fear." });
// left out: a hired sword's own rule, and a setting not ticked
const nimble = special({ id: 5, name: "Nimble", type: "Hired Sword", owner_kind: "hired_sword" });
const beak = special({ id: 6, name: "Beak", type: "Favour of Tchar", in_play: false });

const row = (name: string) =>
  screen.findByRole("button", { name: (label) => label.startsWith(name) });
/** Each row's text: its name and type. */
const names = () =>
  [...document.querySelectorAll<HTMLElement>('li[id^="ref-"] > button')].map(
    (button) => button.textContent ?? ""
  );
/** An open row's figure: "Price35 gc". */
const fact = (label: string) =>
  screen.getByRole("term", { name: (_, term) => term.textContent === label }).parentElement
    ?.textContent;

let scrolledTo: string[] = [];

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignSummary());
  fakeApi.on(`GET /special/?campaign_id=${CAMPAIGN_ID}`, [wound, tail, crazed, fear, nimble, beak]);
  scrolledTo = [];
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function (this: Element) {
    scrolledTo.push(this.id);
  });
});

afterEach(() => {
  cleanupApps();
  vi.restoreAllMocks();
});

describe("The Boons & Banes page", () => {
  it("lists the general rules in play with their type, an open row showing its price and setting", async () => {
    const user = setupUser();
    renderApp(PAGE);

    // William, 7 Nov 2026: "Boons and Banes drop setting and price"
    expect(await row("Spiked Tail")).toHaveTextContent("Spiked TailMutation");
    expect(names()).toEqual(["FearPsychology", "Old Battle WoundInjury", "Spiked TailMutation"]);
    expect(screen.getByText("3 boons and banes shown")).toBeInTheDocument();
    expect(screen.queryByText("Crazed")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(screen.queryByText("Price")).toBeNull();
    expect(screen.queryByText("Setting")).toBeNull();

    await user.click(await row("Old Battle Wound"));
    expect(await row("Old Battle Wound")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Roll a D6 before each battle.")).toBeInTheDocument();
    expect(screen.getByText("Bane · Injury")).toBeInTheDocument();
    expect(fact("Setting")).toBe("SettingMordheim");
    expect(screen.queryByText("Price")).toBeNull(); // no list sells it

    await user.click(await row("Spiked Tail"));
    expect(fact("Price")).toBe("Price35 gc");
  });

  it("searches names, types and rules, and filters by category", async () => {
    const user = setupUser();
    renderApp(PAGE);
    await row("Fear");
    const search = screen.getByRole("searchbox", { name: "Search boons and banes" });

    await user.type(search, "battle");
    expect(names()).toEqual(["Old Battle WoundInjury"]);
    await user.clear(search);
    await user.type(search, "psychology");
    expect(names()).toEqual(["FearPsychology"]);
    await user.clear(search);

    const categories = screen.getByRole("group", { name: "Category" });
    expect(within(categories).getByRole("button", { name: /Mutation/ })).toHaveTextContent(
      "Mutation1"
    );
    await user.click(within(categories).getByRole("button", { name: /Injury/ }));
    expect(names()).toEqual(["Old Battle WoundInjury"]);
    // one setting in play: no Setting filter
    expect(screen.queryByRole("group", { name: "Setting" })).toBeNull();
  });

  it("filters by setting once the rows hold two, Mordheim's grades as one", async () => {
    const setting = (id: number, slug: string, name: string) => ({
      id,
      slug,
      name,
      grade: "1a",
      grade_label: "Official",
      sort_order: id,
      always_on: id === 1,
      warband_types: 0,
    });
    fakeApi.on("GET /settings/", {
      settings: [
        setting(1, "mordheim", "Mordheim 1a"),
        setting(11, "mutiny-in-marienburg", "Mutiny in Marienburg"),
      ],
      presets: [],
    });
    fakeApi.on(`GET /special/?campaign_id=${CAMPAIGN_ID}`, [
      wound,
      tail,
      { ...beak, in_play: true, setting_id: 11 },
    ]);
    const user = setupUser();
    renderApp(PAGE);

    expect(await row("Beak")).toHaveTextContent("BeakFavour of Tchar");
    await user.click(await row("Beak"));
    expect(fact("Setting")).toBe("SettingMutiny in Marienburg");
    await user.click(await row("Beak")); // an open row stays whatever the filters
    const settings = await screen.findByRole("group", { name: "Setting" });
    await user.click(within(settings).getByRole("button", { name: "Mordheim" }));
    expect(names()).toEqual(["Old Battle WoundInjury", "Spiked TailMutation"]);
  });

  it("links a psychology special to its part of the Rules page, and no other", async () => {
    const user = setupUser();
    renderApp(PAGE);

    await user.click(await row("Fear"));
    expect(screen.getByRole("link", { name: "Fear in the rules" })).toHaveAttribute(
      "href",
      `/campaigns/${CAMPAIGN_ID}/rules?open=leadership-psychology-fear`
    );
    await user.click(await row("Old Battle Wound"));
    expect(screen.queryByRole("link", { name: /in the rules$/ })).toBeNull();
  });

  it("lands a link's ?open= on its row, open and scrolled to", async () => {
    renderApp(`${PAGE}?open=${tail.id}`);

    expect(await row("Spiked Tail")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("An extra attack with the tail.")).toBeInTheDocument();
    await waitFor(() => expect(scrolledTo).toEqual([`ref-${tail.id}`]));
  });
});
