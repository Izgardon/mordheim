/**
 * The bestiary detail panel, the Archived list and the Bestiary's favourite stars, as the app
 * mounts them (layout, fake server). The panel offers Edit to `edit_catalogue` holders on book
 * and custom beasts alike (CAT-UX-02, CAT-NEW-01), is read once and cached, reads again on another
 * member's `catalogue.changed`, and follows another member's first edit or Revert.
 * A star changes at once, and a failed toggle puts it back and says why (CAT-UX-04).
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import {
  NAMELESS,
  OWNER,
  PLAYER,
  campaignFor,
  campaignSummary,
  routeCampaignShell,
} from "@/test/campaign-fixtures";
import {
  BESTIARY,
  FAVOURITES,
  LIST,
  bestiaryDetail,
  bestiaryEntry,
  deferred,
  routeCatalogue,
  sewerRat,
  skill,
  warhorse,
} from "@/test/catalogue-fixtures";
import { renderCatalogueRoute } from "@/test/catalogue-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
const auth = vi.hoisted(() => ({
  user: { id: 7, email: "aldric@example.com" },
  signOut: () => undefined,
}));
vi.mock("@/features/auth/hooks/use-auth", () => ({ useAuth: () => auth }));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

const EVENTS = "private-campaign-1-events";
const currentPath = () => screen.getByLabelText("Current path");
/** The campaign's version of the book Warhorse, with M 9. */
const yourHorse = bestiaryEntry({
  ...warhorse,
  id: 34,
  campaign_id: 1,
  replaces: 6,
  movement: 9,
  book: { id: 6, name: "Warhorse", changes: { movement: 8 } },
});
/** Signs in as Mira, a player whose campaign payload carries `permissions`. */
function signInAsPlayer(permissions: string[]) {
  auth.user = { id: PLAYER.id, email: PLAYER.email };
  routeCampaignShell({ campaign: campaignFor("player", { permissions }), viewer: PLAYER });
}

const ADD_FAVOURITE = `POST /warbands/${OWNER.warband!.id}/bestiary-favourites/`;
const REMOVE_FAVOURITE = `DELETE /warbands/${OWNER.warband!.id}/bestiary-favourites/90/`;
const card = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });
const star = (name: string) => within(card(name)).getByRole("button", { name: /favourites$/ });

/** Every button inside the detail panel headed `name`. */
const panelButtons = (name: string) => {
  const panel = screen.getByRole("heading", { name }).closest("div.space-y-4") as HTMLElement;
  return within(panel)
    .getAllByRole("button")
    .map((button) => button.textContent);
};

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  auth.user = { id: OWNER.id, email: OWNER.email };
  routeCampaignShell({ campaign: campaignSummary() });
  routeCatalogue();
  fakeApi.on(
    "GET /bestiary/90/",
    bestiaryDetail(sewerRat, { skills: [{ ...skill(), type: "Combat" }] })
  );
});

describe("detail panels", () => {
  it("offers Edit and Back on the campaign's own beast, with its Custom badge, to an owner holding edit_catalogue (CAT-UX-02, CAT-NEW-01, flipped)", async () => {
    renderCatalogueRoute("/campaigns/1/bestiary?entry=90");

    expect(await screen.findByRole("heading", { name: "Sewer Rat" })).toBeVisible();
    expect(screen.getByText("Strike to Injure")).toBeVisible();
    expect(screen.getByText("Custom")).toBeVisible();
    expect(panelButtons("Sewer Rat")).toEqual(["Edit", "Back"]);
  });

  it("offers Edit on a book beast too (its first save makes the campaign's version)", async () => {
    fakeApi.on("GET /bestiary/6/", bestiaryDetail(warhorse));
    renderCatalogueRoute("/campaigns/1/bestiary?entry=6");

    await screen.findByRole("heading", { name: "Warhorse" });
    expect(panelButtons("Warhorse")).toEqual(["Edit", "Back"]);
  });

  it("offers only Back to a player without edit_catalogue", async () => {
    signInAsPlayer([]);
    renderCatalogueRoute("/campaigns/1/bestiary?entry=90");

    await screen.findByRole("heading", { name: "Sewer Rat" });
    expect(panelButtons("Sewer Rat")).toEqual(["Back"]);
  });

  it("reads a beast once, then shows it again from the cache when reopened (flipped: it read on every open)", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Sewer Rat");

    await user.click(card("Sewer Rat"));
    await screen.findByRole("heading", { name: "Sewer Rat" });
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(await screen.findByRole("button", { name: /^Sewer Rat/ }));
    await screen.findByRole("heading", { name: "Sewer Rat" });

    expect(fakeApi.countOf("GET /bestiary/90/")).toBe(1);
  });

  it("reads the open beast again when another member changes the bestiary (catalogue.changed bestiary)", async () => {
    renderCatalogueRoute("/campaigns/1/bestiary?entry=90");
    await screen.findByRole("heading", { name: "Sewer Rat" });
    await waitFor(() => expect(fakeRealtime.subscriberCount(EVENTS, "catalogue.changed")).toBe(1));
    fakeApi.on("GET /bestiary/90/", bestiaryDetail({ ...sewerRat, description: "Bites harder." }));

    act(() => fakeRealtime.emit(EVENTS, "catalogue.changed", { kind: "bestiary" }));

    expect(await screen.findByText("Bites harder.")).toBeVisible();
    expect(fakeApi.countOf("GET /bestiary/90/")).toBe(2);
  });

  it("follows the campaign's version when another member's first edit of the open book beast makes one", async () => {
    fakeApi.on("GET /bestiary/6/", bestiaryDetail(warhorse));
    renderCatalogueRoute("/campaigns/1/bestiary?entry=6");
    await screen.findByRole("heading", { name: "Warhorse" });
    await waitFor(() => expect(fakeRealtime.subscriberCount(EVENTS, "catalogue.changed")).toBe(1));
    fakeApi.on(
      LIST.bestiary,
      BESTIARY.map((entry) => (entry.id === 6 ? yourHorse : entry))
    );
    fakeApi.on("GET /bestiary/34/", bestiaryDetail(yourHorse));

    act(() => fakeRealtime.emit(EVENTS, "catalogue.changed", { kind: "bestiary" }));

    expect(await screen.findByText("House rule")).toBeVisible();
    expect(currentPath()).toHaveTextContent("/campaigns/1/bestiary?entry=34");
  });

  it("goes back to the book beast when another member reverts the open version", async () => {
    fakeApi.on(
      LIST.bestiary,
      BESTIARY.map((entry) => (entry.id === 6 ? yourHorse : entry))
    );
    fakeApi.on("GET /bestiary/34/", bestiaryDetail(yourHorse));
    renderCatalogueRoute("/campaigns/1/bestiary?entry=34");
    await screen.findByText("House rule");
    await waitFor(() => expect(fakeRealtime.subscriberCount(EVENTS, "catalogue.changed")).toBe(1));
    fakeApi.on(LIST.bestiary, BESTIARY);
    fakeApi.fail("GET /bestiary/34/", new ApiError("Not found", 404, { detail: "Not found" }));
    fakeApi.on("GET /bestiary/6/", bestiaryDetail(warhorse));

    act(() => fakeRealtime.emit(EVENTS, "catalogue.changed", { kind: "bestiary" }));

    await waitFor(() => expect(currentPath()).toHaveTextContent("/campaigns/1/bestiary?entry=6"));
    expect(await screen.findByRole("heading", { name: "Warhorse" })).toBeVisible();
    expect(screen.queryByText("House rule")).toBeNull();
  });

  it("shows a failed read as its message with Back", async () => {
    fakeApi.fail("GET /bestiary/90/", new Error("Not found."));
    renderCatalogueRoute("/campaigns/1/bestiary?entry=90");

    expect(await screen.findByText("Not found.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Back" })).toBeVisible();
  });
});

describe("the Archived list (CAT-TWEAK-04, CAT-NEW-05)", () => {
  const ARCHIVED = `${LIST.bestiary}&archived=1`;
  const oldRat = { ...sewerRat, archived_at: "2026-10-20T10:00:00Z" };
  const removedHorse = { ...warhorse, archived_at: "2026-10-20T11:00:00Z" };

  beforeEach(() => {
    fakeApi.on(ARCHIVED, [oldRat, removedHorse, bestiaryEntry()]);
  });

  it("lists only what is archived or removed, from ?archived=1, with Restore and no Add", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Sewer Rat");

    await user.click(screen.getByRole("checkbox", { name: "Archived" }));

    const archived = await screen.findByRole("article", { name: "Sewer Rat" });
    expect(currentPath()).toHaveTextContent("/campaigns/1/bestiary?archived=1");
    expect(within(archived).getByText("Archived")).toBeVisible();
    expect(screen.queryByText("Warhound")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add entry" })).toBeNull();
    expect(screen.getByRole("button", { name: "Restore Warhorse" })).toBeVisible();
  });

  it("restores a book beast removed for the campaign by naming the campaign", async () => {
    const user = setupUser();
    fakeApi.on("POST /bestiary/6/restore/", bestiaryDetail(warhorse));
    renderCatalogueRoute("/campaigns/1/bestiary?archived=1");
    await screen.findByRole("article", { name: "Warhorse" });

    await user.click(screen.getByRole("button", { name: "Restore Warhorse" }));

    expect(await screen.findByText("Warhorse restored.")).toBeVisible();
    expect(fakeApi.bodyOf("POST /bestiary/6/restore/")).toEqual({ campaign_id: 1 });
  });

  it("says Nothing archived when nothing is", async () => {
    fakeApi.on(ARCHIVED, []);
    renderCatalogueRoute("/campaigns/1/bestiary?archived=1");

    expect(await screen.findByText("Nothing archived.")).toBeVisible();
  });
});

describe("favourite stars", () => {
  /** Opens the Bestiary and waits for your warband (the stars) and its favourites. */
  async function openBestiary() {
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Sewer Rat");
    await within(card("Sewer Rat")).findByRole("button", { name: /favourites$/ });
    await waitFor(() => expect(fakeApi.countOf(FAVOURITES)).toBe(1));
    await act(async () => undefined);
  }

  it("reads your warband's favourites and stars only them", async () => {
    fakeApi.on(FAVOURITES, [sewerRat]);

    await openBestiary();

    expect(
      await within(card("Sewer Rat")).findByRole("button", { name: "Remove from favourites" })
    ).toHaveTextContent("★");
    expect(star("Warhound")).toHaveAccessibleName("Add to favourites");
    expect(fakeApi.countOf(FAVOURITES)).toBe(1);
  });

  it("fills the star at once, keeps it when the server answers, and empties it with a DELETE (CAT-UX-04)", async () => {
    const user = setupUser();
    const answer = deferred<void>();
    fakeApi.on(ADD_FAVOURITE, () => answer.promise);
    fakeApi.on(REMOVE_FAVOURITE, undefined);
    await openBestiary();

    await user.click(star("Sewer Rat"));
    expect(fakeApi.bodyOf(ADD_FAVOURITE)).toEqual({ bestiary_entry_id: 90 });
    expect(star("Sewer Rat")).toHaveAccessibleName("Remove from favourites");
    await act(async () => answer.resolve(undefined));
    expect(star("Sewer Rat")).toHaveAccessibleName("Remove from favourites");

    await user.click(star("Sewer Rat"));
    expect(fakeApi.countOf(REMOVE_FAVOURITE)).toBe(1);
    expect(star("Sewer Rat")).toHaveAccessibleName("Add to favourites");
  });

  it("puts a star back when its write fails, and says why (CAT-UX-04)", async () => {
    const user = setupUser();
    const answer = deferred<void>();
    fakeApi.on(ADD_FAVOURITE, () => answer.promise);
    await openBestiary();

    await user.click(star("Sewer Rat"));
    expect(star("Sewer Rat")).toHaveAccessibleName("Remove from favourites");
    await act(async () => answer.reject(new Error("Server error")));

    expect(star("Sewer Rat")).toHaveAccessibleName("Add to favourites");
    expect(await screen.findByText("Couldn't add Sewer Rat to favourites.")).toBeVisible();
    expect(screen.getByText("Server error")).toBeVisible();
    expect(fakeApi.countOf(ADD_FAVOURITE)).toBe(1);
  });

  it("refills a star whose removal fails", async () => {
    const user = setupUser();
    fakeApi.on(FAVOURITES, [sewerRat]);
    fakeApi.fail(REMOVE_FAVOURITE, new Error("Server error"));
    await openBestiary();
    await within(card("Sewer Rat")).findByRole("button", { name: "Remove from favourites" });

    await user.click(star("Sewer Rat"));

    expect(await screen.findByText("Couldn't remove Sewer Rat from favourites.")).toBeVisible();
    expect(star("Sewer Rat")).toHaveAccessibleName("Remove from favourites");
  });

  it("reads the favourites again on every visit (an effect, not a cached query)", async () => {
    const user = setupUser();
    await openBestiary();

    await user.click(screen.getByRole("link", { name: "Wargear" }));
    await screen.findByRole("button", { name: /^Rusty Cleaver/ });
    await user.click(screen.getByRole("link", { name: "Bestiary" }));
    await screen.findByText("Sewer Rat");

    await waitFor(() => expect(fakeApi.countOf(FAVOURITES)).toBe(2));
  });

  it("shows no stars, and reads no favourites, for a member without a warband", async () => {
    auth.user = { id: NAMELESS.id, email: NAMELESS.email };
    routeCampaignShell({ campaign: campaignFor("player"), viewer: NAMELESS });

    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Sewer Rat");
    await waitFor(() => expect(fakeApi.countOf("GET /warbands/?campaign_id=1")).toBe(1));
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));

    expect(within(card("Sewer Rat")).queryByRole("button", { name: /favourites$/ })).toBeNull();
    expect(fakeApi.calls().some((call) => call.includes("bestiary-favourites"))).toBe(false);
  });
});
