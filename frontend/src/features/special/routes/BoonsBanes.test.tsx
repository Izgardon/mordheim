/**
 * The Specials page (William, 5 Nov 2026: "having a page could be helpful"), on the real
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
import { pickOption } from "@/test/select";
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
// and a beast's own (William, 7 Nov 2026: "keep bestiary rules from displaying on the boons and banes page")
const attacks = special({ id: 7, name: "Attacks (Giant)", type: "Animal", owner_kind: "beast" });
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
  fakeApi.on(`GET /special/?campaign_id=${CAMPAIGN_ID}`, [
    wound,
    tail,
    crazed,
    fear,
    nimble,
    beak,
    attacks,
  ]);
  scrolledTo = [];
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function (this: Element) {
    scrolledTo.push(this.id);
  });
});

afterEach(() => {
  cleanupApps();
  vi.restoreAllMocks();
});

describe("The Specials page", () => {
  it("lists the general rules in play with their type, an open row showing its price and setting", async () => {
    const user = setupUser();
    renderApp(PAGE);

    // William, 7 Nov 2026: "Boons and Banes drop setting and price"
    expect(await row("Spiked Tail")).toHaveTextContent("Spiked TailBoonMutation");
    expect(names()).toEqual([
      "FearTraitPsychology",
      "Old Battle WoundBaneInjury",
      "Spiked TailBoonMutation",
    ]);
    // William, 26 Nov 2026: by name or by kind, the Kind heading sorting on the web
    expect(screen.queryByRole("button", { name: /^Sorted by/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Sort by Kind" }));
    expect(names()).toEqual([
      "Spiked TailBoonMutation",
      "Old Battle WoundBaneInjury",
      "FearTraitPsychology",
    ]);
    await user.click(screen.getByRole("button", { name: "Sort by Name" }));
    expect(names()[0]).toBe("FearTraitPsychology");
    expect(screen.getByText("3 specials shown")).toBeInTheDocument();
    expect(screen.queryByText("Crazed")).toBeNull();
    expect(screen.queryByText("Attacks (Giant)")).toBeNull();
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
    const search = screen.getByRole("searchbox", { name: "Search specials" });

    await user.type(search, "battle");
    expect(names()).toEqual(["Old Battle WoundBaneInjury"]);
    await user.clear(search);
    await user.type(search, "psychology");
    expect(names()).toEqual(["FearTraitPsychology"]);
    await user.clear(search);

    // William, 26 Nov 2026: the category a dropdown
    const categories = screen.getByRole("combobox", { name: "Category" });
    expect(categories).toHaveTextContent("All categories");
    await user.click(categories);
    expect(screen.getByRole("option", { name: /Mutation/ })).toHaveTextContent("Mutation1");
    // William, 22 Nov 2026: "rename the body type to Physical everywhere for boons and banes"
    expect(screen.getByRole("option", { name: /Physical/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Body/ })).toBeNull();
    await user.keyboard("{Escape}");
    await pickOption(user, categories, /Injury/);
    expect(names()).toEqual(["Old Battle WoundBaneInjury"]);
    expect(categories).toHaveTextContent("Injury");
    // one setting in play: no Setting filter
    expect(screen.queryByRole("combobox", { name: "Setting" })).toBeNull();
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

    expect(await row("Beak")).toHaveTextContent("BeakTraitFavour of Tchar");
    await user.click(await row("Beak"));
    expect(fact("Setting")).toBe("SettingMutiny in Marienburg");
    await user.click(await row("Beak")); // an open row stays whatever the filters
    await pickOption(user, await screen.findByRole("combobox", { name: "Setting" }), "Mordheim");
    expect(names()).toEqual(["Old Battle WoundBaneInjury", "Spiked TailBoonMutation"]);
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

// William, 22 Nov 2026: "We also need a way to add a special (boon and bane)"
describe("Adding a special", () => {
  it("adds the campaign's own, opened in the list", async () => {
    const added = special({
      id: 9,
      campaign_id: CAMPAIGN_ID,
      name: "Iron Will",
      type: "Psychology",
      kind: "boon",
      category: "body",
      cost: 20,
      description: "Never flees.",
    });
    fakeApi.on(`POST /special/`, added);
    const user = setupUser();
    renderApp(PAGE);
    await user.click(await screen.findByRole("button", { name: "Add new" }));
    const form = await screen.findByRole("dialog", { name: "Add a special" });

    await user.type(within(form).getByLabelText("Name"), "Iron Will");
    await user.click(within(form).getByRole("button", { name: "Boon" }));
    await user.click(within(form).getByRole("button", { name: /Physical/ }));
    await user.type(within(form).getByLabelText("Price (gc)"), "20");
    await user.type(within(form).getByLabelText("Description"), "Never flees.");
    // the list read again after the save holds it
    fakeApi.on(`GET /special/?campaign_id=${CAMPAIGN_ID}`, [wound, tail, fear, added]);
    await user.click(within(form).getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(fakeApi.bodyOf("POST /special/")).toEqual({
        campaign_id: CAMPAIGN_ID,
        name: "Iron Will",
        kind: "boon",
        category: "body",
        cost: 20,
        description: "Never flees.",
        prebattle_roll: "",
        prebattle_text: "",
      })
    );
    expect(await row("Iron Will")).toHaveAttribute("aria-expanded", "true");
  });

  // William, 22 Nov 2026: "Lets remove type field on edit and creation, keep it fixed for seeded
  // stuff"
  it("asks for no type: a new one has none, and an edit keeps the book's", async () => {
    const user = setupUser();
    renderApp(PAGE);
    await user.click(await screen.findByRole("button", { name: "Add new" }));
    const form = await screen.findByRole("dialog", { name: "Add a special" });
    expect(within(form).queryByLabelText("Type")).toBeNull();
    await user.type(within(form).getByRole("textbox", { name: "Name" }), "Iron Will");
    await user.click(within(form).getByRole("button", { name: "Add" }));

    expect(within(form).getByText("Name and description are required.")).toBeInTheDocument();
    expect(fakeApi.countOf("POST /special/")).toBe(0);
  });

  it("edits one from its open row, a book one becoming the campaign's version", async () => {
    const version = {
      ...wound,
      id: 11,
      campaign_id: CAMPAIGN_ID,
      replaces: wound.id,
      kind: "trait" as const,
    };
    fakeApi.on(`PATCH /special/${wound.id}/`, version);
    const user = setupUser();
    renderApp(`${PAGE}?open=${wound.id}`);
    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const form = await screen.findByRole("dialog", { name: "Edit special" });

    expect(within(form).getByRole("textbox", { name: "Name" })).toHaveValue("Old Battle Wound");
    expect(within(form).getByRole("button", { name: "Bane" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await user.click(within(form).getByRole("button", { name: "Trait" }));
    fakeApi.on(`GET /special/?campaign_id=${CAMPAIGN_ID}`, [version, tail, fear]);
    await user.click(within(form).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fakeApi.countOf(`PATCH /special/${wound.id}/`)).toBe(1));
    expect(fakeApi.bodyOf(`PATCH /special/${wound.id}/`)).not.toHaveProperty("type");
    await waitFor(() =>
      expect(fakeApi.bodyOf(`PATCH /special/${wound.id}/`)).toMatchObject({
        campaign_id: CAMPAIGN_ID,
        name: "Old Battle Wound",
        kind: "trait",
        category: "injury",
        description: "Roll a D6 before each battle.",
      })
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
