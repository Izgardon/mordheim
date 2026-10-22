/**
 * What the item forms do with the server's refusals (backend PR A): a taken name (400
 * `name_taken`) shows on the name field, and the item validation 400s (DRF's shape, nested
 * per availability) show on the price, rarity and properties they name, all keeping the form open;
 * a field the form lacks is named in the line under it.
 */
import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LIST, PROPERTIES } from "@/test/catalogue-fixtures";
import { fakeApi } from "@/test/fake-api";
import { renderWithQueryClient } from "@/test/query-test-utils";
import { nameMatch, nameTaken, expectFieldError, validationError } from "@/test/refusals";
import { chooseOption } from "@/test/select-option";
import { setupUser } from "@/test/user-event";
import AddItemForm from "./AddItemForm";
import ItemFormDialog from "./ItemFormDialog";

vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api-client")>()),
  apiRequest: (await import("@/test/fake-api")).fakeApi.apiRequest,
}));

const taken = nameTaken("Rusty Cleaver", [
  nameMatch({ kind: "items", id: 240, name: "Rusty Cleaver", type: "Weapon", source: "campaign" }),
]);
const BELOW_ZERO = "Ensure this value is greater than or equal to 0.";
const OUT_OF_RANGE = "Ensure this value is less than or equal to 20.";
const NO_PROPERTY = 'Invalid pk "501" - object does not exist.';

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on(LIST.properties, PROPERTIES);
});

describe("AddItemForm: refusals", () => {
  function renderForm() {
    const onCreated = vi.fn();
    renderWithQueryClient(<AddItemForm campaignId={1} onCreated={onCreated} onCancel={vi.fn()} />);
    return { onCreated };
  }

  /** Fills in a Rusty Cleaver weapon at `price` gc, rarity `rarity`, and saves. */
  async function saveWeapon(user: ReturnType<typeof setupUser>, price = "7", rarity = "2") {
    await user.type(screen.getByPlaceholderText("Gutterblade"), "Rusty Cleaver");
    await chooseOption(user, screen.getByText("Select a type").closest("button")!, "Weapon");
    await user.type(screen.getByPlaceholderText("25"), price);
    await user.type(screen.getByPlaceholderText("2"), rarity);
    await user.click(screen.getByRole("button", { name: "Save" }));
  }

  it("shows a taken name on the name field and keeps the form open (name_taken)", async () => {
    const user = setupUser();
    fakeApi.fail("POST /items/", taken.error);
    const { onCreated } = renderForm();

    await saveWeapon(user);

    await expectFieldError(screen.getByPlaceholderText("Gutterblade"), taken.detail, {
      describedBy: true,
    });
    expect(screen.getByRole("button", { name: "Save" })).toBeVisible();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("shows the server's availability and property refusals on those fields (BUG-53, SEC-07)", async () => {
    const user = setupUser();
    fakeApi.fail(
      "POST /items/",
      validationError({ availabilities: [{ cost: [BELOW_ZERO] }], property_ids: [NO_PROPERTY] })
    );
    renderForm();

    await saveWeapon(user);

    await expectFieldError(screen.getByPlaceholderText("25"), BELOW_ZERO);
    expect(screen.getAllByText(NO_PROPERTY)).toHaveLength(1);
    expect(
      screen.getByPlaceholderText("Search properties...").closest("div.space-y-2")
    ).toHaveTextContent(NO_PROPERTY);
  });

  it("names a refused field the form doesn't show in the line under the form", async () => {
    const user = setupUser();
    fakeApi.fail(
      "POST /items/",
      validationError({ bestiary_entry_id: ['Invalid pk "9" - object does not exist.'] })
    );
    renderForm();

    await saveWeapon(user);

    expect(
      await screen.findByText('Bestiary entry: Invalid pk "9" - object does not exist.')
    ).toBeVisible();
  });
});

describe("ItemFormDialog: refusals", () => {
  it("shows a taken name on the name field and keeps the dialog open (name_taken)", async () => {
    const user = setupUser();
    fakeApi.fail("POST /items/", taken.error);
    const onCreated = vi.fn();
    renderWithQueryClient(<ItemFormDialog mode="create" campaignId={1} onCreated={onCreated} />);
    await user.click(screen.getByRole("button", { name: "Add item" }));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByLabelText("Name"), "Rusty Cleaver");
    await chooseOption(user, within(dialog).getByRole("combobox", { name: "Type" }), "Weapon");
    await user.type(within(dialog).getByLabelText("Price"), "7");
    await user.type(within(dialog).getByLabelText(/^Rarity/), "2");
    await user.click(within(dialog).getByRole("button", { name: "Add item" }));

    await expectFieldError(within(dialog).getByLabelText("Name"), taken.detail, {
      describedBy: true,
    });
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("refuses a negative price before sending, and shows a refused rarity on its row", async () => {
    const user = setupUser();
    fakeApi.fail(
      "POST /items/",
      validationError({ availabilities: [{}, { rarity: [OUT_OF_RANGE] }] })
    );
    renderWithQueryClient(<ItemFormDialog mode="create" campaignId={1} onCreated={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add item" }));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByLabelText("Name"), "Rusty Cleaver");
    await chooseOption(user, within(dialog).getByRole("combobox", { name: "Type" }), "Weapon");
    await user.type(within(dialog).getByLabelText("Price"), "-1");
    await user.type(within(dialog).getByLabelText(/^Rarity/), "2");

    await user.click(within(dialog).getByRole("button", { name: "Add item" }));
    expect(
      within(dialog).getByText("Availability 1: a price of 0 or more and a rarity are required.")
    ).toBeVisible();
    expect(fakeApi.countOf("POST /items/")).toBe(0);

    await user.clear(within(dialog).getByLabelText("Price"));
    await user.type(within(dialog).getByLabelText("Price"), "7");
    await user.click(within(dialog).getByRole("button", { name: "Add" }));
    const [, second] = within(dialog).getAllByLabelText("Price");
    const [, secondRarity] = within(dialog).getAllByLabelText(/^Rarity/);
    await user.type(second, "9");
    await user.type(secondRarity, "12");
    await user.click(within(dialog).getByRole("button", { name: "Add item" }));

    await expectFieldError(secondRarity, OUT_OF_RANGE);
  });
});
