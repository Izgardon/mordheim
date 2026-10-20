/**
 * The bestiary and hired-sword detail panels and the Bestiary's favourite stars, as the app mounts
 * them (layout, fake server). The panels offer only Back, even on a campaign entry viewed by
 * someone holding `edit_catalogue` (CAT-UX-02; PR C adds Edit, Revert and Delete, CAT-NEW-01).
 * A star changes at once, and a failed toggle puts it back and says why (CAT-UX-04).
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NAMELESS,
  OWNER,
  campaignFor,
  campaignSummary,
  routeCampaignShell,
} from "@/test/campaign-fixtures";
import {
  FAVOURITES,
  bestiaryDetail,
  deferred,
  hiredSwordDetail,
  pitFighter,
  routeCatalogue,
  sewerRat,
  skill,
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
  fakeApi.on("GET /hired-swords/40/", hiredSwordDetail(pitFighter));
});

describe("detail panels", () => {
  // Characterises current behaviour (CAT-UX-02, CAT-NEW-01, pinned; flips in PR C)
  it("offers only Back on the campaign's own bestiary entry, to an owner holding edit_catalogue (CAT-UX-02, pinned; flips in PR C)", async () => {
    renderCatalogueRoute("/campaigns/1/bestiary?entry=90");

    expect(await screen.findByRole("heading", { name: "Sewer Rat" })).toBeVisible();
    expect(screen.getByText("Strike to Injure")).toBeVisible();
    expect(panelButtons("Sewer Rat")).toEqual(["Back"]);
  });

  // Characterises current behaviour (CAT-UX-02, CAT-NEW-01, pinned; flips in PR C)
  it("offers only Back on the campaign's own hired sword, with its hire and upkeep (CAT-UX-02, pinned; flips in PR C)", async () => {
    renderCatalogueRoute("/campaigns/1/hired-swords?profile=40");

    expect(await screen.findByRole("heading", { name: "Pit Fighter" })).toBeVisible();
    expect(screen.getByText("35 gc")).toBeVisible();
    expect(screen.getByText("15 gc")).toBeVisible();
    expect(panelButtons("Pit Fighter")).toEqual(["Back"]);
  });

  it("reads the entry again each time it is opened: the panel caches nothing", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Sewer Rat");

    await user.click(card("Sewer Rat"));
    await screen.findByRole("heading", { name: "Sewer Rat" });
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(await screen.findByRole("button", { name: /^Sewer Rat/ }));
    await screen.findByRole("heading", { name: "Sewer Rat" });

    expect(fakeApi.countOf("GET /bestiary/90/")).toBe(2);
  });

  it("shows a failed read as its message with Back", async () => {
    fakeApi.fail("GET /bestiary/90/", new Error("Not found."));
    renderCatalogueRoute("/campaigns/1/bestiary?entry=90");

    expect(await screen.findByText("Not found.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Back" })).toBeVisible();
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
