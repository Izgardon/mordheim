/**
 * The bodies the item forms send, as the server receives them: `AddItemForm` (Wargear's Add and
 * Edit) and `ItemFormDialog` (the warband pages' Add item). PR A validates these server-side
 * (nested availability serializers, cost >= 0, rarity 2 to 20, scoped ids), so this is the
 * baseline the frontend may have to adapt from.
 */
import { act, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  LIST,
  PROPERTIES,
  availability,
  restricted,
  rustyCleaver,
} from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { chooseOption } from "@/test/select-option";
import { expectFieldError } from "@/test/refusals";
import { setupUser } from "@/test/user-event";
import { PRICE_HINT, RARITY_HINT } from "../utils/item-form-values";
import AddItemForm from "./AddItemForm";
import ItemFormDialog from "./ItemFormDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const typeSelect = () => screen.getByText("Select a type").closest("button")!;

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on(LIST.properties, PROPERTIES);
  fakeApi.on("POST /items/", (body: object) => ({ ...rustyCleaver, ...body, id: 300 }));
  fakeApi.on("PATCH /items/240/", (body: object) => ({ ...rustyCleaver, ...body }));
});

describe("AddItemForm: create", () => {
  it("POSTs the weapon with its property ids, each availability without restrictions, and campaign_id", async () => {
    const user = setupUser();
    renderWithQueryClient(<AddItemForm campaignId={1} onCreated={vi.fn()} onCancel={vi.fn()} />);

    await user.type(screen.getByPlaceholderText("Gutterblade"), "Gutterblade");
    await chooseOption(user, typeSelect(), "Weapon");
    await user.type(screen.getByPlaceholderText("As user"), "S+1");
    await user.type(screen.getByPlaceholderText("Search properties..."), "P");
    await user.click(screen.getByRole("button", { name: "Parry" }));
    await user.click(screen.getByRole("button", { name: "+ Add" }));
    const [firstPrice, secondPrice] = screen.getAllByPlaceholderText("25");
    const [firstRarity, secondRarity] = screen.getAllByPlaceholderText("2");
    await user.type(firstPrice, "12");
    await user.type(firstRarity, "2");
    await user.type(secondPrice, "30");
    await user.type(secondRarity, "8");
    await user.type(screen.getAllByPlaceholderText("+2d6")[1], "+2d6");
    await user.click(screen.getByLabelText("Add fluff"));
    await user.type(screen.getByPlaceholderText("Describe the item."), "Rusty but keen.");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(fakeApi.bodyOf("POST /items/")).toEqual({
      name: "Gutterblade",
      type: "Weapon",
      subtype: "Melee",
      single_use: false,
      description: "Rusty but keen.",
      strength: "S+1",
      range: null,
      save: null,
      statblock: null,
      property_ids: [501],
      availabilities: [
        { cost: 12, rarity: 2, variable_cost: null, restrictions: [] },
        { cost: 30, rarity: 8, variable_cost: "+2d6", restrictions: [] },
      ],
      campaign_id: 1,
    });
  });

  it("offers no Animal type: an Animal item is its beast's, written by the bestiary (flipped: it sent an Animal's statblock)", async () => {
    const user = setupUser();
    renderWithQueryClient(<AddItemForm campaignId={1} onCreated={vi.fn()} onCancel={vi.fn()} />);

    act(() => typeSelect().focus());
    await user.keyboard("{Enter}");

    const options = (await screen.findAllByRole("option")).map((option) => option.textContent);
    expect(options).toEqual(["Weapon", "Armour", "Miscellaneous"]);
    expect(screen.queryByText("Statblock")).toBeNull();
  });

  it("refuses a negative price before sending, as it refuses a rarity outside 2 to 20, each under its own field (BUG-53, CAT-TEST-09)", async () => {
    const user = setupUser();
    renderWithQueryClient(<AddItemForm campaignId={1} onCreated={vi.fn()} onCancel={vi.fn()} />);
    await user.type(screen.getByPlaceholderText("Gutterblade"), "Debt");
    await chooseOption(user, typeSelect(), "Weapon");

    await user.type(screen.getByPlaceholderText("25"), "-5");
    await user.type(screen.getByPlaceholderText("2"), "21");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await expectFieldError(screen.getByPlaceholderText("25"), PRICE_HINT);
    await expectFieldError(screen.getByPlaceholderText("2"), RARITY_HINT);

    await user.clear(screen.getByPlaceholderText("2"));
    await user.type(screen.getByPlaceholderText("2"), "2");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await expectFieldError(screen.getByPlaceholderText("25"), PRICE_HINT);
    expect(screen.getByPlaceholderText("2")).toHaveAttribute("aria-invalid", "false");
    expect(fakeApi.countOf("POST /items/")).toBe(0);

    await user.clear(screen.getByPlaceholderText("25"));
    await user.type(screen.getByPlaceholderText("25"), "0");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(fakeApi.bodyOf("POST /items/")).toMatchObject({
      availabilities: [{ cost: 0, rarity: 2, variable_cost: null, restrictions: [] }],
    });
  });
});

describe("AddItemForm: edit", () => {
  it("PATCHes every field, with no campaign_id and availabilities without ids, restrictions carried over", async () => {
    const user = setupUser();
    const cleaver = {
      ...rustyCleaver,
      properties: [{ id: 501, name: "Parry", type: "Weapon" }],
      availabilities: [
        availability({
          id: 42,
          cost: 7,
          rarity: 3,
          restrictions: [{ ...restricted(81, "Forest Goblins"), additional_note: "one per model" }],
        }),
      ],
    };
    renderWithQueryClient(
      <AddItemForm
        campaignId={1}
        editingItem={cleaver}
        onCreated={vi.fn()}
        onUpdated={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    const name = screen.getByDisplayValue("Rusty Cleaver");
    await user.clear(name);
    await user.type(name, "Rustier Cleaver");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(fakeApi.calls()).toContain("PATCH /items/240/");
    expect(fakeApi.bodyOf("PATCH /items/240/")).toEqual({
      name: "Rustier Cleaver",
      type: "Weapon",
      subtype: "Melee",
      single_use: false,
      description: "",
      strength: "As user",
      range: "Close combat",
      save: null,
      statblock: null,
      property_ids: [501],
      availabilities: [
        {
          cost: 7,
          rarity: 3,
          variable_cost: null,
          restrictions: [{ restriction_id: 81, additional_note: "one per model" }],
        },
      ],
    });
  });
});

describe("ItemFormDialog: create", () => {
  it("POSTs the armour with its save, the same shape as AddItemForm", async () => {
    const user = setupUser();
    renderWithQueryClient(<ItemFormDialog mode="create" campaignId={1} onCreated={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add item" }));
    const dialog = screen.getByRole("dialog", { name: "Add Wargear" });

    await user.type(within(dialog).getByLabelText("Name"), "Gromril Plate");
    await chooseOption(user, within(dialog).getByRole("combobox", { name: "Type" }), "Armour");
    await user.type(within(dialog).getByLabelText("Save"), "4+");
    await user.type(within(dialog).getByLabelText("Price"), "150");
    await user.type(within(dialog).getByLabelText(/^Rarity/), "11");
    await user.click(within(dialog).getByRole("button", { name: "Add item" }));

    expect(fakeApi.bodyOf("POST /items/")).toEqual({
      name: "Gromril Plate",
      type: "Armour",
      subtype: "Armour",
      single_use: false,
      description: "",
      strength: null,
      range: null,
      save: "4+",
      statblock: null,
      property_ids: [],
      availabilities: [{ cost: 150, rarity: 11, variable_cost: null, restrictions: [] }],
      campaign_id: 1,
    });
  });
});
