/**
 * Editing a book entry and reverting it (decisions 1 and 2, CAT-TWEAK-01), on Wargear, Skills and
 * Spells as the app mounts them: Edit on a book row sends the campaign with the PATCH, and the
 * answer (the campaign's version) takes the book row's place in the cached list; a version's form
 * offers Revert with the brief's confirm, and the answer takes the version's place again; a house
 * rule's clone says which rule set it, links to House Rules and warns that saving detaches it.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api-client";
import { routeCampaignShell } from "@/test/campaign-fixtures";
import {
  ITEMS,
  LIST,
  SKILLS,
  SPELLS,
  type Listed,
  availability,
  halfPriceArmour,
  item,
  routeCatalogue,
  skill,
  spell,
  sword,
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
vi.mock("@/features/auth/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: 7, email: "aldric@example.com" }, signOut: () => undefined }),
}));
vi.mock("@/lib/use-media-query", () => ({ useMediaQuery: () => false }));
vi.mock("@/features/realtime/components/CampaignDiceRollerMenu", () => ({ default: () => null }));

const itemRows = (name: string) => screen.getAllByRole("button", { name: new RegExp(`^${name}`) });
const tableRow = (name: string) => screen.getByRole("row", { name: new RegExp(`^${name}`) });

/** The campaign's version of the book Sword (10 gc), at 15 gc. */
const yourSword = item({
  id: 270,
  campaign_id: 1,
  name: "Sword",
  replaces: 2,
  properties: sword.properties,
  availabilities: [availability({ id: 90, cost: 15 })],
  book: { id: 2, name: "Sword", changes: {}, price: 10 },
});
const withoutSword = ITEMS.filter((entry) => entry.name !== "Sword");

/**
 * A list route whose answer a write changes, as the server's would: `list.now` is what the next
 * read returns.
 */
function serverList<T>(route: string, initial: T[]): Listed<T> {
  const list = { now: initial };
  fakeApi.on(route, () => list.now);
  return list;
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell();
  routeCatalogue();
});

async function openWargear() {
  renderCatalogueRoute("/campaigns/1/items");
  await screen.findByRole("button", { name: /^Rusty Cleaver/ });
}

describe("Wargear: a book item's version", () => {
  it("sends the campaign with a book item's edit and lists the answer in its place (CAT-TWEAK-01)", async () => {
    const user = setupUser();
    const items = serverList(LIST.items, ITEMS);
    fakeApi.on("PATCH /items/2/", () => {
      items.now = [yourSword, ...withoutSword];
      return yourSword;
    });
    await openWargear();

    await user.click(within(itemRows("Sword")[0]).getByRole("button", { name: "Edit item" }));
    const price = screen.getByDisplayValue("10");
    await user.clear(price);
    await user.type(price, "15");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull());
    expect(fakeApi.bodyOf("PATCH /items/2/")).toMatchObject({
      campaign_id: 1,
      availabilities: [{ cost: 15, rarity: 2 }],
    });
    expect(itemRows("Sword")).toHaveLength(1);
    expect(itemRows("Sword")[0]).toHaveTextContent(/SwordHouse rule/);
    expect(itemRows("Sword")[0]).toHaveTextContent(/Common\s*15/);
  });

  it("offers Revert, not Delete, on a version, with the brief's confirm; the book item comes back in its place (CAT-TWEAK-01)", async () => {
    const user = setupUser();
    const items = serverList(LIST.items, [yourSword, ...withoutSword]);
    fakeApi.on("POST /items/270/revert/", () => {
      items.now = ITEMS;
      return sword;
    });
    await openWargear();

    await user.click(within(itemRows("Sword")[0]).getByRole("button", { name: "Edit item" }));
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Revert to book" }));
    const confirm = screen.getByRole("dialog", { name: "Revert to book" });
    expect(confirm).toHaveTextContent(
      "Every Sword in the campaign goes back to the book (10 gc). Copies already bought keep what was paid."
    );
    fakeApi.clearRequests();
    await user.click(within(confirm).getByRole("button", { name: "Revert" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull());
    expect(fakeApi.requests()[0]).toEqual({ method: "POST", path: "/items/270/revert/" });
    expect(itemRows("Sword")).toHaveLength(1);
    expect(itemRows("Sword")[0]).not.toHaveTextContent("House rule");
    expect(itemRows("Sword")[0]).toHaveTextContent(/Common\s*10/);
  });

  it("keeps a refused Revert's reason in its confirm, which stays open", async () => {
    const user = setupUser();
    const detail =
      "This entry isn't a campaign's version of a book entry, so there is nothing to revert.";
    fakeApi.on(LIST.items, [yourSword, ...withoutSword]);
    fakeApi.fail(
      "POST /items/270/revert/",
      new ApiError(detail, 409, { detail, code: "not_a_version", fields: {} })
    );
    await openWargear();

    await user.click(within(itemRows("Sword")[0]).getByRole("button", { name: "Edit item" }));
    await user.click(screen.getByRole("button", { name: "Revert to book" }));
    await user.click(
      within(screen.getByRole("dialog", { name: "Revert to book" })).getByRole("button", {
        name: "Revert",
      })
    );

    const confirm = screen.getByRole("dialog", { name: "Revert to book" });
    expect(await within(confirm).findByRole("alert")).toHaveTextContent(detail);
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(itemRows("Sword")[0]).toHaveTextContent("House rule");
  });

  it("says which rule set a clone, links to House Rules and warns that saving detaches it; the edit sends no campaign (PR C's Calls)", async () => {
    const user = setupUser();
    const detached = {
      ...halfPriceArmour,
      generated_effect_key: null,
      availabilities: [availability({ id: 43, cost: 20 })],
    };
    const items = serverList(LIST.items, ITEMS);
    fakeApi.on("PATCH /items/250/", () => {
      items.now = ITEMS.map((entry) => (entry.id === 250 ? detached : entry));
      return detached;
    });
    await openWargear();
    await user.click(screen.getByRole("button", { name: "Armour" }));

    await user.click(
      within(itemRows("Heavy Armour")[0]).getByRole("button", { name: "Edit item" })
    );

    const note = screen.getByText(/Set by Half price armour/);
    expect(note).toHaveTextContent(
      "Saving changes here detaches it from the rule, which then leaves it alone."
    );
    expect(within(note).getByRole("link", { name: "House Rules" })).toHaveAttribute(
      "href",
      "/campaigns/1/house-rules"
    );
    expect(screen.queryByRole("button", { name: "Revert to book" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();

    const price = screen.getByDisplayValue("25");
    await user.clear(price);
    await user.type(price, "20");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull());
    expect(fakeApi.bodyOf("PATCH /items/250/")).not.toHaveProperty("campaign_id");
    expect(itemRows("Heavy Armour")[0]).toHaveTextContent(/Common\s*20/);
  });
});

describe("Skills and Spells: a book entry's version", () => {
  it("Skills: a book skill's edit sends the campaign, and its version takes the row; Revert says what goes back", async () => {
    const user = setupUser();
    const yourStrike = skill({
      id: 909,
      campaign_id: 1,
      replaces: 205,
      description: "Add +1 to injury rolls, twice.",
      book: { id: 205, name: "Strike to Injure", changes: { description: "Add +1." } },
    });
    const skills = serverList(LIST.skills, SKILLS);
    fakeApi.on("PATCH /skills/205/", () => {
      skills.now = [SKILLS[0], yourStrike];
      return yourStrike;
    });
    fakeApi.on("POST /skills/909/revert/", () => {
      skills.now = SKILLS;
      return skill();
    });
    renderCatalogueRoute("/campaigns/1/skills");
    await screen.findByRole("row", { name: /^Strike to Injure/ });

    await user.click(
      within(tableRow("Strike to Injure")).getByRole("button", { name: "Edit skill" })
    );
    await user.type(screen.getByDisplayValue("Add +1 to injury rolls."), " Twice.");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await within(tableRow("Strike to Injure")).findByText("House rule")).toBeVisible();
    expect(fakeApi.bodyOf("PATCH /skills/205/")).toEqual({
      name: "Strike to Injure",
      type: "Combat",
      description: "Add +1 to injury rolls. Twice.",
      campaign_id: 1,
    });
    expect(screen.getAllByRole("row", { name: /^Strike to Injure/ })).toHaveLength(1);

    await user.click(
      within(tableRow("Strike to Injure")).getByRole("button", { name: "Edit skill" })
    );
    await user.click(screen.getByRole("button", { name: "Revert to book" }));
    expect(screen.getByRole("dialog", { name: "Revert to book" })).toHaveTextContent(
      "Every Strike to Injure in the campaign goes back to the book."
    );
    await user.click(screen.getByRole("button", { name: "Revert" }));

    await waitFor(() => expect(screen.queryByText("House rule")).toBeNull());
    expect(fakeApi.countOf("POST /skills/909/revert/")).toBe(1);
    expect(tableRow("Strike to Injure")).toHaveTextContent("Add +1 to injury rolls.");
  });

  it("Spells: a book spell's edit sends the campaign, and its version takes the row", async () => {
    const user = setupUser();
    const spells = serverList(LIST.spells, SPELLS);
    fakeApi.on("PATCH /spells/301/", (body: object) => {
      const yours = { ...spell(), ...body, id: 960, campaign_id: 1, replaces: 301 };
      spells.now = [SPELLS[0], yours];
      return yours;
    });
    renderCatalogueRoute("/campaigns/1/spells");
    await screen.findByRole("row", { name: /^Fires of U'Zhul/ });

    await user.click(
      within(tableRow("Fires of U'Zhul")).getByRole("button", { name: "Edit spell" })
    );
    const difficulty = screen.getByDisplayValue("7");
    await user.clear(difficulty);
    await user.type(difficulty, "8");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await within(tableRow("Fires of U'Zhul")).findByText("House rule")).toBeVisible();
    expect(fakeApi.bodyOf("PATCH /spells/301/")).toMatchObject({ campaign_id: 1, dc: 8 });
    expect(screen.getAllByRole("row", { name: /^Fires of U'Zhul/ })).toHaveLength(1);
  });
});
