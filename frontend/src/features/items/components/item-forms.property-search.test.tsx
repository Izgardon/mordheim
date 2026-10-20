/**
 * The property search in the item forms (`AddItemForm` on the Wargear page, `ItemFormDialog` on
 * the warband pages): each keystroke asks the server again, with no debounce and no guard against
 * answers arriving out of order (CAT-PERF-08). PR A filters the cached `item-properties` list
 * instead.
 */
import { act, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/lib/query-keys";
import { PROPERTIES, deferred } from "@/test/catalogue-fixtures";
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

const search = (text = "") =>
  `GET /item-properties/?type=Weapon${text ? `&search=${text}` : ""}&campaign_id=1`;

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

const PROPERTIES_KEY = queryKeys.campaign.catalogue(1, "item-properties");

/** The property suggestions under the search box. */
const suggestions = () =>
  screen
    .queryAllByRole("button")
    .filter((button) => button.title && button.closest("[data-state=open]"))
    .map((button) => button.textContent);

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on(search(), [parry, poisoned, pairWeapon]);
  fakeApi.on(search("P"), [parry, poisoned, pairWeapon]);
  fakeApi.on(search("Pa"), [parry, pairWeapon]);
  fakeApi.on(search("Par"), [parry]);
});

describe("AddItemForm: property search", () => {
  async function renderWeaponForm(user: ReturnType<typeof setupUser>) {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(PROPERTIES_KEY, PROPERTIES);
    renderWithQueryClient(<AddItemForm campaignId={1} onCreated={vi.fn()} onCancel={vi.fn()} />, {
      queryClient,
    });
    await chooseOption(user, screen.getByText("Select a type").closest("button")!, "Weapon");
    return queryClient;
  }

  // Characterises current behaviour (CAT-PERF-08, pinned; flips in PR A)
  it("asks the server once for the type, then once per keystroke (CAT-PERF-08, pinned; flips in PR A)", async () => {
    const user = setupUser();
    await renderWeaponForm(user);

    await user.type(screen.getByPlaceholderText("Search properties..."), "Par");

    expect(fakeApi.calls()).toEqual([search(), search("P"), search("Pa"), search("Par")]);
    expect(suggestions()).toEqual(["Parry"]);
  });

  // Characterises current behaviour (CAT-PERF-08, pinned; flips in PR A)
  it("shows whichever answer lands last, so a slow answer for an earlier keystroke wins (CAT-PERF-08, pinned; flips in PR A)", async () => {
    const user = setupUser();
    const slowP = deferred<ItemProperty[]>();
    fakeApi.on(search("P"), () => slowP.promise);
    await renderWeaponForm(user);

    await user.type(screen.getByPlaceholderText("Search properties..."), "Pa");
    expect(suggestions()).toEqual(["Parry", "Pair"]);
    await act(async () => slowP.resolve([parry, poisoned, pairWeapon]));

    expect(suggestions()).toEqual(["Parry", "Poisoned", "Pair"]);
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
  async function openWeaponDialog(user: ReturnType<typeof setupUser>) {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(PROPERTIES_KEY, PROPERTIES);
    renderWithQueryClient(<ItemFormDialog mode="create" campaignId={1} onCreated={vi.fn()} />, {
      queryClient,
    });
    expect(fakeApi.calls()).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Add item" }));
    await chooseOption(user, screen.getByRole("combobox", { name: "Type" }), "Weapon");
    return queryClient;
  }

  // Characterises current behaviour (CAT-PERF-08, pinned; flips in PR A)
  it("asks the server once for the type, then once per keystroke (CAT-PERF-08, pinned; flips in PR A)", async () => {
    const user = setupUser();
    await openWeaponDialog(user);

    await user.type(screen.getByPlaceholderText("Search properties..."), "Par");

    expect(fakeApi.calls()).toEqual([search(), search("P"), search("Pa"), search("Par")]);
    expect(suggestions()).toEqual(["Parry"]);
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
