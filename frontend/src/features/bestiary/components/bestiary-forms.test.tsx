/**
 * The bestiary form (`useBestiaryEntryForm`), on the Bestiary as the app mounts it (layout, fake
 * server), with pass 5's catalogue behaviour (CAT-NEW-01): Add sends the kind, the profile and the
 * links; Edit on a book beast sends the campaign and its answer, the campaign's version, takes the
 * book beast's place in the list and the open panel; Revert goes back; Delete asks what holds the
 * beast's item first; a taken name lists its matches with "Edit this instead"; refusals show by
 * their fields. A beast's Animal item is written with it, so the items list is read again.
 */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OWNER, campaignSummary, routeCampaignShell } from "@/test/campaign-fixtures";
import {
  BESTIARY,
  LIST,
  type Listed,
  bestiaryDetail,
  bestiaryEntry,
  item,
  routeCatalogue,
  sewerRat,
  skill,
  warhorse,
} from "@/test/catalogue-fixtures";
import { renderCatalogueRoute } from "@/test/catalogue-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { expectFieldError, nameMatch, nameTaken, validationError } from "@/test/refusals";
import { setupUser } from "@/test/user-event";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));
vi.mock("@/lib/realtime/client", async () => (await import("@/test/fake-realtime")).fakeClient);
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: OWNER.id, email: OWNER.email }, signOut: () => undefined }),
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

const sword = item({ id: 2, name: "Sword" });
/** The book Warhorse with its links: a skill and barding. */
const horseDetail = bestiaryDetail(warhorse, {
  skills: [skill()],
  equipment: [{ item: sword, quantity: 2 }],
});
/** The campaign's version of it, with M 9. */
const yourHorse = bestiaryDetail(
  bestiaryEntry({
    ...warhorse,
    id: 34,
    campaign_id: 1,
    replaces: 6,
    movement: 9,
    book: { id: 6, name: "Warhorse", changes: { movement: 8 } },
  }),
  { skills: [skill()], equipment: [{ item: sword, quantity: 2 }] }
);

const dialog = () => screen.getByRole("dialog");
const field = (label: string) => within(dialog()).getByLabelText(label);
const currentPath = () => screen.getByLabelText("Current path");

async function type(user: ReturnType<typeof setupUser>, label: string, value: string) {
  await user.clear(field(label));
  await user.type(field(label), value);
}

/** A list route whose answer a write changes, as the server's would (`list.now`). */
function serverList<T>(route: string, initial: T[]): Listed<T> {
  const list = { now: initial };
  fakeApi.on(route, () => list.now);
  return list;
}

/** Picks `name` from the picker whose search box reads `placeholder`. */
async function pick(user: ReturnType<typeof setupUser>, placeholder: string, name: string) {
  await user.click(within(dialog()).getByPlaceholderText(placeholder));
  await user.click(await within(dialog()).findByRole("button", { name: new RegExp(`^${name}`) }));
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell({ campaign: campaignSummary() });
  routeCatalogue();
  fakeApi.on("GET /bestiary/6/", horseDetail);
  fakeApi.on("GET /bestiary/34/", yourHorse);
  fakeApi.on("GET /bestiary/90/", bestiaryDetail(sewerRat));
});

describe("Add", () => {
  it("POSTs the kind, the profile and the links, shows the new beast, and reads the items list again for its item", async () => {
    const user = setupUser();
    const hound = bestiaryDetail(bestiaryEntry({ id: 95, campaign_id: 1, name: "Sewer Hound" }));
    const list = serverList(LIST.bestiary, BESTIARY);
    fakeApi.on("POST /bestiary/", () => {
      list.now = [hound, ...BESTIARY];
      return hound;
    });
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Sewer Rat");

    await user.click(screen.getByRole("button", { name: "Add entry" }));
    expect(await screen.findByRole("dialog", { name: "Add bestiary entry" })).toBeVisible();
    expect(within(dialog()).getByRole("radio", { name: "Creature" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    await user.click(within(dialog()).getByRole("radio", { name: "Mount" }));
    await type(user, "Name", "Sewer Hound");
    await type(user, "M", "6");
    await type(user, "S", "4");
    await type(user, "Armour save", "5");
    await pick(user, "Search special rules...", "Leader");
    await pick(user, "Search skills...", "Strike to Injure");
    await pick(user, "Search items...", "Sword");
    fireEvent.change(field("Quantity for Sword"), { target: { value: "2" } });
    await user.click(within(dialog()).getByLabelText("Large target"));
    const itemReads = fakeApi.countOf(LIST.items);
    await user.click(within(dialog()).getByRole("button", { name: "Create" }));

    await waitFor(() => expect(fakeApi.countOf("POST /bestiary/")).toBe(1));
    expect(fakeApi.bodyOf("POST /bestiary/")).toEqual({
      campaign_id: 1,
      kind: "mount",
      name: "Sewer Hound",
      description: "",
      movement: 6,
      weapon_skill: 0,
      ballistic_skill: 0,
      strength: 4,
      toughness: 0,
      wounds: 1,
      initiative: 0,
      attacks: 1,
      leadership: 0,
      armour_save: 5,
      large: true,
      caster: "No",
      has_profile: true,
      gains_xp: false,
      rating_bonus: null,
      available_in_shop: false,
      item: { availabilities: [] },
      special_ids: [401],
      skill_ids: [205],
      spell_ids: [],
      item_entries: [{ item_id: 2, quantity: 2 }],
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: /^Sewer Hound/ })).toBeVisible();
    await waitFor(() => expect(fakeApi.countOf(LIST.items)).toBeGreaterThan(itemReads));
  });

  it("starts a new beast on the kind the page shows", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/bestiary?kind=pet");
    await screen.findByText("Raven");

    await user.click(screen.getByRole("button", { name: "Add entry" }));

    await screen.findByRole("dialog", { name: "Add bestiary entry" });
    expect(within(dialog()).getByRole("radio", { name: "Pet" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  it('creates a special on the spot typed "Animal" and links it', async () => {
    const user = setupUser();
    fakeApi.on("POST /special/", {
      id: 450,
      campaign_id: 1,
      name: "Mange",
      type: "Animal",
      description: "Itchy.",
    });
    renderCatalogueRoute("/campaigns/1/bestiary");
    await user.click(await screen.findByRole("button", { name: "Add entry" }));
    await screen.findByRole("dialog");

    await user.type(within(dialog()).getByPlaceholderText("Search special rules..."), "Mange");
    await user.click(within(dialog()).getByRole("button", { name: /Create new rule/ }));
    await user.type(within(dialog()).getByPlaceholderText("Description (optional)"), "Itchy.");
    await user.click(within(dialog()).getByRole("button", { name: "Add rule" }));

    await within(dialog()).findByRole("button", { name: "Remove Mange" });
    expect(fakeApi.bodyOf("POST /special/")).toEqual({
      campaign_id: 1,
      name: "Mange",
      type: "Animal",
      description: "Itchy.",
    });
  });
});

describe("Edit, Revert and Delete (CAT-NEW-01)", () => {
  it("edits a book beast from its panel: the form holds its values and links, the PATCH names the campaign, and its version takes its place", async () => {
    const user = setupUser();
    const list = serverList(LIST.bestiary, BESTIARY);
    fakeApi.on("PATCH /bestiary/6/", () => {
      list.now = BESTIARY.map((entry) => (entry.id === 6 ? yourHorse : entry));
      return yourHorse;
    });
    renderCatalogueRoute("/campaigns/1/bestiary?entry=6");
    await screen.findByRole("heading", { name: "Warhorse" });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("dialog", { name: "Edit bestiary entry" })).toBeVisible();
    expect(field("Name")).toHaveValue("Warhorse");
    expect(within(dialog()).getByRole("radio", { name: "Mount" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(field("Quantity for Sword")).toHaveValue(2);
    expect(within(dialog()).getByText("Strike to Injure")).toBeVisible();
    await type(user, "M", "9");
    await user.click(within(dialog()).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fakeApi.countOf("PATCH /bestiary/6/")).toBe(1));
    expect(fakeApi.bodyOf("PATCH /bestiary/6/")).toMatchObject({
      campaign_id: 1,
      kind: "mount",
      name: "Warhorse",
      movement: 9,
      skill_ids: [205],
      item_entries: [{ item_id: 2, quantity: 2 }],
    });
    // The panel follows the version, from the write's answer: nothing is read for it.
    await waitFor(() => expect(currentPath()).toHaveTextContent("bestiary?entry=34"));
    expect(await screen.findByText("House rule")).toBeVisible();
    expect(fakeApi.countOf("GET /bestiary/34/")).toBe(0);

    await user.click(screen.getByRole("button", { name: "Back" }));
    const horses = await screen.findAllByRole("button", { name: /^Warhorse/ });
    expect(horses).toHaveLength(1);
    expect(within(horses[0]).getByText("House rule")).toBeVisible();
  });

  it("edits the campaign's own beast without naming the campaign", async () => {
    const user = setupUser();
    fakeApi.on("PATCH /bestiary/90/", bestiaryDetail({ ...sewerRat, movement: 7 }));
    renderCatalogueRoute("/campaigns/1/bestiary?entry=90");
    await screen.findByRole("heading", { name: "Sewer Rat" });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog", { name: "Edit bestiary entry" });
    await type(user, "M", "7");
    await user.click(within(dialog()).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fakeApi.countOf("PATCH /bestiary/90/")).toBe(1));
    expect(fakeApi.bodyOf("PATCH /bestiary/90/")).not.toHaveProperty("campaign_id");
    expect(fakeApi.bodyOf("PATCH /bestiary/90/")).toMatchObject({ movement: 7 });
  });

  it("reverts a version to the book: the confirm says what goes back, and the panel shows the book beast", async () => {
    const user = setupUser();
    fakeApi.on("POST /bestiary/34/revert/", horseDetail);
    renderCatalogueRoute("/campaigns/1/bestiary?entry=34");
    await screen.findByRole("heading", { name: "Warhorse" });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog", { name: "Edit bestiary entry" });
    expect(within(dialog()).queryByRole("button", { name: /^(Delete|Remove)$/ })).toBeNull();
    await user.click(within(dialog()).getByRole("button", { name: "Revert to book" }));
    const confirm = await screen.findByRole("dialog", { name: "Revert to book" });
    expect(confirm).toHaveTextContent("Every Warhorse in the campaign goes back to the book.");
    await user.click(within(confirm).getByRole("button", { name: "Revert" }));

    await waitFor(() => expect(currentPath()).toHaveTextContent("bestiary?entry=6"));
    expect(fakeApi.requests().find((request) => request.path.endsWith("revert/"))).toEqual({
      method: "POST",
      path: "/bestiary/34/revert/",
    });
    expect(await screen.findByRole("heading", { name: "Warhorse" })).toBeVisible();
    expect(screen.queryByText("House rule")).toBeNull();
    // The answer is the book beast's detail: the panel shows it without reading it.
    expect(fakeApi.countOf("GET /bestiary/6/")).toBe(0);
  });

  it("deletes an unused custom beast for good after asking what holds it, and closes its panel", async () => {
    const user = setupUser();
    const list = serverList(LIST.bestiary, BESTIARY);
    fakeApi.on("GET /bestiary/90/usage/", { units: 0, warbands: 0, stashes: 0 });
    fakeApi.on("DELETE /bestiary/90/", () => {
      list.now = BESTIARY.filter((entry) => entry.id !== 90);
      return null;
    });
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Sewer Rat");
    await user.click(screen.getByRole("button", { name: /^Sewer Rat/ }));
    await screen.findByRole("heading", { name: "Sewer Rat" });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog", { name: "Edit bestiary entry" });
    await user.click(within(dialog()).getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete bestiary entry" });
    await waitFor(() =>
      expect(confirm).toHaveTextContent(
        "Delete Sewer Rat? Nothing uses it, so it is deleted for good."
      )
    );
    await user.click(within(confirm).getByRole("button", { name: "Delete bestiary entry" }));

    await waitFor(() => expect(fakeApi.countOf("DELETE /bestiary/90/")).toBe(1));
    await waitFor(() => expect(currentPath()).toHaveTextContent(/^\/campaigns\/1\/bestiary$/));
    expect(await screen.findByText("Warhound")).toBeVisible();
    expect(screen.queryByText("Sewer Rat")).toBeNull();
  });

  it("archives a custom beast whose item a unit holds, saying so, and keeps its copies", async () => {
    const user = setupUser();
    const usage = { units: 1, warbands: 1, stashes: 0 };
    fakeApi.on("GET /bestiary/90/usage/", usage);
    fakeApi.on("DELETE /bestiary/90/", { outcome: "archived", usage });
    renderCatalogueRoute("/campaigns/1/bestiary?entry=90");
    await screen.findByRole("heading", { name: "Sewer Rat" });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog", { name: "Edit bestiary entry" });
    await user.click(within(dialog()).getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete bestiary entry" });
    await waitFor(() => expect(confirm).toHaveTextContent(/1 unit in 1 warband/));
    await user.click(within(confirm).getByRole("button", { name: /bestiary entry$/ }));

    expect(await screen.findByText("Sewer Rat archived; its copies stay.")).toBeVisible();
  });

  it("removes a book beast from this campaign only", async () => {
    const user = setupUser();
    const usage = { units: 0, warbands: 0, stashes: 0, hired_swords: 0, dramatis_personae: 0 };
    fakeApi.on("GET /bestiary/6/usage/?campaign_id=1", usage);
    fakeApi.on("DELETE /bestiary/6/?campaign_id=1", { outcome: "removed", usage });
    renderCatalogueRoute("/campaigns/1/bestiary?entry=6");
    await screen.findByRole("heading", { name: "Warhorse" });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog", { name: "Edit bestiary entry" });
    await user.click(within(dialog()).getByRole("button", { name: "Remove" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete bestiary entry" });
    await waitFor(() =>
      expect(confirm).toHaveTextContent(
        "Remove Warhorse from this campaign only? The book and other campaigns keep it."
      )
    );
    await user.click(within(confirm).getByRole("button", { name: "Remove bestiary entry" }));

    expect(await screen.findByText("Warhorse removed from this campaign.")).toBeVisible();
    expect(fakeApi.countOf("DELETE /bestiary/6/?campaign_id=1")).toBe(1);
  });
});

describe("refusals", () => {
  it("lists a taken name's matches, and Edit this instead opens the matched beast in the form", async () => {
    const user = setupUser();
    const taken = nameTaken("Warhorse", [
      nameMatch({ kind: "bestiary", id: 6, name: "Warhorse", source: "book" }),
    ]);
    fakeApi.fail("POST /bestiary/", taken.error);
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Sewer Rat");
    await user.click(screen.getByRole("button", { name: "Add entry" }));
    await screen.findByRole("dialog", { name: "Add bestiary entry" });

    await type(user, "Name", "warhorse");
    await user.click(within(dialog()).getByRole("button", { name: "Create" }));

    await expectFieldError(field("Name"), taken.detail, { describedBy: true });
    expect(within(dialog()).getByText("Warhorse · book")).toBeVisible();
    await user.click(
      within(dialog()).getByRole("button", { name: "Edit the book Warhorse instead" })
    );

    expect(await screen.findByRole("dialog", { name: "Edit bestiary entry" })).toBeVisible();
    await waitFor(() => expect(field("Name")).toHaveValue("Warhorse"));
    expect(field("M")).toHaveValue(8);
  });

  it("names this campaign's match and the book's apart for screen readers", async () => {
    // Was: both were "Edit Warhorse instead".
    const user = setupUser();
    const taken = nameTaken("Warhorse", [
      nameMatch({ kind: "bestiary", id: 32, name: "Warhorse", source: "campaign" }),
      nameMatch({ kind: "bestiary", id: 6, name: "Warhorse", source: "book" }),
    ]);
    fakeApi.fail("POST /bestiary/", taken.error);
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Sewer Rat");
    await user.click(screen.getByRole("button", { name: "Add entry" }));
    await screen.findByRole("dialog", { name: "Add bestiary entry" });

    await type(user, "Name", "warhorse");
    await user.click(within(dialog()).getByRole("button", { name: "Create" }));

    await expectFieldError(field("Name"), taken.detail, { describedBy: true });
    const [campaign, book] = within(dialog()).getAllByRole("listitem");
    expect(campaign).toHaveTextContent("Warhorse · this campaign");
    expect(
      within(campaign).getByRole("button", { name: "Edit this campaign's Warhorse instead" })
    ).toBeVisible();
    expect(book).toHaveTextContent("Warhorse · book");
    expect(
      within(book).getByRole("button", { name: "Edit the book Warhorse instead" })
    ).toBeVisible();
  });

  it("shows a refused armour save under the stats and a refused kit under the equipment, keeping the form open", async () => {
    const user = setupUser();
    const kit = 'Invalid pk "999" - object does not exist.';
    fakeApi.fail(
      "POST /bestiary/",
      validationError({
        armour_save: ["Ensure this value is less than or equal to 6."],
        item_entries: [kit],
      })
    );
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Sewer Rat");
    await user.click(screen.getByRole("button", { name: "Add entry" }));
    await screen.findByRole("dialog");

    await type(user, "Name", "Sewer Hound");
    await user.click(within(dialog()).getByRole("button", { name: "Create" }));

    expect(
      await within(dialog()).findByText("Ensure this value is less than or equal to 6.")
    ).toBeVisible();
    expect(within(dialog()).getByText(kit)).toBeVisible();
    expect(screen.getByRole("dialog", { name: "Add bestiary entry" })).toBeVisible();
  });
});
