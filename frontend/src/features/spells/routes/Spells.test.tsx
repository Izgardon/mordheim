/**
 * The Spells page (William, 3 Nov 2026: "lets show the spell reference table as a row per school
 * with the spells inside the expanded row"), on the real routes over the fake API server: a row
 * per lore in play opens to its D6 table, a spell's row to its rules; the search keeps the lores
 * with a match; `?open=` lands on a spell with its lore open, scrolled into view, as a save does.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RAIDER, storeSession } from "@/test/auth-fixtures";
import { cleanupApps, renderApp } from "@/test/app-routes";
import { CAMPAIGN_ID, campaignSummary } from "@/test/campaign-fixtures";
import { spell } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

// The campaign's routes load on demand; importing them first lets each lazy() resolve at once.
import "@/features/campaigns/routes/CampaignLayout";
import "@/features/spells/routes/Spells";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));

const PAGE = `/campaigns/${CAMPAIGN_ID}/spells`;
const SPELLS = `GET /spells/?campaign_id=${CAMPAIGN_ID}`;
const LESSER = "Lesser Magic";
const DEAD = "Necromancy (Restless Dead)";
const fires = spell({ id: 1, name: "Fires of U'Zhul", type: LESSER, roll: 1, dc: 7 });
const arrows = spell({
  id: 3,
  name: "Silver Arrows of Arha",
  type: LESSER,
  roll: 3,
  dc: 7,
  description: "D6+2 arrows of light.",
});
const curse = spell({ id: 2, name: "Sorcerer's Curse", type: LESSER, roll: 6, dc: 8 });
const horror = spell({
  id: 4,
  name: "Living Horror",
  type: DEAD,
  roll: null,
  dc: "8",
  description: "A horror rises.",
});
const visage = spell({ id: 5, name: "Deathly Visage", type: DEAD, roll: 6, dc: "6" });
const awakening = spell({ id: 6, name: "Spell of Awakening", type: DEAD, roll: 1, dc: "Auto" });
// Khemri's, not ticked in this campaign
const djedhi = spell({ id: 7, name: "Spell of Ra", type: "Spells of the Djedhi", in_play: false });

/** A lore's row: its name, then its cells. */
const loreRow = (name: string) =>
  screen.findByRole("button", { name: (label) => label.startsWith(name) });
const queryLoreRow = (name: string) =>
  screen.queryByRole("button", { name: (label) => label.startsWith(name) });
const tableRows = (lore: string) =>
  within(screen.getByRole("table", { name: `${lore} spells` }))
    .getAllByRole("row")
    .map((row) => row.textContent);
const param = (app: ReturnType<typeof renderApp>, name: string) =>
  new URLSearchParams(app.location().search).get(name);

let scrolledTo: string[] = [];

beforeEach(() => {
  localStorage.clear();
  fakeApi.reset();
  fakeRealtime.reset();
  storeSession(RAIDER);
  fakeApi.on("GET /auth/me/", RAIDER);
  fakeApi.on("GET /notifications/", []);
  fakeApi.on(`GET /campaigns/${CAMPAIGN_ID}/`, campaignSummary());
  fakeApi.on(SPELLS, [horror, curse, visage, djedhi, fires, awakening, arrows]);
  scrolledTo = [];
  vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(function (this: Element) {
    scrolledTo.push(this.id);
  });
});

afterEach(() => {
  cleanupApps();
  vi.restoreAllMocks();
});

describe("The Spells page", () => {
  it("is a row per lore in play, which opens to its D6 table, a spell's row to its rules", async () => {
    const user = setupUser();
    const app = renderApp(PAGE);

    const lesser = await loreRow(LESSER);
    expect(lesser).toHaveTextContent(`${LESSER}37–8`);
    expect(await loreRow(DEAD)).toHaveTextContent(`${DEAD}36–8`);
    expect(queryLoreRow("Spells of the Djedhi")).toBeNull();
    expect(screen.getByText("2 lores, 6 spells")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Lore" })).toBeNull();

    await user.click(await loreRow(DEAD));
    expect(await loreRow(DEAD)).toHaveAttribute("aria-expanded", "true");
    expect(tableRows(DEAD)).toEqual([
      "D6SpellDifficulty",
      "1Spell of AwakeningAuto",
      "6Deathly Visage6",
      "–Living Horror8",
    ]);
    expect(param(app, "lore")).toBe(DEAD);

    await user.click(screen.getByRole("button", { name: "Living Horror" }));
    expect(screen.getByText("A horror rises.")).toBeInTheDocument();
    expect(screen.getByText(`${DEAD} · Difficulty 8`)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit spell" })).toBeInTheDocument();
    expect(param(app, "open")).toBe(String(horror.id));

    // closing the rules leaves the lore open; its row closes it
    await user.click(screen.getByRole("button", { name: "Close rules" }));
    expect(screen.queryByText("A horror rises.")).toBeNull();
    expect(param(app, "lore")).toBe(DEAD);
    await user.click(await loreRow(DEAD));
    expect(screen.queryByRole("table", { name: `${DEAD} spells` })).toBeNull();
    expect(app.location().search).toBe("");
  });

  it("searches names, lores and rules, keeping the lores with a match and their matches", async () => {
    const user = setupUser();
    renderApp(PAGE);
    await loreRow(LESSER);
    const search = screen.getByRole("searchbox", { name: "Search spells" });

    await user.type(search, "fires");
    expect(await loreRow(LESSER)).toHaveTextContent(`${LESSER}1 of 37–8`);
    expect(queryLoreRow(DEAD)).toBeNull();
    expect(screen.getByText("1 spell in 1 lore")).toBeInTheDocument();
    await user.click(await loreRow(LESSER));
    expect(tableRows(LESSER)).toEqual(["D6SpellDifficulty", "1Fires of U'Zhul7"]);

    await user.clear(search);
    await user.type(search, "arrows of light");
    expect(tableRows(LESSER)).toEqual(["D6SpellDifficulty", "3Silver Arrows of Arha7"]);

    await user.clear(search);
    await user.type(search, "restless");
    expect(await loreRow(DEAD)).toHaveTextContent(`${DEAD}3 of 36–8`);
    expect(queryLoreRow(LESSER)).toBeNull();

    await user.type(search, " nothing");
    expect(screen.getByText("No spells match.")).toBeInTheDocument();
  });

  it("lands a link's ?open= on the spell, its lore open and its rules shown, scrolled to", async () => {
    renderApp(`${PAGE}?open=${horror.id}`);

    const table = await screen.findByRole("table", { name: `${DEAD} spells` });
    expect(await loreRow(DEAD)).toHaveAttribute("aria-expanded", "true");
    expect(await loreRow(LESSER)).toHaveAttribute("aria-expanded", "false");
    expect(within(table).getByRole("button", { name: "Living Horror" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByText("A horror rises.")).toBeInTheDocument();
    await waitFor(() => expect(scrolledTo).toEqual([`ref-${horror.id}`]));
  });

  it("lands an edit on the saved spell, in the lore it moved to, scrolled to", async () => {
    // a book spell's first edit makes the campaign's version of it, which the list then holds
    const version = {
      ...horror,
      id: 40,
      campaign_id: CAMPAIGN_ID,
      replaces: horror.id,
      type: LESSER,
    };
    fakeApi.on(`PATCH /spells/${horror.id}/`, () => {
      fakeApi.on(SPELLS, [version, curse, visage, fires, awakening, arrows]);
      return version;
    });
    const user = setupUser();
    const app = renderApp(`${PAGE}?open=${horror.id}`);
    await waitFor(() => expect(scrolledTo).toEqual([`ref-${horror.id}`]));

    await user.click(await screen.findByRole("button", { name: "Edit spell" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit Spell" });
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(param(app, "open")).toBe("40"));
    await waitFor(() => expect(queryLoreRow(LESSER)).toHaveAttribute("aria-expanded", "true"));
    expect(tableRows(LESSER)).toContain("–Living Horror8");
    expect(queryLoreRow(DEAD)).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => expect(scrolledTo).toEqual([`ref-${horror.id}`, "ref-40"]));
  });

  it('asks "Discard changes?" before an edited spell\'s dialog closes, and only then', async () => {
    const user = setupUser();
    renderApp(`${PAGE}?open=${horror.id}`);
    await user.click(await screen.findByRole("button", { name: "Edit spell" }));
    let dialog = await screen.findByRole("dialog", { name: "Edit Spell" });
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull()); // nothing changed

    await user.click(screen.getByRole("button", { name: "Edit spell" }));
    dialog = await screen.findByRole("dialog", { name: "Edit Spell" });
    const name = within(dialog).getByRole("textbox", { name: /^Name/ });
    await user.clear(name);
    await user.type(name, "Living Terror");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    const ask = await screen.findByRole("dialog", { name: "Discard changes?" });
    await user.click(within(ask).getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("dialog", { name: "Edit Spell" })).toBeInTheDocument();
    expect(name).toHaveValue("Living Terror");

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    const again = await screen.findByRole("dialog", { name: "Discard changes?" });
    await user.click(within(again).getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
});
