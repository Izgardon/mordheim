/**
 * The Hired Swords and Dramatis Personae pages as the app mounts them (layout, fake server): the
 * flat catalogue rows (`race_name ?? race_label`, fees in gold or as formulas, a dramatis
 * persona's terms), the Custom and House rule badges, the empty Dramatis Personae catalogue, the
 * URL state (`q`, `entry`, `archived`), the detail panel with Edit, the Archived list with
 * Restore, and another member's `catalogue.changed`.
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  OWNER,
  PLAYER,
  campaignFor,
  campaignSummary,
  routeCampaignShell,
} from "@/test/campaign-fixtures";
import {
  HIRED_SWORDS,
  LIST,
  bertha,
  hiredSword,
  hiredSwordDetail,
  item,
  pitFighter,
  routeCatalogue,
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

const card = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });
const currentPath = () => screen.getByLabelText("Current path");
const EVENTS = "private-campaign-1-events";

/** The campaign's version of the book Ogre Bodyguard, hired for 95. */
const yourOgre = hiredSword({
  id: 73,
  campaign_id: 1,
  replaces: 17,
  hire_cost: 95,
  book: { id: 17, name: "Ogre Bodyguard", changes: { hire_cost: 80 } },
});
/** A book hired sword whose race the catalogue doesn't have: the label shows. */
const skink = hiredSword({
  id: 18,
  name: "Skink Scout",
  race_id: null,
  race_name: null,
  race_label: "Chameleon Skink",
  hire_cost: null,
  hire_cost_expression: "2D6x10",
  upkeep_cost: null,
  upkeep_cost_expression: "1 piece of wyrdstone",
  large: false,
});

function signInAsPlayer(permissions: string[]) {
  auth.user = { id: PLAYER.id, email: PLAYER.email };
  routeCampaignShell({ campaign: campaignFor("player", { permissions }), viewer: PLAYER });
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  auth.user = { id: OWNER.id, email: OWNER.email };
  routeCampaignShell({ campaign: campaignSummary() });
  routeCatalogue();
  fakeApi.on(
    "GET /hired-swords/40/",
    hiredSwordDetail(pitFighter, {
      equipment: [{ item: item({ id: 2, name: "Sword" }), quantity: 2 }],
      restrictions: [
        {
          restriction: { id: 63, type: "Warband", restriction: "Any warband except Skaven" },
          additional_note: "Humans only",
        },
      ],
    })
  );
});

describe("Hired Swords: the list", () => {
  it("shows each row's race (the label when none matched), fees in gold or as formulas, and its profile", async () => {
    fakeApi.on(LIST.hiredSwords, [...HIRED_SWORDS, skink]);
    renderCatalogueRoute("/campaigns/1/hired-swords");
    await screen.findByText("Pit Fighter");

    const ogre = card("Ogre Bodyguard");
    expect(within(ogre).getByText(/Hired sword • Ogre • Large/)).toBeVisible();
    expect(within(ogre).getByText("80 gc")).toBeVisible();
    expect(within(ogre).getByText("30 gc")).toBeVisible();
    const scout = card("Skink Scout");
    expect(within(scout).getByText(/Hired sword • Chameleon Skink/)).toBeVisible();
    expect(within(scout).getByText("2D6x10")).toBeVisible();
    expect(within(scout).getByText("1 piece of wyrdstone")).toBeVisible();
  });

  it("marks the campaign's own hired sword Custom and its version of a book one House rule; the book's carry none (CAT-NEW-03)", async () => {
    fakeApi.on(LIST.hiredSwords, [pitFighter, yourOgre, skink]);
    renderCatalogueRoute("/campaigns/1/hired-swords");
    await screen.findByText("Pit Fighter");

    expect(within(card("Pit Fighter")).getByText("Custom")).toBeVisible();
    expect(within(card("Ogre Bodyguard")).getByText("House rule")).toBeVisible();
    expect(within(card("Skink Scout")).queryByText(/custom|house rule/i)).toBeNull();
  });

  it("keeps the search and the open entry in the URL; Back and the browser's Back after another page restore it (CAT-UX-05, CAT-NEW-02)", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/hired-swords");
    await screen.findByText("Ogre Bodyguard");
    const search = () => screen.getByRole("searchbox", { name: "Search hired swords" });

    await user.type(search(), "pit");
    await user.click(card("Pit Fighter"));
    expect(currentPath()).toHaveTextContent("/campaigns/1/hired-swords?q=pit&entry=40");
    expect(await screen.findByRole("heading", { name: "Pit Fighter" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByRole("button", { name: /^Pit Fighter/ })).toBeVisible();
    expect(search()).toHaveValue("pit");
    expect(screen.queryByText("Ogre Bodyguard")).toBeNull();

    await user.click(screen.getByRole("link", { name: "Wargear" }));
    await screen.findByRole("button", { name: /^Rusty Cleaver/ });
    await user.click(screen.getByRole("button", { name: "Browser back" }));

    expect(await screen.findByRole("button", { name: /^Pit Fighter/ })).toBeVisible();
    expect(search()).toHaveValue("pit");
  });

  it("goes to the list on Back when the ?entry= link was opened fresh (BUG-150)", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/hired-swords?entry=40");
    await screen.findByRole("heading", { name: "Pit Fighter" });

    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByText("Ogre Bodyguard")).toBeVisible();
    expect(currentPath()).toHaveTextContent(/^\/campaigns\/1\/hired-swords$/);
  });

  it("says when a search matches nothing", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/hired-swords");
    await screen.findByText("Pit Fighter");

    await user.type(screen.getByRole("searchbox", { name: "Search hired swords" }), "dragon");

    expect(screen.getByText(/No hired swords match/)).toHaveTextContent(
      "No hired swords match “dragon”."
    );
  });
});

describe("the detail panel", () => {
  it("offers Edit and Back to an edit_catalogue holder, with the hire terms, the kit's quantities and the restriction's note (CAT-UX-02, flipped)", async () => {
    renderCatalogueRoute("/campaigns/1/hired-swords?entry=40");

    const heading = await screen.findByRole("heading", { name: "Pit Fighter" });
    const panel = heading.closest("div.space-y-4") as HTMLElement;
    expect(within(panel).getByText("Custom")).toBeVisible();
    expect(within(panel).getByText("35 gc")).toBeVisible();
    expect(within(panel).getByText("15 gc")).toBeVisible();
    expect(within(panel).getByText("Sword x2")).toBeVisible();
    expect(within(panel).getByText("Any warband except Skaven (Humans only)")).toBeVisible();
    expect(within(panel).getByRole("button", { name: "Edit" })).toBeVisible();
    expect(within(panel).getByRole("button", { name: "Back" })).toBeVisible();
  });

  it("offers only Back to a player without edit_catalogue", async () => {
    signInAsPlayer([]);
    renderCatalogueRoute("/campaigns/1/hired-swords?entry=40");

    await screen.findByRole("heading", { name: "Pit Fighter" });
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.getByRole("button", { name: "Back" })).toBeVisible();
  });

  it("reads an entry once, then shows it again from the cache when reopened", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/hired-swords");
    await screen.findByText("Pit Fighter");

    await user.click(card("Pit Fighter"));
    await screen.findByRole("heading", { name: "Pit Fighter" });
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(await screen.findByRole("button", { name: /^Pit Fighter/ }));
    await screen.findByRole("heading", { name: "Pit Fighter" });

    expect(fakeApi.countOf("GET /hired-swords/40/")).toBe(1);
  });

  it("reads the open entry again when another member changes hired swords (catalogue.changed hired_swords)", async () => {
    renderCatalogueRoute("/campaigns/1/hired-swords?entry=40");
    await screen.findByRole("heading", { name: "Pit Fighter" });
    await waitFor(() => expect(fakeRealtime.subscriberCount(EVENTS, "catalogue.changed")).toBe(1));
    fakeApi.on("GET /hired-swords/40/", hiredSwordDetail({ ...pitFighter, hire_cost: 45 }));

    act(() => fakeRealtime.emit(EVENTS, "catalogue.changed", { kind: "hired_swords" }));

    expect(await screen.findByText("45 gc")).toBeVisible();
    expect(fakeApi.countOf("GET /hired-swords/40/")).toBe(2);
  });
});

describe("Dramatis Personae", () => {
  it("has its own page beside Hired Swords, empty until the campaign adds one, saying what a dramatis persona is and how to add one", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/hired-swords");
    await screen.findByText("Pit Fighter");

    await user.click(screen.getByRole("link", { name: "Dramatis Personae" }));

    const title = await screen.findByText("No dramatis personae yet");
    const empty = title.closest("[role=status]") as HTMLElement;
    expect(title).toBeVisible();
    expect(empty).toHaveTextContent(/one of a kind: found after a battle/);
    expect(empty).toHaveTextContent("Add your campaign's own with Add dramatis persona.");
    expect(screen.getByRole("button", { name: "Add dramatis persona" })).toBeVisible();
    expect(fakeApi.countOf(LIST.dramatisPersonae)).toBe(1);
  });

  it("offers a player without edit_catalogue the empty catalogue without Add or the hint", async () => {
    signInAsPlayer([]);
    renderCatalogueRoute("/campaigns/1/dramatis-personae");

    expect(await screen.findByText("No dramatis personae yet")).toBeVisible();
    expect(screen.queryByText(/Add your campaign's own/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Add dramatis persona" })).toBeNull();
  });

  it("shows a dramatis persona's terms: one battle, what he is paid in, and a fee that isn't gold", async () => {
    fakeApi.on(LIST.dramatisPersonae, [bertha]);
    renderCatalogueRoute("/campaigns/1/dramatis-personae");

    const persona = await screen.findByRole("button", { name: /^Bertha Bestraufrung/ });
    expect(within(persona).getByText(/Dramatis persona • Human • Priest/)).toBeVisible();
    expect(within(persona).getByText("One battle · Paid in 25 gc or 1 shard")).toBeVisible();
    expect(within(persona).getByText("2 Treasure")).toBeVisible();
  });

  it("reads its list again when another member changes it (catalogue.changed dramatis_personae)", async () => {
    renderCatalogueRoute("/campaigns/1/dramatis-personae");
    await screen.findByText("No dramatis personae yet");
    await waitFor(() => expect(fakeRealtime.subscriberCount(EVENTS, "catalogue.changed")).toBe(1));
    fakeApi.on(LIST.dramatisPersonae, [bertha]);

    act(() => fakeRealtime.emit(EVENTS, "catalogue.changed", { kind: "dramatis_personae" }));

    expect(await screen.findByRole("button", { name: /^Bertha Bestraufrung/ })).toBeVisible();
    expect(fakeApi.countOf(LIST.dramatisPersonae)).toBe(2);
  });
});

describe("the Archived list (CAT-TWEAK-04, CAT-NEW-05)", () => {
  const ARCHIVED = `${LIST.hiredSwords}&archived=1`;
  const oldPitFighter = { ...pitFighter, archived_at: "2026-10-20T10:00:00Z" };
  const removedOgre = { ...hiredSword(), archived_at: "2026-10-20T11:00:00Z" };

  beforeEach(() => {
    fakeApi.on(ARCHIVED, [oldPitFighter, removedOgre, skink]);
  });

  it("lists only what is archived or removed, from ?archived=1, with Restore and no Add", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/hired-swords");
    await screen.findByText("Pit Fighter");

    await user.click(screen.getByRole("checkbox", { name: "Archived" }));

    const archived = await screen.findByRole("article", { name: "Pit Fighter" });
    expect(currentPath()).toHaveTextContent("/campaigns/1/hired-swords?archived=1");
    expect(within(archived).getByText("Archived")).toBeVisible();
    expect(screen.queryByText("Skink Scout")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add hired sword" })).toBeNull();
    expect(screen.getByRole("button", { name: "Restore Ogre Bodyguard" })).toBeVisible();
  });

  it("restores a book hired sword removed for the campaign by naming the campaign", async () => {
    const user = setupUser();
    fakeApi.on("POST /hired-swords/17/restore/", hiredSwordDetail(hiredSword()));
    renderCatalogueRoute("/campaigns/1/hired-swords?archived=1");
    await screen.findByRole("article", { name: "Ogre Bodyguard" });

    await user.click(screen.getByRole("button", { name: "Restore Ogre Bodyguard" }));

    expect(await screen.findByText("Ogre Bodyguard restored.")).toBeVisible();
    expect(fakeApi.bodyOf("POST /hired-swords/17/restore/")).toEqual({ campaign_id: 1 });
  });

  it("says Nothing archived when nothing is", async () => {
    fakeApi.on(`${LIST.dramatisPersonae}&archived=1`, []);
    renderCatalogueRoute("/campaigns/1/dramatis-personae?archived=1");

    expect(await screen.findByText("Nothing archived.")).toBeVisible();
  });
});
