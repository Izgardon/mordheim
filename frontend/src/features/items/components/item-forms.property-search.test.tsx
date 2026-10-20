/**
 * The property search in the item forms (`AddItemForm` on the Wargear page, `ItemFormDialog` on
 * the warband pages): both filter the campaign's cached `item-properties` list to the form's type
 * and the search, so typing sends no request and no answer can land out of order (CAT-PERF-08).
 */
import { act, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import { LIST, PROPERTIES, deferred } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { createTestQueryClient, renderWithQueryClient } from "@/test/query-test-utils";
import { chooseOption } from "@/test/select-option";
import { setupUser } from "@/test/user-event";
import AddItemForm from "./AddItemForm";
import ItemFormDialog from "./ItemFormDialog";

import type { ItemProperty } from "../types/item-types";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const parry: ItemProperty = PROPERTIES[0];
const poisoned: ItemProperty = {
  id: 502,
  campaign_id: null,
  name: "Poisoned",
  type: "Weapon",
  description: "Coated in venom.",
};
const pairWeapon: ItemProperty = {
  id: 503,
  campaign_id: null,
  name: "Pair",
  type: "Weapon",
  description: "Comes as two.",
};

/** A book armour property: never offered for a weapon. */
const padded: ItemProperty = {
  id: 504,
  campaign_id: null,
  name: "Padded",
  type: "Armour",
  description: "Soft lining.",
};
/** A property with no type: the server offers it for every type. */
const painted: ItemProperty = {
  id: 505,
  campaign_id: 1,
  name: "Painted",
  type: "",
  description: "Warband colours.",
};
/** The campaign's `item-properties` list, every type, as `?campaign_id=1` returns it. */
const PROPERTY_LIST = [parry, padded, painted, pairWeapon, poisoned];

const PROPERTIES_KEY = queryKeys.campaign.catalogue(1, "item-properties");

/** The property suggestions under the search box. */
const suggestions = () =>
  screen
    .queryAllByRole("button")
    .filter((button) => button.title && button.closest("[data-state=open]"))
    .map((button) => button.textContent);

beforeEach(() => {
  fakeApi.reset();
});

describe("AddItemForm: property search", () => {
  async function renderWeaponForm(
    user: ReturnType<typeof setupUser>,
    cached: ItemProperty[] | null = PROPERTIES
  ) {
    const queryClient = createTestQueryClient();
    if (cached) {
      queryClient.setQueryData(PROPERTIES_KEY, cached);
    }
    renderWithQueryClient(<AddItemForm campaignId={1} onCreated={vi.fn()} onCancel={vi.fn()} />, {
      queryClient,
    });
    await chooseOption(user, screen.getByText("Select a type").closest("button")!, "Weapon");
    return queryClient;
  }

  it("filters the cached list to the type and the search as you type, with no request (CAT-PERF-08)", async () => {
    const user = setupUser();
    await renderWeaponForm(user, PROPERTY_LIST);
    const searchBox = screen.getByPlaceholderText("Search properties...");

    await user.type(searchBox, "pa");
    expect(suggestions()).toEqual(["Parry", "Painted", "Pair"]);
    await user.type(searchBox, "i");

    expect(suggestions()).toEqual(["Painted", "Pair"]);
    expect(fakeApi.calls()).toEqual([]);
  });

  it("reads the list once on a cold cache, then filters it for every keystroke (CAT-PERF-08)", async () => {
    const user = setupUser();
    const list = deferred<ItemProperty[]>();
    fakeApi.on(LIST.properties, () => list.promise);
    await renderWeaponForm(user, null);
    const searchBox = screen.getByPlaceholderText("Search properties...");

    await user.type(searchBox, "Pa");
    expect(suggestions()).toEqual([]);
    await act(async () => list.resolve(PROPERTY_LIST));
    await waitFor(() => expect(suggestions()).toEqual(["Parry", "Painted", "Pair"]));
    await user.type(searchBox, "i");

    expect(suggestions()).toEqual(["Painted", "Pair"]);
    expect(fakeApi.calls()).toEqual([LIST.properties]);
  });

  it("puts a property it creates into the cached item-properties list", async () => {
    const user = setupUser();
    const created = { ...poisoned, id: 510, campaign_id: 1, name: "Rusty" };
    fakeApi.on("POST /item-properties/", created);
    const queryClient = await renderWeaponForm(user);

    await user.click(screen.getByRole("button", { name: "Create" }));
    await user.type(screen.getByPlaceholderText("Battle Schooled"), "Rusty");
    await user.click(screen.getByRole("button", { name: "Add property" }));

    expect(await screen.findByText("Rusty", { selector: "span" })).toBeVisible();
    expect(fakeApi.bodyOf("POST /item-properties/")).toEqual({
      name: "Rusty",
      description: "",
      type: "Weapon",
      campaign_id: 1,
    });
    expect(queryClient.getQueryData<ItemProperty[]>(PROPERTIES_KEY)?.map((p) => p.name)).toEqual([
      "Rusty",
      "Parry",
    ]);
  });
});

describe("ItemFormDialog: property search", () => {
  async function openWeaponDialog(
    user: ReturnType<typeof setupUser>,
    cached: ItemProperty[] = PROPERTIES
  ) {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(PROPERTIES_KEY, cached);
    renderWithQueryClient(<ItemFormDialog mode="create" campaignId={1} onCreated={vi.fn()} />, {
      queryClient,
    });
    expect(fakeApi.calls()).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Add item" }));
    await chooseOption(user, screen.getByRole("combobox", { name: "Type" }), "Weapon");
    return queryClient;
  }

  it("filters the cached list to the type and the search as you type, with no request (CAT-PERF-08)", async () => {
    const user = setupUser();
    await openWeaponDialog(user, PROPERTY_LIST);
    const searchBox = screen.getByPlaceholderText("Search properties...");

    await user.type(searchBox, "pa");
    expect(suggestions()).toEqual(["Parry", "Painted", "Pair"]);
    await user.type(searchBox, "i");

    expect(suggestions()).toEqual(["Painted", "Pair"]);
    expect(fakeApi.calls()).toEqual([]);
  });

  // Characterises current behaviour (BUG-149, pinned; flips in PR A)
  it("leaves a property it creates out of the cached item-properties list, unlike AddItemForm (BUG-149, pinned; flips in PR A)", async () => {
    const user = setupUser();
    const created = { ...poisoned, id: 510, campaign_id: 1, name: "Rusty" };
    fakeApi.on("POST /item-properties/", created);
    const queryClient = await openWeaponDialog(user);

    await user.click(screen.getByRole("button", { name: "Create" }));
    await user.type(screen.getByLabelText("Property name"), "Rusty");
    await user.click(screen.getByRole("button", { name: "Add property" }));

    expect(await screen.findByText("Rusty", { selector: "span" })).toBeVisible();
    expect(queryClient.getQueryData<ItemProperty[]>(PROPERTIES_KEY)?.map((p) => p.name)).toEqual([
      "Parry",
    ]);
  });
});
