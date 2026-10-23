/**
 * The hired-sword and dramatis-persona form (`useHirelingProfileForm`), on its pages as the app
 * mounts them (layout, fake server): Add sends the whole entry (race and label, fees and formulas,
 * rating, skill lists, profile, kit with quantities, restrictions with notes, a dramatis persona's
 * terms); Edit on a book entry sends the campaign and its answer, the campaign's version, takes the
 * book entry's place, in the list and the open panel; Revert goes back; Delete asks what uses the
 * entry first; a taken name lists its matches with "Edit this instead"; refusals show by their
 * fields.
 */
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OWNER, campaignSummary, routeCampaignShell } from "@/test/campaign-fixtures";
import {
  HIRED_SWORDS,
  LIST,
  type Listed,
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
import { expectFieldError, nameMatch, nameTaken, validationError } from "@/test/refusals";
import { chooseOption, selectNear } from "@/test/select-option";
import { setupUser } from "@/test/user-event";
import { humanRace } from "@/test/warband-fixtures";

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
const SKAVEN = { id: 63, type: "Warband", restriction: "Any warband except Skaven" };
/** The book Ogre Bodyguard with its kit: two swords. */
const ogreDetail = hiredSwordDetail(hiredSword(), {
  equipment: [{ item: sword, quantity: 2 }],
  restrictions: [{ restriction: SKAVEN, additional_note: "" }],
});
/** The campaign's version of it, hired for 95. */
const yourOgre = hiredSwordDetail(
  hiredSword({
    id: 73,
    campaign_id: 1,
    replaces: 17,
    hire_cost: 95,
    book: { id: 17, name: "Ogre Bodyguard", changes: { hire_cost: 80 } },
  }),
  { equipment: [{ item: sword, quantity: 2 }] }
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
  fakeApi.on("GET /races/?campaign_id=1", [humanRace, { ...humanRace, id: 4, name: "Ogre" }]);
  fakeApi.on("GET /restrictions/?campaign_id=1", [SKAVEN]);
  fakeApi.on("GET /hired-swords/17/", ogreDetail);
  fakeApi.on("GET /hired-swords/40/", hiredSwordDetail(pitFighter));
  fakeApi.on("GET /hired-swords/73/", yourOgre);
});

describe("Add", () => {
  it("POSTs the whole hired sword: race and label, fees, rating, skill lists, profile, kit quantities and restriction notes", async () => {
    const user = setupUser();
    const duellist = hiredSwordDetail(
      hiredSword({ id: 80, campaign_id: 1, name: "Duellist", large: false })
    );
    const list = serverList(LIST.hiredSwords, HIRED_SWORDS);
    fakeApi.on("POST /hired-swords/", () => {
      list.now = [duellist, ...HIRED_SWORDS];
      return duellist;
    });
    renderCatalogueRoute("/campaigns/1/hired-swords");
    await screen.findByText("Pit Fighter");

    await user.click(screen.getByRole("button", { name: "Add hired sword" }));
    expect(await screen.findByRole("dialog", { name: "Add hired sword" })).toBeVisible();
    await type(user, "Name", "Duellist");
    await chooseOption(user, selectNear("Race"), "Human");
    expect(field("Race label")).toHaveValue("Human");
    await type(user, "Hire cost (gc)", "30");
    await type(user, "or upkeep formula", "1 piece of wyrdstone");
    await type(user, "Rating", "12");
    await user.click(within(dialog()).getByRole("checkbox", { name: "Combat" }));
    await type(user, "M", "4");
    await type(user, "WS", "4");
    await type(user, "Armour save", "5+");
    await pick(user, "Search items...", "Sword");
    fireEvent.change(field("Quantity for Sword"), { target: { value: "2" } });
    await pick(user, "Search restrictions...", "Any warband except Skaven");
    await user.type(field("Note for Any warband except Skaven"), "Humans only");
    await user.click(within(dialog()).getByRole("button", { name: "Create" }));

    await waitFor(() => expect(fakeApi.countOf("POST /hired-swords/")).toBe(1));
    expect(fakeApi.bodyOf("POST /hired-swords/")).toEqual({
      campaign_id: 1,
      name: "Duellist",
      description: "",
      movement: 4,
      weapon_skill: 4,
      ballistic_skill: 0,
      strength: 0,
      toughness: 0,
      wounds: 1,
      initiative: 0,
      attacks: 1,
      leadership: 0,
      armour_save: 5,
      large: false,
      caster: "No",
      race_id: 1,
      race_label: "Human",
      hire_cost: 30,
      hire_cost_expression: "",
      upkeep_cost: null,
      upkeep_cost_expression: "1 piece of wyrdstone",
      rating: 12,
      available_skill_types: ["Combat"],
      special_ids: [],
      skill_ids: [],
      spell_ids: [],
      item_entries: [{ item_id: 2, quantity: 2 }],
      restriction_ids: [{ restriction_id: 63, additional_note: "Humans only" }],
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: /^Duellist/ })).toBeVisible();
  });

  it("caps a kit line at 20 copies", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/hired-swords");
    await screen.findByText("Pit Fighter");
    await user.click(screen.getByRole("button", { name: "Add hired sword" }));
    await screen.findByRole("dialog");

    await pick(user, "Search items...", "Sword");
    fireEvent.change(field("Quantity for Sword"), { target: { value: "50" } });

    expect(field("Quantity for Sword")).toHaveValue(20);
  });

  it("POSTs a dramatis persona's terms too, and the empty catalogue makes way for him", async () => {
    const user = setupUser();
    const list = serverList(LIST.dramatisPersonae, [] as (typeof bertha)[]);
    fakeApi.on("POST /dramatis-personae/", () => {
      list.now = [bertha];
      return hiredSwordDetail(bertha);
    });
    renderCatalogueRoute("/campaigns/1/dramatis-personae");
    await screen.findByText("No dramatis personae yet");

    await user.click(screen.getByRole("button", { name: "Add dramatis persona" }));
    await screen.findByRole("dialog", { name: "Add dramatis persona" });
    await type(user, "Name", "Bertha Bestraufrung");
    await type(user, "or hire formula", "2 Treasure");
    await chooseOption(user, selectNear("Stays"), "One battle");
    await type(user, "Paid in", "25 gc or 1 shard");
    await user.click(within(dialog()).getByRole("button", { name: "Create" }));

    await waitFor(() => expect(fakeApi.countOf("POST /dramatis-personae/")).toBe(1));
    expect(fakeApi.bodyOf("POST /dramatis-personae/")).toMatchObject({
      campaign_id: 1,
      name: "Bertha Bestraufrung",
      hire_cost: null,
      hire_cost_expression: "2 Treasure",
      stays: "one_battle",
      payment_note: "25 gc or 1 shard",
    });
    expect(await screen.findByRole("button", { name: /^Bertha Bestraufrung/ })).toBeVisible();
    expect(screen.queryByText("No dramatis personae yet")).toBeNull();
  });

  it('creates a special on the spot typed "Dramatis Persona" for a dramatis persona', async () => {
    const user = setupUser();
    fakeApi.on("POST /special/", {
      id: 452,
      campaign_id: 1,
      name: "Holy Fury",
      type: "Dramatis Persona",
      description: "",
    });
    renderCatalogueRoute("/campaigns/1/dramatis-personae");
    await user.click(await screen.findByRole("button", { name: "Add dramatis persona" }));
    await screen.findByRole("dialog");

    await user.type(within(dialog()).getByPlaceholderText("Search special rules..."), "Holy Fury");
    await user.click(within(dialog()).getByRole("button", { name: /Create new rule/ }));
    await user.click(within(dialog()).getByRole("button", { name: "Add rule" }));

    await within(dialog()).findByRole("button", { name: "Remove Holy Fury" });
    expect(fakeApi.bodyOf("POST /special/")).toMatchObject({ type: "Dramatis Persona" });
  });
});

describe("Edit, Revert and Delete", () => {
  it("edits a book hired sword from its panel: the form holds its values and kit, the PATCH names the campaign, and its version takes its place", async () => {
    const user = setupUser();
    const list = serverList(LIST.hiredSwords, HIRED_SWORDS);
    fakeApi.on("PATCH /hired-swords/17/", () => {
      list.now = [pitFighter, yourOgre];
      return yourOgre;
    });
    renderCatalogueRoute("/campaigns/1/hired-swords?entry=17");
    await screen.findByRole("heading", { name: "Ogre Bodyguard" });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    expect(await screen.findByRole("dialog", { name: "Edit hired sword" })).toBeVisible();
    expect(field("Name")).toHaveValue("Ogre Bodyguard");
    expect(field("Race label")).toHaveValue("Ogre");
    expect(field("Quantity for Sword")).toHaveValue(2);
    expect(within(dialog()).getByText("Any warband except Skaven")).toBeVisible();
    await type(user, "Hire cost (gc)", "95");
    await user.click(within(dialog()).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fakeApi.countOf("PATCH /hired-swords/17/")).toBe(1));
    expect(fakeApi.bodyOf("PATCH /hired-swords/17/")).toMatchObject({
      campaign_id: 1,
      name: "Ogre Bodyguard",
      hire_cost: 95,
      race_id: 4,
      race_label: "Ogre",
      item_entries: [{ item_id: 2, quantity: 2 }],
      restriction_ids: [{ restriction_id: 63, additional_note: "" }],
    });
    // The panel follows the version, from the write's answer: nothing is read for it.
    await waitFor(() => expect(currentPath()).toHaveTextContent("hired-swords?entry=73"));
    expect(await screen.findByText("House rule")).toBeVisible();
    expect(fakeApi.countOf("GET /hired-swords/73/")).toBe(0);

    await user.click(screen.getByRole("button", { name: "Back" }));
    const ogres = await screen.findAllByRole("button", { name: /^Ogre Bodyguard/ });
    expect(ogres).toHaveLength(1);
    expect(within(ogres[0]).getByText("House rule")).toBeVisible();
  });

  it("edits the campaign's own hired sword without naming the campaign", async () => {
    const user = setupUser();
    fakeApi.on("PATCH /hired-swords/40/", hiredSwordDetail({ ...pitFighter, rating: 14 }));
    renderCatalogueRoute("/campaigns/1/hired-swords?entry=40");
    await screen.findByRole("heading", { name: "Pit Fighter" });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog", { name: "Edit hired sword" });
    await type(user, "Rating", "14");
    await user.click(within(dialog()).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fakeApi.countOf("PATCH /hired-swords/40/")).toBe(1));
    expect(fakeApi.bodyOf("PATCH /hired-swords/40/")).not.toHaveProperty("campaign_id");
    expect(fakeApi.bodyOf("PATCH /hired-swords/40/")).toMatchObject({ rating: 14 });
  });

  it("reverts a version to the book: the confirm says what goes back, and the panel shows the book entry", async () => {
    const user = setupUser();
    fakeApi.on("POST /hired-swords/73/revert/", ogreDetail);
    renderCatalogueRoute("/campaigns/1/hired-swords?entry=73");
    await screen.findByRole("heading", { name: "Ogre Bodyguard" });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog", { name: "Edit hired sword" });
    expect(within(dialog()).queryByRole("button", { name: /^(Delete|Remove)$/ })).toBeNull();
    await user.click(within(dialog()).getByRole("button", { name: "Revert to book" }));
    const confirm = await screen.findByRole("dialog", { name: "Revert to book" });
    expect(confirm).toHaveTextContent(
      "Every Ogre Bodyguard in the campaign goes back to the book."
    );
    await user.click(within(confirm).getByRole("button", { name: "Revert" }));

    await waitFor(() => expect(currentPath()).toHaveTextContent("hired-swords?entry=17"));
    expect(fakeApi.requests().find((request) => request.path.endsWith("revert/"))).toEqual({
      method: "POST",
      path: "/hired-swords/73/revert/",
    });
    expect(await screen.findByRole("heading", { name: "Ogre Bodyguard" })).toBeVisible();
    expect(screen.queryByText("House rule")).toBeNull();
  });

  it("deletes an unused custom hired sword for good after asking what uses it, and closes its panel", async () => {
    const user = setupUser();
    const list = serverList(LIST.hiredSwords, HIRED_SWORDS);
    fakeApi.on("GET /hired-swords/40/usage/", { units: 0, warbands: 0, stashes: 0 });
    fakeApi.on("DELETE /hired-swords/40/", () => {
      list.now = [hiredSword()];
      return null;
    });
    renderCatalogueRoute("/campaigns/1/hired-swords");
    await screen.findByText("Pit Fighter");
    await user.click(screen.getByRole("button", { name: /^Pit Fighter/ }));
    await screen.findByRole("heading", { name: "Pit Fighter" });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog", { name: "Edit hired sword" });
    await user.click(within(dialog()).getByRole("button", { name: "Delete" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete hired sword" });
    await waitFor(() =>
      expect(confirm).toHaveTextContent(
        "Delete Pit Fighter? Nothing uses it, so it is deleted for good."
      )
    );
    await user.click(within(confirm).getByRole("button", { name: "Delete hired sword" }));

    await waitFor(() => expect(fakeApi.countOf("DELETE /hired-swords/40/")).toBe(1));
    await waitFor(() => expect(currentPath()).toHaveTextContent(/^\/campaigns\/1\/hired-swords$/));
    expect(await screen.findByText("Ogre Bodyguard")).toBeVisible();
    expect(screen.queryByText("Pit Fighter")).toBeNull();
  });

  it("removes a book hired sword from this campaign only", async () => {
    const user = setupUser();
    const usage = { units: 0, warbands: 0, stashes: 0, hired_swords: 0, dramatis_personae: 0 };
    fakeApi.on("GET /hired-swords/17/usage/?campaign_id=1", usage);
    fakeApi.on("DELETE /hired-swords/17/?campaign_id=1", { outcome: "removed", usage });
    renderCatalogueRoute("/campaigns/1/hired-swords?entry=17");
    await screen.findByRole("heading", { name: "Ogre Bodyguard" });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog", { name: "Edit hired sword" });
    await user.click(within(dialog()).getByRole("button", { name: "Remove" }));
    const confirm = await screen.findByRole("dialog", { name: "Delete hired sword" });
    await waitFor(() =>
      expect(confirm).toHaveTextContent(
        "Remove Ogre Bodyguard from this campaign only? The book and other campaigns keep it."
      )
    );
    await user.click(within(confirm).getByRole("button", { name: "Remove hired sword" }));

    expect(await screen.findByText("Ogre Bodyguard removed from this campaign.")).toBeVisible();
    expect(fakeApi.countOf("DELETE /hired-swords/17/?campaign_id=1")).toBe(1);
  });
});

describe("refusals", () => {
  it("lists a taken name's matches, and Edit this instead opens the matched entry in the form", async () => {
    const user = setupUser();
    const taken = nameTaken("Ogre Bodyguard", [
      nameMatch({ kind: "hired_swords", id: 17, name: "Ogre Bodyguard", source: "book" }),
    ]);
    fakeApi.fail("POST /hired-swords/", taken.error);
    renderCatalogueRoute("/campaigns/1/hired-swords");
    await screen.findByText("Pit Fighter");
    await user.click(screen.getByRole("button", { name: "Add hired sword" }));
    await screen.findByRole("dialog", { name: "Add hired sword" });

    await type(user, "Name", "ogre bodyguard");
    await user.click(within(dialog()).getByRole("button", { name: "Create" }));

    await expectFieldError(field("Name"), taken.detail, { describedBy: true });
    expect(within(dialog()).getByText("Ogre Bodyguard · book")).toBeVisible();
    await user.click(within(dialog()).getByRole("button", { name: "Edit Ogre Bodyguard instead" }));

    expect(await screen.findByRole("dialog", { name: "Edit hired sword" })).toBeVisible();
    await waitFor(() => expect(field("Name")).toHaveValue("Ogre Bodyguard"));
    expect(field("Hire cost (gc)")).toHaveValue(80);
  });

  it("shows a refused upkeep under its field and a refused kit under the equipment, keeping the form open", async () => {
    const user = setupUser();
    const kit = "A kit carries at most 20 of an item.";
    fakeApi.fail(
      "POST /hired-swords/",
      validationError({
        upkeep_cost: ["Ensure this value is greater than or equal to 0."],
        item_entries: [kit],
      })
    );
    renderCatalogueRoute("/campaigns/1/hired-swords");
    await screen.findByText("Pit Fighter");
    await user.click(screen.getByRole("button", { name: "Add hired sword" }));
    await screen.findByRole("dialog");

    await type(user, "Name", "Duellist");
    await type(user, "Upkeep (gc)", "15");
    await user.click(within(dialog()).getByRole("button", { name: "Create" }));

    await expectFieldError(
      field("Upkeep (gc)"),
      "Ensure this value is greater than or equal to 0."
    );
    expect(within(dialog()).getByText(kit)).toBeVisible();
    expect(screen.getByRole("dialog", { name: "Add hired sword" })).toBeVisible();
    expect(fakeApi.countOf(LIST.hiredSwords)).toBe(1);
  });
});
