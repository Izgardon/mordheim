/**
 * How long a catalogue list lives on the pages, with the app's own cache rules
 * (`createQueryClient` and the catalogue's 5-minute stale time): another member's write reaches
 * the page as `catalogue.changed {kind}` on the campaign's events channel, which reads that kind's
 * list again (BUG-80); your own write goes into the cached list at once and the list is then read
 * again.
 */
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryClient } from "@/lib/query-client";
import { OWNER, routeCampaignShell } from "@/test/campaign-fixtures";
import {
  ITEMS,
  LIST,
  SKILLS,
  deferred,
  item,
  routeCatalogue,
  skill,
} from "@/test/catalogue-fixtures";
import { renderCatalogueRoute } from "@/test/catalogue-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { setupUser } from "@/test/user-event";
import { CATALOGUE_STALE_TIME_MS } from "./catalogue-queries";

import type { QueryClient } from "@tanstack/react-query";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 7, email: "aldric@example.com" }, signOut: () => undefined }),
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

/** Another member's skill, saved after you opened the page. */
const dirtyFighting = skill({ id: 905, campaign_id: 1, name: "Dirty Fighting", type: "Combat" });

const EVENTS = "private-campaign-1-events";
/** Your warband's sheet, which the campaign shell holds. */
const SHEET = `GET /warbands/${OWNER.warband!.id}/sheet/`;

/** Another member's catalogue write, as the server announces it to everyone else. */
const catalogueChanged = (kind: string) =>
  act(() => fakeRealtime.emit(EVENTS, "catalogue.changed", { kind }));

/** Gives a late request the chance to start before counting. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));

let queryClient: QueryClient;

async function openSkills() {
  queryClient = createQueryClient();
  renderCatalogueRoute("/campaigns/1/skills", { queryClient });
  await screen.findByRole("row", { name: /^Quick Hands/ });
}

/** Leaves for Spells and comes back to Skills by the rail. */
async function revisitSkills(user: ReturnType<typeof setupUser>) {
  await user.click(screen.getByRole("link", { name: "Spells" }));
  await screen.findByRole("row", { name: /^Gutter Hex/ });
  await user.click(screen.getByRole("link", { name: "Skills" }));
  await screen.findByRole("row", { name: /^Quick Hands/ });
  await settle();
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell();
  routeCatalogue();
});

afterEach(() => {
  cleanup();
  queryClient?.clear();
  vi.restoreAllMocks();
});

describe("catalogue cache: other members' writes", () => {
  it("shows another member's new skill as soon as catalogue.changed {skills} arrives, reading that list and your warband's sheet, nothing else (BUG-80)", async () => {
    await openSkills();
    await waitFor(() => expect(fakeRealtime.subscriberCount(EVENTS, "catalogue.changed")).toBe(1));
    fakeApi.on(LIST.skills, [dirtyFighting, ...SKILLS]);
    fakeApi.clearRequests();

    await catalogueChanged("skills");

    expect(await screen.findByRole("row", { name: /^Dirty Fighting/ })).toBeVisible();
    await settle();
    // Units carry skills: the sheet the shell holds is read again for their current ids.
    expect([...fakeApi.calls()].sort()).toEqual([LIST.skills, SHEET].sort());
  });

  it("marks the campaign's warband sheets and stashes stale on catalogue.changed {items}, another campaign's not, and reads only what is shown", async () => {
    await openSkills();
    await waitFor(() => expect(fakeRealtime.subscriberCount(EVENTS, "catalogue.changed")).toBe(1));
    const rival = ["campaign", 1, "warband", 102, "sheet"];
    const stash = ["campaign", 1, "warband", OWNER.warband!.id, "stash"];
    const elsewhere = ["campaign", 2, "warband", 201, "sheet"];
    [rival, stash, elsewhere].forEach((key) => queryClient.setQueryData(key, {}));
    fakeApi.clearRequests();

    await catalogueChanged("items");
    await settle();

    expect(queryClient.getQueryState(rival)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(stash)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(elsewhere)?.isInvalidated).toBe(false);
    // Only your own sheet is on screen (the shell's): it alone is read again.
    expect(fakeApi.calls()).toEqual([SHEET]);
  });

  it("marks a list nobody is watching stale, so the next visit reads it; hired_swords is the Hired Swords list (BUG-80)", async () => {
    const user = setupUser();
    await openSkills();
    await waitFor(() => expect(fakeRealtime.subscriberCount(EVENTS, "catalogue.changed")).toBe(1));
    // Spells and Hired Swords were read once already (a visit), then left.
    await queryClient.prefetchQuery({
      queryKey: ["campaign", 1, "catalogue", "hired-swords"],
      queryFn: () => [],
    });
    await user.click(screen.getByRole("link", { name: "Spells" }));
    await screen.findByRole("row", { name: /^Gutter Hex/ });
    await user.click(screen.getByRole("link", { name: "Skills" }));
    await screen.findByRole("row", { name: /^Quick Hands/ });
    fakeApi.clearRequests();

    await catalogueChanged("spells");
    await catalogueChanged("hired_swords");
    await settle();

    // No list is read; only the shell's sheet, for the spells its units know.
    expect(fakeApi.calls()).toEqual([SHEET]);
    expect(queryClient.getQueryState(["campaign", 1, "catalogue", "spells"])?.isInvalidated).toBe(
      true
    );
    expect(
      queryClient.getQueryState(["campaign", 1, "catalogue", "hired-swords"])?.isInvalidated
    ).toBe(true);
    expect(queryClient.getQueryState(["campaign", 1, "catalogue", "skills"])?.isInvalidated).toBe(
      false
    );
    await user.click(screen.getByRole("link", { name: "Spells" }));
    await waitFor(() => expect(fakeApi.countOf(LIST.spells)).toBe(1));
  });

  it("reads nothing again when the window regains focus within those 5 minutes (the socket says when a list changed), and reads it after", async () => {
    await openSkills();
    fakeApi.on(LIST.skills, [dirtyFighting, ...SKILLS]);
    fakeApi.clearRequests();
    const refocus = async () => {
      act(() => {
        window.dispatchEvent(new Event("visibilitychange"));
      });
      await settle();
    };

    await refocus();
    expect(fakeApi.countOf(LIST.skills)).toBe(0);
    expect(screen.queryByText("Dirty Fighting")).toBeNull();

    vi.spyOn(Date, "now").mockReturnValue(Date.now() + CATALOGUE_STALE_TIME_MS + 1_000);
    await refocus();
    expect(fakeApi.countOf(LIST.skills)).toBe(1);
    expect(await screen.findByRole("row", { name: /^Dirty Fighting/ })).toBeVisible();
  });

  it("shows it once the 5-minute stale time has passed: the revisit reads the list again", async () => {
    const user = setupUser();
    await openSkills();
    fakeApi.on(LIST.skills, [dirtyFighting, ...SKILLS]);
    fakeApi.clearRequests();
    vi.spyOn(Date, "now").mockReturnValue(Date.now() + CATALOGUE_STALE_TIME_MS + 1_000);

    await revisitSkills(user);

    expect(fakeApi.countOf(LIST.skills)).toBe(1);
    expect(await screen.findByRole("row", { name: /^Dirty Fighting/ })).toBeVisible();
  });

  it("listens for catalogue.changed on the campaign's events channel the shell already opens: no channel of its own (BUG-80)", async () => {
    await openSkills();

    await waitFor(() => expect(fakeRealtime.subscriberCount(EVENTS, "catalogue.changed")).toBe(1));
    expect(fakeRealtime.channels()).toEqual([
      "private-campaign-1-chat",
      EVENTS,
      `private-user-${OWNER.id}-notifications`,
    ]);
  });
});

describe("catalogue cache: your own writes", () => {
  it("puts your new skill in the list at once, then reads the list again and shows what else changed", async () => {
    const user = setupUser();
    const refetch = deferred<unknown>();
    const dirtyTricks = skill({ id: 906, campaign_id: 1, name: "Dirty Tricks", type: "Speed" });
    fakeApi.on("POST /skills/", dirtyTricks);
    await openSkills();
    fakeApi.on(LIST.skills, () => refetch.promise);
    fakeApi.clearRequests();

    await user.click(screen.getByRole("button", { name: "Add skill" }));
    await user.type(screen.getByPlaceholderText("Quick Hands"), "Dirty Tricks");
    await user.click(screen.getByPlaceholderText("Search or add a list"));
    await user.click(screen.getByRole("button", { name: "Speed" }));
    await user.type(screen.getByPlaceholderText("Describe the skill."), "Sand in the eyes.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("row", { name: /^Dirty Tricks/ })).toBeVisible();
    expect(fakeApi.calls()).toEqual(["POST /skills/", LIST.skills]);
    expect(screen.queryByText("Dirty Fighting")).toBeNull();

    await act(async () => refetch.resolve([dirtyTricks, dirtyFighting, ...SKILLS]));

    expect(await screen.findByRole("row", { name: /^Dirty Fighting/ })).toBeVisible();
  });

  it("edits the book Axe into the campaign's version in its place: one Axe row before and after the list is read again (BUG-18, CAT-TWEAK-01)", async () => {
    const user = setupUser();
    const bookAxe = item({ id: 1, name: "Axe" });
    const yourAxe = item({
      id: 232,
      campaign_id: 1,
      name: "Axe",
      replaces: 1,
      availabilities: [{ id: 45, cost: 25, rarity: 2, restrictions: [], variable_cost: null }],
      book: { id: 1, name: "Axe", changes: {}, price: 5 },
    });
    const others = ITEMS.filter((entry) => entry.name !== "Axe");
    fakeApi.on(LIST.items, [bookAxe, ...others]);
    fakeApi.on("PATCH /items/1/", yourAxe);
    queryClient = createQueryClient();
    renderCatalogueRoute("/campaigns/1/items", { queryClient });
    await screen.findByRole("button", { name: /^Axe/ });
    const refetch = deferred<unknown>();
    fakeApi.on(LIST.items, () => refetch.promise);

    await user.click(
      within(screen.getByRole("button", { name: /^Axe/ })).getByRole("button", {
        name: "Edit item",
      })
    );
    const price = screen.getByDisplayValue("5");
    await user.clear(price);
    await user.type(price, "25");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Axe/ })).toHaveTextContent(/Common\s*25/)
    );
    expect(screen.getAllByRole("button", { name: /^Axe/ })).toHaveLength(1);
    expect(fakeApi.bodyOf("PATCH /items/1/")).toMatchObject({ campaign_id: 1 });

    await act(async () => refetch.resolve([yourAxe, ...others]));

    expect(screen.getAllByRole("button", { name: /^Axe/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /^Axe/ })).toHaveTextContent(/Common\s*25/);
  });
});
