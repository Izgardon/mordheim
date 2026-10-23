/**
 * The bestiary form's step 3 fields, on the Bestiary as the app mounts it (layout, fake server):
 * "Has a profile" (off, the stats hide and are saved empty), a mount's "Rating bonus for the
 * rider", a creature's "Gains experience", and "Available in the shop", which reveals the item's
 * prices (price, rarity, variable cost, restrictions with notes) and, unticked, folds them away and
 * keeps them. The cards and the panel say what the shop sells a beast at.
 */
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OWNER, campaignSummary, routeCampaignShell } from "@/test/campaign-fixtures";
import {
  availability,
  bestiaryDetail,
  bestiaryEntry,
  raven,
  routeCatalogue,
  warhorse,
} from "@/test/catalogue-fixtures";
import { renderCatalogueRoute } from "@/test/catalogue-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { expectFieldError, validationError } from "@/test/refusals";
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

const HUMANS = { id: 92, type: "Warband Group", restriction: "Humans" };
/** The book Warhorse as its detail reads: sold at 80 gc, Rare 11, to Humans. */
const horseDetail = bestiaryDetail({
  ...warhorse,
  item: {
    id: 230,
    grade: "1a",
    availabilities: [
      availability({
        id: 242,
        cost: 80,
        rarity: 11,
        restrictions: [{ restriction: HUMANS, additional_note: "" }],
      }),
    ],
  },
});
const created = bestiaryDetail(bestiaryEntry({ id: 95, campaign_id: 1, name: "Destrier" }));

const dialog = () => screen.getByRole("dialog");
const field = (label: string | RegExp) => within(dialog()).getByLabelText(label);
const box = (name: string) => within(dialog()).getByRole("checkbox", { name });

async function type(user: ReturnType<typeof setupUser>, label: string | RegExp, value: string) {
  await user.clear(field(label));
  await user.type(field(label), value);
}

/** Opens Add entry on the Bestiary and names the new beast. */
async function openAdd(user: ReturnType<typeof setupUser>, name = "Destrier") {
  renderCatalogueRoute("/campaigns/1/bestiary");
  await user.click(await screen.findByRole("button", { name: "Add entry" }));
  await screen.findByRole("dialog", { name: "Add bestiary entry" });
  await type(user, "Name", name);
}

const create = (user: ReturnType<typeof setupUser>) =>
  user.click(within(dialog()).getByRole("button", { name: "Create" }));

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell({ campaign: campaignSummary() });
  routeCatalogue();
  fakeApi.on("GET /restrictions/?campaign_id=1", [HUMANS]);
  fakeApi.on("GET /bestiary/6/", horseDetail);
  fakeApi.on("GET /bestiary/20/", bestiaryDetail(raven));
  fakeApi.on("POST /bestiary/", created);
});

describe("Has a profile", () => {
  it("hides the stats when unticked, saying they are cleared, and sends has_profile false", async () => {
    const user = setupUser();
    await openAdd(user, "Polecat");
    await user.click(within(dialog()).getByRole("radio", { name: "Pet" }));
    expect(box("Has a profile")).toBeChecked();
    expect(field("M")).toBeVisible();

    await user.click(box("Has a profile"));

    expect(within(dialog()).queryByLabelText("M")).toBeNull();
    expect(within(dialog()).getByText(/its stats are cleared when you save/)).toBeVisible();
    await create(user);
    await waitFor(() => expect(fakeApi.countOf("POST /bestiary/")).toBe(1));
    expect(fakeApi.bodyOf("POST /bestiary/")).toMatchObject({ kind: "pet", has_profile: false });
  });

  it("opens a beast without a profile unticked, its stats hidden", async () => {
    const user = setupUser();
    renderCatalogueRoute("/campaigns/1/bestiary?entry=20");
    await screen.findByRole("heading", { name: "Raven" });

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog", { name: "Edit bestiary entry" });

    expect(box("Has a profile")).not.toBeChecked();
    expect(within(dialog()).queryByLabelText("M")).toBeNull();
  });
});

describe("what a kind adds", () => {
  it("offers a mount's rating bonus and a creature's experience, and sends each for its own kind only", async () => {
    const user = setupUser();
    await openAdd(user);
    expect(within(dialog()).queryByLabelText("Rating bonus for the rider")).toBeNull();
    await user.click(box("Gains experience"));

    await user.click(within(dialog()).getByRole("radio", { name: "Mount" }));
    expect(within(dialog()).queryByRole("checkbox", { name: /Gains experience/ })).toBeNull();
    await type(user, "Rating bonus for the rider", "5");
    await create(user);

    await waitFor(() => expect(fakeApi.countOf("POST /bestiary/")).toBe(1));
    expect(fakeApi.bodyOf("POST /bestiary/")).toMatchObject({
      kind: "mount",
      rating_bonus: 5,
      gains_xp: false,
    });
  });

  it("sends a creature's experience, and no rating bonus", async () => {
    const user = setupUser();
    await openAdd(user, "Kennel Hound");
    await user.click(box("Gains experience"));
    await create(user);

    await waitFor(() => expect(fakeApi.countOf("POST /bestiary/")).toBe(1));
    expect(fakeApi.bodyOf("POST /bestiary/")).toMatchObject({
      kind: "creature",
      gains_xp: true,
      rating_bonus: null,
    });
  });

  it("shows a refused rating bonus under its field", async () => {
    const user = setupUser();
    const refusal = "Ensure this value is greater than or equal to 0.";
    fakeApi.fail("POST /bestiary/", validationError({ rating_bonus: [refusal] }));
    await openAdd(user);
    await user.click(within(dialog()).getByRole("radio", { name: "Mount" }));
    await type(user, "Rating bonus for the rider", "3");
    await create(user);

    await expectFieldError(field("Rating bonus for the rider"), refusal);
  });
});

describe("Available in the shop", () => {
  it("is unticked on a new beast; ticking it reveals one price, sent with its restriction and note", async () => {
    const user = setupUser();
    await openAdd(user);
    expect(box("Available in the shop")).not.toBeChecked();
    expect(within(dialog()).queryByLabelText("Price")).toBeNull();

    await user.click(box("Available in the shop"));
    await type(user, "Price", "95");
    await type(user, /^Rarity/, "11");
    await type(user, "Variable cost", "+D6");
    await user.click(within(dialog()).getByPlaceholderText("Search restrictions..."));
    await user.click(await within(dialog()).findByRole("button", { name: /^Humans/ }));
    await user.type(field("Note for Humans"), "knights only");
    await create(user);

    await waitFor(() => expect(fakeApi.countOf("POST /bestiary/")).toBe(1));
    expect(fakeApi.bodyOf("POST /bestiary/")).toMatchObject({
      available_in_shop: true,
      item: {
        availabilities: [
          {
            cost: 95,
            rarity: 11,
            variable_cost: "+D6",
            restrictions: [{ restriction_id: 92, additional_note: "knights only" }],
          },
        ],
      },
    });
  });

  it("reads the campaign's restrictions only once the shop section shows", async () => {
    const user = setupUser();
    await openAdd(user);
    expect(fakeApi.countOf("GET /restrictions/?campaign_id=1")).toBe(0);

    await user.click(box("Available in the shop"));

    await waitFor(() => expect(fakeApi.countOf("GET /restrictions/?campaign_id=1")).toBe(1));
  });

  it("folds a sold beast's prices away when unticked and keeps them: they are sent, and come back when ticked again", async () => {
    const user = setupUser();
    fakeApi.on("PATCH /bestiary/6/", horseDetail);
    renderCatalogueRoute("/campaigns/1/bestiary?entry=6");
    await screen.findByRole("heading", { name: "Warhorse" });
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog", { name: "Edit bestiary entry" });
    expect(box("Available in the shop")).toBeChecked();
    expect(field("Price")).toHaveValue(80);
    expect(within(dialog()).getByText("Humans")).toBeVisible();

    await user.click(box("Available in the shop"));
    expect(within(dialog()).queryByLabelText("Price")).toBeNull();
    expect(within(dialog()).getByText(/its prices are kept/)).toBeVisible();
    await user.click(box("Available in the shop"));
    expect(field("Price")).toHaveValue(80);
    await user.click(box("Available in the shop"));
    await user.click(within(dialog()).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fakeApi.countOf("PATCH /bestiary/6/")).toBe(1));
    expect(fakeApi.bodyOf("PATCH /bestiary/6/")).toMatchObject({
      campaign_id: 1,
      available_in_shop: false,
      item: {
        availabilities: [
          {
            cost: 80,
            rarity: 11,
            variable_cost: null,
            restrictions: [{ restriction_id: 92, additional_note: "" }],
          },
        ],
      },
    });
  });

  it("stops a sold beast's save on a missing price or a rarity outside 2 to 20, under each field", async () => {
    const user = setupUser();
    await openAdd(user);
    await user.click(box("Available in the shop"));
    await type(user, /^Rarity/, "1");
    await create(user);

    await expectFieldError(field("Price"), "Needs a price of 0 or more.");
    await expectFieldError(field(/^Rarity/), "Needs a rarity from 2 to 20.");
    expect(fakeApi.countOf("POST /bestiary/")).toBe(0);
  });

  it("stops the save on a half-filled price folded away, saying how to see it", async () => {
    const user = setupUser();
    await openAdd(user);
    await user.click(box("Available in the shop"));
    await type(user, "Price", "40");
    await user.click(box("Available in the shop"));
    await create(user);

    expect(
      await within(dialog()).findByText(
        "Finish or remove the shop prices first: tick Available in the shop to see them."
      )
    ).toBeVisible();
    expect(fakeApi.countOf("POST /bestiary/")).toBe(0);
  });

  it("sends no price for a beast never sold", async () => {
    const user = setupUser();
    await openAdd(user);
    await create(user);

    await waitFor(() => expect(fakeApi.countOf("POST /bestiary/")).toBe(1));
    expect(fakeApi.bodyOf("POST /bestiary/")).toMatchObject({
      available_in_shop: false,
      item: { availabilities: [] },
    });
  });
});

describe("the shop on the page", () => {
  const card = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });

  it("says on each card what the shop sells the beast at, or that it isn't sold, and a mount's rider rating", async () => {
    renderCatalogueRoute("/campaigns/1/bestiary");
    await screen.findByText("Sewer Rat");

    expect(within(card("Warhorse")).getByText("80 gc · Rare 11")).toBeVisible();
    expect(within(card("Warhorse")).getByText("+5")).toBeVisible();
    expect(within(card("Warhound")).getByText("15 gc · Common")).toBeVisible();
    expect(within(card("Sewer Rat")).getByText("Not sold")).toBeVisible();
  });

  it("says it in the panel too, with the price's restrictions", async () => {
    renderCatalogueRoute("/campaigns/1/bestiary?entry=6");

    expect(await screen.findByText("80 gc · Rare 11 · Humans")).toBeVisible();
  });
});
