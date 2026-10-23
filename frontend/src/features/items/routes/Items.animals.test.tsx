/**
 * Wargear's Animals tab after the bestiary rewrite's step 3, as the app mounts it (layout, fake
 * server): every beast's Animal item is listed with its beast's kind; only what the shop sells
 * (`listed`) offers Acquire, labelled by kind ("Acquire mount"); a beast without a profile says so;
 * and an Animal row's Edit goes to its beast's bestiary entry, whose form writes the item (the
 * items routes refuse to, 403 `animal_item`), as does "Edit this instead" on a taken animal name.
 */
import { act, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { campaignSummary, routeCampaignShell } from "@/test/campaign-fixtures";
import {
  ITEMS,
  LIST,
  availability,
  bestiaryDetail,
  bestiaryEntry,
  item,
  raven,
  routeCatalogue,
  warhoundItem,
} from "@/test/catalogue-fixtures";
import { renderCatalogueRoute } from "@/test/catalogue-routes";
import { fakeApi } from "@/test/fake-api";
import { fakeRealtime } from "@/test/fake-realtime";
import { nameMatch, nameTaken } from "@/test/refusals";
import { chooseOption } from "@/test/select-option";
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

const profile = {
  movement: 8,
  weapon_skill: 3,
  ballistic_skill: 0,
  strength: 3,
  toughness: 3,
  wounds: 1,
  initiative: 3,
  attacks: 1,
  leadership: 5,
  armour_save: null,
  specials: [],
};
/** The Warhorse's item: a mount, sold. */
const warhorseItem = item({
  id: 230,
  name: "Warhorse",
  type: "Animal",
  subtype: "Mount",
  strength: null,
  range: null,
  availabilities: [availability({ id: 242, cost: 80, rarity: 11 })],
  listed: true,
  bestiary_entry: { id: 6, name: "Warhorse", kind: "mount", has_profile: true, ...profile },
});
/** The Raven's item: a pet without a profile, not sold. */
const ravenItem = item({
  id: 270,
  name: "Raven",
  type: "Animal",
  subtype: "Pet",
  strength: null,
  range: null,
  availabilities: [availability({ id: 370, cost: 60, rarity: 8 })],
  listed: false,
  bestiary_entry: {
    id: 20,
    name: "Raven",
    kind: "pet",
    has_profile: false,
    ...profile,
    movement: 0,
  },
});

const row = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name}`) });
const currentPath = () => screen.getByLabelText("Current path");

async function openAnimals() {
  renderCatalogueRoute("/campaigns/1/items?tab=animals");
  await screen.findByRole("button", { name: /^Warhound/ });
}

beforeEach(() => {
  fakeApi.reset();
  fakeRealtime.reset();
  routeCampaignShell({ campaign: campaignSummary() });
  routeCatalogue();
  fakeApi.on(LIST.items, [...ITEMS, warhorseItem, ravenItem]);
  fakeApi.on("GET /bestiary/5/", bestiaryDetail(bestiaryEntry()));
  fakeApi.on("GET /bestiary/20/", bestiaryDetail(raven));
});

describe("Wargear: the Animals tab", () => {
  it("lists every beast's item with its kind, sold or not", async () => {
    await openAnimals();

    expect(within(row("Warhound")).getByText("Creature")).toBeVisible();
    expect(within(row("Warhorse")).getByText("Mount")).toBeVisible();
    expect(within(row("Raven")).getByText("Pet")).toBeVisible();
  });

  it('offers Acquire only for what the shop sells, labelled by kind; an unsold beast says "Not sold"', async () => {
    await openAnimals();

    expect(within(row("Warhound")).getByRole("button", { name: "Acquire creature" })).toBeVisible();
    expect(within(row("Warhorse")).getByRole("button", { name: "Acquire mount" })).toBeVisible();
    expect(within(row("Raven")).queryByRole("button", { name: /^Acquire/ })).toBeNull();
    expect(within(row("Raven")).getByText("Not sold")).toBeVisible();
  });

  it('says "No profile" for a beast without one, where the others show their stat line', async () => {
    await openAnimals();

    expect(within(row("Raven")).getByText("No profile")).toBeVisible();
    expect(within(row("Warhorse")).getByRole("table")).toBeVisible();
  });
});

describe("Wargear: an Animal item is edited in the bestiary", () => {
  it("sends an Animal row's Edit to its beast's entry with the bestiary form open; Back returns to the tab", async () => {
    const user = setupUser();
    await openAnimals();

    await user.click(within(row("Warhound")).getByRole("button", { name: "Edit in the bestiary" }));

    expect(await screen.findByRole("dialog", { name: "Edit bestiary entry" })).toBeVisible();
    expect(currentPath()).toHaveTextContent("/campaigns/1/bestiary?entry=5");
    await waitFor(() =>
      expect(within(screen.getByRole("dialog")).getByLabelText("Name")).toHaveValue("Warhound")
    );
    expect(fakeApi.calls().some((call) => call.startsWith("PATCH /items/"))).toBe(false);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "Back" }));

    expect(await screen.findByRole("button", { name: /^Warhound/ })).toBeVisible();
    expect(currentPath()).toHaveTextContent("/campaigns/1/items?tab=animals");
  });

  it("offers no Animal type in the items form: animals come from the bestiary", async () => {
    const user = setupUser();
    await openAnimals();
    await user.click(screen.getByRole("button", { name: "Add item" }));
    const trigger = screen.getByText("Select a type").closest("button")!;

    act(() => trigger.focus());
    await user.keyboard("{Enter}");

    const options = (await screen.findAllByRole("option")).map((option) => option.textContent);
    expect(options).toEqual(["Weapon", "Armour", "Miscellaneous"]);
  });

  it("opens the beast in the bestiary when a taken name's match is an Animal item", async () => {
    const user = setupUser();
    const taken = nameTaken("Warhound", [
      nameMatch({ kind: "items", id: warhoundItem.id, name: "Warhound", source: "book" }),
    ]);
    fakeApi.fail("POST /items/", taken.error);
    await openAnimals();
    await user.click(screen.getByRole("button", { name: "Add item" }));
    await user.type(screen.getByPlaceholderText("Gutterblade"), "Warhound");
    await chooseOption(user, screen.getByText("Select a type").closest("button")!, "Weapon");
    await user.type(screen.getByPlaceholderText("25"), "5");
    await user.type(screen.getByPlaceholderText("2"), "2");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await user.click(await screen.findByRole("button", { name: "Edit Warhound instead" }));

    expect(await screen.findByRole("dialog", { name: "Edit bestiary entry" })).toBeVisible();
    expect(currentPath()).toHaveTextContent("/campaigns/1/bestiary?entry=5");
  });
});
